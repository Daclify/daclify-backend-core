import { z } from 'zod';
import { McpOAuthClientSchema } from '../../../../protocol/mcp.js';
import { readBoundedResponse } from '../http.js';

export const CHATGPT_CLIENT_METADATA = 'https://chatgpt.com/oauth/client.json';
const PublishedClient = z.object({
  client_id: z.literal(CHATGPT_CLIENT_METADATA),
  redirect_uris: z.array(z.url().max(2048)).min(1).max(8),
  token_endpoint_auth_methods_supported: z.array(z.string().max(64)).min(1).max(8),
  response_types: z.array(z.string().max(64)).min(1).max(8),
  grant_types: z.array(z.string().max(64)).min(1).max(8),
});

export async function loadMcpOAuthClients(input: unknown) {
  const clients = z.array(McpOAuthClientSchema).max(32).parse(input);
  const chatgpt = clients.find((client) => client.clientId === CHATGPT_CLIENT_METADATA);
  if (chatgpt) {
    // Only this fixed provider URL is fetched; caller-supplied URLs never become network destinations.
    const response = await fetch(CHATGPT_CLIENT_METADATA, {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw Error('MCP_CLIENT_METADATA_UNAVAILABLE');
    }
    const document = PublishedClient.parse(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await readBoundedResponse(response, 16384),
        ),
      ),
    );
    if (
      !document.token_endpoint_auth_methods_supported.includes('none') ||
      !document.response_types.includes('code') ||
      !document.grant_types.includes('authorization_code') ||
      !document.grant_types.includes('refresh_token') ||
      chatgpt.redirectUris.some((uri) => !document.redirect_uris.includes(uri))
    )
      throw Error('MCP_CLIENT_METADATA_INVALID');
  }
  return clients;
}
