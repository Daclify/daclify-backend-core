import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { readFileSync } from 'node:fs';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
import { z } from 'zod';
import { privateHandoverCommitment } from '../sdk/account-exit.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { DaoRefSchema } from '../protocol/base.js';
import { Name, TimePointSec } from '@greymass/eosio';
let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
const roots = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
function root(member: number) {
  const key = roots[member - 1];
  if (!key) throw new Error('FIXTURE_ROOT');
  return key;
}
const native = 'daclifycore';
const reference = DaoRefSchema.parse({
  chainId: 'ab'.repeat(32),
  contract: native,
  daoId: '1',
  interfaceVersion: 1,
});
const now = () => chain.timestamp.toMilliseconds() / 1000;
const preparation = () =>
  RuntimeTableSchemas.handovers.parse(row(runtime, 'handovers', runtime.toBigInt(), 1n));
async function signed(action: string, fields: Record<string, unknown>, member = 1) {
  const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const nonce = z
    .object({ nonce: z.union([z.string(), z.number().int().safe()]) })
    .parse(row(runtime, 'members', 1n, BigInt(member))).nonce;
  const request = {
    version: 1,
    chain_id: reference.chainId,
    deployment: native,
    dao_id: 1,
    member_id: member,
    nonce,
    expires: now() + 300,
    target: native,
    action,
    data: Serializer.encode({
      abi,
      type: action,
      object: { runtime: native, dao_id: 1, member_id: member, ...fields },
    }).hexString,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  await send(
    runtime,
    'submit',
    [request, root(member).signDigest(digest).toString()],
    'alice@active',
  );
}
async function epoch() {
  const current = z
    .object({ key_epoch: z.union([z.string(), z.number().int().safe()]) })
    .parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).key_epoch;
  await send(
    runtime,
    'commitepoch',
    [native, 1, 1, current, 'ab'.repeat(32), '{}'],
    `${native}@active`,
  );
}
async function begin() {
  await signed('beginhand', { departing: 2, successor: 1, expires: now() + 600 });
}
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice');
  runtime = loadContract(chain, native, '.artifacts/contracts/runtime');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 1, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const id of [1, 2])
    await send(
      runtime,
      'enroll',
      [1, id, '', root(id).toPublic().toString(), `synthetic-key-${id}`, 0],
      'alice@active',
    );
  await send(runtime, 'setroles', [native, 1, 1, 2, true, false], `${native}@active`);
});
it('refuses private administrator deactivation without prepared and accepted recorded-grant continuity', async () => {
  await expect(
    send(runtime, 'setactive', [native, 1, 1, 2, false], `${native}@active`),
  ).rejects.toThrow('PRIVATE_HANDOVER_REQUIRED');
  expect(row(runtime, 'members', 1n, 2n)).toMatchObject({ active: true });
});
it('refuses private administrator demotion through the existing role entry path', async () => {
  await expect(
    send(runtime, 'setroles', [native, 1, 1, 2, false, false], `${native}@active`),
  ).rejects.toThrow('PRIVATE_HANDOVER_REQUIRED');
  expect(row(runtime, 'members', 1n, 2n)).toMatchObject({ admin: true, active: true });
});
it('does not require handover for an ordinary private member departure', async () => {
  const daoId = 2;
  await send(
    runtime,
    'createdao',
    [daoId, 'alice', '{}', 1, 'eosio.token', '4,TLOS'],
    'alice@active',
  );
  for (const id of [1, 2])
    await send(
      runtime,
      'enroll',
      [daoId, id, '', root(id).toPublic().toString(), `synthetic-key-${id}`, 0],
      'alice@active',
    );
  const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const request = {
    version: 1,
    chain_id: 'ab'.repeat(32),
    deployment: native,
    dao_id: daoId,
    member_id: 2,
    nonce: 0,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: native,
    action: 'leave',
    data: Serializer.encode({
      abi,
      type: 'actor_context',
      object: { runtime: native, dao_id: daoId, member_id: 2 },
    }).hexString,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  await send(runtime, 'submit', [request, root(2).signDigest(digest).toString()], 'alice@active');
  expect(row(runtime, 'members', BigInt(daoId), 2n)).toMatchObject({ active: false });
});

it('requires the selected successor acceptance and consumes a matching completed preparation once', async () => {
  await epoch();
  await begin();
  await signed('scanhand', { limit: 25 });
  expect(preparation().complete).toBe(true);
  await expect(
    send(runtime, 'setactive', [native, 1, 1, 2, false], `${native}@active`),
  ).rejects.toThrow('PRIVATE_HANDOVER_REQUIRED');
  const commitment = privateHandoverCommitment(reference, preparation());
  await expect(signed('accepthand', { expected_commitment: commitment }, 2)).rejects.toThrow(
    'PRIVATE_SUCCESSOR_REQUIRED',
  );
  await expect(signed('accepthand', { expected_commitment: 'ef'.repeat(32) })).rejects.toThrow(
    'PRIVATE_HANDOVER_CONTEXT',
  );
  await signed('accepthand', { expected_commitment: commitment });
  await expect(signed('accepthand', { expected_commitment: commitment })).rejects.toThrow(
    'PRIVATE_HANDOVER_PENDING',
  );
  await signed('leave', {}, 2);
  expect(row(runtime, 'members', 1n, 2n)).toMatchObject({ active: false });
  expect(row(runtime, 'handovers', runtime.toBigInt(), 1n)).toBeUndefined();
});
it('scans more than 25 committed epochs in bounded batches without inventing missing successor grants', async () => {
  for (let index = 1; index <= 26; index++) {
    if (index > 1) await send(runtime, 'rotateepoch', [native, 1, 1], `${native}@active`);
    await epoch();
  }
  await begin();
  await signed('scanhand', { limit: 25 });
  expect(preparation()).toMatchObject({ cursor: '25', complete: false });
  await expect(signed('scanhand', { limit: 26 })).rejects.toThrow('HANDOVER_SCAN_BOUNDS');
  await signed('scanhand', { limit: 25 });
  expect(preparation()).toMatchObject({ cursor: '26', complete: true });
});
it('refuses a missing successor grant and retains the unadvanced preparation', async () => {
  await epoch();
  await signed('beginhand', { departing: 1, successor: 2, expires: now() + 600 });
  await expect(signed('scanhand', { limit: 25 })).rejects.toThrow('PRIVATE_GRANT_MISSING');
  expect(preparation()).toMatchObject({ cursor: '0', complete: false, accepted: false });
});
it('invalidates preparation after credential changes and safely clears expiry', async () => {
  await epoch();
  await begin();
  await signed('rotatekey', { signing_key: PrivateKey.generate('K1').toPublic().toString() }, 2);
  await expect(signed('scanhand', { limit: 25 })).rejects.toThrow('PRIVATE_HANDOVER_STALE');
  await expect(send(runtime, 'clearhand', [1], 'alice@active')).rejects.toThrow(
    'PRIVATE_HANDOVER_PENDING',
  );
  chain.addTime(TimePointSec.from(601));
  await send(runtime, 'clearhand', [1], 'alice@active');
  expect(row(runtime, 'handovers', runtime.toBigInt(), 1n)).toBeUndefined();
  await send(runtime, 'clearhand', [1], 'alice@active');
});
it('invalidates preparation when the DAO advances its epoch', async () => {
  await epoch();
  await begin();
  await signed('scanhand', { limit: 25 });
  await signed('rotateepoch', {});
  await expect(signed('scanhand', { limit: 25 })).rejects.toThrow('PRIVATE_HANDOVER_STALE');
  await expect(
    signed('accepthand', {
      expected_commitment: privateHandoverCommitment(reference, preparation()),
    }),
  ).rejects.toThrow('PRIVATE_HANDOVER_STALE');
});
it('can commit and rotate protected settlement keys while closing after a member leaves', async () => {
  await epoch();
  await begin();
  await signed('scanhand', { limit: 25 });
  await signed('accepthand', {
    expected_commitment: privateHandoverCommitment(reference, preparation()),
  });
  await signed('setroles', { target: 2, admin: false, reviewer: false });
  await signed('startclose', {});
  await signed('leave', {}, 2);
  const current = RuntimeTableSchemas.daos.parse(
    row(runtime, 'daos', runtime.toBigInt(), 1n),
  ).key_epoch;
  await signed('commitepoch', { epoch: current, commitment: 'cd'.repeat(32), self_grant: '{}' });
  await signed('rotateepoch', {});
  const next = RuntimeTableSchemas.daos.parse(
    row(runtime, 'daos', runtime.toBigInt(), 1n),
  ).key_epoch;
  await signed('commitepoch', { epoch: next, commitment: 'ef'.repeat(32), self_grant: '{}' });
  expect(RuntimeTableSchemas.epochs.parse(row(runtime, 'epochs', 1n, BigInt(next))).creator).toBe(
    '1',
  );
});
it('refuses replacement before expiry and binds successor acceptance to the reviewed preparation', async () => {
  await epoch();
  await begin();
  await signed('scanhand', { limit: 25 });
  const original = privateHandoverCommitment(reference, preparation());
  await expect(begin()).rejects.toThrow('PRIVATE_HANDOVER_PENDING');
  chain.addTime(TimePointSec.from(601));
  await begin();
  await signed('scanhand', { limit: 25 });
  await expect(signed('accepthand', { expected_commitment: original })).rejects.toThrow(
    'PRIVATE_HANDOVER_CONTEXT',
  );
  expect(preparation().accepted).toBe(false);
});
it('preserves an existing from-join policy instead of granting forbidden earlier history', async () => {
  await epoch();
  // Historical state fixture: the current product exposes no policy-changing action.
  const daoRow = RuntimeTableSchemas.daos.parse(row(runtime, 'daos', runtime.toBigInt(), 1n));
  const successor = RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n));
  const daos = runtime.tables.daos,
    members = runtime.tables.members;
  if (!daos || !members) throw new Error('FIXTURE_TABLES');
  daos(runtime.toBigInt()).set(1n, Name.from(native), { ...daoRow, history_policy: 1 });
  members(1n).set(1n, Name.from(native), { ...successor, join_epoch: '2' });
  await begin();
  await expect(signed('scanhand', { limit: 25 })).rejects.toThrow('PRIVATE_HISTORY_FORBIDDEN');
  expect(preparation()).toMatchObject({ cursor: '0', complete: false });
});
