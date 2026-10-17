import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { ApiRoutes } from '../../protocol/index.js';
import { encodeAction } from '../../sdk/index.js';
import { encodeDecide } from '@daclify/modules/sdk';
import { mcpFixture } from '../helpers/mcp-fixture.js';
import { LocalCommunityClient } from '../../packages/community-mcp/src/local-client.js';
import { createCommunityTools } from '../../packages/community-mcp/src/tools.js';

let fixture: Awaited<ReturnType<typeof mcpFixture>>;
beforeAll(async () => {
  fixture = await mcpFixture();
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('keeps encrypted descriptions out of public API and MCP projections and refuses an unread private vote', async () => {
  const current = await fixture.paired(0, [], 2),
    dao = current.dao;
  const title = 'Secret identity café canary',
    question = 'Secret question café canary';
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const sealed = async (text: string) => {
    const iv = randomBytes(12),
      ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(text),
      );
    return JSON.stringify({
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: iv.toString('base64'),
      ciphertext: Buffer.from(ciphertext).toString('base64'),
    });
  };
  // This fixture qualifies projections, not grant recovery; real grant recovery is tested in browsers.
  await dao.act(
    'daclifycore',
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: '1',
      commitment: 'ab'.repeat(32),
      self_grant: '{}',
    }),
  );
  const references = [];
  for (const [index, text] of [title, question].entries()) {
    const value = await sealed(text),
      documentId = String(881 + index);
    await dao.act(
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        ...dao.actor(),
        document_id: documentId,
        version: 1,
        value,
        envelope_version: 1,
        key_epoch: '1',
      }),
    );
    references.push({
      documentId,
      version: 1,
      commitment: createHash('sha256').update(value).digest('hex'),
      keyEpoch: '1',
    });
  }
  const identity = references[0],
    ballot = references[1];
  if (!identity || !ballot) throw Error('OWNED_REFERENCES_REQUIRED');
  await dao.act(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', {
      ...dao.actor(),
      expected: createHash('sha256').update('{}').digest('hex'),
      metadata: JSON.stringify({
        schemaVersion: 4,
        title: 'Private DAO',
        description: '',
        purpose: 'custom',
        setup: null,
        privateIdentity: identity,
      }),
    }),
  );
  await dao.act(
    'decide',
    'openpoll',
    encodeDecide('openpoll', {
      ...dao.actor(),
      ballot_id: '882',
      kind: 0,
      choices: 2,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: JSON.stringify({
        schemaVersion: 4,
        semantics: 'poll',
        options: [0, 1],
        privateContent: ballot,
      }),
    }),
  );
  const projections = [
    await fixture.chain.dao(dao.daoId),
    await fixture.chain.content(dao.daoId),
    await fixture.chain.moduleState(dao.daoId),
  ];
  const response = await fixture.server.inject({
    method: 'GET',
    url: ApiRoutes.dao.path.replace(':id', dao.daoId),
    headers: current.headers,
  });
  expect(response.statusCode).toBe(200);
  const summary = ApiRoutes.dao.response.parse(response.json());
  expect(summary.title).toBe('Private DAO');
  projections.push(summary);
  const client = new LocalCommunityClient({
    version: 1,
    api: fixture.api,
    grantToken: current.grant.token,
    delegateKey: current.delegate.toString(),
    grantId: current.grant.grant.id,
  });
  const tools = createCommunityTools(client);
  const reads = [
    await tools.call('list_daos', {}),
    await tools.call('get_membership', {}),
    await tools.call('list_activity', {}),
  ];
  for (const output of [...projections, ...reads]) {
    expect(JSON.stringify(output)).not.toContain(title);
    expect(JSON.stringify(output)).not.toContain(question);
    expect(JSON.stringify(output)).not.toContain(current.root.toString());
  }
  await expect(tools.call('prepare_vote', { pollId: '882', optionId: '1' })).rejects.toThrow(
    'MCP_PUBLIC_DAO_REQUIRED',
  );
}, 60000);
