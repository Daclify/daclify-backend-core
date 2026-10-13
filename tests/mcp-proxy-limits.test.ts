import { expect, it } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { Pool } from 'pg';
import { McpPairings } from '../services/api/src/mcp/pairing.js';
import { McpOAuth } from '../services/api/src/mcp/oauth.js';
import { registerMcpHttpRoutes } from '../services/api/src/mcp/http.js';
import { registerMcpPairingRoutes } from '../services/api/src/mcp/routes.js';
import { ApiError } from '../services/api/src/errors.js';
import { ApiRoutes } from '../protocol/routes.js';

for (const transport of ['local', 'hosted'] as const) {
  it(`${transport} MCP preserves bounded shared-proxy admission without trusting forwarded addresses`, async () => {
    const pool = new Pool(),
      app = Fastify(),
      pairings = new McpPairings(pool, undefined, 'https://api.example', 'https://app.example'),
      shared = '192.0.2.1';
    await app.register(cookie);
    const session = async () => {
      throw new ApiError('AUTH_REQUIRED', 401);
    };
    if (transport === 'hosted')
      registerMcpHttpRoutes(app, new McpOAuth(pairings, []), 'session', session, [shared]);
    else registerMcpPairingRoutes(app, pairings, 'session', session, [shared]);
    const request = (remoteAddress: string, forwarded?: string) =>
      app.inject({
        remoteAddress,
        method: transport === 'hosted' ? 'POST' : 'GET',
        url: transport === 'hosted' ? '/mcp' : ApiRoutes.mcpGrants.path,
        headers: { host: 'api.example', ...(forwarded ? { 'x-forwarded-for': forwarded } : {}) },
        ...(transport === 'hosted'
          ? {
              payload: {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: { name: 'get_membership', arguments: {} },
              },
            }
          : {}),
      });
    try {
      for (let count = 0; count < 121; count++)
        expect((await request(shared)).statusCode).toBe(401);
      for (const ordinary of ['192.0.2.2', '192.0.2.3']) {
        for (let count = 0; count < 120; count++)
          expect((await request(ordinary, shared)).statusCode).toBe(401);
        expect((await request(ordinary, shared)).statusCode).toBe(429);
      }
      for (let count = 361; count < 2000; count++)
        expect((await request(shared)).statusCode).toBe(401);
      expect((await request(shared)).statusCode).toBe(429);
    } finally {
      await app.close();
      await pool.end();
    }
  });
}
