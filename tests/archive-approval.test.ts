import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { TimePointSec } from '@greymass/eosio';
import { PrivateKey, Name, Serializer, ABI, Checksum256 } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadContract, row, send } from './helpers/vert.js';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
} from '../sdk/index.js';
const domain = {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
    interfaceVersion: 1 as const,
  },
  key = PrivateKey.generate('K1'),
  hash = 'cd'.repeat(32),
  backup = 'ef'.repeat(32),
  cid = 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
let chain: Blockchain, runtime: ReturnType<typeof loadContract>;
const codeHash = createHash('sha256')
  .update(readFileSync('.artifacts/contracts/permprobe.wasm'))
  .digest('hex');
function descriptor() {
  return {
    format_version: 1,
    chain_id: domain.chainId,
    runtime: domain.contract,
    dao_id: domain.daoId,
    source: 'permprobe',
    code_hash: codeHash,
    abi_hash: 'ad'.repeat(32),
    block_number: 1,
    block_id: '00000001' + 'ab'.repeat(28),
    timestamp: '2026-01-01T00:00:00.000Z',
    families: [
      {
        kind: 'ordinary-poll-votes',
        parent_id: '7',
        table: 'votes',
        scope: Name.from(domain.contract).value.toString(),
        schema_hash: 'be'.repeat(32),
        records: '0',
        chunks: [],
      },
    ],
    files: [],
  };
}
function digest(value = descriptor()) {
  return Checksum256.hash(
    Serializer.encode({
      abi: ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8')),
      type: 'archive_manifest_descriptor',
      object: value,
    }).array,
  ).toString();
}
async function attest(value = descriptor(), actor = 'bob') {
  return send(
    runtime,
    'archattest',
    [domain.daoId, value, cid, 4096, hash, backup, 7776000],
    actor + '@active',
  );
}
async function approve(
  action: 'archapprove' | 'archrevoke' = 'archapprove',
  manifest = hash,
  descriptorHash = digest(),
  backupHash = backup,
  retentionSeconds = 7776000,
) {
  const member = RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n));
  const request = makeInstruction(
    domain,
    '1',
    member.nonce,
    chain.timestamp.toMilliseconds() / 1000 + 120,
    domain.contract,
    action,
    encodeAction(action, {
      runtime: domain.contract,
      dao_id: domain.daoId,
      member_id: '1',
      manifest_commitment: manifest,
      descriptor_commitment: descriptorHash,
      backup_commitment: backupHash,
      retention_seconds: retentionSeconds,
    }),
  );
  return send(
    runtime,
    'submit',
    [request, key.signDigest(instructionDigest(request)).toString()],
    'relay@active',
  );
}
beforeEach(async () => {
  chain = new Blockchain();
  runtime = loadContract(chain, domain.contract, '.artifacts/contracts/runtime');
  loadContract(chain, 'permprobe', '.artifacts/contracts/permprobe');
  chain.createAccounts('alice', 'bob', 'relay', 'eosio.token');
  await send(runtime, 'init', [domain.chainId], domain.contract + '@active');
  await send(runtime, 'initramobs', [], domain.contract + '@active');
  await send(
    runtime,
    'createdao',
    ['1', 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
    'alice@active',
  );
  await send(
    runtime,
    'enroll',
    ['1', '1', '', key.toPublic().toString(), 'fixture-encryption', 0],
    'alice@active',
  );
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    domain.contract + '@active',
  );
  await send(
    runtime,
    'listmod',
    ['permprobe', 'alice', 0, 1, '0.0000 TLOS', codeHash, 'Owned archive source fixture'],
    domain.contract + '@active',
  );
  await send(runtime, 'setramcode', ['permprobe', codeHash], domain.contract + '@active');
  await send(
    runtime,
    'setmodule',
    ['1', 'permprobe', 1, ['vote', 'finalize'], [], codeHash],
    'alice@active',
  );
  await send(runtime, 'setarchcfg', ['bob', 7776000, false], domain.contract + '@active');
});
it('separates availability attestation from exact signed administrator approval and revocation', async () => {
  await expect(attest(descriptor(), 'relay')).rejects.toThrow();
  await attest();
  const saved = () => row(runtime, 'archives', 1n, 1n);
  expect(saved()).toMatchObject({
    approved_by: 0,
    manifest_commitment: hash,
    backup_commitment: backup,
    retention_seconds: 7776000,
  });
  await expect(
    send(
      runtime,
      'archapprove',
      [domain.contract, '1', '1', hash, digest(), backup, 7776000],
      domain.contract + '@active',
    ),
  ).rejects.toThrow('ACTOR_SENDER');
  await approve();
  expect(saved()).toMatchObject({ approved_by: 1, revoked: false });
  await approve('archrevoke');
  expect(saved()).toMatchObject({ revoked: true });
});
it('requires the exact immutable manifest, descriptor and backup and rejects a foreign/protected source', async () => {
  await attest();
  await expect(approve('archapprove', hash, 'ff'.repeat(32))).rejects.toThrow('ARCHIVE_COMMITMENT');
  await expect(approve('archapprove', hash, digest(), 'ff'.repeat(32))).rejects.toThrow(
    'ARCHIVE_COMMITMENT',
  );
  await expect(attest({ ...descriptor(), timestamp: '2026-01-02T00:00:00.000Z' })).rejects.toThrow(
    'ARCHIVE_ANCHOR_IMMUTABLE',
  );
  await expect(attest({ ...descriptor(), dao_id: '2' })).rejects.toThrow('ARCHIVE_DOMAIN');
  const family = descriptor().families[0];
  if (!family) throw new Error('ARCHIVE_FIXTURE_FAMILY');
  await expect(
    attest({ ...descriptor(), families: [{ ...family, kind: 'protected-export' }] }),
  ).rejects.toThrow('ARCHIVE_FAMILY_PROTECTED');
  expect(row(runtime, 'archives', 1n, 2n)).toBeUndefined();
});
it('requires a recent matching availability attestation without silently changing its payload', async () => {
  await attest();
  chain.addTime(TimePointSec.from(901));
  await expect(approve()).rejects.toThrow('ARCHIVE_AVAILABILITY_EXPIRED');
  await attest();
  await approve();
  expect(row(runtime, 'archives', 1n, 1n)).toMatchObject({ approved_by: 1 });
});
it('bounds retention configuration and keeps destructive pruning disabled by default', async () => {
  await expect(
    send(runtime, 'setarchcfg', ['bob', 7775999, false], domain.contract + '@active'),
  ).rejects.toThrow('ARCHIVE_POLICY');
  expect(
    row(
      runtime,
      'archcfg',
      BigInt(Name.from(domain.contract).value.toString()),
      BigInt(Name.from('archcfg').value.toString()),
    ),
  ).toMatchObject({ pruning_enabled: false });
});

it('invalidates a removed verifier until the replacement attests the exact same immutable export', async () => {
  await attest();
  await send(runtime, 'setarchcfg', ['alice', 7776000, false], domain.contract + '@active');
  await expect(approve()).rejects.toThrow('ARCHIVE_VERIFIER_CHANGED');
  await attest(descriptor(), 'alice');
  await approve();
  expect(row(runtime, 'archives', 1n, 1n)).toMatchObject({ approved_by: 1, verifier: 'alice' });
});

it('binds the accepted retention delay without weakening an immutable existing anchor', async () => {
  await attest();
  await expect(approve('archapprove', hash, digest(), backup, 365 * 86400)).rejects.toThrow(
    'ARCHIVE_COMMITMENT',
  );
  await expect(
    send(
      runtime,
      'archattest',
      [domain.daoId, descriptor(), cid, 4096, hash, backup, 365 * 86400],
      'bob@active',
    ),
  ).rejects.toThrow('ARCHIVE_ANCHOR_IMMUTABLE');
});
