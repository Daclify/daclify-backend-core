import { Blockchain } from '@proton/vert';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PrivateKey } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
import { RuntimeTableSchemas } from '../sdk/index.js';
it('adopts missing human credential state from the actual old core without rewriting original member bytes', async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'eosio.token');
  const runtime = loadContract(chain, 'daclifycore', '.artifacts/upgrade/core/runtime');
  const signing = PrivateKey.generate('K1').toPublic().toString();
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(runtime, 'enroll', [1, 1, '', signing, 'original encryption key', 0], 'alice@active');
  const original = RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n));
  expect(row(runtime, 'actors', 1n, 1n)).toBeUndefined();
  runtime.setContract(
    readFileSync('.artifacts/contracts/runtime.abi', 'utf8'),
    readFileSync('.artifacts/contracts/runtime.wasm'),
  );
  await runtime.recreateVm();
  await send(runtime, 'beginram', [[]], 'daclifycore@active');
  const manifest = readFileSync('contracts/common/ram_families.hpp', 'utf8');
  const global = manifest
    .split('#define DACLIFY_RAM_GLOBALS(X)')[1]
    ?.split('#define DACLIFY_RAM_SCOPED(X)')[0];
  const scoped = manifest.split('#define DACLIFY_RAM_SCOPED(X)')[1]?.split('inline std::vector')[0];
  if (!global || !scoped) throw new Error('OLD_RELEASE_FAMILY_MANIFEST');
  for (const [id, block] of [
    [0, global],
    [1, scoped],
  ] as const)
    for (const [, table] of block.matchAll(/X\("([a-z]+)",/g))
      await send(runtime, 'scanram', [id, table, 25], 'daclifycore@active');
  for (const claims of [false, true])
    await send(runtime, 'adoptram', [1, claims, 25], 'daclifycore@active');
  expect(RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n))).toEqual(original);
  expect(RuntimeTableSchemas.actors.parse(row(runtime, 'actors', 1n, 1n))).toMatchObject({
    kind: 0,
    credential_epoch: '1',
  });
});
