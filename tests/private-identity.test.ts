import { expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { createHash } from 'node:crypto';
import { MetadataSchema, defaultDaoSetup } from '../protocol/dao.js';
import { loadContract, row, send } from './helpers/vert.js';
import {
  encodeAction,
  instructionDigest,
  makeInstruction,
  RuntimeActionSchemas,
} from '../sdk/index.js';
import { z } from 'zod';

const metadata = {
  schemaVersion: 4,
  title: 'Private DAO',
  description: '',
  purpose: 'community',
  setup: defaultDaoSetup(),
  privateIdentity: null,
};
it('keeps private DAO metadata opaque and retains a versioned identity reference', () => {
  expect(MetadataSchema.parse(metadata)).toEqual(metadata);
  const reference = { documentId: '41', version: 1, commitment: '11'.repeat(32), keyEpoch: '1' };
  expect(MetadataSchema.parse({ ...metadata, privateIdentity: reference })).toMatchObject({
    privateIdentity: reference,
  });
  expect(MetadataSchema.parse({ ...metadata, privateAssets: [reference] })).toHaveProperty(
    'privateAssets',
  );
  expect(
    MetadataSchema.safeParse({ ...metadata, privateAssets: [reference, reference] }).success,
  ).toBe(false);
  expect(
    MetadataSchema.parse({
      ...metadata,
      publicIdentity: { title: 'Published alias', description: 'Deliberate public text' },
    }),
  ).toHaveProperty('publicIdentity');
  for (const invalid of [
    { ...metadata, title: 'Accidentally public private name' },
    { ...metadata, description: 'Private description leak' },
    { ...metadata, branding: { summary: 'Accidental public summary' } },
    { ...metadata, purpose: 'team' },
    { ...metadata, privateIdentity: { ...reference, keyEpoch: '0' } },
  ])
    expect(MetadataSchema.safeParse(invalid).success).toBe(false);
});

it('binds protected identity writes to an exact previous metadata commitment', () => {
  expect(
    RuntimeActionSchemas.setmeta.safeParse({
      runtime: 'daclifycore',
      dao_id: '7',
      member_id: '1',
      metadata: JSON.stringify(metadata),
      expected: 'ab'.repeat(32),
    }).success,
  ).toBe(true);
});

it('preserves preset identity, rejects downgrade and retains only the exact encrypted identity version', async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'relay');
  const runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime'),
    key = PrivateKey.generate('K1');
  const original = {
    schemaVersion: 2,
    title: 'Already public name',
    description: '',
    purpose: 'community',
    setup: defaultDaoSetup(),
  };
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(
    runtime,
    'createdao',
    [7, 'alice', JSON.stringify(original), 1, 'eosio.token', '4,TLOS'],
    'alice@active',
  );
  await send(
    runtime,
    'enroll',
    [7, 1, '', key.toPublic().toString(), 'fixture', 0],
    'alice@active',
  );
  let nonce = 0;
  async function act(action: 'setmeta' | 'commitepoch' | 'putjson', data: unknown) {
    if (action === 'setmeta') {
      const prior = z
        .object({ metadata: z.string() })
        .parse(row(runtime, 'daos', runtime.toBigInt(), 7n)).metadata;
      const parsed = RuntimeActionSchemas.setmeta.parse(data);
      data = {
        ...parsed,
        expected: parsed.expected ?? createHash('sha256').update(prior).digest('hex'),
      };
    }
    const request = makeInstruction(
      { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '7', interfaceVersion: 1 },
      '1',
      String(nonce),
      chain.timestamp.toMilliseconds() / 1000 + 300,
      'daclifycore',
      action,
      encodeAction(action, RuntimeActionSchemas[action].parse(data)),
    );
    const result = await send(
      runtime,
      'submit',
      { request, sig: key.signDigest(instructionDigest(request)).toString() },
      'relay@active',
    );
    nonce++;
    return result;
  }
  const actor = { runtime: 'daclifycore', dao_id: '7', member_id: '1' };
  await act('setmeta', { ...actor, metadata: JSON.stringify(metadata) });
  await expect(act('setmeta', { ...actor, metadata: JSON.stringify(original) })).rejects.toThrow(
    'PRIVATE_METADATA_DOWNGRADE',
  );
  await expect(
    act('setmeta', { ...actor, metadata: JSON.stringify({ ...metadata, purpose: 'team' }) }),
  ).rejects.toThrow();
  await act('commitepoch', { ...actor, epoch: '1', commitment: 'aa'.repeat(32), self_grant: '{}' });
  const envelope = JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: btoa('i'.repeat(12)),
    ciphertext: btoa('t'.repeat(16)),
  });
  await act('putjson', {
    ...actor,
    document_id: '41',
    version: 1,
    value: envelope,
    envelope_version: 1,
    key_epoch: '1',
  });
  const reference = {
    documentId: '41',
    version: 1,
    commitment: createHash('sha256').update(envelope).digest('hex'),
    keyEpoch: '1',
  };
  for (const invalid of [
    { ...reference, keyEpoch: '2' },
    { ...reference, commitment: 'ff'.repeat(32) },
    { ...reference, version: 2 },
  ])
    await expect(
      act('setmeta', {
        ...actor,
        metadata: JSON.stringify({ ...metadata, privateIdentity: invalid }),
      }),
    ).rejects.toThrow();
  await act('setmeta', {
    ...actor,
    metadata: JSON.stringify({ ...metadata, privateIdentity: reference }),
  });
  expect(row(runtime, 'docrefs', 7n, 1n)).toMatchObject({
    source: 'daclifycore',
    table: 'daos',
    source_id: 7,
    document_id: 41,
    version: 1,
  });
  expect(row(runtime, 'daos', runtime.toBigInt(), 7n)).toHaveProperty(
    'metadata',
    JSON.stringify({ ...metadata, privateIdentity: reference }),
  );
  await expect(
    act('setmeta', { ...actor, metadata: JSON.stringify(metadata), expected: '00'.repeat(32) }),
  ).rejects.toThrow('PRIVATE_METADATA_CHANGED');
  await act('putjson', {
    ...actor,
    document_id: '42',
    version: 1,
    value: envelope,
    envelope_version: 1,
    key_epoch: '1',
  });
  const asset = { ...reference, documentId: '42' };
  await act('setmeta', {
    ...actor,
    metadata: JSON.stringify({ ...metadata, privateIdentity: reference, privateAssets: [asset] }),
  });
  expect(row(runtime, 'docrefs', 7n, 2n)).toMatchObject({
    table: 'daos',
    source_id: 7,
    slot: 1,
    document_id: 42,
    version: 1,
  });
  await act('setmeta', {
    ...actor,
    metadata: JSON.stringify({ ...metadata, privateIdentity: reference }),
  });
  expect(row(runtime, 'docrefs', 7n, 2n)).toMatchObject({ document_id: 0, version: 0 });
});
