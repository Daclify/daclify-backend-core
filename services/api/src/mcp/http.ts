import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createMcpHttpHandler } from '../../../../packages/community-mcp/src/http.js';
import type { Account } from '../../../../protocol/api.js';
import { McpOAuthRoutes, McpOAuthAuthorizeSchema } from '../../../../protocol/mcp.js';
import type { McpOAuth } from './oauth.js';
import { RemoteCommunityAccess } from './remote-access.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import { pairedSignInApprovalExpires } from '../auth/intent.js';
export const MCP_HTTP_PUBLIC_PATHS = ['/mcp', '/mcp/oauth/token', '/mcp/oauth/revoke'];
const DiscoveryRequest = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.enum(['initialize', 'notifications/initialized', 'ping', 'tools/list']),
});
export function registerMcpHttpRoutes(
  app: FastifyInstance,
  service: McpOAuth,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sharedProxyIps: readonly string[] = [],
) {
  const handler = createMcpHttpHandler((context) => {
    return new RemoteCommunityAccess(service, context.authInfo?.token ?? '');
  });
  const admit = createWindowLimiter(120, 60000, 2000, sharedProxyIps);
  app.addHook('onClose', async () => handler.close());
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (!path?.startsWith('/mcp') && !path?.startsWith('/v1/mcp/oauth/')) return;
    reply.header('cache-control', 'no-store').header('referrer-policy', 'no-referrer');
    if (!admit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    if (request.headers.origin && request.headers.origin !== service.pairings.frontend)
      throw new ApiError('ORIGIN_REJECTED', 403);
  });
  app.get('/.well-known/oauth-protected-resource/mcp', async () => service.resourceMetadata());
  app.get('/.well-known/oauth-authorization-server/mcp/oauth', async () => service.metadata());
  app.get('/mcp/oauth/.well-known/oauth-authorization-server', async () => service.metadata());
  app.get('/mcp/oauth/authorize', async (request, reply) => {
    const values = new URL(request.url, service.pairings.api).searchParams;
    if (new Set(values.keys()).size !== values.size) throw new ApiError('INPUT_INVALID', 400);
    // OAuth ignores extension parameters; persist only the canonical DAO request.
    const input = McpOAuthAuthorizeSchema.parse(
      Object.fromEntries(
        [...values].filter(([name]) => Object.hasOwn(McpOAuthAuthorizeSchema.shape, name)),
      ),
    );
    const scopes = input.scope.split(' ');
    if (new Set(scopes).size !== scopes.length) throw new ApiError('INPUT_INVALID', 400);
    // No OIDC grant is issued; token responses report only supported Daclify scopes.
    const started = await service.begin({
      ...input,
      scope: scopes.filter((scope) => scope !== 'openid').join(' '),
    });
    return reply.redirect(started.consentUrl);
  });
  app.get(McpOAuthRoutes.mcpOAuthConsent.path, async (request) =>
    service.consent(
      await session(request.cookies[cookieName]),
      z.object({ id: z.uuid() }).parse(request.params).id,
    ),
  );
  app.get(McpOAuthRoutes.mcpOAuthSignInApproval.path, async (request) => {
    const token = request.cookies[cookieName],
      account = await session(token);
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    return { expires: await pairedSignInApprovalExpires(service.pairings.pool, account.id, token) };
  });
  app.post(McpOAuthRoutes.mcpOAuthApprove.path, { bodyLimit: 4096 }, async (request) =>
    service.approve(
      await session(
        request.cookies[cookieName],
        typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
      ),
      request.body,
    ),
  );
  // OAuth clients use form encoding; install only for this encapsulated resource.
  app.register(async (resource) => {
    if (resource.hasContentTypeParser('application/x-www-form-urlencoded'))
      resource.removeContentTypeParser('application/x-www-form-urlencoded');
    resource.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: 4096 },
      (_request, body, done) => {
        if (typeof body !== 'string') {
          done(new ApiError('INPUT_INVALID', 400));
          return;
        }
        const values = new URLSearchParams(body);
        if (new Set(values.keys()).size !== [...values.keys()].length) {
          done(new ApiError('INPUT_INVALID', 400));
          return;
        }
        done(null, Object.fromEntries(values));
      },
    );
    resource.post('/mcp/oauth/token', { bodyLimit: 4096 }, async (request, reply) => {
      try {
        return await service.token(request.body);
      } catch (cause) {
        if (cause instanceof ApiError || cause instanceof z.ZodError)
          return reply.code(400).send({ error: 'invalid_grant' });
        throw cause;
      }
    });
    resource.post('/mcp/oauth/revoke', { bodyLimit: 4096 }, async (request) => {
      const input = z
        .strictObject({
          token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          client_id: z.string().min(1).max(128),
          token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
        })
        .parse(request.body);
      return service.revokeToken(input.token, input.client_id);
    });
  });
  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    bodyLimit: 32768,
    handler: async (request, reply) => {
      if (request.headers.host !== new URL(service.pairings.api).host)
        throw new ApiError('HOST_REJECTED', 403);
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith('Bearer ')) {
        // Only the public catalog can be discovered before linking; never a tool call or batch.
        if (
          authorization ||
          request.method !== 'POST' ||
          !DiscoveryRequest.safeParse(request.body).success
        ) {
          reply.header(
            'www-authenticate',
            `Bearer resource_metadata="${service.pairings.api}/.well-known/oauth-protected-resource/mcp"`,
          );
          throw new ApiError('MCP_TOKEN_REQUIRED', 401);
        }
      }
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
      const current =
        token === undefined
          ? undefined
          : await service.authorizeToken(token).catch(() => {
              reply.header(
                'www-authenticate',
                `Bearer error="invalid_token", resource_metadata="${service.pairings.api}/.well-known/oauth-protected-resource/mcp"`,
              );
              throw new ApiError('MCP_TOKEN_REQUIRED', 401);
            });
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(name, value);
        else if (Array.isArray(value)) headers.set(name, value.join(', '));
      }
      headers.set('host', new URL(service.pairings.api).host);
      const controller = new AbortController();
      request.raw.on('aborted', () => controller.abort());
      reply.raw.on('close', () => controller.abort());
      const input = new Request(service.resource, {
        method: request.method,
        headers,
        signal: controller.signal,
        ...(request.method === 'POST' ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await handler.fetch(
        input,
        current && token !== undefined
          ? {
              authInfo: {
                token,
                clientId: current.claims.clientId,
                scopes: current.claims.scopes,
                expiresAt: current.claims.exp,
                resource: new URL(service.resource),
              },
            }
          : {},
      );
      reply.code(response.status);
      response.headers.forEach((value, name) => reply.header(name, value));
      if (!response.body) return reply.send();
      const body = response.body;
      return reply.send(
        Readable.from(
          (async function* () {
            const reader = body.getReader();
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                yield chunk.value;
              }
            } finally {
              await reader.cancel().catch(() => undefined);
              reader.releaseLock();
            }
          })(),
        ),
      );
    },
  });
}
