import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { McpPairingRoutes, McpInventoryRoutes, McpGrantSchema } from '../../../../protocol/mcp.js';
import type { McpPairings } from './pairing.js';
import { LocalCommunityAccess } from './access.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
export const MCP_LOCAL_PUBLIC_PATHS = [
  McpPairingRoutes.mcpPair.path,
  McpPairingRoutes.mcpRedeem.path,
  ...[
    McpPairingRoutes.mcpLocalRead,
    McpPairingRoutes.mcpLocalPrepare,
    McpPairingRoutes.mcpLocalSubmit,
    McpPairingRoutes.mcpLocalRevoke,
    McpPairingRoutes.mcpLocalValidate,
  ].map((value) => value.path),
];
export function registerMcpPairingRoutes(
  app: FastifyInstance,
  service: McpPairings,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sharedProxyIps: readonly string[] = [],
) {
  const admit = createWindowLimiter(120, 300000, 2000, sharedProxyIps),
    admitRedeem = createWindowLimiter(240, 300000, 2000),
    id = (params: unknown) => z.object({ id: z.uuid() }).parse(params).id;
  const bearer = (value: string | undefined) => {
    if (!value?.startsWith('Bearer ')) throw new ApiError('MCP_TOKEN_REQUIRED', 401);
    return value.slice(7);
  };
  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/v1/mcp/')) return;
    if (!request.url.split('?')[0]?.endsWith('/redeem') && !admit(request.ip, Date.now()))
      throw new ApiError('RATE_LIMIT', 429);
    if (request.headers.origin && request.headers.origin !== service.frontend)
      throw new ApiError('ORIGIN_REJECTED', 403);
  });
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/v1/mcp/')) {
      reply.header('referrer-policy', 'no-referrer');
      if (!request.url.startsWith('/v1/mcp/releases/')) reply.header('cache-control', 'no-store');
    }
  });
  app.get(McpInventoryRoutes.mcpGrants.path, async (request) => {
    const account = await session(request.cookies[cookieName]);
    const rows = await service.pool.query<{ context: unknown }>(
      'SELECT context FROM mcp_local_grants WHERE account_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 32',
      [account.id],
    );
    return rows.rows.map((row) => McpGrantSchema.parse(row.context));
  });
  app.post(McpInventoryRoutes.mcpRevokeGrant.path, { bodyLimit: 1024 }, async (request) => {
    const account = await session(
        request.cookies[cookieName],
        typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
      ),
      input = McpInventoryRoutes.mcpRevokeGrant.input.parse(request.body);
    await service.pool.query(
      'UPDATE mcp_local_grants SET revoked_at=now() WHERE id=$1 AND account_id=$2',
      [input.id, account.id],
    );
    return { revoked: true };
  });
  app.post(McpPairingRoutes.mcpPair.path, { bodyLimit: 4096 }, async (request) =>
    service.begin(request.body),
  );
  app.get(McpPairingRoutes.mcpConsent.path, async (request) =>
    service.consent(await session(request.cookies[cookieName]), id(request.params)),
  );
  app.post(McpPairingRoutes.mcpApprove.path, { bodyLimit: 4096 }, async (request) =>
    service.approve(
      await session(
        request.cookies[cookieName],
        typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
      ),
      request.body,
    ),
  );
  app.post(McpPairingRoutes.mcpRedeem.path, { bodyLimit: 1024 }, async (request) => {
    const pairingId = id(request.params);
    if (!admitRedeem(request.ip + ':' + pairingId, Date.now()))
      throw new ApiError('RATE_LIMIT', 429);
    return service.redeem(
      pairingId,
      McpPairingRoutes.mcpRedeem.input.parse(request.body).codeVerifier,
    );
  });
  app.get(
    McpPairingRoutes.mcpLocalStatus.path,
    async (request) => (await service.authorize(bearer(request.headers.authorization))).grant,
  );
  app.post(McpPairingRoutes.mcpLocalRead.path, { bodyLimit: 4096 }, async (request) =>
    new LocalCommunityAccess(service, bearer(request.headers.authorization)).read(
      McpPairingRoutes.mcpLocalRead.input.parse(request.body),
    ),
  );
  app.post(McpPairingRoutes.mcpLocalPrepare.path, { bodyLimit: 16384 }, async (request) =>
    new LocalCommunityAccess(service, bearer(request.headers.authorization)).prepare(
      McpPairingRoutes.mcpLocalPrepare.input.parse(request.body),
    ),
  );
  app.post(McpPairingRoutes.mcpLocalSubmit.path, { bodyLimit: 16384 }, async (request) =>
    new LocalCommunityAccess(service, bearer(request.headers.authorization)).submitSigned(
      McpPairingRoutes.mcpLocalSubmit.input.parse(request.body),
    ),
  );
  app.post(McpPairingRoutes.mcpLocalValidate.path, { bodyLimit: 16384 }, async (request) =>
    new LocalCommunityAccess(service, bearer(request.headers.authorization)).validatePrepared(
      McpPairingRoutes.mcpLocalValidate.input.parse(request.body),
    ),
  );
  app.post(McpPairingRoutes.mcpLocalRevoke.path, { bodyLimit: 1024 }, async (request) => {
    McpPairingRoutes.mcpLocalRevoke.input.parse(request.body);
    return service.revoke(bearer(request.headers.authorization));
  });
}
