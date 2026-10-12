import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import { encodeAction, instructionDigest, makeInstruction } from '../sdk/index.js';
import { DaoRefSchema } from '../protocol/base.js';

let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
let token: ReturnType<typeof loadContract>;
const roots = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
const reference = DaoRefSchema.parse({
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
});
const units = z.union([z.string(), z.number().int().safe()]).transform(String);
const member = (id: number) =>
  z
    .object({ active: z.boolean(), nonce: units, credits: units, stake: units, claim: units })
    .parse(row(runtime, 'members', 1n, BigInt(id)));
const dao = () =>
  z
    .object({
      member_count: units,
      admin_count: z.number(),
      eligible_credits: units,
      eligible_stake: units,
      staked: units,
      available: units,
      claims: units,
    })
    .parse(row(runtime, 'daos', runtime.toBigInt(), 1n));
function root(id: number) {
  const key = roots[id - 1];
  if (!key) throw new Error('FIXTURE_ROOT');
  return key;
}
async function signed(action: string, id: number, data?: Uint8Array, proof = root(id)) {
  // These new actions share the existing flat actor-context wire layout.
  const request = makeInstruction(
    reference,
    String(id),
    member(id).nonce,
    chain.timestamp.toMilliseconds() / 1000 + 300,
    reference.contract,
    action,
    data ??
      encodeAction('refreshgov', {
        runtime: reference.contract,
        dao_id: '1',
        member_id: String(id),
      }),
  );
  await send(
    runtime,
    'submit',
    [request, proof.signDigest(instructionDigest(request)).toString()],
    'relay@active',
  );
}
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, reference.contract, '.artifacts/contracts/runtime');
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', [reference.chainId], 'daclifycore@active');
  await send(token, 'create', ['eosio.token', '1000000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['bob', '100.0000 TLOS', ''], 'eosio.token@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const id of [1, 2])
    await send(
      runtime,
      'enroll',
      [
        1,
        id,
        id === 1 ? 'alice' : 'bob',
        root(id).toPublic().toString(),
        'fixture-encryption-key',
        0,
      ],
      id === 1 ? 'alice@active' : ['alice@active', 'bob@active'],
    );
});
it('lets a signed ordinary member leave without deleting identity or another member', async () => {
  const before = member(1);
  await signed('leave', 2);
  expect(member(2).active).toBe(false);
  expect(member(1)).toEqual(before);
  expect(dao()).toMatchObject({ member_count: '1', admin_count: 1 });
  await expect(signed('leave', 2)).rejects.toThrow('MEMBER_INACTIVE');
});
it('rejects another root and an instruction/body member mismatch without deactivating either member', async () => {
  await expect(signed('leave', 2, undefined, root(1))).rejects.toThrow(
    'recovered key is different',
  );
  await expect(
    signed(
      'leave',
      2,
      encodeAction('refreshgov', { runtime: reference.contract, dao_id: '1', member_id: '1' }),
    ),
  ).rejects.toThrow('PAYLOAD_DOMAIN');
  expect(member(1).active).toBe(true);
  expect(member(2).active).toBe(true);
});
it('preserves deposited stake and lets the inactive member unstake once without voting weight', async () => {
  await send(token, 'transfer', ['bob', 'daclifycore', '5.0000 TLOS', 'stake:1:2'], 'bob@active');
  await signed('leave', 2);
  expect(member(2)).toMatchObject({ active: false, stake: '50000' });
  expect(dao()).toMatchObject({ eligible_stake: '0', staked: '50000' });
  const payout = encodeAction('unstake', {
    runtime: reference.contract,
    dao_id: '1',
    member_id: '2',
    destination: 'bob',
    quantity: '5.0000 TLOS',
  });
  await signed('unstake', 2, payout);
  expect(member(2).stake).toBe('0');
  expect(dao().staked).toBe('0');
  await expect(signed('unstake', 2, payout)).rejects.toThrow('INSUFFICIENT_STAKE');
});
it('refuses last-admin departure and nonadministrator retirement without silently closing a DAO', async () => {
  await expect(signed('leave', 1)).rejects.toThrow('LAST_ADMIN');
  await expect(signed('startclose', 2)).rejects.toThrow('ADMIN_REQUIRED');
  expect(member(1).active).toBe(true);
  expect(member(2).active).toBe(true);
});
it('enters settlement-only closing and refuses final closure while treasury funds remain', async () => {
  await send(token, 'transfer', ['bob', 'daclifycore', '3.0000 TLOS', 'dao:1'], 'bob@active');
  await signed('startclose', 1);
  expect(
    z.object({ state: z.number() }).parse(row(runtime, 'daolife', runtime.toBigInt(), 1n)).state,
  ).toBe(1);
  await expect(
    send(
      runtime,
      'enroll',
      [1, 3, '', PrivateKey.generate('K1').toPublic().toString(), 'fixture', 0],
      'alice@active',
    ),
  ).rejects.toThrow('DAO_CLOSING');
  await expect(signed('closedao', 1)).rejects.toThrow('DAO_FUNDS_REMAIN');
  expect(dao().available).toBe('30000');
});
it('blocks fresh sessions, metadata and member reactivation while allowing credential removal in closing', async () => {
  await signed('leave', 2);
  await signed('startclose', 1);
  await expect(
    signed(
      'setmeta',
      1,
      encodeAction('setmeta', {
        runtime: reference.contract,
        dao_id: '1',
        member_id: '1',
        metadata: '{}',
      }),
    ),
  ).rejects.toThrow('DAO_CLOSING');
  await expect(
    signed(
      'addsession',
      1,
      encodeAction('addsession', {
        runtime: reference.contract,
        dao_id: '1',
        member_id: '1',
        session_id: '1',
        signing_key: PrivateKey.generate('K1').toPublic().toString(),
        expires: chain.timestamp.toMilliseconds() / 1000 + 300,
        permissions: [{ target: reference.contract, action: 'putjson', code_hash: '0'.repeat(64) }],
      }),
    ),
  ).rejects.toThrow('DAO_CLOSING');
  await expect(
    send(runtime, 'setactive', [reference.contract, 1, 1, 2, true], 'daclifycore@active'),
  ).rejects.toThrow('DAO_CLOSING');
});
it('rejects new deposits and module removal through direct owner paths after retirement starts', async () => {
  await signed('startclose', 1);
  await expect(
    send(token, 'transfer', ['bob', 'daclifycore', '1.0000 TLOS', 'dao:1'], 'bob@active'),
  ).rejects.toThrow('DAO_CLOSING');
  await expect(
    send(runtime, 'setmodule', [1, 'alice', 1, [], [], '0'.repeat(64)], 'alice@active'),
  ).rejects.toThrow('DAO_CLOSING');
  expect(dao().available).toBe('0');
});
it('allows explicit fully settled closure and final member departure while rejecting new ordinary operations', async () => {
  await signed('leave', 2);
  await signed('startclose', 1);
  await signed('closedao', 1);
  await expect(
    signed(
      'setmeta',
      1,
      encodeAction('setmeta', {
        runtime: reference.contract,
        dao_id: '1',
        member_id: '1',
        metadata: '{}',
      }),
    ),
  ).rejects.toThrow('DAO_CLOSED');
  await signed('leave', 1);
  expect(dao()).toMatchObject({ member_count: '0', admin_count: 0 });
  expect(member(1)).toMatchObject({ active: false, claim: '0', stake: '0' });
});
it('keeps a hosted DAO closing until its configured operator confirms external resource reconciliation', async () => {
  await send(runtime, 'sethosted', [10, 'relay'], 'daclifycore@active');
  await signed('startclose', 1);
  await expect(signed('closedao', 1)).rejects.toThrow('HOSTED_CLOSURE_PENDING');
  const closingAt = z
    .object({ transitioned_at: z.number() })
    .parse(row(runtime, 'daolife', runtime.toBigInt(), 1n)).transitioned_at;
  await expect(
    send(runtime, 'closehost', [1, closingAt, 'ab'.repeat(32)], 'alice@active'),
  ).rejects.toThrow();
  await expect(
    send(runtime, 'closehost', [1, closingAt + 1, 'ab'.repeat(32)], 'relay@active'),
  ).rejects.toThrow('HOSTED_CLOSURE_CONTEXT');
  await send(runtime, 'closehost', [1, closingAt, 'ab'.repeat(32)], 'relay@active');
  await send(runtime, 'closehost', [1, closingAt, '0'.repeat(64)], 'relay@active');
  await expect(signed('closedao', 1)).rejects.toThrow('HOSTED_CLOSURE_PENDING');
  await send(runtime, 'closehost', [1, closingAt, 'ab'.repeat(32)], 'relay@active');
  await signed('closedao', 1);
  expect(row(runtime, 'hostclose', runtime.toBigInt(), 1n)).toBeUndefined();
});
