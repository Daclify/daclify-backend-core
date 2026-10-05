import { beforeEach, describe, it, expect } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, send, row } from './helpers/vert.js';
let runtime: ReturnType<typeof loadContract>;
let token: ReturnType<typeof loadContract>;
let works: ReturnType<typeof loadContract>;
beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'bob');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  works = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 2, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const id of [1, 2])
    await send(
      runtime,
      'enroll',
      [1, id, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
  await send(
    runtime,
    'commitepoch',
    ['daclifycore', 1, 1, 1, 'ab'.repeat(32), '{}'],
    'daclifycore@active',
  );
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, [], ['reserve', 'approve', 'cancel', 'govlock']],
    'alice@active',
  );
  await send(token, 'create', ['alice', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '100.0000 TLOS', ''], 'alice@active');
  await send(token, 'transfer', ['alice', 'daclifycore', '10.0000 TLOS', 'dao:1'], 'alice@active');
});
const role = (target: number, admin: boolean, reviewer: boolean) => [
  'daclifycore',
  1,
  1,
  target,
  admin,
  reviewer,
];
const balance = () =>
  z
    .object({
      available: z.number(),
      reserved: z.number(),
      claims: z.number(),
      active_ballots: z.number(),
      admin_count: z.number(),
    })
    .parse(row(runtime, 'daos', runtime.toBigInt(), 1n));
describe('roles and encrypted epoch grants', () => {
  it('delegates an administrator and review role', async () => {
    await send(runtime, 'setroles', role(2, true, true), 'daclifycore@active');
    expect(balance().admin_count).toBe(2);
  });
  it('prevents demotion of the final administrator', async () => {
    await expect(
      send(runtime, 'setroles', role(1, false, false), 'daclifycore@active'),
    ).rejects.toThrow('LAST_ADMIN');
  });
  it('rejects role changes by a regular member', async () => {
    await expect(
      send(runtime, 'setroles', ['daclifycore', 1, 2, 2, true, true], 'daclifycore@active'),
    ).rejects.toThrow('ADMIN_REQUIRED');
  });
  it('stores a bounded opaque epoch grant for a member', async () => {
    await send(
      runtime,
      'grantkey',
      ['daclifycore', 1, 1, 2, 1, '{"schemaVersion":1,"ciphertext":"opaque"}'],
      'daclifycore@active',
    );
    expect(
      z
        .object({ recipient: z.number(), epoch: z.number() })
        .parse(row(runtime, 'keygrants', 1n, 2n)),
    ).toMatchObject({ recipient: 2, epoch: 1 });
  });
  it('rejects future epochs', async () => {
    await expect(
      send(runtime, 'grantkey', ['daclifycore', 1, 1, 2, 2, '{}'], 'daclifycore@active'),
    ).rejects.toThrow('KEY_EPOCH');
  });
  it('rejects duplicate epoch grants', async () => {
    const data = ['daclifycore', 1, 1, 2, 1, '{}'];
    await send(runtime, 'grantkey', data, 'daclifycore@active');
    await expect(send(runtime, 'grantkey', data, 'daclifycore@active')).rejects.toThrow(
      'KEY_GRANT_EXISTS',
    );
  });
  it('rejects a grant to an inactive member', async () => {
    await send(runtime, 'setactive', ['daclifycore', 1, 1, 2, false], 'daclifycore@active');
    await expect(
      send(runtime, 'grantkey', ['daclifycore', 1, 1, 2, 2, '{}'], 'daclifycore@active'),
    ).rejects.toThrow('MEMBER_INACTIVE');
  });
});
describe('bounded governance locks and financial exit', () => {
  it('freezes supply under a granted ballot lock', async () => {
    await send(works, 'govlock', [runtime.name.toString(), 1, 1, 500], 'works@active');
    expect(balance().active_ballots).toBe(1);
    await expect(send(runtime, 'grantcredit', [1, 2, 1], 'alice@active')).rejects.toThrow(
      'GOVERNANCE_LOCKED',
    );
  });
  it('rejects ungranted sources', async () => {
    await expect(send(runtime, 'govlock', [1, 'bob', 1, 500], 'bob@active')).rejects.toThrow(
      'SOURCE_SENDER',
    );
  });
  it('rejects repeated unlock and preserves the counter', async () => {
    await send(works, 'govlock', [runtime.name.toString(), 1, 1, 500], 'works@active');
    await send(works, 'govunlock', [runtime.name.toString(), 1, 1], 'works@active');
    await expect(
      send(works, 'govunlock', [runtime.name.toString(), 1, 1], 'works@active'),
    ).rejects.toThrow('LOCK_INACTIVE');
    expect(balance().active_ballots).toBe(0);
  });
  it('does not let another source unlock early', async () => {
    await send(works, 'govlock', [runtime.name.toString(), 1, 1, 500], 'works@active');
    await expect(send(runtime, 'govunlock', [1, 'works', 1], 'bob@active')).rejects.toThrow(
      'SOURCE_SENDER',
    );
  });
  it('pays an internal claim to the signed recipient account', async () => {
    await send(
      works,
      'reserve',
      [runtime.name.toString(), 1, 1, 2, '1.0000 TLOS', 0],
      'works@active',
    );
    await send(works, 'approveob', [runtime.name.toString(), 1, 1], 'works@active');
    await send(runtime, 'payob', [1, 'works', 1], 'bob@active');
    await send(
      runtime,
      'withdraw',
      ['daclifycore', 1, 2, 'bob', '1.0000 TLOS'],
      'daclifycore@active',
    );
    expect(balance().claims).toBe(0);
  });
  it('allows an offboarded member to withdraw an accepted liability', async () => {
    await send(
      works,
      'reserve',
      [runtime.name.toString(), 1, 1, 2, '1.0000 TLOS', 0],
      'works@active',
    );
    await send(works, 'approveob', [runtime.name.toString(), 1, 1], 'works@active');
    await send(runtime, 'payob', [1, 'works', 1], 'bob@active');
    await send(runtime, 'setactive', ['daclifycore', 1, 1, 2, false], 'daclifycore@active');
    await send(
      runtime,
      'withdraw',
      ['daclifycore', 1, 2, 'bob', '1.0000 TLOS'],
      'daclifycore@active',
    );
    expect(balance().claims).toBe(0);
  });
  it('rejects an overdrawn claim', async () => {
    await expect(
      send(runtime, 'withdraw', ['daclifycore', 1, 2, 'bob', '1.0000 TLOS'], 'daclifycore@active'),
    ).rejects.toThrow('INSUFFICIENT_CLAIM');
  });
  it('cannot withdraw through an untrusted callback', async () => {
    await expect(
      send(runtime, 'withdraw', ['daclifycore', 1, 2, 'bob', '1.0000 TLOS'], 'bob@active'),
    ).rejects.toThrow();
  });
});
