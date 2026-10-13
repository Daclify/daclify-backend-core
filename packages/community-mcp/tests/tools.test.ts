import { it, expect } from 'vitest';
import { createCommunityTools } from '../src/tools.js';
import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server';
import { Client } from '@modelcontextprotocol/client';
import { ProtectedCommunitySigner } from '../src/signer.js';
import { PrivateKey } from '@wharfkit/antelope';
it('exposes only the bounded community tool inventory without a local signer', () => {
  const tools = createCommunityTools({
    read: async () => ({}),
    prepare: async () => {
      throw Error('unused');
    },
    submitSigned: async () => {
      throw Error('unused');
    },
  });
  expect(tools.names()).toEqual([
    'list_daos',
    'get_membership',
    'list_activity',
    'prepare_proposal',
    'prepare_activity',
    'prepare_vote',
    'prepare_review',
    'submit_signed',
  ]);
  expect(tools.names()).not.toContain('sign_transaction');
  expect(tools.names()).not.toContain('submit_prepared');
});
it('uses a genuine stable SDK client for discovery, calls, validation and shutdown', async () => {
  const calls: unknown[] = [];
  const tools = createCommunityTools({
    read: async (input) => {
      calls.push(input);
      return { daos: [] };
    },
    prepare: async () => {
      throw Error('private credential must not be logged');
    },
    submitSigned: async () => {
      throw Error('unused');
    },
  });
  const server = new McpServer({ name: 'daclify-test', version: '0.1.0' });
  tools.register(server);
  const client = new Client({ name: 'daclify-fixture', version: '0.1.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual(
      tools.names().sort(),
    );
    const result = await client.callTool({ name: 'list_daos', arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(calls).toEqual([{ tool: 'list_daos', input: {} }]);
    const bad = await client.callTool({
      name: 'prepare_vote',
      arguments: { pollId: '1', optionId: '1', target: 'foreign' },
    });
    expect(bad.isError).toBe(true);
    expect(JSON.stringify(bad)).not.toContain('private credential');
  } finally {
    await client.close();
    await server.close();
  }
});
it('requires the protected signer and denies arbitrary signing methods', async () => {
  const access = {
    read: async () => ({}),
    prepare: async () => {
      throw Error('unused');
    },
    submitSigned: async () => {
      throw Error('unused');
    },
  };
  expect(() =>
    createCommunityTools(access, {
      signLoginMessage: async () => '',
      signInstruction: async () => '',
    }),
  ).toThrow('MCP_UNQUALIFIED_SIGNER');
  const key = PrivateKey.generate('K1');
  const signer = new ProtectedCommunitySigner(
    {
      validatePrepared: async () => {
        throw Error('current permission revoked');
      },
    },
    key.toString(),
  );
  expect(createCommunityTools(access, signer).names()).toContain('submit_prepared');
  await expect(signer.signLoginMessage()).rejects.toThrow('MCP_ROOT_CEREMONY_REQUIRED');
});
