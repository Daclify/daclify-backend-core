import { afterEach, expect, it, vi } from 'vitest';
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
afterEach(() => vi.unstubAllGlobals());

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
  await expect(loadMcpOAuthClients(registry)).rejects.toThrow();
});

it('bounds the document and refuses redirects or unavailable providers', async () => {
  for (const response of [
    new Response('redirect', { status: 302 }),
    new Response('unavailable', { status: 503 }),
    new Response('a'.repeat(16385)),
  ]) {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response));
    await expect(loadMcpOAuthClients(registry)).rejects.toThrow();
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
