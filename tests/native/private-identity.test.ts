import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { RuntimeCodeHash } from '../../sdk/index.js';
import { encodeAction, RuntimeTableSchemas } from '../../sdk/index.js';
import {
  nativeContracts,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let fixture: NativeContracts | undefined;
let dao: DummyDao;
const f = () => {
  if (!fixture) throw Error('OWNED_FIXTURE_REQUIRED');
  return fixture;
};
beforeAll(async () => {
  fixture = await nativeContracts();
  dao = await fixture.dummyDao('alice', false, 0, [], 2);
}, 90000);
afterAll(async () => {
  await fixture?.stop();
});
it('enforces original signer authority, exact ciphertext retention and optimistic writes on a native process', async () => {
  const metadata = {
    schemaVersion: 4,
    title: 'Private DAO',
    description: '',
    purpose: 'custom',
    setup: null,
    privateIdentity: null,
  };
  const expected = createHash('sha256').update('{}').digest('hex');
  const beforeRam = Number(
    (await f().api.v1.chain.get_account('daclifycore')).ram_usage.toString(),
  );
  await expect(
    dao.act(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', { ...dao.actor('2'), metadata: JSON.stringify(metadata), expected }),
      '2',
    ),
  ).rejects.toThrow();
  const migrated = await dao.act(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', { ...dao.actor(), metadata: JSON.stringify(metadata), expected }),
  );
  const afterRam = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage.toString());
  const receipt = z
    .object({ receipt: z.object({ cpu_usage_us: z.number().int().nonnegative() }) })
    .parse(migrated.processed).receipt;
  expect(afterRam).toBeGreaterThan(beforeRam);
  writeFileSync(
    '.artifacts/native/private-identity-resources.json',
    JSON.stringify(
      {
        runtimeCodeHash: RuntimeCodeHash,
        compiler: 'CDT 4.1.1 -O=s, existing MVP wasm-opt -Oz',
        operation: 'legacy metadata -> private metadata with three fixed docref slots',
        nativeRamDeltaBytes: afterRam - beforeRam,
        cpuUsageUs: receipt.cpu_usage_us,
        newTables: 0,
        newSecondaryIndexes: 0,
        referenceSlots: 3,
        note: 'Owned local Spring measurement; not a network CPU or price guarantee.',
      },
      null,
      2,
    ) + '\n',
  );
  const snapshot = await f().gateway.privateIdentity(dao.daoId);
  expect(snapshot.reference).toBeNull();
  expect(snapshot.metadata).toEqual(metadata);
  expect(snapshot.metadataCommitment).toBe(
    createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
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
  });
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '41',
      version: 1,
      value: envelope,
      envelope_version: 1,
      key_epoch: '1',
    }),
  );
  const reference = {
    documentId: '41',
    version: 1,
    keyEpoch: '1',
    commitment: createHash('sha256').update(envelope).digest('hex'),
  };
  const request = {
    ...dao.actor(),
    metadata: JSON.stringify({ ...metadata, privateIdentity: reference }),
    expected: snapshot.metadataCommitment,
  };
  await dao.act('daclifycore', 'setmeta', encodeAction('setmeta', request));
  await expect(dao.act('daclifycore', 'setmeta', encodeAction('setmeta', request))).rejects.toThrow(
    'PRIVATE_METADATA_CHANGED',
  );
  expect((await f().gateway.privateIdentity(dao.daoId)).reference).toEqual(reference);
  const refs = await f().gateway.table('docrefs', dao.daoId);
  expect(
    refs.some((row) => row.table === 'daos' && row.document_id === '41' && row.version === 1),
  ).toBe(true);
  expect(await f().gateway.dao(dao.daoId)).toMatchObject({
    title: 'Private DAO',
    description: '',
    privacy: 'encrypted-user-controlled',
  });
  expect(RuntimeTableSchemas.members.parse(await dao.member()).active).toBe(true);
});
it('rejects a newly attached old-epoch identity after rotation while retaining the unchanged original reference', async () => {
  const snapshot = await f().gateway.privateIdentity(dao.daoId);
  if (!snapshot.reference) throw Error('Native identity fixture');
  const envelope = JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: btoa('i'.repeat(12)),
    ciphertext: btoa('c'.repeat(32)),
  });
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '41',
      version: 2,
      value: envelope,
      envelope_version: 1,
      key_epoch: '1',
    }),
  );
  await dao.act('daclifycore', 'rotateepoch', encodeAction('rotateepoch', dao.actor()));
  const update = {
    ...dao.actor(),
    expected: snapshot.metadataCommitment,
    metadata: JSON.stringify({
      ...snapshot.metadata,
      privateIdentity: { ...snapshot.reference, version: 2 },
    }),
  };
  await expect(dao.act('daclifycore', 'setmeta', encodeAction('setmeta', update))).rejects.toThrow(
    'PRIVATE_EPOCH_CHANGED',
  );
  await dao.act(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', { ...update, metadata: JSON.stringify(snapshot.metadata) }),
  );
  expect((await f().gateway.privateIdentity(dao.daoId)).reference).toEqual(snapshot.reference);
});
