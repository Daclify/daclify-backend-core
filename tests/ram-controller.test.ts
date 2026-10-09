import { Blockchain } from '@proton/vert';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Name } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';

it('requires operator authorization and refuses to seal an incomplete legacy scan', async () => {
  const chain = new Blockchain();
  const runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  chain.createAccounts('alice', 'eosio.token');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await expect(send(runtime, 'beginram', [[]], 'alice@active')).rejects.toThrow();
  await send(runtime, 'beginram', [[]], 'daclifycore@active');
  await expect(send(runtime, 'adoptram', [1, true, 25], 'daclifycore@active')).rejects.toThrow(
    'RAM_MIGRATION_INCOMPLETE',
  );
  await expect(send(runtime, 'sealram', [1], 'daclifycore@active')).rejects.toThrow(
    'RAM_MIGRATION_INCOMPLETE',
  );
  await expect(send(runtime, 'scanram', [1, 'unknown', 25], 'daclifycore@active')).rejects.toThrow(
    'RAM_MIGRATION_TABLE',
  );
  await expect(
    send(runtime, 'createdao', [2, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active'),
  ).rejects.toThrow('RAM_MIGRATION_GROWTH');
  expect(row(runtime, 'daos', BigInt(Name.from('daclifycore').value.toString()), 1n)).toMatchObject(
    { owner: 'alice' },
  );
});

it('seals complete scope coverage in bounded batches and retries without changing counters', async () => {
  const chain = new Blockchain();
  const runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  chain.createAccounts('alice', 'eosio.token');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  for (const id of [1, 2])
    await send(
      runtime,
      'createdao',
      [id, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
  await send(runtime, 'beginram', [[]], 'daclifycore@active');
  const families = readFileSync('contracts/common/ram_families.hpp', 'utf8');
  const global = families
    .split('#define DACLIFY_RAM_GLOBALS(X)')[1]
    ?.split('#define DACLIFY_RAM_SCOPED(X)')[0];
  const scoped = families.split('#define DACLIFY_RAM_SCOPED(X)')[1]?.split('inline std::vector')[0];
  if (!global || !scoped) throw new Error('MIGRATION_FAMILY_MANIFEST');
  const labels = (text: string) => [...text.matchAll(/X\("([a-z]+)",/g)].map((m) => m[1]);
  expect(labels(global)).toHaveLength(28);
  expect(labels(scoped)).toHaveLength(26);
  for (const table of labels(global))
    await send(runtime, 'scanram', [0, table, 25], 'daclifycore@active');
  for (const id of [1, 2])
    for (const table of labels(scoped))
      await send(runtime, 'scanram', [id, table, 25], 'daclifycore@active');
  for (const id of [1, 2])
    for (const claims of [false, true])
      await send(runtime, 'adoptram', [id, claims, 25], 'daclifycore@active');
  const scope = runtime.toBigInt();
  await send(runtime, 'sealram', [1], 'daclifycore@active');
  expect(
    row(runtime, 'rammigrate', scope, BigInt(Name.from('rammigrate').value.toString())),
  ).toMatchObject({ active: true, dao_cursor: 1 });
  await send(runtime, 'sealram', [1], 'daclifycore@active');
  expect(
    row(runtime, 'rammigrate', scope, BigInt(Name.from('rammigrate').value.toString())),
  ).toMatchObject({ active: false, dao_cursor: 2 });
  const before = runtime.tables.ramstats?.(1n).getTableRows();
  await send(runtime, 'sealram', [1], 'daclifycore@active');
  expect(runtime.tables.ramstats?.(1n).getTableRows()).toEqual(before);
  await expect(send(runtime, 'scanram', [1, 'members', 1], 'daclifycore@active')).rejects.toThrow(
    'RAM_MIGRATION_INACTIVE',
  );
  await send(runtime, 'createdao', [3, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await expect(
    send(runtime, 'inheritram', [1, 'daclifycore', 4096, 2048, 32768], 'daclifycore@active'),
  ).rejects.toThrow('RAM_POOL_UNKNOWN');
  expect(runtime.tables.raminherit?.(1n).getTableRows() ?? []).toEqual([]);
});
