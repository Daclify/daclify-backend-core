import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from '../services/api/src/server.js';
import { authChain } from './helpers/auth-chain.js';
import { loadMcpOAuthClients } from '../services/api/src/mcp/clients.js';
import { McpOAuth } from '../services/api/src/mcp/oauth.js';
import { McpPairings } from '../services/api/src/mcp/pairing.js';
import { Pool } from 'pg';

const clientId = 'https://chatgpt.com/oauth/client.json';
const redirect = 'https://chatgpt.com/connector_platform_oauth_redirect';
const registry = [{ clientId, redirectUris: [redirect] }];
const document = {
  client_id: clientId,
  redirect_uris: [redirect],
  token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('validates the exact published ChatGPT public client before advertising metadata support', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(document));
  vi.stubGlobal('fetch', fetcher);
  const clients = await loadMcpOAuthClients(registry);
  expect(clients).toEqual(registry);
  expect(fetcher).toHaveBeenCalledWith(
    clientId,
    expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }),
  );
  const oauth = new McpOAuth(
    new McpPairings(new Pool(), undefined, 'https://api.example', 'https://app.example'),
    clients,
  );
  expect(oauth.metadata()).toMatchObject({
    client_id_metadata_document_supported: true,
    token_endpoint_auth_methods_supported: ['none'],
  });
});

it.each([
  { ...document, client_id: 'https://evil.example/client.json' },
  { ...document, redirect_uris: ['https://evil.example/callback'] },
  { ...document, token_endpoint_auth_methods_supported: ['private_key_jwt'] },
  { ...document, grant_types: ['client_credentials'] },
  { ...document, response_types: ['token'] },
])('refuses incompatible or substituted published metadata', async (metadata) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json(metadata)));
  await expect(loadMcpOAuthClients(registry)).resolves.toEqual([]);
});

it('bounds the document and refuses redirects or unavailable providers', async () => {
  for (const response of [
    new Response('redirect', { status: 302 }),
    new Response('unavailable', { status: 503 }),
    new Response('a'.repeat(16385)),
  ]) {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response));
    await expect(loadMcpOAuthClients(registry)).resolves.toEqual([]);
  }
});

it('does not fetch arbitrary client URLs and leaves preregistered clients available without ChatGPT', async () => {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  const clients = [
    {
      clientId: 'https://evil.example/client.json',
      redirectUris: ['https://app.example/callback'],
    },
  ];
  expect(await loadMcpOAuthClients(clients)).toEqual(clients);
  expect(fetcher).not.toHaveBeenCalled();
  const oauth = new McpOAuth(
    new McpPairings(new Pool(), undefined, 'https://api.example', 'https://app.example'),
    clients,
  );
  expect(oauth.metadata()).not.toHaveProperty('client_id_metadata_document_supported');
});

it.each(['503', 'network', 'timeout', 'invalid-json'])(
  'keeps ordinary API and other registered clients available during ChatGPT metadata %s',
  async (failure) => {
    const fetcher = vi.fn<typeof fetch>();
    if (failure === '503') fetcher.mockResolvedValue(new Response('', { status: 503 }));
    else if (failure === 'invalid-json') fetcher.mockResolvedValue(new Response('{'));
    else fetcher.mockRejectedValue(new Error(failure));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const other = { clientId: 'claude-code', redirectUris: ['http://127.0.0.1:3456/callback'] };
    const pool = new Pool();
    try {
      for (const configured of [registry, [...registry, other]]) {
        const clients = await loadMcpOAuthClients(configured);
        expect(clients).toEqual(configured.length === 1 ? [] : [other]);
        const oauth = clients.length
          ? new McpOAuth(
              new McpPairings(pool, undefined, 'https://api.example', 'https://app.example'),
              clients,
            )
          : undefined;
        const app = await createServer(pool, authChain, 'https://app.example', {
          ...(oauth ? { mcpOAuth: oauth } : {}),
        });
        try {
          expect((await app.inject('/v1/network')).statusCode).toBe(200);
          const response = await app.inject('/.well-known/oauth-authorization-server/mcp/oauth');
          expect(response.statusCode).toBe(oauth ? 200 : 404);
          if (oauth)
            expect(response.json()).not.toHaveProperty('client_id_metadata_document_supported');
        } finally {
          await app.close();
        }
      }
    } finally {
      await pool.end();
    }
  },
);
it('still rejects empty or malformed operator configuration before any provider call', async () => {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  for (const input of [
    [],
    null,
    [...registry, ...registry],
    [{ clientId, redirectUris: ['javascript:alert(1)'] }],
    [{ clientId, redirectUris: ['not-a-url'] }],
  ])
    await expect(loadMcpOAuthClients(input)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
