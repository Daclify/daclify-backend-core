import { afterAll, beforeAll, it, expect } from 'vitest';
import { Pool } from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import { McpOAuth } from '../../services/api/src/mcp/oauth.js';
import { McpOAuthAuthorizeSchema } from '../../protocol/mcp.js';
import { CHATGPT_CLIENT_METADATA } from '../../services/api/src/mcp/clients.js';
import { McpPairings } from '../../services/api/src/mcp/pairing.js';
import { migrate } from '../../services/api/src/store.js';
const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || !new URL(url).pathname.endsWith('_test'))
  throw Error('Owned test database required');
const pool = new Pool({ connectionString: url });
const api = 'https://api.example';
let service: McpOAuth;
beforeAll(async () => {
  await migrate(pool);
  service = new McpOAuth(new McpPairings(pool, undefined, api, 'https://app.example'), [
    { clientId: 'official-sdk', redirectUris: ['https://client.example/callback'] },
  ]);
});
afterAll(async () => {
  await pool.end();
});
it('discovers a dedicated resource and refuses foreign tokens and unsafe authorization requests', async () => {
  expect(service.resourceMetadata().resource).toBe(api + '/mcp');
  expect(service.metadata().issuer).toBe(api + '/mcp/oauth');
  await expect(service.authorizeToken(randomBytes(32).toString('base64url'))).rejects.toThrow();
  const verifier = randomBytes(32).toString('base64url'),
    input = {
      response_type: 'code',
      client_id: 'official-sdk',
      redirect_uri: 'https://client.example/callback',
      resource: api + '/mcp',
      scope: 'daclify:read',
      state: 'fixture-state',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    };
  for (const change of [
    { resource: 'https://foreign.example/mcp' },
    { redirect_uri: 'https://client.example/other' },
    { code_challenge_method: 'plain' },
    { scope: 'daclify:admin' },
    { state: '' },
    { client_id: 'unregistered' },
  ])
    await expect(service.begin({ ...input, ...change })).rejects.toThrow();
  const request = await service.begin(input);
  expect(request.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(request.consentUrl).toContain('https://app.example/mcp/oauth/consent?request=');
  await expect(
    service.token({
      grant_type: 'authorization_code',
      code: randomBytes(32).toString('base64url'),
      code_verifier: verifier,
      client_id: 'official-sdk',
      redirect_uri: input.redirect_uri,
      resource: input.resource,
    }),
  ).rejects.toThrow();
});

import Fastify from 'fastify';
import { z } from 'zod';
import { registerMcpHttpRoutes } from '../../services/api/src/mcp/http.js';
it('accepts ChatGPT language hints and grants only supported DAO scopes', async () => {
  const oauth = new McpOAuth(service.pairings, [
      {
        clientId: CHATGPT_CLIENT_METADATA,
        redirectUris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
      },
    ]),
    app = Fastify(),
    input = {
      response_type: 'code',
      client_id: CHATGPT_CLIENT_METADATA,
      redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect',
      resource: oauth.resource,
      scope: 'openid daclify:read daclify:prepare daclify:submit',
      state: 'owned-chatgpt-regression',
      code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
      code_challenge_method: 'S256',
      ui_locales: 'en-US',
    };
  registerMcpHttpRoutes(app, oauth, 'session', async () => {
    throw Error('unused');
  });
  let requestId: string | undefined;
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/mcp/oauth/authorize?' + new URLSearchParams(input),
    });
    expect(response.statusCode, response.body).toBe(302);
    const location = new URL(z.url().parse(response.headers.location));
    expect(location.origin + location.pathname).toBe('https://app.example/mcp/oauth/consent');
    requestId = z.uuid().parse(location.searchParams.get('request'));
    const stored = await pool.query<{ request: unknown }>(
      'SELECT request FROM mcp_oauth_requests WHERE id=$1',
      [requestId],
    );
    expect(McpOAuthAuthorizeSchema.parse(stored.rows[0]?.request)).toEqual({
      response_type: input.response_type,
      client_id: input.client_id,
      redirect_uri: input.redirect_uri,
      resource: input.resource,
      scope: 'daclify:read daclify:prepare daclify:submit',
      state: input.state,
      code_challenge: input.code_challenge,
      code_challenge_method: input.code_challenge_method,
    });
  } finally {
    if (requestId) await pool.query('DELETE FROM mcp_oauth_requests WHERE id=$1', [requestId]);
    await app.close();
  }
});

it('preserves authorization checks and rejects duplicated parameters with OAuth hints', async () => {
  const app = Fastify(),
    input = {
      response_type: 'code',
      client_id: 'official-sdk',
      redirect_uri: 'https://client.example/callback',
      resource: service.resource,
      scope: 'openid daclify:read',
      state: 'owned-authorization-guards',
      code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
      code_challenge_method: 'S256',
      ui_locales: 'en-US',
    };
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ code: 'INPUT_INVALID' });
    return reply.send(error);
  });
  registerMcpHttpRoutes(app, service, 'session', async () => {
    throw Error('unused');
  });
  try {
    for (const change of [
      { scope: 'openid' },
      { scope: 'openid daclify:admin' },
      { scope: 'openid openid daclify:read' },
      { scope: 'openid daclify:read daclify:read' },
      { scope: 'openid ' + 'x'.repeat(129) },
      { resource: 'https://foreign.example/mcp' },
      { redirect_uri: 'https://client.example/other' },
      { client_id: 'unregistered' },
      { code_challenge_method: 'plain' },
      { code_challenge: 'invalid' },
      { state: '' },
      { state: 'x'.repeat(513) },
    ]) {
      const response = await app.inject({
        method: 'GET',
        url: '/mcp/oauth/authorize?' + new URLSearchParams({ ...input, ...change }),
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
      expect(response.headers.location).toBeUndefined();
    }
    for (const name of Object.keys(input)) {
      const query = new URLSearchParams(input);
      query.append(name, 'duplicate');
      const response = await app.inject({ method: 'GET', url: '/mcp/oauth/authorize?' + query });
      expect(response.statusCode).toBe(400);
      expect(response.headers.location).toBeUndefined();
    }
  } finally {
    await app.close();
  }
});

it('coexists with the ordinary app form parser and returns OAuth-shaped token errors', async () => {
  const app = Fastify();
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => done(null, body),
  );
  registerMcpHttpRoutes(app, service, 'session', async () => {
    throw Error('unused');
  });
  try {
    await app.ready();
    const response = await app.inject({
      method: 'POST',
      url: '/mcp/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload:
        'grant_type=refresh_token&resource=https%3A%2F%2Fapi.example%2Fmcp&client_id=official-sdk&refresh_token=' +
        randomBytes(32).toString('base64url'),
    });
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid_grant' });
  } finally {
    await app.close();
  }
});

it('discovers the authenticated tool catalog before linking an account', async () => {
  const app = Fastify();
  registerMcpHttpRoutes(app, service, 'session', async () => {
    throw Error('unused');
  });
  const headers = { host: 'api.example', accept: 'application/json, text/event-stream' };
  try {
    const initialized = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers,
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'catalog-client', version: '1' },
        },
      },
    });
    expect(initialized.statusCode, initialized.body).toBe(200);
    const listed = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers,
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    expect(listed.statusCode, listed.body).toBe(200);
    const event = listed.body.split('\n').find((line) => line.startsWith('data:'));
    const result = z
      .object({
        result: z.object({
          tools: z.array(
            z.object({
              name: z.string(),
              _meta: z.object({
                securitySchemes: z.array(
                  z.object({ type: z.literal('oauth2'), scopes: z.array(z.string()) }),
                ),
              }),
              annotations: z.object({
                readOnlyHint: z.boolean(),
                destructiveHint: z.boolean(),
                openWorldHint: z.boolean(),
              }),
            }),
          ),
        }),
      })
      .parse(JSON.parse(event ? event.slice(5).trim() : listed.body));
    expect(result.result.tools.map((tool) => tool.name)).toEqual([
      'list_daos',
      'get_membership',
      'list_activity',
      'prepare_proposal',
      'prepare_vote',
      'prepare_review',
      'prepare_activity',
      'submit_signed',
    ]);
    for (const tool of result.result.tools) {
      const scope = tool.name.startsWith('prepare_')
        ? 'daclify:prepare'
        : tool.name === 'submit_signed'
          ? 'daclify:submit'
          : 'daclify:read';
      expect(tool._meta.securitySchemes).toEqual([{ type: 'oauth2', scopes: [scope] }]);
      expect(tool.annotations.readOnlyHint).toBe(scope === 'daclify:read');
      expect(tool.annotations.destructiveHint).toBe(scope === 'daclify:submit');
    }
    expect(JSON.stringify(result)).not.toContain('accountId');
  } finally {
    await app.close();
  }
});

it('keeps tool calls, batches, foreign origins and invalid credentials protected during discovery', async () => {
  const app = Fastify();
  registerMcpHttpRoutes(app, service, 'session', async () => {
    throw Error('unused');
  });
  const headers = { host: 'api.example', accept: 'application/json, text/event-stream' };
  try {
    for (const payload of [
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_membership', arguments: {} },
      },
      { jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'private' } },
      [
        { jsonrpc: '2.0', id: 5, method: 'tools/list' },
        {
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: { name: 'get_membership', arguments: {} },
        },
      ],
    ]) {
      const response = await app.inject({ method: 'POST', url: '/mcp', headers, payload });
      expect(response.statusCode).toBe(401);
      expect(response.headers['www-authenticate']).toContain('resource_metadata=');
    }
    for (const authorization of [
      'Bearer ',
      'Basic foreign',
      'Bearer ' + randomBytes(32).toString('base64url'),
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { ...headers, authorization },
        payload: { jsonrpc: '2.0', id: 7, method: 'tools/list' },
      });
      expect(response.statusCode).toBe(401);
    }
    const origin = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { ...headers, origin: 'https://foreign.example' },
      payload: { jsonrpc: '2.0', id: 8, method: 'tools/list' },
    });
    expect(origin.statusCode).toBe(403);
    const host = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { ...headers, host: 'foreign.example' },
      payload: { jsonrpc: '2.0', id: 9, method: 'tools/list' },
    });
    expect(host.statusCode).toBe(403);
  } finally {
    await app.close();
  }
});
