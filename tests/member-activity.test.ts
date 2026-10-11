import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { Name, TimePoint, TimePointSec } from '@greymass/eosio';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';

const artifact = '.artifacts/contracts/runtime';
const chainId = 'ab'.repeat(32),
  key = PrivateKey.generate('K1');
const activity = z.object({
  member_id: z.union([z.string(), z.number()]),
  last_active: z.number(),
});
let chain: Blockchain, runtime: ReturnType<typeof loadContract>;
beforeEach(async () => {
  chain = new Blockchain();
  chain.setTime(TimePoint.fromMilliseconds(1_800_000_000_000));
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, 'daclifycore', artifact);
  await send(runtime, 'init', [chainId], 'daclifycore@active');
  for (const dao of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [dao, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [dao, 1, 'alice', key.toPublic().toString(), 'encryption', 0],
      'alice@active',
    );
  }
});
function last(dao = 1, member = 1) {
  return activity.parse(row(runtime, 'memberacts', BigInt(dao), BigInt(member))).last_active;
}
function instruction(dao = 1, nonce = 0, valid = true, signer = key) {
  const abi = ABI.from(readFileSync(artifact + '.abi', 'utf8'));
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: dao,
    member_id: 1,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action: 'setmeta',
    data: Serializer.encode({
      abi,
      type: 'setmeta',
      object: {
        runtime: 'daclifycore',
        dao_id: dao,
        member_id: 1,
        metadata: valid ? '{"title":"Action"}' : '{invalid',
      },
    }).hexString,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  return { request, sig: signer.signDigest(digest).toString() };
}
it('reserves activity RAM without counting enrollment as a member action', () => {
  expect(last(1)).toBe(0);
  expect(last(2)).toBe(0);
});
it('records signing-key actions in their DAO and updates a constant-size row', async () => {
  await send(runtime, 'submit', instruction(), 'relay@active');
  expect(last()).toBe(1_800_000_000);
  expect(last(2)).toBe(0);
  chain.addTime(TimePointSec.from(60));
  await send(runtime, 'submit', instruction(1, 1), 'relay@active');
  expect(last()).toBe(1_800_000_060);
});
it('records native account actions through the same authenticated dispatch', async () => {
  await send(runtime, 'submitnat', { request: instruction().request }, 'alice@active');
  expect(last()).toBe(1_800_000_000);
});
it('rolls back activity and nonce when the inline DAO action fails', async () => {
  await send(runtime, 'submit', instruction(), 'relay@active');
  chain.addTime(TimePointSec.from(60));
  await expect(send(runtime, 'submit', instruction(1, 1, false), 'relay@active')).rejects.toThrow(
    'JSON',
  );
  expect(last()).toBe(1_800_000_000);
  expect(row(runtime, 'members', 1n, 1n)).toMatchObject({ nonce: 1 });
});
it('rejects replay and wrong signing credentials without recording activity', async () => {
  await expect(
    send(runtime, 'submit', instruction(1, 0, true, PrivateKey.generate('K1')), 'relay@active'),
  ).rejects.toThrow();
  expect(last()).toBe(0);
  const signed = instruction();
  await send(runtime, 'submit', signed, 'relay@active');
  chain.addTime(TimePointSec.from(60));
  await expect(send(runtime, 'submit', signed, 'relay@active')).rejects.toThrow('NONCE');
  expect(last()).toBe(1_800_000_000);
});
it('rejects direct administrative attribution and does not count direct changes', async () => {
  await expect(send(runtime, 'initactivity', [1, 0, 50], 'bob@active')).rejects.toThrow();
  expect(last()).toBe(0);
});
it.each([0, 51])('rejects unbounded initialization batch size %s', async (limit) => {
  await expect(send(runtime, 'initactivity', [1, 0, limit], 'daclifycore@active')).rejects.toThrow(
    'ACTIVITY_BATCH',
  );
  expect(last()).toBe(0);
});
it('initialization is idempotent and preserves successful activity', async () => {
  await send(runtime, 'submit', instruction(), 'relay@active');
  await send(runtime, 'initactivity', [1, 0, 50], 'daclifycore@active');
  await send(runtime, 'initactivity', [1, 0, 50], 'daclifycore@active');
  expect(last()).toBe(1_800_000_000);
  expect(last(2)).toBe(0);
});
it('initializes actual legacy row layout in bounded batches without fabricating history', async () => {
  const member = z.record(z.string(), z.unknown()).parse(row(runtime, 'members', 1n, 1n));
  const rows = runtime.tables.members;
  if (!rows) throw new Error('MEMBERS_TABLE_REQUIRED');
  for (const id of [2, 3])
    rows(1n).set(BigInt(id), Name.from('daclifycore'), { ...member, id, native_account: '' });
  await send(runtime, 'initactivity', [1, 2, 1], 'daclifycore@active');
  expect(last(1, 2)).toBe(0);
  expect(row(runtime, 'memberacts', 1n, 3n)).toBeUndefined();
  await send(runtime, 'initactivity', [1, 3, 1], 'daclifycore@active');
  expect(last(1, 3)).toBe(0);
});
it('continues legacy member actions without allocating activity RAM on dispatch', async () => {
  const table = chain.store.findTable(
    runtime.toBigInt(),
    1n,
    BigInt(Name.from('memberacts').value.toString()),
  );
  if (!table) throw new Error('ACTIVITY_TABLE_REQUIRED');
  table.delete(1n);
  await send(runtime, 'submit', instruction(), 'relay@active');
  expect(row(runtime, 'members', 1n, 1n)).toMatchObject({ nonce: 1 });
  expect(row(runtime, 'memberacts', 1n, 1n)).toBeUndefined();
  await send(runtime, 'initactivity', [1, 0, 50], 'daclifycore@active');
  expect(last()).toBe(0);
  await send(runtime, 'submit', instruction(1, 1), 'relay@active');
  expect(last()).toBe(1_800_000_000);
});
