import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import {
  McpSetupRoutes,
  McpGrantSchema,
  McpOAuthClaimsSchema,
  McpConnectionInventorySchema,
  McpArtifactNameSchema,
} from '../../../../protocol/mcp.js';
import type { McpArtifacts } from './artifacts.js';
import type { McpPairings } from './pairing.js';
import { ApiError } from '../errors.js';
export function registerMcpSetupRoutes(
  app: FastifyInstance,
  service: McpPairings,
  artifacts: McpArtifacts | undefined,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
) {
  app.get(McpSetupRoutes.mcpRelease.path, async (_request, reply) => {
    if (!artifacts) throw new ApiError('MCP_DOWNLOAD_UNAVAILABLE', 503);
    return reply.header('cache-control', 'no-store').send(artifacts.manifest);
  });
  app.get('/v1/mcp/releases/:releaseId/files/:file', async (request, reply) => {
    const params = z
      .strictObject({ releaseId: z.string().regex(/^[a-f0-9]{64}$/), file: McpArtifactNameSchema })
      .parse(request.params);
    const release = artifacts?.findRelease(params.releaseId);
    if (!release) throw new ApiError('MCP_RELEASE_UNKNOWN', 404);
    const file = release.manifest.files.find((value) => value.name === params.file);
    if (!file) throw new ApiError('MCP_RELEASE_UNKNOWN', 404);
    const handle = await release.openFile(params.file);
    return reply
      .header('cache-control', 'public,max-age=31536000,immutable')
      .header('etag', '"' + file.sha256 + '"')
      .header('content-length', file.bytes)
      .header('content-disposition', 'attachment; filename="' + params.file + '"')
      .type('application/gzip')
      .send(handle.createReadStream({ start: 0, autoClose: true }));
  });
  app.get(McpSetupRoutes.mcpConnections.path, async (request) => {
    const account = await session(request.cookies[cookieName]);
    const [local, remote] = await Promise.all([
      service.pool.query<{ context: unknown; revoked_at: Date | null }>(
        'SELECT context,revoked_at FROM mcp_local_grants WHERE account_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 32',
        [account.id],
      ),
      service.pool.query<{
        id: string;
        context: unknown;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        'SELECT id,context,expires_at,revoked_at FROM mcp_oauth_families WHERE account_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 32',
        [account.id],
      ),
    ]);
    const context = z.object({
      clientId: McpOAuthClaimsSchema.shape.clientId,
      dao: McpOAuthClaimsSchema.shape.dao,
      memberId: McpOAuthClaimsSchema.shape.memberId,
      scopes: McpOAuthClaimsSchema.shape.scopes,
    });
    return McpConnectionInventorySchema.parse({
      local: local.rows.map((row) => ({
        grant: McpGrantSchema.parse(row.context),
        revoked: !!row.revoked_at,
      })),
      remote: remote.rows.map((row) => ({
        id: row.id,
        ...context.parse(row.context),
        expires: row.expires_at.toISOString(),
        revoked: !!row.revoked_at,
      })),
    });
  });
  app.post(McpSetupRoutes.mcpRevokeFamily.path, { bodyLimit: 1024 }, async (request) => {
    const account = await session(
        request.cookies[cookieName],
        typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
      ),
      input = McpSetupRoutes.mcpRevokeFamily.input.parse(request.body);
    await service.pool.query(
      'UPDATE mcp_oauth_families SET revoked_at=now() WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL',
      [input.id, account.id],
    );
    return { revoked: true };
  });
}
