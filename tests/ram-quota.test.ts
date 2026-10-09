import { Blockchain } from '@proton/vert';
import { expect, it } from 'vitest';
import { loadContract, send, row } from './helpers/vert.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { listFirstParty } from './helpers/list-module.js';
import {
  RuntimeTableSchemas,
  makeInstruction,
  encodeAction,
  instructionDigest,
  type RuntimeActions,
} from '../sdk/index.js';
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
  await expect(
    send(runtime, 'inheritram', [1, 'daclifycore', 4096, 0, 32768], 'daclifycore@active'),
  ).rejects.toThrow('RAM_MIGRATION_INCOMPLETE');
});

it('refuses activating an actual old observer while legacy recovery metadata is missing', async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'eosio.token');
  const old = '.artifacts/observer-upgrade-old/runtime';
  const current = '.artifacts/contracts/runtime';
  const runtime = loadContract(chain, 'daclifycore', old);
  chain.createAccounts('bob', 'relay');
  const firstKey = PrivateKey.generate('K1');
  const nextKey = PrivateKey.generate('K1');
  const module = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  const token = loadContract(chain, 'test.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'initramobs', [], 'daclifycore@active');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'test.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, '', firstKey.toPublic().toString(), 'original recovery identity', 0],
    'alice@active',
  );
  expect(row(runtime, 'actors', 1n, 1n)).toBeUndefined();
  const moduleHash = createHash('sha256')
    .update(readFileSync('.artifacts/contracts/modrelay.wasm'))
    .digest('hex');
  await listFirstParty(runtime, 'works', moduleHash);
  await send(runtime, 'setramcode', ['works', moduleHash], 'daclifycore@active');
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, [], ['reserve', 'approve'], moduleHash],
    'alice@active',
  );
  await send(token, 'create', ['test.token', '1000.0000 TLOS'], 'test.token@active');
  await send(token, 'issue', ['alice', '10.0000 TLOS', ''], 'test.token@active');
  await send(token, 'transfer', ['alice', 'daclifycore', '10.0000 TLOS', 'dao:1'], 'alice@active');
  for (const id of [1, 2]) {
    await send(module, 'reserve', ['daclifycore', 1, id, 1, '1.0000 TLOS', 0], 'works@active');
    await send(module, 'approveob', ['daclifycore', 1, id], 'works@active');
  }
  await send(runtime, 'payob', [1, 'works', 1], 'alice@active');
  runtime.setContract(readFileSync(current + '.abi', 'utf8'), readFileSync(current + '.wasm'));
  await runtime.recreateVm();
  const hash = (artifact: string) =>
    createHash('sha256')
      .update(readFileSync(artifact + '.wasm'))
      .digest('hex');
  await send(runtime, 'rebindramobs', [hash(old), hash(current)], 'daclifycore@active');
  await expect(send(runtime, 'setdaoquota', [1, true], 'daclifycore@active')).rejects.toThrow(
    'RAM_CREDENTIAL_REQUIRED',
  );
  expect(row(runtime, 'ramquota', 1n, 0n)).toBeUndefined();
  async function govern<K extends 'rotatekey' | 'withdraw'>(
    action: K,
    data: RuntimeActions[K],
    signer: PrivateKey,
  ) {
    const member = RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n));
    const request = makeInstruction(
      { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      '1',
      member.nonce,
      chain.timestamp.toMilliseconds() / 1000 + 300,
      'daclifycore',
      action,
      encodeAction(action, data),
    );
    await send(
      runtime,
      'submit',
      [request, signer.signDigest(instructionDigest(request)).toString()],
      'relay@active',
    );
  }
  await govern(
    'rotatekey',
    {
      runtime: 'daclifycore',
      dao_id: '1',
      member_id: '1',
      signing_key: nextKey.toPublic().toString(),
    },
    firstKey,
  );
  await expect(send(runtime, 'setdaoquota', [1, true], 'daclifycore@active')).rejects.toThrow(
    'RAM_CLAIM_HOLD_REQUIRED',
  );
  await govern(
    'withdraw',
    {
      runtime: 'daclifycore',
      dao_id: '1',
      member_id: '1',
      destination: 'bob',
      quantity: '1.0000 TLOS',
    },
    nextKey,
  );
  await expect(send(runtime, 'setdaoquota', [1, true], 'daclifycore@active')).rejects.toThrow(
    'RAM_OBLIGATION_HOLD_REQUIRED',
  );
  expect(row(runtime, 'ramquota', 1n, 0n)).toBeUndefined();
  await expect(send(runtime, 'adoptram', [1, false, 1], 'alice@active')).rejects.toThrow();
  const prior = RuntimeTableSchemas.ramstats.parse(
    row(runtime, 'ramstats', 1n, runtime.toBigInt()),
  );
  await send(runtime, 'adoptram', [1, false, 1], 'daclifycore@active');
  await send(runtime, 'adoptram', [1, false, 1], 'daclifycore@active');
  await send(runtime, 'adoptram', [1, true, 1], 'daclifycore@active');
  const after = RuntimeTableSchemas.ramstats.parse(
    row(runtime, 'ramstats', 1n, runtime.toBigInt()),
  );
  expect(after.identity).toBe(prior.identity);
  expect(after.activity).toBe(prior.activity);
  expect(BigInt(after.retained)).toBeGreaterThan(BigInt(prior.retained));
  expect(row(runtime, 'ramholds', 1n, 2n)).toMatchObject({ recipient: 1, ready: false });
  await send(runtime, 'adoptram', [1, false, 1], 'daclifycore@active');
  await send(runtime, 'adoptram', [1, true, 1], 'daclifycore@active');
  expect(
    RuntimeTableSchemas.ramstats.parse(row(runtime, 'ramstats', 1n, runtime.toBigInt())),
  ).toEqual(after);
  await expect(
    send(runtime, 'inheritram', [1, 'daclifycore', 4096, 0, 32768], 'daclifycore@active'),
  ).rejects.toThrow('RAM_POOL_UNKNOWN');
  await expect(send(runtime, 'setdaoquota', [1, true], 'daclifycore@active')).rejects.toThrow(
    'RAM_POOL_UNKNOWN',
  );
});
