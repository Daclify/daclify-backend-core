import { afterAll, beforeAll, expect, it } from 'vitest';
import { Action, PrivateKey } from '@wharfkit/antelope';
import {
  encodeAction,
  nativeOwnershipSetupActions,
  handoverOwnerActions,
} from '../../sdk/index.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';

// Characterizes the existing govern handover, not the proposed creator-owner migration.
let owned: NativeContracts | undefined;
let governing: DummyDao, tenant: DummyDao;
const managed = ['daclifyhub', ...nativeModules.map((module) => module.account)];
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
    'govern',
    signers,
  );
}
async function handover(signers = ['alice', 'bob'], threshold = 2, revision = '1') {
  const f = fixture(),
    accounts = ['daclifycore', ...managed];
  const stages = handoverOwnerActions(
    'daclifycore',
    await Promise.all(accounts.map((account) => f.api.v1.chain.get_account(account))),
  );
  const action = Action.from({
    account: 'daclifycore',
    name: 'handover',
    authorization: accounts.map((actor) => ({ actor, permission: 'owner' })),
    data: encodeAction('handover', {
      dao_id: governing.daoId,
      expected_signers: signers,
      expected_threshold: threshold,
      expected_revision: revision,
    }),
  });
  return f.push(
    [...stages, action],
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

it('performs the existing handover atomically and explicitly removes bootstrap ownership', async () => {
  await handover();
  const root = await permissions('daclifycore');
  expect(root.find((row) => row.name === 'govern')).toMatchObject({
    parent: 'owner',
    threshold: 2,
    keys: [],
    accounts: [
      { permission: 'alice@active', weight: 1 },
      { permission: 'bob@active', weight: 1 },
    ],
  });
  expect(root.find((row) => row.name === 'owner')).toMatchObject({
    parent: '',
    threshold: 1,
    keys: [],
    accounts: [
      { permission: 'daclifycore@eosio.code', weight: 1 },
      { permission: 'daclifycore@govern', weight: 1 },
    ],
  });
  expect((await governing.member('2')).admin).toBe(true);
  expect((await tenant.member('2')).admin).toBe(false);
});

it.each(managed)(
  '%s delegates owner to the actual legacy executive quorum after handover',
  async (account) => {
    expect((await permissions(account)).find((row) => row.name === 'owner')).toMatchObject({
      threshold: 1,
      keys: [],
      accounts: [{ permission: 'daclifycore@govern', weight: 1 }],
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
      { dao_id: '99001', contracts: [], service_key: serviceKey.toPublic() },
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
      { dao_id: tenant.daoId, contracts: managed, service_key: serviceKey.toPublic() },
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
  expect((await permissions('daclifycore')).find((row) => row.name === 'govern')).toMatchObject({
    threshold: 1,
  });
  await appoint(['1', '2'], 10000, [fixture().key('alice')]);
  expect((await permissions('daclifycore')).find((row) => row.name === 'govern')).toMatchObject({
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
  expect((await permissions('daclifycore')).find((row) => row.name === 'govern')).toMatchObject({
    threshold: 1,
    accounts: [{ permission: 'alice@active', weight: 1 }],
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
  expect((await permissions('daclifycore')).find((row) => row.name === 'govern')).toMatchObject({
    threshold: 1,
    accounts: [{ permission: 'carol@active', weight: 1 }],
  });
  await expect(appoint(['1'], 10000, [fixture().key('alice')])).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  await appoint(['1'], 10000, [fixture().key('carol')]);
});
