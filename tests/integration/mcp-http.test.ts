import { afterAll, beforeAll, it, expect } from 'vitest';
import { Pool } from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import { McpOAuth } from '../../services/api/src/mcp/oauth.js';
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
import { registerMcpHttpRoutes } from '../../services/api/src/mcp/http.js';
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
