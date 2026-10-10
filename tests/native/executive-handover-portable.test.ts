import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrivateKey, Authority, Serializer } from '@wharfkit/antelope';
import {
  encodeAction,
  nativeOwnershipSetupActions,
  nativeHandoverActions,
  nativeOwnershipAuthorities,
  RuntimeTableSchemas,
} from '../../sdk/index.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';

// Exercises the actual versioned creator-owner/executive-active handover.
let owned: NativeContracts | undefined;
let governing: DummyDao, tenant: DummyDao;
const managed = ['daclifyhub', 'names', ...nativeModules.map((module) => module.account)];
const serviceKey = PrivateKey.generate('K1');
const fixture = () => {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
};
async function permissions(account: string) {
  return (await fixture().api.v1.chain.get_account(account)).permissions.map((row) => ({
    name: row.perm_name.toString(),
    parent: row.parent.toString(),
    threshold: row.required_auth.threshold.toNumber(),
    keys: row.required_auth.keys.map((key) => key.key.toString()),
    accounts: row.required_auth.accounts.map((account) => ({
      permission: account.permission.toString(),
      weight: account.weight.toNumber(),
    })),
  }));
}
async function appoint(
  members: string[],
  quorum = 10000,
  signers = [fixture().key('alice'), fixture().key('bob')],
) {
  return fixture().call(
    'daclifycore',
    'appoint',
    { dao_id: governing.daoId, member_ids: members, inactivity_seconds: 60, quorum_bps: quorum },
    'daclifycore',
    'active',
    signers,
  );
}
async function handover(signers = ['alice', 'bob'], threshold = 2, revision = '1') {
  const f = fixture(),
    accounts = ['daclifycore', ...managed];
  const rows = await f.api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: 'daclifycore',
    table: 'nativegov',
    limit: 1,
  });
  const config = RuntimeTableSchemas.nativegov.parse(rows.rows[0]);
  const actions = nativeHandoverActions(
    'daclifycore',
    config,
    {
      dao_id: governing.daoId,
      expected_signers: signers,
      expected_threshold: threshold,
      expected_revision: revision,
      expected_creator: 'recovery',
      expected_policy_version: 2,
    },
    await Promise.all(accounts.map((account) => f.api.v1.chain.get_account(account))),
  );
  return f.push(
    actions,
    accounts.map((account) => f.key(account)),
  );
}
beforeAll(async () => {
  owned = await nativeContracts();
  governing = await owned.dummyDao();
  tenant = await owned.dummyDao('bob');
  const account = await owned.api.v1.chain.get_account('daclifycore');
  await owned.push(contextLinkRepairActions(owned.context, account), [owned.key('daclifycore')]);
  await owned.call(
    'daclifycore',
    'appoint',
    { dao_id: governing.daoId, member_ids: ['1', '2'], inactivity_seconds: 60, quorum_bps: 10000 },
    'alice',
  );
  for (const [member, account] of [
    ['1', 'alice'],
    ['2', 'bob'],
  ] as const)
    await governing.act(
      'daclifycore',
      'linknative',
      encodeAction('linknative', { ...governing.actor(member), account }),
      member,
      account,
    );
  await owned.push(
    nativeOwnershipSetupActions('daclifycore', {
      dao_id: governing.daoId,
      contracts: managed,
      creator: 'recovery',
      inline_code: ['names', ...nativeModules.map((module) => module.account)],
      service_key: serviceKey.toPublic().toString(),
    }),
    [owned.key('daclifycore')],
  );
}, 90000);
afterAll(async () => {
  await owned?.stop();
});

it.each([
  [['alice'], 1, '1'],
  [['alice', 'bob'], 1, '1'],
  [['alice', 'bob'], 2, '99'],
] as const)(
  'rejects a stale handover snapshot %j and rolls back every temporary owner grant',
  async (signers, threshold, revision) => {
    const before = await Promise.all(['daclifycore', ...managed].map(permissions));
    await expect(handover([...signers], threshold, revision)).rejects.toThrow(
      'NATIVE_HANDOVER_CHANGED',
    );
    expect(await Promise.all(['daclifycore', ...managed].map(permissions))).toEqual(before);
  },
);

it('preserves creator recovery when the actual contract performs handover', async () => {
  await handover();
  expect((await permissions('daclifycore')).find((row) => row.name === 'owner')).toMatchObject({
    threshold: 1,
    keys: [],
    accounts: [{ permission: 'recovery@active', weight: 1 }],
  });
});

it('installs the complete policy without bootstrap keys or a govern permission', async () => {
  const expected = nativeOwnershipAuthorities(
    'daclifycore',
    {
      creator: 'recovery',
      contracts: managed,
      inline_code: ['names', ...nativeModules.map((module) => module.account)],
    },
    ['alice', 'bob'],
    2,
  );
  for (const plan of expected) {
    const actual = await fixture().api.v1.chain.get_account(plan.account);
    for (const name of ['owner', 'active'] as const)
      expect(
        actual.permissions
          .find((row) => row.perm_name.toString() === name)
          ?.required_auth.equals(Authority.from(plan[name])),
      ).toBe(true);
    expect(actual.permissions.some((row) => row.perm_name.toString() === 'govern')).toBe(false);
    const upgradeLinks = actual.permissions
      .find((row) => row.perm_name.toString() === plan.upgradePermission)
      ?.linked_actions?.filter((link) => link.account.toString() === 'eosio')
      .map((link) => link.action?.toString());
    expect(upgradeLinks).toEqual(expect.arrayContaining(['setcode', 'setabi']));
  }
  expect((await governing.member('2')).admin).toBe(true);
  expect((await tenant.member('2')).admin).toBe(false);
});

it('requires executive quorum for a real runtime ABI upgrade and prevents replacing creator owner', async () => {
  const f = fixture(),
    abi = Serializer.encode({ object: f.abi('daclifycore') });
  const upgrade = f.system('setabi', { account: 'daclifycore', abi }, 'daclifycore', 'active');
  await expect(f.push([upgrade], [f.key('alice')])).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await f.push([upgrade], [f.key('alice'), f.key('bob')]);
  const owner = (await f.api.v1.chain.get_account('daclifycore')).permissions.find(
    (row) => row.perm_name.toString() === 'owner',
  );
  if (!owner) throw new Error('Fixture owner required');
  const change = f.system(
    'updateauth',
    { account: 'daclifycore', permission: 'owner', parent: '', auth: owner.required_auth },
    'daclifycore',
    'active',
  );
  await expect(f.push([change], [f.key('alice'), f.key('bob')])).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
});

it('permits creator recovery to restore active while keeping owner creator-only', async () => {
  const f = fixture(),
    active = (await f.api.v1.chain.get_account('daclifycore')).permissions.find(
      (row) => row.perm_name.toString() === 'active',
    );
  if (!active) throw new Error('Fixture active required');
  await f.push(
    [
      f.system(
        'updateauth',
        {
          account: 'daclifycore',
          permission: 'active',
          parent: 'owner',
          auth: active.required_auth,
        },
        'daclifycore',
        'owner',
      ),
    ],
    [f.key('recovery')],
  );
  expect((await permissions('daclifycore')).find((row) => row.name === 'owner')?.accounts).toEqual([
    { permission: 'recovery@active', weight: 1 },
  ]);
});

it.each(managed)(
  '%s delegates owner to the runtime active quorum after handover',
  async (account) => {
    expect((await permissions(account)).find((row) => row.name === 'owner')).toMatchObject({
      threshold: 1,
      keys: [],
      accounts: [{ permission: 'daclifycore@active', weight: 1 }],
    });
    await expect(
      fixture().push(
        [fixture().system('setabi', { account, abi: '00' }, account, 'owner')],
        [fixture().key(account)],
      ),
    ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  },
);

it.each(['service', 'single executive', 'bootstrap'])(
  '%s cannot appoint native executives after handover',
  async (kind) => {
    const keys =
      kind === 'service'
        ? [serviceKey]
        : [fixture().key(kind === 'bootstrap' ? 'daclifycore' : 'alice')];
    await expect(appoint(['1'], 10000, keys)).rejects.toThrow('NATIVE_AUTH_REJECTED');
  },
);

it('lets the scoped service create a separate DAO without granting native governance', async () => {
  const f = fixture();
  await f.call(
    'daclifycore',
    'createdao',
    {
      dao_id: '99001',
      owner: 'daclifycore',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'daclifycore',
    'service',
    [serviceKey],
  );
  await expect(
    f.call(
      'daclifycore',
      'setnativegov',
      {
        dao_id: '99001',
        contracts: [],
        service_key: serviceKey.toPublic(),
        creator: 'recovery',
        inline_code: [],
      },
      'daclifycore',
      'service',
      [serviceKey],
    ),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
});

it('prevents a shared tenant from claiming executive control or escalating ordinary app roles', async () => {
  const f = fixture(),
    before = await permissions('daclifycore');
  await expect(
    f.call(
      'daclifycore',
      'setnativegov',
      {
        dao_id: tenant.daoId,
        contracts: managed,
        service_key: serviceKey.toPublic(),
        creator: 'recovery',
        inline_code: ['names'],
      },
      'bob',
    ),
  ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await expect(
    governing.act(
      'daclifycore',
      'setroles',
      encodeAction('setroles', { ...governing.actor(), target: '3', admin: true, reviewer: false }),
    ),
  ).rejects.toThrow('NATIVE_EXECUTIVE_ROLES');
  expect(await permissions('daclifycore')).toEqual(before);
});

it('keeps quorum configurable and synchronizes the actual permission immediately', async () => {
  await appoint(['1', '2'], 5000);
  expect((await permissions('daclifycore')).find((row) => row.name === 'active')).toMatchObject({
    threshold: 1,
  });
  await appoint(['1', '2'], 10000, [fixture().key('alice')]);
  expect((await permissions('daclifycore')).find((row) => row.name === 'active')).toMatchObject({
    threshold: 2,
  });
});

it('removes a departing wallet from transitive native control while retaining the other controller', async () => {
  await governing.act(
    'daclifycore',
    'unlinknat',
    encodeAction('unlinknat', governing.actor('2')),
    '2',
  );
  expect((await governing.member('2')).admin).toBe(false);
  expect((await permissions('daclifycore')).find((row) => row.name === 'active')).toMatchObject({
    threshold: 1,
    accounts: [
      { permission: 'alice@active', weight: 1 },
      { permission: 'daclifycore@eosio.code', weight: 1 },
    ],
  });
  await expect(appoint(['1'], 10000, [fixture().key('bob')])).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
});

it('protects the final paired native controller and rolls back its failed unlink', async () => {
  const before = await governing.member();
  await expect(
    governing.act('daclifycore', 'unlinknat', encodeAction('unlinknat', governing.actor())),
  ).rejects.toThrow('LAST_NATIVE_EXECUTIVE');
  expect(await governing.member()).toEqual(before);
  await expect(appoint(['3'], 10000, [fixture().key('alice')])).rejects.toThrow(
    'LAST_NATIVE_EXECUTIVE',
  );
});

it('moves the final controller to an incoming wallet only with both consents, leaving no former authority', async () => {
  const request = await governing.request(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...governing.actor(), account: 'carol' }),
  );
  await expect(governing.submit(request)).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await governing.submit(request, '1', 'carol');
  expect((await permissions('daclifycore')).find((row) => row.name === 'active')).toMatchObject({
    threshold: 1,
    accounts: [
      { permission: 'carol@active', weight: 1 },
      { permission: 'daclifycore@eosio.code', weight: 1 },
    ],
  });
  await expect(appoint(['1'], 10000, [fixture().key('alice')])).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  await appoint(['1'], 10000, [fixture().key('carol')]);
});
