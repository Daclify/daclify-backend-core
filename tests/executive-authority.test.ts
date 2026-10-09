import { expect, it } from 'vitest';
import { ABI, API, PrivateKey, Serializer } from '@wharfkit/antelope';
import { handoverOwnerActions, nativeOwnershipSetupActions } from '../sdk/executives.js';
import { SYSTEM_ABI } from '../sdk/system-abi.js';
const publicKey = PrivateKey.generate('K1').toPublic().toString();
function account(name = 'foo', threshold = 2) {
  return API.v1.AccountObject.from({
    account_name: name,
    head_block_num: 1,
    head_block_time: '2026-10-09T00:00:00.000',
    privileged: false,
    last_code_update: '2026-10-09T00:00:00.000',
    created: '2026-10-09T00:00:00.000',
    ram_quota: 0,
    net_weight: 0,
    cpu_weight: 0,
    ram_usage: 0,
    net_limit: { used: 0, available: 0, max: 0 },
    cpu_limit: { used: 0, available: 0, max: 0 },
    permissions: [
      {
        perm_name: 'owner',
        parent: '',
        required_auth: {
          threshold,
          keys: [{ key: publicKey, weight: 2 }],
          waits: [{ wait_sec: 30, weight: 2 }],
          accounts: [{ permission: { actor: 'foo1', permission: 'active' }, weight: 2 }],
        },
      },
    ],
  });
}
it('stages code authority in native numeric name order while preserving current owner credentials', () => {
  const [action] = handoverOwnerActions('foo', [account()]);
  if (!action) throw new Error('Fixture staging missing');
  const decoded = Serializer.objectify(
    Serializer.decode({ abi: ABI.from(SYSTEM_ABI), type: 'updateauth', data: action.data }),
  );
  expect(decoded).toMatchObject({
    account: 'foo',
    permission: 'owner',
    auth: {
      threshold: 2,
      keys: [{ key: publicKey, weight: 2 }],
      waits: [{ wait_sec: 30, weight: 2 }],
      accounts: [
        { permission: { actor: 'foo', permission: 'eosio.code' }, weight: 2 },
        { permission: { actor: 'foo1', permission: 'active' }, weight: 2 },
      ],
    },
  });
  expect(action.authorization.map((p) => p.toString())).toEqual(['foo@owner']);
});
it('rejects invalid owner staging before producing a partial transaction', () => {
  expect(() => handoverOwnerActions('foo', [])).toThrow('NATIVE_HANDOVER_ACCOUNTS');
  expect(() => handoverOwnerActions('foo', [account('bar')])).toThrow('NATIVE_HANDOVER_ACCOUNTS');
  expect(() => handoverOwnerActions('foo', [account(), account()])).toThrow(
    'NATIVE_HANDOVER_ACCOUNTS',
  );
  expect(() => handoverOwnerActions('foo', [account('foo', 65536)])).toThrow(
    'NATIVE_OWNER_THRESHOLD_UNSUPPORTED',
  );
});
it('locks native code and ABI updates to owner before configuring governance', () => {
  const actions = nativeOwnershipSetupActions('foo', {
    dao_id: '1',
    contracts: ['works'],
    service_key: publicKey,
  });
  expect(actions.map((a) => a.name.toString())).toEqual(['linkauth', 'linkauth', 'setnativegov']);
  expect(actions.every((a) => a.authorization[0]?.toString() === 'foo@owner')).toBe(true);
  expect(
    actions
      .slice(0, 2)
      .map((action) =>
        Serializer.objectify(
          Serializer.decode({ abi: ABI.from(SYSTEM_ABI), type: 'linkauth', data: action.data }),
        ),
      ),
  ).toEqual([
    { account: 'foo', code: 'eosio', type: 'setcode', requirement: 'owner' },
    { account: 'foo', code: 'eosio', type: 'setabi', requirement: 'owner' },
  ]);
});
