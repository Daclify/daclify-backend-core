import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { TimePointSec } from '@greymass/eosio';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { instructionDigest, makeInstruction, RuntimeTableSchemas } from '../sdk/index.js';
import { buildArchiveTree } from '@daclify/modules/archive';
import { loadContract, row, send } from './helpers/vert.js';
const name = 'daclifycore',
  chainId = 'ab'.repeat(32),
  cid = 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  hash = 'cd'.repeat(32),
  backup = 'ef'.repeat(32),
  key = PrivateKey.generate('K1');
const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
let chain: Blockchain, core: ReturnType<typeof loadContract>;
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  core = loadContract(chain, name, '.artifacts/contracts/runtime');
  await send(core, 'init', [chainId], name + '@active');
  await send(core, 'initramobs', [], name + '@active');
  await send(core, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(core, 'enroll', [1, 1, '', key.toPublic().toString(), 'key', 0], 'alice@active');
  for (const version of [1, 2, 3])
    await send(
      core,
      'putjson',
      [name, 1, 1, 9, version, JSON.stringify({ version }), 0, 0],
      name + '@active',
    );
  await send(core, 'setarchcfg', ['bob', 7776000, true], name + '@active');
});
function manifest(ids = [1, 2]) {
  const records = ids.map((id) => ({
    primaryKey: String(id),
    packed: Serializer.encode({
      abi,
      type: 'document_record',
      object: row(core, 'documents', 1n, BigInt(id)),
    }).hexString,
  }));
  const domain = {
    format_version: 1 as const,
    chain_id: chainId,
    runtime: name,
    dao_id: '1',
    source: name,
    code_hash: Checksum256.hash(readFileSync('.artifacts/contracts/runtime.wasm')).toString(),
    abi_hash: Checksum256.hash(Serializer.encode({ object: abi }).array).toString(),
    schema_hash: 'be'.repeat(32),
    table: 'documents',
    scope: '1',
    chunk_ordinal: 0,
    leaf_count: ids.length,
  };
  const tree = buildArchiveTree(domain, records);
  const first = ids[0],
    last = ids.at(-1);
  if (first === undefined || last === undefined) throw new Error('FIXTURE_ROWS_REQUIRED');
  return {
    tree,
    records,
    value: {
      format_version: 1,
      chain_id: chainId,
      runtime: name,
      dao_id: '1',
      source: name,
      code_hash: domain.code_hash,
      abi_hash: domain.abi_hash,
      block_number: 1,
      block_id: '00000001' + 'ab'.repeat(28),
      timestamp: '2026-01-01T00:00:00.000Z',
      families: [
        {
          kind: 'document-versions',
          parent_id: '9',
          table: 'documents',
          scope: '1',
          schema_hash: domain.schema_hash,
          records: String(ids.length),
          chunks: [
            {
              domain,
              root: tree.root,
              cid,
              bytes: 500,
              commitment: hash,
              first_key: String(first),
              last_key: String(last),
            },
          ],
        },
      ],
      files: [],
    },
  };
}
async function act(action: 'archapprove' | 'restoredoc', fields: object) {
  const member = RuntimeTableSchemas.members.parse(row(core, 'members', 1n, 1n));
  const data = Serializer.encode({
    abi,
    type: action,
    object: { runtime: name, dao_id: '1', member_id: '1', ...fields },
  }).array;
  const request = makeInstruction(
    { chainId, contract: name, daoId: '1', interfaceVersion: 1 },
    '1',
    member.nonce,
    chain.timestamp.toMilliseconds() / 1000 + 120,
    name,
    action,
    data,
  );
  await send(
    core,
    'submit',
    [request, key.signDigest(instructionDigest(request)).toString()],
    'relay@active',
  );
}
async function ready(value: ReturnType<typeof manifest>['value']) {
  await send(core, 'backfilldocs', [1, 25], name + '@active');
  await send(core, 'archattest', [1, value, cid, 4096, hash, backup, 7776000], 'bob@active');
  await act('archapprove', {
    manifest_commitment: hash,
    descriptor_commitment: Checksum256.hash(
      Serializer.encode({ abi, type: 'archive_manifest_descriptor', object: value }).array,
    ).toString(),
    backup_commitment: backup,
    retention_seconds: 7776000,
  });
}
it('protects unbackfilled and latest versions, rolls bad proofs back and restores exact originals', async () => {
  const { value, tree } = manifest();
  await expect(
    send(core, 'archattest', [1, value, cid, 4096, hash, backup, 7776000], 'bob@active'),
  ).rejects.toThrow('DOCUMENT_BACKFILL_REQUIRED');
  await ready(value);
  const proofs = [
    { primary_key: '1', siblings: tree.proof(0) },
    { primary_key: '2', siblings: tree.proof(1) },
  ];
  await expect(send(core, 'prunedocs', [1, 1, 0, 0, proofs], 'bob@active')).rejects.toThrow(
    'ARCHIVE_RETENTION',
  );
  chain.addTime(TimePointSec.from(7776000));
  await send(core, 'archattest', [1, value, cid, 4096, hash, backup, 7776000], 'bob@active');
  const original = RuntimeTableSchemas.documents.parse(row(core, 'documents', 1n, 1n));
  await expect(
    send(
      core,
      'prunedocs',
      [1, 1, 0, 0, [proofs[0], { ...proofs[1], siblings: ['00'.repeat(32)] }]],
      'bob@active',
    ),
  ).rejects.toThrow('ARCHIVE_PROOF');
  expect(RuntimeTableSchemas.documents.parse(row(core, 'documents', 1n, 1n))).toEqual(original);
  await send(core, 'prunedocs', [1, 1, 0, 0, proofs], 'bob@active');
  expect(row(core, 'documents', 1n, 1n)).toBeUndefined();
  expect(row(core, 'documents', 1n, 3n)).toBeDefined();
  await send(core, 'prunedocs', [1, 1, 0, 0, proofs], 'bob@active');
  await expect(act('restoredoc', { original: { ...original, metadata: '{}' } })).rejects.toThrow(
    'DOCUMENT_RESTORE_COMMITMENT',
  );
  await act('restoredoc', { original });
  await act('restoredoc', { original });
  expect(RuntimeTableSchemas.documents.parse(row(core, 'documents', 1n, 1n))).toEqual(original);
  expect(RuntimeTableSchemas.docstate.parse(row(core, 'docstate', 1n, 0n)).high_water).toBe('3');
});
it('never prunes the latest document version', async () => {
  const { value, tree } = manifest([3]);
  await ready(value);
  chain.addTime(TimePointSec.from(7776000));
  await send(core, 'archattest', [1, value, cid, 4096, hash, backup, 7776000], 'bob@active');
  await expect(
    send(
      core,
      'prunedocs',
      [1, 1, 0, 0, [{ primary_key: '3', siblings: tree.proof(0) }]],
      'bob@active',
    ),
  ).rejects.toThrow('DOCUMENT_LATEST_PROTECTED');
});
