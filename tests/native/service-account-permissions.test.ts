import { afterAll, beforeAll, expect, it } from 'vitest';
import { Authority, PrivateKey, Serializer } from '@wharfkit/antelope';
import { serviceAccountPermissionActions } from '../../sdk/service-accounts.js';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/generated/releases.js';
import { HubDeploymentRowSchema } from '../../protocol/directory.js';
let owned: NativeContracts | undefined;
function fixture() {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
}
const executives = () => [fixture().key('alice'), fixture().key('bob')];
beforeAll(async () => {
  owned = await nativeContracts();
  const f = fixture();
  await f.create('fees');
  await f.call(
    'eosio.token',
    'transfer',
    { from: 'alice', to: 'fees', quantity: '3.0000 TLOS', memo: 'Dummy treasury verification' },
    'alice',
  );
  await f.push(
    contextLinkRepairActions(f.context, await f.api.v1.chain.get_account('daclifycore')),
    [f.key('daclifycore')],
  );
  await f.executiveTree();
  await f.call(
    'daclifycore',
    'setcreate',
    { shared_usd: 0, independent_usd: 5000, premium_bps: 2000, settler: 'relay' },
    'daclifycore',
    'active',
    executives(),
  );
  await f.call(
    'daclifycore',
    'sethosted',
    { free_members: 10, settler: 'relay' },
    'daclifycore',
    'active',
    executives(),
  );
  await f.push(
    serviceAccountPermissionActions({
      runtime: 'daclifycore',
      relay: 'relay',
      treasury: 'fees',
      names: 'names',
      decide: 'decide',
      payroll: 'payroll',
      relayKey: f.key('relay').toPublic().toString(),
    }),
    [f.key('relay'), f.key('fees')],
  );
}, 90000);
afterAll(async () => owned?.stop());

it('runs a real API free-creation order through Relay operator after removing its active key', async () => {
  const f = fixture();
  const gateway = new NativeChainGateway({
    rpcUrl: f.url,
    chainId: f.chainId,
    runtime: 'daclifycore',
    hub: 'daclifyhub',
    environment: 'local',
    relayActor: 'relay',
    relayKey: f.key('relay'),
    relayPermission: 'operator',
  });
  const reference = 'ab'.repeat(32),
    creator = PrivateKey.generate('K1').toPublic().toString();
  expect(await gateway.orderCreation(reference, creator, 'free')).toMatchObject({
    reference,
    creator,
  });
});
it('keeps Relay and Fees owner/active free of operator keys and code grants', async () => {
  for (const name of ['relay', 'fees']) {
    const account = await fixture().api.v1.chain.get_account(name);
    for (const perm of ['owner', 'active']) {
      const authority = account.permissions.find(
        (p) => p.perm_name.toString() === perm,
      )?.required_auth;
      expect(JSON.parse(JSON.stringify(authority))).toEqual({
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'daclifycore', permission: 'active' }, weight: 1 }],
      });
    }
  }
});
it('denies operator-key recovery, link expansion and treasury authority while accepting executive quorum', async () => {
  const f = fixture();
  const active = (await f.api.v1.chain.get_account('fees')).permissions.find(
    (p) => p.perm_name.toString() === 'active',
  );
  if (!active) throw new Error('FIXTURE_PERMISSION_REQUIRED');
  const update = f.system(
    'updateauth',
    { account: 'fees', permission: 'active', parent: 'owner', auth: active.required_auth },
    'fees',
    'active',
  );
  await expect(f.push([update], [f.key('relay')])).rejects.toThrow();
  await expect(f.push([update], [f.key('alice')])).rejects.toThrow();
  await f.push([update], executives());
  const expansion = f.system(
    'linkauth',
    { account: 'relay', code: 'eosio.token', type: 'transfer', requirement: 'operator' },
    'relay',
    'operator',
  );
  await expect(f.push([expansion], [f.key('relay')])).rejects.toThrow();
  const root = f.system(
    'updateauth',
    { account: 'relay', permission: 'active', parent: 'owner', auth: active.required_auth },
    'relay',
    'operator',
  );
  await expect(f.push([root], [f.key('relay')])).rejects.toThrow();
  const upgraded = f.system(
    'setabi',
    { account: 'relay', abi: Serializer.encode({ object: f.abi('daclifycore') }) },
    'relay',
    'operator',
  );
  await expect(f.push([upgraded], [f.key('relay')])).rejects.toThrow();
});
it('protects actual dummy treasury tokens from both legacy keys and a partial executive quorum', async () => {
  const f = fixture();
  const transfer = f.action(
    'eosio.token',
    'transfer',
    {
      from: 'fees',
      to: 'carol',
      quantity: '1.0000 TLOS',
      memo: 'Dummy executive-authorized payment',
    },
    [{ actor: 'fees', permission: 'active' }],
    f.abi('eosio.token'),
  );
  await expect(f.push([transfer], [f.key('relay')])).rejects.toThrow();
  await expect(f.push([transfer], [f.key('fees')])).rejects.toThrow();
  await expect(f.push([transfer], [f.key('alice')])).rejects.toThrow();
  await f.push([transfer], executives());
  const balance = await f.api.v1.chain.get_currency_balance('eosio.token', 'fees', 'TLOS');
  expect(balance.map((value) => value.toString())).toEqual(['2.0000 TLOS']);
});

it('refreshes Hub release hashes with executive authority and denies the operator key', async () => {
  const f = fixture();
  const data = {
    runtime: 'daclifycore',
    owner: 'daclifycore',
    chain_id: f.chainId,
    interface_version: 1,
    code_hash: RuntimeCodeHash,
    abi_hash: RuntimeRawAbiHash,
    metadata: '{"schemaVersion":1,"title":"Dummy DAO"}',
    listed: true,
  };
  await expect(
    f.call('daclifyhub', 'regdeploy', data, 'daclifycore', 'active', [f.key('relay')]),
  ).rejects.toThrow();
  await f.call('daclifyhub', 'regdeploy', data, 'daclifycore', 'active', executives());
  const rows = await f.api.v1.chain.get_table_rows({
    code: 'daclifyhub',
    scope: 'daclifyhub',
    table: 'deployments',
    limit: 1,
  });
  expect(HubDeploymentRowSchema.parse(rows.rows[0])).toMatchObject(data);
});

it.each([
  ['fees', '4', null],
  ['relay', '5', null],
  ['recovexeca', '6', 'active'],
  ['recovexecb', '7', 'owner'],
] as const)(
  'rejects governed %s as an executive before creating a circular authority',
  async (account, member, delegatedPermission) => {
    const f = fixture();
    if (delegatedPermission) {
      await f.create(account);
      await f.update(
        account,
        delegatedPermission,
        delegatedPermission === 'owner' ? '' : 'owner',
        Authority.from({
          threshold: 1,
          keys: [],
          waits: [],
          accounts: [{ permission: { actor: 'daclifycore', permission: 'owner' }, weight: 1 }],
        }),
      );
    }
    const rows = await f.api.v1.chain.get_table_rows({
      code: 'daclifycore',
      scope: 'daclifycore',
      table: 'nativegov',
      limit: 1,
    });
    const cfg = RuntimeTableSchemas.nativegov.parse(rows.rows[0]);
    await f.push(
      [
        f.action(
          'daclifycore',
          'enroll',
          {
            dao_id: cfg.dao_id,
            member_id: member,
            native_account: account,
            signing_key: PrivateKey.generate('K1').toPublic(),
            encryption_key: 'disposable',
            custody: 0,
          },
          [
            { actor: 'alice', permission: 'active' },
            { actor: 'daclifycore', permission: 'active' },
            { actor: account, permission: delegatedPermission === 'owner' ? 'owner' : 'active' },
          ],
          f.abi('daclifycore'),
        ),
      ],
      delegatedPermission ? [...executives(), f.key('recovery')] : executives(),
    );
    await expect(
      f.call(
        'daclifycore',
        'appoint',
        {
          dao_id: cfg.dao_id,
          member_ids: [member],
          inactivity_seconds: 0,
          quorum_bps: 10000,
        },
        'daclifycore',
        'active',
        executives(),
      ),
    ).rejects.toThrow('NATIVE_EXECUTIVE_DELEGATION');
    const authority = (await f.api.v1.chain.get_account('daclifycore')).permissions.find(
      (p) => p.perm_name.toString() === 'active',
    )?.required_auth;
    expect(authority?.accounts.map((row) => row.permission.toString())).toEqual([
      'alice@active',
      'bob@active',
      'daclifycore@eosio.code',
    ]);
  },
);
