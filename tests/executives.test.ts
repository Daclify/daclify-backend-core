import { beforeEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
let chain: Blockchain, core: ReturnType<typeof loadContract>;
const keys = Array.from({ length: 4 }, () => PrivateKey.generate('K1'));
async function act(action: string, fields: object, member = 1, native?: string) {
  const person = z.object({ nonce: z.number() }).parse(row(core, 'members', 1n, BigInt(member)));
  const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const data = Serializer.encode({
    abi,
    type: action,
    object: { runtime: 'daclifycore', dao_id: 1, member_id: member, ...fields },
  }).hexString;
  const request = {
    version: 1,
    chain_id: 'ab'.repeat(32),
    deployment: 'daclifycore',
    dao_id: 1,
    member_id: member,
    nonce: person.nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action,
    data,
  };
  const key = keys[member - 1];
  if (!key) throw new Error('FIXTURE_MEMBER');
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  await send(
    core,
    'submit',
    [request, key.signDigest(digest).toString()],
    native ? ['relay@active', native + '@active'] : 'relay@active',
  );
}
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'carol', 'relay');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(core, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const [index, key] of keys.entries())
    await send(
      core,
      'enroll',
      [1, index + 1, '', key.toPublic().toString(), 'key', 0],
      'alice@active',
    );
});
it('appoints explicit executives separately from administrators and wallet bindings', async () => {
  await send(core, 'appoint', [1, [1, 2], 2592000, 10000], 'alice@active');
  expect(row(core, 'executives', 1n, 1n)).toMatchObject({ member_id: 1 });
  expect(row(core, 'executives', 1n, 3n)).toBeUndefined();
  expect(row(core, 'members', 1n, 2n)).toMatchObject({ admin: false, native_account: '' });
});
it('rejects appointment by an ordinary native account', async () => {
  await expect(send(core, 'appoint', [1, [3], 2592000, 10000], 'bob@active')).rejects.toThrow();
  expect(row(core, 'executives', 1n, 3n)).toBeUndefined();
});
it('records voter exclusion without removing membership or executive office', async () => {
  await send(core, 'appoint', [1, [1], 2592000, 10000], 'alice@active');
  await act('setvoter', { target: 2, can_vote: false });
  expect(row(core, 'nonvoters', 1n, 2n)).toMatchObject({ member_id: 2 });
  expect(row(core, 'members', 1n, 2n)).toMatchObject({ active: true });
  await act('setvoter', { target: 2, can_vote: true });
  expect(row(core, 'nonvoters', 1n, 2n)).toBeUndefined();
});
it('refreshes activity only for appointed executives', async () => {
  await send(core, 'appoint', [1, [1], 60, 10000], 'alice@active');
  chain.addTime(requireTime(61));
  await act('heartbeat', {});
  const executive = z.object({ last_active: z.number() }).parse(row(core, 'executives', 1n, 1n));
  expect(executive.last_active).toBe(chain.timestamp.toMilliseconds() / 1000);
  await expect(act('heartbeat', {}, 2)).rejects.toThrow('EXECUTIVE_REQUIRED');
});
it('replaced executives cannot reactivate their previous office', async () => {
  await send(core, 'appoint', [1, [1, 2], 60, 10000], 'alice@active');
  await send(core, 'appoint', [1, [2], 60, 10000], 'alice@active');
  await expect(act('heartbeat', {})).rejects.toThrow('EXECUTIVE_REQUIRED');
});
it('pairing an ordinary member never appoints an executive', async () => {
  await send(core, 'appoint', [1, [1], 60, 10000], 'alice@active');
  await act('linknative', { account: 'bob' }, 2, 'bob');
  expect(row(core, 'members', 1n, 2n)).toMatchObject({ native_account: 'bob' });
  expect(row(core, 'executives', 1n, 2n)).toBeUndefined();
});
import { TimePointSec } from '@greymass/eosio';
function requireTime(seconds: number) {
  return TimePointSec.from(seconds);
}
it('allows an ordinary member to refresh executive authority without becoming an executive', async () => {
  await send(core, 'appoint', [1, [1], 60, 10000], 'alice@active');
  await act('refreshgov', {}, 2);
  expect(row(core, 'executives', 1n, 2n)).toBeUndefined();
});
