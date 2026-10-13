import { readFileSync } from 'node:fs';
import { z } from 'zod';
const packageVersion = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))).version;
import { it, expect } from 'vitest';
import { createMcpHttpHandler } from '../src/http.js';
it('creates the genuine SDK HTTP handler without a local signing tool', async () => {
  const handler = createMcpHttpHandler(() => ({
    read: async () => ({ daos: [] }),
    prepare: async () => {
      throw Error('unused');
    },
    submitSigned: async () => {
      throw Error('unused');
    },
  }));
  expect(typeof handler.fetch).toBe('function');
  await handler.close();
});

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
it('initializes two genuine HTTP clients without sharing authenticated context', async () => {
  const observed: string[] = [];
  const handler = createMcpHttpHandler((context) => ({
    read: async () => {
      if (!context.authInfo) throw Error('authentication absent');
      observed.push(context.authInfo.clientId);
      return { principal: context.authInfo.clientId };
    },
    prepare: async () => {
      throw Error('unused');
    },
    submitSigned: async () => {
      throw Error('unused');
    },
  }));
  const clients = [
    new Client({ name: 'one', version: '1' }),
    new Client({ name: 'two', version: '1' }),
  ];
  try {
    for (const [index, client] of clients.entries()) {
      const transport = new StreamableHTTPClientTransport(new URL('https://api.example/mcp'), {
        fetch: async (input, init) => {
          const request = new Request(input, init);
          return handler.fetch(request, {
            authInfo: {
              token: 'test-only-transport-token',
              clientId: String(index),
              scopes: ['daclify:read'],
              resource: new URL('https://api.example/mcp'),
            },
          });
        },
      });
      await client.connect(transport);
      expect(client.getServerVersion()).toEqual({
        name: 'daclify-community',
        version: packageVersion,
      });
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).not.toContain('submit_prepared');
      const result = await client.callTool({ name: 'get_membership', arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(JSON.stringify(result)).toContain('principal');
    }
    expect(observed).toEqual(['0', '1']);
  } finally {
    for (const client of clients) await client.close();
    await handler.close();
  }
});
