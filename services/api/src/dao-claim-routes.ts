import type { FastifyInstance } from 'fastify';
import type { Account } from '../../../protocol/api.js';
import { DaoClaimRoutes } from '../../../protocol/dao-claims.js';
import { DaoClaimLinks } from './dao-claims.js';
import { ApiError } from './errors.js';
import { createWindowLimiter } from './limits.js';
import { pairedSignInApprovalExpires } from './auth/intent.js';
import type { Pool } from 'pg';

export function registerDaoClaimRoutes(
  app: FastifyInstance,
  service: DaoClaimLinks,
  pool: Pool,
  cookie: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  spend: (id: string) => void,
  cardConfigured: boolean,
  sharedIps: readonly string[],
) {
  const previewLimit = createWindowLimiter(60, 60000, 600, sharedIps);
  const writeAccount = async (request: {
    cookies: Record<string, string | undefined>;
    headers: Record<string, unknown>;
  }) => {
    const account = await session(
      request.cookies[cookie],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    return account;
  };
  app.get(DaoClaimRoutes.daoClaimSignInApproval.path, async (request) => {
    const token = request.cookies[cookie];
    const account = await session(token);
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    return { expires: await pairedSignInApprovalExpires(pool, account.id, token) };
  });
  app.get(DaoClaimRoutes.daoClaimEligibility.path, async (request) =>
    service.eligibility(await session(request.cookies[cookie])),
  );
  app.get(DaoClaimRoutes.daoClaimList.path, async (request) =>
    service.list(await session(request.cookies[cookie])),
  );
  app.post(DaoClaimRoutes.daoClaimPreview.path, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (!previewLimit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return service.preview(DaoClaimRoutes.daoClaimPreview.input.parse(request.body).token);
  });
  app.post(DaoClaimRoutes.daoClaimIssue.path, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return service.issue(
      await writeAccount(request),
      DaoClaimRoutes.daoClaimIssue.input.parse(request.body),
    );
  });
  app.post(DaoClaimRoutes.daoClaimRevoke.path, async (request) =>
    service.revoke(
      await writeAccount(request),
      DaoClaimRoutes.daoClaimRevoke.input.parse(request.body).id,
    ),
  );
  app.post(DaoClaimRoutes.daoClaimConfirm.path, async (request) => {
    const account = await writeAccount(request);
    const input = DaoClaimRoutes.daoClaimConfirm.input.parse(request.body);
    if (input.method === 'card' && !cardConfigured)
      throw new ApiError('STRIPE_NOT_CONFIGURED', 503);
    return service.claim(account, input);
  });
}
