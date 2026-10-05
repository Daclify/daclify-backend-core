import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
import { z } from 'zod';

let runtime: ReturnType<typeof loadContract>;
let works: ReturnType<typeof loadContract>;
let payroll: ReturnType<typeof loadContract>;
const reserved = () =>
  z.object({ reserved: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).reserved;
beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  works = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  payroll = loadContract(chain, 'payroll', '.artifacts/contracts/modrelay');
  const token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, 'alice', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
    'alice@active',
  );
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, ['propose'], ['reserve', 'approve', 'cancel', 'govlock']],
    'alice@active',
  );
  await send(token, 'create', ['eosio.token', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '20.0000 TLOS', ''], 'eosio.token@active');
  await send(token, 'transfer', ['alice', 'daclifycore', '10.0000 TLOS', 'dao:1'], 'alice@active');
});

describe('module callback authority', () => {
  it('rejects a module account key that calls reserve directly', async () => {
    await expect(
      send(runtime, 'reserve', [1, 'works', 1, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('SOURCE_SENDER');
    expect(reserved()).toBe(0);
  });
  it('accepts the same reservation from the module contract', async () => {
    await send(works, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'works@active');
    expect(reserved()).toBe(10000);
  });
  it('rejects another contract impersonating the installed module', async () => {
    await expect(
      send(
        payroll,
        'impersonate',
        ['daclifycore', 'works', 1, 1, 1, '1.0000 TLOS', 0],
        'payroll@active',
      ),
    ).rejects.toThrow('SOURCE_SENDER');
    expect(reserved()).toBe(0);
  });
  it('rejects an inline callback from a module without the grant', async () => {
    await expect(
      send(payroll, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'payroll@active'),
    ).rejects.toThrow('MODULE_DISABLED');
    expect(reserved()).toBe(0);
  });
  it('rejects a direct governance lock and accepts the module contract', async () => {
    await expect(send(runtime, 'govlock', [1, 'works', 1, 500], 'works@active')).rejects.toThrow(
      'SOURCE_SENDER',
    );
    await send(works, 'govlock', ['daclifycore', 1, 1, 500], 'works@active');
    expect(
      z.object({ active_ballots: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n))
        .active_ballots,
    ).toBe(1);
  });
});
