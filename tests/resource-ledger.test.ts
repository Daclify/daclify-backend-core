import { Blockchain } from '@proton/vert';
import { beforeEach, expect, it } from 'vitest';
import { Name } from '@wharfkit/antelope';
import { loadContract, send, row } from './helpers/vert.js';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
beforeEach(async () => {
  chain = new Blockchain();
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  chain.createAccount({ name: 'alice' });
  chain.createAccount({ name: 'eosio.token' });
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
});
it('observes DAO ownership and native billed rows without granting capacity or changing authority', async () => {
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  const counter = z
    .object({
      activity: z.int().nonnegative(),
      identity: z.int().nonnegative(),
      retained: z.int().nonnegative(),
    })
    .parse(row(runtime, 'ramstats', 1n, BigInt(Name.from('daclifycore').value.toString())));
  expect(BigInt(counter.activity)).toBeGreaterThan(112n);
  expect(BigInt(counter.identity)).toBe(0n);
  expect(BigInt(counter.retained)).toBe(0n);
  expect(row(runtime, 'daos', BigInt(Name.from('daclifycore').value.toString()), 1n)).toMatchObject(
    {
      owner: 'alice',
    },
  );
});
it('rejects a signed counter adjustment that did not come from executing contract code', async () => {
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await expect(
    send(runtime, 'ramadjust', [1, 'daclifycore', 1, 100, 0], 'daclifycore@active'),
  ).rejects.toThrow('RAM_SOURCE_SENDER');
});
it('does not enable an incomplete observer over pre-existing unmigrated state', async () => {
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await expect(send(runtime, 'initramobs', [], 'daclifycore@active')).rejects.toThrow(
    'RAM_BACKFILL_REQUIRED',
  );
});
it('requires backfill for existing platform settings even before the first DAO', async () => {
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    'daclifycore@active',
  );
  await expect(send(runtime, 'initramobs', [], 'daclifycore@active')).rejects.toThrow(
    'RAM_BACKFILL_REQUIRED',
  );
});
it('requires a calibrated code pin before installing a module into an observed runtime', async () => {
  loadContract(chain, 'permprobe', '.artifacts/contracts/permprobe');
  const hash = createHash('sha256')
    .update(readFileSync('.artifacts/contracts/permprobe.wasm'))
    .digest('hex');
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    'daclifycore@active',
  );
  await send(
    runtime,
    'listmod',
    ['permprobe', 'alice', 0, 1, '0.0000 TLOS', hash, 'Probe'],
    'daclifycore@active',
  );
  await expect(
    send(runtime, 'setmodule', [1, 'permprobe', 1, ['checkauth'], [], hash], 'alice@active'),
  ).rejects.toThrow('RAM_SOURCE_UNKNOWN');
  await send(runtime, 'setramcode', ['permprobe', hash], 'daclifycore@active');
  await send(runtime, 'setmodule', [1, 'permprobe', 1, ['checkauth'], [], hash], 'alice@active');
});

it('requires backfill for existing resource settings before enabling observation', async () => {
  await send(
    runtime,
    'setresources',
    [500, 2000, '262144', '2048', 300, '100000000', '1000000000', 100],
    'daclifycore@active',
  );
  await expect(send(runtime, 'initramobs', [], 'daclifycore@active')).rejects.toThrow(
    'RAM_BACKFILL_REQUIRED',
  );
});
