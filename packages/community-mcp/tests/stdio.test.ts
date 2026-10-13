import { readFileSync } from 'node:fs';
import { z } from 'zod';
const packageVersion = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))).version;
import { it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';
import { createStdioServer } from '../src/stdio.js';
import { createCommunityTools } from '../src/tools.js';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
it('creates the SDK server using the same bounded tools', async () => {
  const server = createStdioServer(
    createCommunityTools({
      read: async () => ({}),
      prepare: async () => {
        throw Error('unused');
      },
      submitSigned: async () => {
        throw Error('unused');
      },
    }),
  );
  expect(server).toBeInstanceOf(McpServer);
  await server.close();
});
it('runs a genuine SDK client against a separate stdio server process', async () => {
  const transport = new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('../dist/tests/stdio-fixture.js', import.meta.url))],
      stderr: 'pipe',
    }),
    client = new Client({ name: 'daclify-stdio-fixture', version: '1.0.0' });
  await client.connect(transport);
  try {
    expect(client.getServerVersion()).toEqual({
      name: 'daclify-community',
      version: packageVersion,
    });
    const tools = await client.listTools();
    expect(tools.tools.map((value) => value.name)).toContain('prepare_vote');
    expect(tools.tools.map((value) => value.name)).not.toContain('sign_transaction');
    expect((await client.callTool({ name: 'list_daos', arguments: {} })).isError).not.toBe(true);
    const rejected = await client.callTool({
      name: 'prepare_vote',
      arguments: { pollId: '1', optionId: '1', signingKey: 'PVT_fixture' },
    });
    expect(rejected.isError).toBe(true);
  } finally {
    await client.close();
  }
});
