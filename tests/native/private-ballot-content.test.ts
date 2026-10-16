import { beforeAll, afterAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync, statSync } from 'node:fs';
import { z } from 'zod';
import {
  encodeDecide,
  encodeWorks,
  ballotCommitment,
  ModuleCodeHashes,
} from '@daclify/modules/sdk';
import { encodeAction, RuntimeCodeHash } from '../../sdk/index.js';
import {
  nativeContracts,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let fixture: NativeContracts | undefined, dao: DummyDao;
function f() {
  if (!fixture) throw Error('OWNED_FIXTURE_REQUIRED');
  return fixture;
}
beforeAll(async () => {
  fixture = await nativeContracts();
  dao = await fixture.dummyDao('alice', true, 0, [], 2);
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('verifies private ballot authority, retained bodies, version4 funding targets and native resource use', async () => {
  const beforeTotals = await dao.totals();
  await dao.act(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', {
      ...dao.actor(),
      metadata: JSON.stringify({
        schemaVersion: 4,
        title: 'Private DAO',
        description: '',
        purpose: 'custom',
        setup: null,
        privateIdentity: null,
      }),
      expected: createHash('sha256').update('{}').digest('hex'),
    }),
  );
  await dao.act(
    'daclifycore',
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: '1',
      commitment: 'ac'.repeat(32),
      self_grant: '{}',
    }),
  );
  const envelope = JSON.stringify({
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: btoa('i'.repeat(12)),
      ciphertext: btoa('c'.repeat(32)),
    }),
    commitment = createHash('sha256').update(envelope).digest('hex');
  const ram = async () =>
    Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage.toString());
  const beforeBody = await ram();
  for (const id of ['41', '42'])
    await dao.act(
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        ...dao.actor(),
        document_id: id,
        version: 1,
        value: envelope,
        envelope_version: 1,
        key_epoch: '1',
      }),
    );
  const bodyRam = (await ram()) - beforeBody;
  const pollMetadata = JSON.stringify({
    schemaVersion: 4,
    semantics: 'poll',
    options: [0, 1, 2],
    privateContent: { documentId: '41', version: 1, keyEpoch: '1', commitment },
  });
  const beforeOpen = await ram();
  const opened = await dao.act(
    'decide',
    'openpoll',
    encodeDecide('openpoll', {
      ...dao.actor(),
      ballot_id: '41',
      kind: 0,
      choices: 3,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: pollMetadata,
    }),
  );
  const openingRam = (await ram()) - beforeOpen;
  let state = await dao.state();
  const ballot = state.ballots.find((row) => row.id === '41'),
    definition = state.ballotDefinitions.find((row) => row.ballot_id === '41');
  if (!ballot || !definition) throw Error('private ballot missing');
  expect(definition.version).toBe(3);
  expect(
    ballotCommitment({
      chainId: f().chainId,
      runtime: dao.reference.contract,
      decide: 'decide',
      ballot,
      definition,
    }),
  ).toBe(definition.commitment);
  await expect(
    dao.act('decide', 'vote', encodeDecide('vote', { ...dao.actor(), ballot_id: '41', choice: 2 })),
  ).rejects.toThrow('BALLOT_COMMITMENT_REQUIRED');
  await dao.act(
    'decide',
    'votecommit',
    encodeDecide('votecommit', {
      ...dao.actor('2'),
      ballot_id: '41',
      choice: 2,
      expected: definition.commitment,
    }),
    '2',
  );
  await dao.act(
    'works',
    'propose',
    encodeWorks('propose', {
      ...dao.actor(),
      project_id: '7',
      contributor: '2',
      document_id: '41',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [Math.floor(Date.now() / 1000) + 600],
    }),
  );
  const fundingMetadata = JSON.stringify({
    schemaVersion: 4,
    semantics: 'proposal',
    options: [0, 1],
    privateContent: { documentId: '42', version: 1, keyEpoch: '1', commitment },
  });
  await dao.act(
    'decide',
    'openwork',
    encodeDecide('openwork', {
      ...dao.actor(),
      ballot_id: '42',
      works: 'works',
      project_id: '7',
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: fundingMetadata,
    }),
  );
  state = await dao.state();
  const funded = state.ballots.find((row) => row.id === '42'),
    marker = state.ballotDefinitions.find((row) => row.ballot_id === '42'),
    execution = state.executions.find((row) => row.ballot_id === '42'),
    target = state.ballotTargets.find((row) => row.ballot_id === '42');
  if (!funded || !marker || !target || !execution) throw Error('private funding target missing');
  expect(marker.version).toBe(4);
  expect(
    ballotCommitment({
      chainId: f().chainId,
      runtime: dao.reference.contract,
      decide: 'decide',
      ballot: funded,
      definition: marker,
      execution,
      target,
    }),
  ).toBe(marker.commitment);
  expect(target.work?.project.id).toBe('7');
  expect((await dao.totals()).available).toBe(beforeTotals.available);
  expect((await f().gateway.network()).capabilities).toContain('private-ballot-content-v1');
  const refs = await f().api.v1.chain.get_table_rows({
    code: dao.reference.contract,
    scope: dao.daoId,
    table: 'docrefs',
    limit: 50,
  });
  const references = z
    .array(z.object({ source: z.string(), table: z.string(), document_id: z.coerce.string() }))
    .parse(refs.rows);
  for (const id of ['41', '42'])
    expect(references).toContainEqual(
      expect.objectContaining({ source: 'decide', table: 'ballotdefs', document_id: id }),
    );
  const cpu = z.object({ receipt: z.object({ cpu_usage_us: z.number() }) }).parse(opened.processed)
    .receipt.cpu_usage_us;
  writeFileSync(
    '.artifacts/native/private-ballot-resources.json',
    JSON.stringify(
      {
        runtimeCodeHash: RuntimeCodeHash,
        decideCodeHash: ModuleCodeHashes.decide,
        runtimeWasmBytes: statSync('.artifacts/contracts/runtime.wasm').size,
        decideWasmBytes: statSync('../daclify-backend-modules/.artifacts/contracts/decide.wasm')
          .size,
        encryptedInlineDocuments: 2,
        encryptedDocumentPublicationRamBytes: bodyRam,
        privateOpeningRamBytes: openingRam,
        privateOpeningCpuUs: cpu,
        newTables: 0,
        newSecondaryIndexes: 0,
        maximumDocumentSourceFamilies: 5,
        note: 'Owned local Spring native permission/resource check; synthetic envelopes do not qualify decryption. Real cryptography is covered by browser/unit checks. Opening RAM includes document-source registration, retained reference and existing ballot bookkeeping. Not a network price/CPU guarantee.',
      },
      null,
      2,
    ) + '\n',
  );
});
