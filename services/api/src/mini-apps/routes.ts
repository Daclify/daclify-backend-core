import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { MiniAppsRoutes } from '../../../../protocol/mini-apps.js';
import type { MiniAppConnections } from './connections.js';
import { ApiError } from '../errors.js';
export function registerMiniAppsRoutes(
  app: FastifyInstance,
  connections: MiniAppConnections,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  spend: (id: string) => void,
) {
  app.get(MiniAppsRoutes.miniAppConnection.path, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const account = await session(request.cookies[cookieName]);
    const params = MiniAppsRoutes.miniAppConnection.params.parse(request.params);
    return connections.buildConnection(params.daoId, params.appId, account.id);
  });
  app.post(MiniAppsRoutes.checkMiniAppConnection.path, async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const account = await session(
      request.cookies[cookieName],
      request.headers['x-csrf-token']?.toString() ?? '',
    );
    spend(account.id);
    MiniAppsRoutes.checkMiniAppConnection.input.parse(request.body);
    const params = MiniAppsRoutes.checkMiniAppConnection.params.parse(request.params);
    const bundle = await connections.buildConnection(params.daoId, params.appId, account.id);
    return connections.checkConnection(bundle.binding);
  });
  app.get(MiniAppsRoutes.miniAppRelease.path, async (request, reply) => {
    const { releaseId } = MiniAppsRoutes.miniAppRelease.params.parse(request.params);
    const artifacts = connections.artifacts;
    if (!artifacts || releaseId !== artifacts.manifest.releaseId)
      throw new ApiError('MINI_APP_RELEASE_UNKNOWN', 404);
    return reply
      .header('cache-control', 'public,max-age=31536000,immutable')
      .header('etag', '"' + artifacts.manifestHash + '"')
      .type('application/json')
      .send(artifacts.manifestBytes.toString('utf8'));
  });
  app.get(MiniAppsRoutes.miniAppRelease.path + '/files/:file', async (request, reply) => {
    const params = z
      .strictObject({
        releaseId: MiniAppsRoutes.miniAppRelease.params.shape.releaseId,
        file: z.enum(['core.tgz', 'modules.tgz', 'starter.tgz']),
      })
      .parse(request.params);
    const artifacts = connections.artifacts;
    if (!artifacts || params.releaseId !== artifacts.manifest.releaseId)
      throw new ApiError('MINI_APP_RELEASE_UNKNOWN', 404);
    const metadata = artifacts.manifest.files.find((file) => file.name === params.file);
    if (!metadata) throw new ApiError('MINI_APP_ARTIFACT_INTEGRITY', 503);
    const handle = await artifacts.openFile(params.file).catch(() => {
      throw new ApiError('MINI_APP_ARTIFACT_INTEGRITY', 503);
    });
    return reply
      .header('cache-control', 'public,max-age=31536000,immutable')
      .header('etag', '"' + metadata.sha256 + '"')
      .header('content-length', metadata.bytes)
      .header('content-disposition', 'attachment; filename="' + params.file + '"')
      .type('application/gzip')
      .send(handle.createReadStream({ start: 0, autoClose: true }));
  });
}
