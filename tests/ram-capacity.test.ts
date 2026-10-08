import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { Name } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
let chain: Blockchain, runtime: ReturnType<typeof loadContract>;
beforeEach(async () => {
  chain = new Blockchain();
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  chain.createAccounts('alice', 'eosio.token');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
});
it('refuses an unbacked capacity grant instead of manufacturing included bytes from configuration', async () => {
  await expect(
    send(runtime, 'checkrampool', ['daclifycore'], 'daclifycore@active'),
  ).rejects.toThrow('RAM_POOL_SENDER');
  await expect(
    send(runtime, 'grantdaoram', [1, 'daclifycore', 1, 262144, 20480, 32768], 'daclifycore@active'),
  ).rejects.toThrow('RAM_POOL_UNKNOWN');
  expect(row(runtime, 'daos', BigInt(Name.from('daclifycore').value.toString()), 1n)).toBeDefined();
});
