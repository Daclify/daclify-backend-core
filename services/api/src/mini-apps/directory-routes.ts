import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { MiniAppDirectoryRoutes as routes } from '../../../../protocol/mini-apps.js';
import type { DirectoryService } from './directory.js';
import { createWindowLimiter } from '../limits.js';
import { ApiError } from '../errors.js';
export function registerDirectoryRoutes(
  app: FastifyInstance,
  service: DirectoryService,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
) {
  const write = createWindowLimiter(30, 3600000, 2000);
  const account = async (request: FastifyRequest) =>
    session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
  app.get(routes.miniAppDirectory.path, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const query = routes.miniAppDirectory.query.parse(request.query);
    return service.list(
      query,
      query.mine ? (await session(request.cookies[cookieName])).id : undefined,
    );
  });
  app.get(routes.miniAppListingReports.path, async (request) => {
    const input = routes.miniAppListingReports.query.parse(request.query);
    return service.reports((await session(request.cookies[cookieName])).id, input.id, input.after);
  });
  app.addHook('preHandler', async (request) => {
    if (request.method === 'POST' && request.url.startsWith(routes.miniAppDirectory.path + '/')) {
      const current = await account(request);
      if (!write(current.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    }
  });
  app.post(routes.miniAppListingSubmit.path, { bodyLimit: 8192 }, async (request) =>
    service.submit(
      (await account(request)).id,
      routes.miniAppListingSubmit.input.parse(request.body),
    ),
  );
  app.post(routes.miniAppListingUpdate.path, { bodyLimit: 8192 }, async (request) => {
    const input = routes.miniAppListingUpdate.input.parse(request.body);
    return service.update((await account(request)).id, input.id, input.listing, input.withdraw);
  });
  app.post(routes.miniAppListingVerify.path, { bodyLimit: 1024 }, async (request) => {
    const input = routes.miniAppListingVerify.input.parse(request.body);
    return service.verify((await account(request)).id, input.id, input.complete);
  });
  app.post(routes.miniAppListingTransfer.path, { bodyLimit: 1024 }, async (request) => {
    const input = routes.miniAppListingTransfer.input.parse(request.body);
    return service.transfer((await account(request)).id, input.id, input.successorAccountId);
  });
  app.post(routes.miniAppListingReport.path, { bodyLimit: 2048 }, async (request) => {
    const input = routes.miniAppListingReport.input.parse(request.body);
    return service.report((await account(request)).id, input.id, input.reason);
  });
  app.post(routes.miniAppListingModerate.path, { bodyLimit: 1024 }, async (request) => {
    const input = routes.miniAppListingModerate.input.parse(request.body);
    return service.moderate((await account(request)).id, input.id, input.decision);
  });
}
