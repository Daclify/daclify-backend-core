import { Blockchain } from '@proton/vert';
import { expect, it } from 'vitest';
import { loadContract, send, row } from './helpers/vert.js';
it('refuses enabling DAO RAM enforcement without actual backed allocations', async () => {
  const chain = new Blockchain();
  const runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  chain.createAccounts('alice', 'eosio.token');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await expect(send(runtime, 'setdaoquota', [1, true], 'alice@active')).rejects.toThrow();
  await expect(send(runtime, 'setdaoquota', [1, true], 'daclifycore@active')).rejects.toThrow(
    'RAM_POOL_UNKNOWN',
  );
  expect(row(runtime, 'ramquota', 1n, 0n)).toBeUndefined();
});
