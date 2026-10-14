import { it, expect, vi } from 'vitest';
import { mcpRequest } from '../src/local-client.js';
it('reports only reviewed actionable codes from an HTTP failure', async () => {
  const fake = vi.spyOn(globalThis, 'fetch');
  try {
    fake.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'MCP_GRANT_REVOKED', message: 'private provider diagnostic' }),
        { status: 401 },
      ),
    );
    await expect(mcpRequest('https://api.example', '/v1/mcp/local/status')).rejects.toThrow(
      'MCP_GRANT_REVOKED',
    );
    fake.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'unreviewed private provider value',
          message: 'private provider diagnostic',
        }),
        { status: 500 },
      ),
    );
    await expect(mcpRequest('https://api.example', '/v1/mcp/local/status')).rejects.toThrow(
      'MCP_API_REJECTED',
    );
  } finally {
    fake.mockRestore();
  }
});
