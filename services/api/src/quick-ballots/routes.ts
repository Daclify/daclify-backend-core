import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { QuickAccountRoutes } from '../../../../protocol/quick-accounts.js';
import { IdSchema } from '../../../../protocol/base.js';
import { QuickBallotRoutes } from '@daclify/modules';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import type { QuickBallots } from './service.js';
import type { QuickBallotArchives } from './archives.js';

export function registerQuickBallotRoutes(
  app: FastifyInstance,
  service: QuickBallots | undefined,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  spend: (id: string) => void,
  archives?: Pick<QuickBallotArchives, 'history'>,
) {
  const readLimit = createWindowLimiter(120, 60000, 2000);
  const archiveLimit = createWindowLimiter(6, 60_000, 60);
  let archiveReads = 0;
  const required = () => {
    if (!service) throw new ApiError('QUICK_UNAVAILABLE', 503);
    return service;
  };
  app.get(QuickAccountRoutes.quickAccountStatus.path, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const account = await session(request.cookies[cookieName]);
    return service ? service.status(account.id) : { available: false, context: null };
  });
  for (const route of [
    QuickAccountRoutes.quickAccountPrepare,
    QuickAccountRoutes.quickAccountSubmit,
  ]) {
    app.post(route.path, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const token = request.cookies[cookieName],
        account = await session(
          token,
          typeof request.headers['x-csrf-token'] === 'string'
            ? request.headers['x-csrf-token']
            : '',
        );
      if (!token) throw new ApiError('AUTH_REQUIRED', 401);
      spend(account.id);
      return route === QuickAccountRoutes.quickAccountPrepare
        ? required().prepare(account.id, token, request.body)
        : required().submit(account.id, token, request.body);
    });
  }
  for (const route of [QuickBallotRoutes.quickAdvance, QuickBallotRoutes.quickFinalize]) {
    app.post(route.path, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const account = await session(
        request.cookies[cookieName],
        typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
      );
      spend(account.id);
      const { ballotId } = z.object({ ballotId: IdSchema }).parse(request.params);
      if (route === QuickBallotRoutes.quickAdvance) {
        route.input.parse(request.body);
        return required().chain.advance(ballotId);
      }
      return required().chain.finalize(ballotId, route.input.parse(request.body));
    });
  }
  for (const [name, route] of Object.entries(QuickBallotRoutes)) {
    if (route.method !== 'GET') continue;
    app.get(route.path, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      if (!readLimit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
      if (name === 'quickList')
        return service
          ? service.chain.list(request.query)
          : { available: false, experimental: true, domain: null, ballots: [], next: null };
      const params = z
        .object({ ballotId: IdSchema.optional(), id: IdSchema.optional() })
        .parse(request.params);
      if (name === 'quickReaders' && params.id) return required().chain.readers(params.id);
      if (!params.ballotId) throw new ApiError('INPUT_INVALID', 400);
      if (name === 'quickArchive') {
        if (!archives) throw new ApiError('QUICK_ARCHIVE_UNAVAILABLE', 503);
        if (archiveReads >= 2 || !archiveLimit(request.ip, Date.now()))
          throw new ApiError('RATE_LIMIT', 429);
        archiveReads++;
        try {
          return await archives.history(params.ballotId);
        } finally {
          archiveReads--;
        }
      }
      if (name === 'quickDetail') return required().chain.detail(params.ballotId);
      if (name === 'quickResponses')
        return required().chain.responses(params.ballotId, request.query);
      if (name === 'quickOwnResponse')
        return required().chain.ownResponse(params.ballotId, request.query);
      throw new ApiError('QUICK_UNAVAILABLE', 503);
    });
  }
}
