import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ModulePermissions } from '@daclify/modules';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import {
  APIClient,
  APIError,
  ABI,
  UInt64,
  PermissionLevel,
  Checksum256,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
  Action,
} from '@wharfkit/antelope';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { fixtureNetwork } from '../../tools/native/network.js';
import { handoverOwnerActions, nativeOwnershipSetupActions } from '../../sdk/executives.js';
import { fixtureKey } from '../../tools/native/keys.js';
const network = fixtureNetwork(),
  api = new APIClient({ url: network.url });
const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
const memberKeys = [
  PrivateKey.generate('K1'),
  PrivateKey.generate('K1'),
  PrivateKey.generate('K1'),
];
const dao = '66001';
const serviceKey = PrivateKey.generate('K1');
async function push(
  action: string,
  data: object | unknown[],
  authorization: string[],
  keys: PrivateKey[],
  target = 'daclifycore',
) {
  const info = await api.v1.chain.get_info();
  const contractAbi =
    target === 'daclifycore'
      ? abi
      : ABI.from(readFileSync('.artifacts/modules-release/decide.abi', 'utf8'));
  const definition = contractAbi.structs.find((s) => s.name === action);
  if (!definition) throw new Error('FIXTURE_ACTION');
  if (action === 'handover' && Array.isArray(data) && data.length === 1)
    data = [dao, ['alice', 'bob'], 2, 1];
  const object = Array.isArray(data)
    ? Object.fromEntries(definition.fields.map((field, index) => [field.name, data[index]]))
    : data;
  const request = Action.from({
    account: target,
    name: action,
    authorization: authorization.map((value) => PermissionLevel.from(value)),
    data: Serializer.encode({ abi: contractAbi, type: action, object }),
  });
  const staging =
    action === 'handover'
      ? await handoverOwnerActions(
          'daclifycore',
          await Promise.all(
            ['daclifycore', 'works', 'decide'].map((account) => api.v1.chain.get_account(account)),
          ),
        )
      : [];
  const transaction = Transaction.from({
    ...info.getTransactionHeader(60),
    actions: [...staging, request],
  });
  try {
    return await api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: keys.map((k) => k.signDigest(transaction.signingDigest(info.chain_id))),
      }),
    );
  } catch (cause) {
    if (cause instanceof APIError)
      throw new Error(
        cause.details
          .map((d) => d.message)
          .join(' ')
          .replace(/PVT_[A-Za-z0-9_]+/g, '[redacted]'),
      );
    throw new Error('NATIVE_TRANSACTION_REJECTED');
  }
}
async function member(id: number) {
  const page = await api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: dao,
    table: 'members',
    key_type: 'i64',
    lower_bound: UInt64.from(id),
    limit: 1,
  });
  return RuntimeTableSchemas.members.parse(page.rows[0]);
}
async function act(
  action: string,
  fields: object,
  id: number,
  incoming?: string,
  target = 'daclifycore',
) {
  const person = await member(id),
    key = memberKeys[id - 1];
  if (!key) throw new Error('FIXTURE_MEMBER');
  const contractAbi =
    target === 'daclifycore'
      ? abi
      : ABI.from(readFileSync('.artifacts/modules-release/decide.abi', 'utf8'));
  const data = Serializer.encode({
    abi: contractAbi,
    type: action,
    object: { runtime: 'daclifycore', dao_id: dao, member_id: id, ...fields },
  }).hexString;
  const request = {
    version: 1,
    chain_id: network.chainId,
    deployment: 'daclifycore',
    dao_id: dao,
    member_id: id,
    nonce: person.nonce,
    expires: Math.floor(Date.now() / 1000) + 120,
    target,
    action,
    data,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  await push(
    'submit',
    [request, key.signDigest(digest)],
    ['relay@active', ...(incoming ? [incoming + '@active'] : [])],
    [fixtureKey('relay'), ...(incoming ? [fixtureKey(incoming)] : [])],
  );
}
async function permission(account: string, name: string) {
  const info = await api.v1.chain.get_account(account);
  const row = info.permissions.find((p) => p.perm_name.toString() === name);
  if (!row) throw new Error('PERMISSION_MISSING');
  return {
    threshold: row.required_auth.threshold.toNumber(),
    keys: row.required_auth.keys.map((k) => k.key.toString()),
    accounts: row.required_auth.accounts.map((p) => p.permission.toString()),
  };
}
beforeAll(async () => {
  execFileSync(process.execPath, ['--import', 'tsx', 'tools/native/install-modules.ts'], {
    stdio: 'pipe',
  });
  await push(
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    ['daclifycore@active'],
    [fixtureKey('daclifycore')],
  );
  await push(
    'listmod',
    ['decide', 'alice', 0, 1, '0.0000 TLOS', ModuleCodeHashes.decide, 'Native executive fixture'],
    ['daclifycore@active'],
    [fixtureKey('daclifycore')],
  );
  await push(
    'createdao',
    [dao, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
    ['alice@active'],
    [fixtureKey('alice')],
  );
  await push(
    'initgov',
    [
      dao,
      {
        participant_mode: 0,
        decide: 'decide',
        guardian: 'alice',
        kind: 0,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        governed_works: false,
        max_commitment: 100000,
        daily_commitment: 300000,
      },
    ],
    ['alice@active'],
    [fixtureKey('alice')],
  );
  for (const [index, key] of memberKeys.entries())
    await push(
      'enroll',
      [dao, index + 1, '', key.toPublic(), 'key', 0],
      ['alice@active'],
      [fixtureKey('alice')],
    );
  await push('appoint', [dao, [1, 2], 60, 10000], ['alice@active'], [fixtureKey('alice')]);
  await push(
    'setmodule',
    [
      dao,
      'decide',
      1,
      ModulePermissions.decide.actions,
      ModulePermissions.decide.grants,
      ModuleCodeHashes.decide,
    ],
    ['alice@active'],
    [fixtureKey('alice')],
  );
  const info = await api.v1.chain.get_info();
  const setup = Transaction.from({
    ...info.getTransactionHeader(60),
    actions: nativeOwnershipSetupActions('daclifycore', {
      dao_id: dao,
      contracts: ['works', 'decide'],
      service_key: serviceKey.toPublic().toString(),
    }),
  });
  await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...setup,
      signatures: [fixtureKey('daclifycore').signDigest(setup.signingDigest(info.chain_id))],
    }),
  );
});
it('keeps bootstrap permissions until an appointed executive pairs a native account', async () => {
  const before = await permission('daclifycore', 'owner');
  await expect(
    push(
      'handover',
      [dao],
      ['daclifycore@owner', 'works@owner', 'decide@owner'],
      [fixtureKey('daclifycore'), fixtureKey('works'), fixtureKey('decide')],
    ),
  ).rejects.toThrow('NATIVE_EXECUTIVE_REQUIRED');
  expect(await permission('daclifycore', 'owner')).toEqual(before);
  await act('linknative', { account: 'alice' }, 1, 'alice');
  await act('linknative', { account: 'bob' }, 2, 'bob');
  await expect(
    push('handover', [dao], ['daclifycore@owner'], [fixtureKey('daclifycore')]),
  ).rejects.toThrow();
  await expect(
    push(
      'handover',
      [dao, ['bob'], 1, 1],
      ['daclifycore@owner', 'works@owner', 'decide@owner'],
      [fixtureKey('daclifycore'), fixtureKey('works'), fixtureKey('decide')],
    ),
  ).rejects.toThrow('NATIVE_HANDOVER_CHANGED');
  await push(
    'handover',
    [dao],
    ['daclifycore@owner', 'works@owner', 'decide@owner'],
    [fixtureKey('daclifycore'), fixtureKey('works'), fixtureKey('decide')],
  );
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 2,
    accounts: ['alice@active', 'bob@active'],
    keys: [],
  });
  expect((await member(2)).admin).toBe(true);
  await expect(act('setroles', { target: 3, admin: true, reviewer: false }, 1)).rejects.toThrow(
    'NATIVE_EXECUTIVE_ROLES',
  );
  expect(await permission('works', 'owner')).toMatchObject({
    accounts: ['daclifycore@govern'],
    keys: [],
  });
  expect(await permission('works', 'active')).toMatchObject({
    accounts: ['daclifycore@govern', 'works@eosio.code'],
    keys: [],
  });
});
it('rejects a service key or a single executive changing the executive roster', async () => {
  await expect(
    push('appoint', [dao, [1], 60, 10000], ['daclifycore@govern'], [serviceKey]),
  ).rejects.toThrow();
  await expect(
    push('appoint', [dao, [1], 60, 10000], ['daclifycore@govern'], [fixtureKey('alice')]),
  ).rejects.toThrow();
});
it('accepts executive activity signed directly by the paired wallet without a vault key', async () => {
  const person = await member(2);
  const request = {
    version: 1,
    chain_id: network.chainId,
    deployment: 'daclifycore',
    dao_id: dao,
    member_id: '2',
    nonce: person.nonce,
    expires: Math.floor(Date.now() / 1000) + 120,
    target: 'daclifycore',
    action: 'heartbeat',
    data: Serializer.encode({
      abi,
      type: 'heartbeat',
      object: { runtime: 'daclifycore', dao_id: dao, member_id: '2' },
    }).hexString,
  };
  await expect(
    push('submitnat', [request], ['alice@active'], [fixtureKey('alice')]),
  ).rejects.toThrow();
  expect((await member(2)).nonce).toBe(person.nonce);
  await push(
    'submitnat',
    [request],
    [person.native_account + '@active'],
    [fixtureKey(person.native_account)],
  );
  expect(BigInt((await member(2)).nonce)).toBe(BigInt(person.nonce) + 1n);
});
it('allows the scoped hosting service to create a separate shared DAO', async () => {
  await push(
    'createdao',
    ['66002', 'daclifycore', '{}', 0, 'eosio.token', '4,TLOS'],
    ['daclifycore@service'],
    [serviceKey],
  );
  await expect(
    push(
      'setnativegov',
      ['66002', [], fixtureKey('daclifycore').toPublic()],
      ['daclifycore@service'],
      [serviceKey],
    ),
  ).rejects.toThrow();
});
it('removes a departed wallet transitively from runtime and module owner authority', async () => {
  await act('unlinknat', {}, 2);
  expect((await member(2)).admin).toBe(false);
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 1,
    accounts: ['alice@active'],
  });
  await expect(
    push('appoint', [dao, [1], 60, 10000], ['daclifycore@govern'], [fixtureKey('bob')]),
  ).rejects.toThrow();
});
it('blocks the final paired controller unlink, deactivation and replacement with an unpaired roster', async () => {
  await expect(act('unlinknat', {}, 1)).rejects.toThrow('LAST_NATIVE_EXECUTIVE');
  await expect(act('setactive', { target: 1, active: false }, 1)).rejects.toThrow();
  await expect(
    push('appoint', [dao, [3], 60, 10000], ['daclifycore@govern'], [fixtureKey('alice')]),
  ).rejects.toThrow('LAST_NATIVE_EXECUTIVE');
  expect((await member(1)).native_account).toBe('alice');
});
it('atomically replaces the final paired wallet and invalidates its former native authority', async () => {
  await expect(act('linknative', { account: 'bob' }, 1)).rejects.toThrow();
  expect((await member(1)).native_account).toBe('alice');
  await act('linknative', { account: 'bob' }, 1, 'bob');
  expect((await member(1)).native_account).toBe('bob');
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 1,
    accounts: ['bob@active'],
  });
  await expect(
    push('appoint', [dao, [1], 60, 10000], ['daclifycore@govern'], [fixtureKey('alice')]),
  ).rejects.toThrow();
  await push('appoint', [dao, [1], 60, 10000], ['daclifycore@govern'], [fixtureKey('bob')]);
});
it('refreshes an expired co-executive while the caller stays active, then restores returning weight', async () => {
  await act('linknative', { account: 'alice' }, 2, 'alice');
  await push('appoint', [dao, [1, 2], 60, 10000], ['daclifycore@govern'], [fixtureKey('bob')]);
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 2,
    accounts: ['alice@active', 'bob@active'],
  });
  const until = Date.now() + 62000;
  while (Date.now() < until) {
    await act('heartbeat', {}, 1);
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  await push('syncexec', [dao], ['relay@active'], [fixtureKey('relay')]);
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 1,
    accounts: ['bob@active'],
  });
  expect((await member(2)).admin).toBe(false);
  await act('heartbeat', {}, 2);
  expect((await member(2)).admin).toBe(true);
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 2,
    accounts: ['alice@active', 'bob@active'],
  });
}, 95000);
it('lets the first returning executive reactivate when every executive is inactive', async () => {
  await new Promise((resolve) => setTimeout(resolve, 62000));
  await act('heartbeat', {}, 1);
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 1,
    accounts: ['bob@active'],
  });
}, 85000);

it('schedules an unpaired elected successor and retains control until that member pairs', async () => {
  const now = Math.floor(Date.now() / 1000);
  await act(
    'putjson',
    {
      document_id: '1',
      version: 1,
      value: '{"rules":"Explicit executive election"}',
      envelope_version: 0,
      key_epoch: 0,
    },
    1,
  );
  await act(
    'newelect',
    {
      election_id: '1',
      title: 'Executives',
      document_id: '1',
      document_version: 1,
      nomination_close: now + 3,
      term_start: now + 70,
      term_end: now + 600,
      seats: 1,
    },
    1,
    undefined,
    'decide',
  );
  await act('nominate', { election_id: '1', active: true }, 3, undefined, 'decide');
  while (Math.floor(Date.now() / 1000) < now + 3)
    await new Promise((resolve) => setTimeout(resolve, 200));
  await act('startelect', { election_id: '1' }, 1, undefined, 'decide');
  await act('vote', { ballot_id: '1', choice: 1 }, 1, undefined, 'decide');
  await act('vote', { ballot_id: '1', choice: 1 }, 2, undefined, 'decide');
  while (Math.floor(Date.now() / 1000) <= now + 64)
    await new Promise((resolve) => setTimeout(resolve, 500));
  await push(
    'finalize',
    ['daclifycore', dao, '1'],
    ['relay@active'],
    [fixtureKey('relay')],
    'decide',
  );
  const pending = await api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: 'daclifycore',
    table: 'execpending',
    key_type: 'i64',
    lower_bound: UInt64.from(dao),
    limit: 1,
  });
  expect(RuntimeTableSchemas.execpending.parse(pending.rows[0])).toMatchObject({
    dao_id: dao,
    members: ['3'],
  });
  while (Math.floor(Date.now() / 1000) < now + 71)
    await new Promise((resolve) => setTimeout(resolve, 500));
  await push('syncexec', [dao], ['relay@active'], [fixtureKey('relay')]);
  expect((await member(3)).admin).toBe(false);
  await act('linknative', { account: 'carol' }, 3, 'carol');
  expect((await member(3)).admin).toBe(true);
  expect((await member(1)).admin).toBe(false);
  expect(await permission('daclifycore', 'govern')).toMatchObject({
    threshold: 1,
    accounts: ['carol@active'],
  });
  await expect(act('heartbeat', {}, 1)).rejects.toThrow('EXECUTIVE_REQUIRED');
}, 95000);
