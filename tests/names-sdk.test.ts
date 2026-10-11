import { describe, it, expect } from 'vitest';
import { ABI, Serializer } from '@wharfkit/antelope';
import {
  nameSellerAction,
  nameCreationPermissionActions,
  nameOraclePermissionActions,
} from '../sdk/names.js';
import { SYSTEM_ABI } from '../sdk/system-abi.js';
describe('native name seller instructions', () => {
  it.each(['regname', 'editname'] as const)('rejects ordinary basic names for %s', (action) => {
    expect(() =>
      nameSellerAction('names', action, {
        seller: 'alice',
        account_name: 'reviewaaaaaa',
        price: '100.0000 TLOS',
        usd_cents: 10000,
        accepts_fee_rule: 1,
      }),
    ).toThrow('NAME_BASIC_FIRST_PARTY');
  });
  it('still lets a seller remove a legacy basic-name listing', () => {
    expect(
      nameSellerAction('names', 'delname', {
        seller: 'alice',
        account_name: 'reviewaaaaaa',
      }).name.toString(),
    ).toBe('delname');
  });
  it('exports only a code-only child and newaccount link, preserving owner and active', () => {
    const actions = nameCreationPermissionActions('alice', 'names');
    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.name.toString())).toEqual(['updateauth', 'linkauth']);
    const first = actions[0];
    if (!first) throw new Error('SETUP_ACTION_REQUIRED');
    const decoded = Serializer.decode({
      data: first.data,
      type: 'updateauth',
      abi: ABI.from(SYSTEM_ABI),
    });
    expect(JSON.parse(JSON.stringify(decoded))).toMatchObject({
      account: 'alice',
      permission: 'namesale',
      parent: 'active',
      auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'names', permission: 'eosio.code' }, weight: 1 }],
      },
    });
  });
  it('requires explicit fee consent and rejects a suffix outside native namespace rules', () => {
    expect(() =>
      nameSellerAction('names', 'regsuffix', {
        suffix: 'foo.bar',
        price: '1.0000 TLOS',
        usd_cents: 0,
        accepts_fee_rule: 1,
      }),
    ).toThrow('NATIVE_SUFFIX_REQUIRED');
    expect(() =>
      nameSellerAction('names', 'regsuffix', {
        suffix: 'alice',
        price: '1.0000 TLOS',
        usd_cents: 0,
        accepts_fee_rule: 0,
      }),
    ).toThrow('FEE_RULE');
    expect(
      nameSellerAction('names', 'regsuffix', {
        suffix: 'alice',
        price: '1.0000 TLOS',
        usd_cents: 0,
        accepts_fee_rule: 1,
      }).authorization[0]?.actor.toString(),
    ).toBe('alice');
  });
});

it('installs an observation-only child without rewriting Names owner or active', () => {
  const key = 'PUB_K1_8j1MA7Evt5628RaKn5zF1GPwB3RqY1gXeqxq9z56Cmh7oPsAmg';
  const actions = nameOraclePermissionActions('names', key);
  const decoded = actions.map((action) =>
    JSON.parse(JSON.stringify(action.decodeData(ABI.from(SYSTEM_ABI)))),
  );
  expect(decoded).toEqual([
    {
      account: 'names',
      permission: 'oracle',
      parent: 'active',
      auth: { threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] },
    },
    { account: 'names', code: 'names', type: 'observeprice', requirement: 'oracle' },
    { account: 'names', code: 'names', type: 'observefee', requirement: 'oracle' },
  ]);
  expect(actions.every((action) => action.authorization[0]?.toString() === 'names@active')).toBe(
    true,
  );
  expect(() => nameOraclePermissionActions('names', 'not-a-key')).toThrow();
});
