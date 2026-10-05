import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey, Asset } from '@wharfkit/antelope';
import { z } from 'zod';
import { send, row, loadContract } from './helpers/vert.js';
let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
let token: ReturnType<typeof loadContract>;
let rogue: ReturnType<typeof loadContract>;
const units = z.union([z.string(), z.number().int().safe()]).transform((value) => BigInt(value));
const ledgerSchema = z.object({ available: units, reserved: units, claims: units, staked: units });
function ledger(id = 1) {
  return ledgerSchema.parse(row(runtime, 'daos', runtime.toBigInt(), BigInt(id)));
}
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'works', 'payroll');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  rogue = loadContract(chain, 'rogue.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  for (const t of [token, rogue]) {
    await send(t, 'create', [t.name.toString(), '1000000.0000 TLOS'], `${t.name}@active`);
    await send(t, 'issue', ['alice', '1000.0000 TLOS', ''], `${t.name}@active`);
  }
  for (const id of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [id, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [id, 1, 'alice', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
    await send(
      runtime,
      'setmodule',
      [id, 'works', 1, [], ['reserve', 'approve', 'cancel']],
      'alice@active',
    );
  }
});
async function deposit(amount = '20.0000 TLOS', memo = 'dao:1', t = token) {
  await send(t, 'transfer', ['alice', 'daclifycore', amount, memo], 'alice@active');
}
async function reserve(id = 1, quantity = '5.0000 TLOS', source = 'works', dao = 1) {
  await send(runtime, 'reserve', [dao, source, id, 1, quantity, 0], `${source}@active`);
}
describe('native treasury backing and obligations', () => {
  it('credits only the receiving DAO', async () => {
    await deposit();
    expect(ledger(1).available).toBe(200000n);
    expect(ledger(2).available).toBe(0n);
  });
  it('rejects a rogue same-symbol token notification and rolls back transfer', async () => {
    await expect(deposit('20.0000 TLOS', 'dao:1', rogue)).rejects.toThrow('TOKEN_IDENTITY');
    expect(ledger().available).toBe(0n);
  });
  it.each(['', 'dao:0', 'dao:3', 'dao:01', 'stake:1:999', 'dao:1:unexpected'])(
    'rejects unsupported deposit reference %s',
    async (memo) => {
      await expect(deposit('20.0000 TLOS', memo)).rejects.toThrow();
      expect(ledger().available).toBe(0n);
    },
  );
  it('reserves funds without changing total recorded backing', async () => {
    await deposit();
    await reserve();
    expect(ledger()).toMatchObject({ available: 150000n, reserved: 50000n, claims: 0n });
  });
  it('rejects overcommitment', async () => {
    await deposit();
    await expect(reserve(1, '20.0001 TLOS')).rejects.toThrow('INSUFFICIENT_AVAILABLE');
  });
  it('requires a granted module and its native authority', async () => {
    await deposit();
    await expect(
      send(runtime, 'reserve', [1, 'works', 1, 1, '1.0000 TLOS', 0], 'bob@active'),
    ).rejects.toThrow();
    await expect(reserve(1, '1.0000 TLOS', 'payroll')).rejects.toThrow('MODULE_DISABLED');
  });
  it('rejects duplicate source obligations', async () => {
    await deposit();
    await reserve();
    await expect(reserve()).rejects.toThrow('OBLIGATION_EXISTS');
    expect(ledger().reserved).toBe(50000n);
  });
  it('keeps equal source ids separate between DAOs', async () => {
    await deposit('20.0000 TLOS', 'dao:1');
    await deposit('20.0000 TLOS', 'dao:2');
    await reserve();
    await reserve(1, '5.0000 TLOS', 'works', 2);
    expect(ledger(1).reserved).toBe(50000n);
    expect(ledger(2).reserved).toBe(50000n);
  });
  it('rejects an unapproved payout', async () => {
    await deposit();
    await reserve();
    await expect(send(runtime, 'payob', [1, 'works', 1], 'bob@active')).rejects.toThrow(
      'NOT_PAYABLE',
    );
  });
  it('settles a native obligation once and conserves backing', async () => {
    await deposit();
    await reserve();
    await send(runtime, 'approveob', [1, 'works', 1], 'works@active');
    await send(runtime, 'payob', [1, 'works', 1], 'bob@active');
    expect(ledger()).toMatchObject({ available: 150000n, reserved: 0n, claims: 0n });
    const balance = z
      .object({ balance: z.string() })
      .parse(
        row(
          token,
          'accounts',
          runtime.toBigInt(),
          BigInt(Asset.SymbolCode.from('TLOS').value.toString()),
        ),
      );
    expect(balance.balance).toBe('15.0000 TLOS');
    await expect(send(runtime, 'payob', [1, 'works', 1], 'bob@active')).rejects.toThrow(
      'NOT_PAYABLE',
    );
  });
  it('cancels only an unapproved reservation', async () => {
    await deposit();
    await reserve();
    await send(runtime, 'cancelob', [1, 'works', 1], 'works@active');
    expect(ledger()).toMatchObject({ available: 200000n, reserved: 0n });
    await expect(send(runtime, 'cancelob', [1, 'works', 1], 'works@active')).rejects.toThrow();
  });
  it('cannot cancel an accepted obligation', async () => {
    await deposit();
    await reserve();
    await send(runtime, 'approveob', [1, 'works', 1], 'works@active');
    await expect(send(runtime, 'cancelob', [1, 'works', 1], 'works@active')).rejects.toThrow(
      'NOT_CANCELLABLE',
    );
  });
  it('keeps governance stake separate from treasury funding', async () => {
    await deposit('10.0000 TLOS', 'stake:1:1');
    expect(ledger()).toMatchObject({ available: 0n, staked: 100000n });
  });
  it('rejects staking for a different native member', async () => {
    await send(token, 'issue', ['bob', '10.0000 TLOS', ''], 'eosio.token@active');
    await expect(
      send(token, 'transfer', ['bob', 'daclifycore', '10.0000 TLOS', 'stake:1:1'], 'bob@active'),
    ).rejects.toThrow('STAKE_OWNER');
  });
});
