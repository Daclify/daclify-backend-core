import { describe, it, expect } from 'vitest';
import { ABI, Serializer } from '@wharfkit/antelope';
import { nameSellerAction, nameCreationPermissionActions } from '../sdk/names.js';
import { SYSTEM_ABI } from '../sdk/system-abi.js';
describe('native name seller instructions', () => {
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
