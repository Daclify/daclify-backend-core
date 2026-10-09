import { beforeEach, describe, it, expect } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, send, row } from './helpers/vert.js';
import { wasmCodeHash } from './helpers/code-hash.js';
import { listFirstParty } from './helpers/list-module.js';
const worksHash = wasmCodeHash('.artifacts/contracts/modrelay.wasm');
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
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await send(runtime, 'setramcode', ['works', worksHash], 'daclifycore@active');
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
  await listFirstParty(runtime, 'works', worksHash);
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, [], ['reserve', 'approve', 'cancel', 'govlock'], worksHash],
    'alice@active',
  );
  await send(token, 'create', ['alice', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '100.0000 TLOS', ''], 'alice@active');
  await send(token, 'open', ['bob', '4,TLOS', 'bob'], 'bob@active');
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
  it('backs each accepted obligation with real completion space without a premature receipt', async () => {
    await send(
      works,
      'reserve',
      [runtime.name.toString(), 1, 1, 2, '1.0000 TLOS', 0],
      'works@active',
    );
    expect(row(runtime, 'ramholds', 1n, 1n)).toMatchObject({ recipient: 2, ready: false });
    expect(row(runtime, 'receipts', 1n, 1n)).toBeUndefined();
    await send(works, 'cancelob', [runtime.name.toString(), 1, 1], 'works@active');
    expect(row(runtime, 'ramholds', 1n, 1n)).toBeUndefined();
    expect(balance()).toMatchObject({ available: 100000, reserved: 0, claims: 0 });
  });
  it('retains full-claim receipt space through partial exits and releases it on full exit', async () => {
    await send(
      works,
      'reserve',
      [runtime.name.toString(), 1, 1, 2, '1.0000 TLOS', 0],
      'works@active',
    );
    await send(works, 'approveob', [runtime.name.toString(), 1, 1], 'works@active');
    await send(runtime, 'payob', [1, 'works', 1], 'bob@active');
    expect(row(runtime, 'ramholds', 1n, 1n)).toMatchObject({ recipient: 2, ready: true });
    await send(
      runtime,
      'withdraw',
      ['daclifycore', 1, 2, 'bob', '0.2500 TLOS'],
      'daclifycore@active',
    );
    expect(row(runtime, 'ramholds', 1n, 1n)).toMatchObject({ ready: true });
    expect(balance().claims).toBe(7500);
    await send(
      runtime,
      'withdraw',
      ['daclifycore', 1, 2, 'bob', '0.7500 TLOS'],
      'daclifycore@active',
    );
    expect(row(runtime, 'ramholds', 1n, 1n)).toBeUndefined();
    expect(balance().claims).toBe(0);
    expect(row(runtime, 'receipts', 1n, 3n)).toMatchObject({ kind: 2, quantity: '0.7500 TLOS' });
  });
  it('cleans surplus ready holds in bounded batches without touching pending obligations or receipts', async () => {
    for (const id of [1, 2, 3]) {
      await send(
        works,
        'reserve',
        [runtime.name.toString(), 1, id, 2, '1.0000 TLOS', 0],
        'works@active',
      );
      if (id < 3) {
        await send(works, 'approveob', [runtime.name.toString(), 1, id], 'works@active');
        await send(runtime, 'payob', [1, 'works', id], 'bob@active');
      }
    }
    await expect(send(runtime, 'clearholds', [1, 2, 25], 'bob@active')).rejects.toThrow(
      'CLAIM_OUTSTANDING',
    );
    await send(
      runtime,
      'withdraw',
      ['daclifycore', 1, 2, 'bob', '2.0000 TLOS'],
      'daclifycore@active',
    );
    await expect(send(runtime, 'clearholds', [1, 2, 0], 'bob@active')).rejects.toThrow(
      'RAM_HOLD_BATCH',
    );
    await expect(send(runtime, 'clearholds', [1, 2, 26], 'bob@active')).rejects.toThrow(
      'RAM_HOLD_BATCH',
    );
    await send(runtime, 'clearholds', [1, 2, 1], 'bob@active');
    expect(row(runtime, 'ramholds', 1n, 2n)).toBeUndefined();
    expect(row(runtime, 'ramholds', 1n, 3n)).toMatchObject({ ready: false });
    expect(row(runtime, 'receipts', 1n, 3n)).toMatchObject({ kind: 2, quantity: '2.0000 TLOS' });
    await send(runtime, 'clearholds', [1, 2, 25], 'bob@active');
    expect(balance()).toMatchObject({ available: 70000, reserved: 10000, claims: 0 });
  });
  it('releases at most 25 accumulated ready holds on full exit and lets bounded cleanup finish', async () => {
    for (let id = 1; id <= 29; id++) {
      await send(
        works,
        'reserve',
        [runtime.name.toString(), 1, id, 2, '0.0100 TLOS', 0],
        'works@active',
      );
      if (id <= 28) {
        await send(works, 'approveob', [runtime.name.toString(), 1, id], 'works@active');
        await send(runtime, 'payob', [1, 'works', id], 'bob@active');
      }
    }
    await send(
      runtime,
      'withdraw',
      ['daclifycore', 1, 2, 'bob', '0.2800 TLOS'],
      'daclifycore@active',
    );
    expect(row(runtime, 'ramholds', 1n, 25n)).toBeUndefined();
    expect(row(runtime, 'ramholds', 1n, 26n)).toMatchObject({ ready: true });
    await send(runtime, 'clearholds', [1, 2, 1], 'bob@active');
    expect(row(runtime, 'ramholds', 1n, 26n)).toBeUndefined();
    expect(row(runtime, 'ramholds', 1n, 27n)).toMatchObject({ ready: true });
    await send(runtime, 'clearholds', [1, 2, 25], 'bob@active');
    expect(row(runtime, 'ramholds', 1n, 28n)).toBeUndefined();
    expect(row(runtime, 'ramholds', 1n, 29n)).toMatchObject({ ready: false });
    expect(balance()).toMatchObject({ claims: 0, reserved: 100 });
  });
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
    expect(row(runtime, 'receipts', 1n, 1n)).toMatchObject({
      kind: 0,
      obligation_id: 1,
      recipient: 2,
      destination: '',
      quantity: '1.0000 TLOS',
    });
    expect(row(runtime, 'receipts', 1n, 2n)).toMatchObject({
      kind: 2,
      obligation_id: 0,
      recipient: 2,
      destination: 'bob',
      quantity: '1.0000 TLOS',
    });
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
