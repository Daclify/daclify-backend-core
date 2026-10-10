import { expect, it } from 'vitest';
import {
  ABI,
  API,
  Authority,
  Name,
  PermissionLevel,
  PrivateKey,
  Serializer,
} from '@wharfkit/antelope';
import {
  assertNativeOwnershipRuntime,
  nativeHandoverActions,
  nativeOwnershipAuthorities,
  nativeOwnershipAccount,
  nativeOwnershipSetupActions,
  type NativeOwnershipState,
} from '../sdk/executives.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../sdk/generated/releases.js';
import { runtimeAbi, type RuntimeActions } from '../sdk/generated/runtime.js';
import { CoreContextActions } from '../sdk/permissions.js';
import { SYSTEM_ABI } from '../sdk/system-abi.js';
const publicKey = PrivateKey.generate('K1').toPublic().toString();
function rawAccount(name = 'foo', threshold = 2) {
  return {
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
    eosio_any_linked_actions: [],
    permissions: [
      {
        perm_name: 'owner',
        parent: '',
        linked_actions: [],
        required_auth: {
          threshold,
          keys: [{ key: publicKey, weight: 2 }],
          waits: [{ wait_sec: 30, weight: 2 }],
          accounts: [{ permission: { actor: 'foo1', permission: 'active' }, weight: 2 }],
        },
      },
      {
        perm_name: 'active',
        parent: 'owner',
        linked_actions: [],
        required_auth: {
          threshold: 1,
          keys: [{ key: publicKey, weight: 1 }],
          waits: [],
          accounts: [],
        },
      },
    ],
  };
}
const account = (name = 'foo', threshold = 2) => {
  const value = API.v1.AccountObject.from(rawAccount(name, threshold));
  if (name === 'foo')
    value.permissions.push(
      API.v1.AccountPermission.from({
        perm_name: 'execctx',
        parent: 'active',
        linked_actions: CoreContextActions.map((action) => ({ account: name, action })),
        required_auth: {
          threshold: 1,
          keys: [],
          waits: [],
          accounts: [{ permission: { actor: name, permission: 'eosio.code' }, weight: 1 }],
        },
      }),
    );
  return value;
};
const config: NativeOwnershipState = {
  dao_id: '1',
  contracts: ['works'],
  service_key: publicKey,
  handed_over: false,
  signers: [],
  threshold: 0,
  admin_members: [],
  ownership: { policy_version: 2, creator: 'recovery', inline_code: ['works'] },
};
const input: RuntimeActions['handover'] = {
  dao_id: '1',
  expected_signers: ['alice', 'bob'],
  expected_threshold: 2,
  expected_revision: '1',
  expected_creator: 'recovery',
  expected_policy_version: 2,
};
const snapshots = () => [account(), account('works')];
it('returns preserved staging and the fully authorized handover as one transaction', () => {
  const actions = nativeHandoverActions('foo', config, input, snapshots());
  expect(actions.map((a) => a.name.toString())).toEqual(['updateauth', 'updateauth', 'handover']);
  const stage = actions[0],
    final = actions.at(-1);
  if (!stage || !final) throw new Error('Fixture actions missing');
  expect(
    Serializer.objectify(
      Serializer.decode({ abi: ABI.from(SYSTEM_ABI), type: 'updateauth', data: stage.data }),
    ),
  ).toMatchObject({
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
  expect(final.authorization.map((p) => p.toString())).toEqual(['foo@owner', 'works@owner']);
  expect(
    Serializer.objectify(
      Serializer.decode({ abi: ABI.from(runtimeAbi), type: 'handover', data: final.data }),
    ),
  ).toEqual({ ...input, dao_id: 1, expected_revision: 1 });
});
it.each(
  [
    [],
    [account('bar'), account('works')],
    [account(), account()],
    [account(), account('works'), account('extra')],
  ].map((rows) => ({ rows })),
)('refuses incomplete or unexpected account snapshots', ({ rows }) => {
  expect(() => nativeHandoverActions('foo', config, input, rows)).toThrow(
    'NATIVE_HANDOVER_ACCOUNTS',
  );
});
it('refuses legacy policy, stale creator/version, already handed-over state and invalid quorum', () => {
  expect(() =>
    nativeHandoverActions('foo', { ...config, ownership: undefined }, input, snapshots()),
  ).toThrow('NATIVE_POLICY_MIGRATION_REQUIRED');
  expect(() =>
    nativeHandoverActions('foo', { ...config, handed_over: true }, input, snapshots()),
  ).toThrow('NATIVE_HANDOVER_STATE');
  for (const changed of [
    { expected_creator: 'other' },
    { expected_policy_version: 1 },
    { expected_threshold: 3 },
    { expected_signers: ['bob', 'alice'] },
    { expected_signers: ['alice', 'alice'] },
    { expected_revision: '0' },
  ])
    expect(() =>
      nativeHandoverActions('foo', config, { ...input, ...changed }, snapshots()),
    ).toThrow();
});
it('refuses unexpected permissions, hidden links, invalid owner and preexisting temporary code grants', () => {
  const extra = rawAccount();
  const current = extra.permissions[1];
  if (!current) throw new Error('Fixture active required');
  extra.permissions.push({ ...current, perm_name: 'govern' });
  expect(() =>
    nativeHandoverActions('foo', config, input, [
      API.v1.AccountObject.from(extra),
      account('works'),
    ]),
  ).toThrow('NATIVE_AUTHORITY_REVIEW_REQUIRED');
  expect(() =>
    nativeHandoverActions('foo', config, input, [account('foo', 65536), account('works')]),
  ).toThrow('NATIVE_OWNER_THRESHOLD_UNSUPPORTED');
  const granted = account(),
    owner = granted.getPermission('owner');
  owner.required_auth = Authority.from({
    ...owner.required_auth,
    accounts: [...owner.required_auth.accounts, { permission: inputPermission(), weight: 2 }],
  });
  expect(() => nativeHandoverActions('foo', config, input, [granted, account('works')])).toThrow(
    'NATIVE_AUTHORITY_REVIEW_REQUIRED',
  );
});
function inputPermission() {
  return PermissionLevel.from('foo@eosio.code');
}
it('inspects raw eosio.any metadata before the pinned API discards it', () => {
  expect(nativeOwnershipAccount(rawAccount()).account_name.toString()).toBe('foo');
  expect(() => nativeOwnershipAccount({ ...rawAccount(), eosio_any_linked_actions: [{}] })).toThrow(
    'PERMISSION_ANY_LINK_REVIEW_REQUIRED',
  );
  expect(() =>
    nativeOwnershipAccount({ ...rawAccount(), eosio_any_linked_actions: undefined }),
  ).toThrow('PERMISSION_LINKS_UNAVAILABLE');
});
it('describes creator recovery, quorum-weighted code and explicit inline roles', () => {
  const plan = nativeOwnershipAuthorities(
    'foo',
    { creator: 'recovery', contracts: ['works', 'hub'], inline_code: ['works'] },
    ['alice', 'bob'],
    2,
  );
  expect(plan[0]).toMatchObject({
    account: 'foo',
    upgradePermission: 'active',
    owner: {
      threshold: 1,
      accounts: [{ permission: { actor: 'recovery', permission: 'active' }, weight: 1 }],
    },
    active: {
      threshold: 2,
      accounts: [
        { permission: { actor: 'alice', permission: 'active' }, weight: 1 },
        { permission: { actor: 'bob', permission: 'active' }, weight: 1 },
        { permission: { actor: 'foo', permission: 'eosio.code' }, weight: 2 },
      ],
    },
  });
  expect(plan.find((p) => p.account === 'hub')?.active.accounts).toHaveLength(1);
  expect(plan.find((p) => p.account === 'works')?.active.accounts).toHaveLength(2);
});
it.each([
  { creator: 'foo', contracts: ['works'], inline_code: ['works'] },
  { creator: 'works', contracts: ['works'], inline_code: ['works'] },
  { creator: 'recovery', contracts: ['works', 'works'], inline_code: ['works'] },
  { creator: 'recovery', contracts: ['works'], inline_code: ['hub'] },
])('rejects creator cycles and invalid managed roles', (cfg) => {
  expect(() => nativeOwnershipAuthorities('foo', cfg, ['alice', 'bob'], 2)).toThrow();
});
it('rejects executive cycles and an observed runtime outside the exact release', () => {
  expect(() =>
    nativeOwnershipAuthorities(
      'foo',
      { creator: 'recovery', contracts: ['works'], inline_code: [] },
      ['works'],
      1,
    ),
  ).toThrow('NATIVE_EXECUTIVE_ACCOUNT');
  const observed = API.v1.GetRawAbiResponse.from({
    account_name: 'foo',
    code_hash: RuntimeCodeHash,
    abi_hash: RuntimeRawAbiHash,
    abi: '',
  });
  expect(() => assertNativeOwnershipRuntime(observed)).not.toThrow();
  observed.code_hash = API.v1.GetRawAbiResponse.from({
    account_name: 'foo',
    code_hash: '00'.repeat(32),
    abi_hash: RuntimeRawAbiHash,
    abi: '',
  }).code_hash;
  expect(() => assertNativeOwnershipRuntime(observed)).toThrow('NATIVE_OWNERSHIP_RUNTIME_REQUIRED');
});
it('temporarily owner-links core upgrades before configuring versioned governance', () => {
  const actions = nativeOwnershipSetupActions('foo', {
    dao_id: '1',
    contracts: ['works'],
    service_key: publicKey,
    creator: 'recovery',
    inline_code: ['works'],
  });
  expect(actions.map((a) => a.name.toString())).toEqual(['linkauth', 'linkauth', 'setnativegov']);
  expect(actions.every((a) => a.authorization[0]?.toString() === 'foo@owner')).toBe(true);
});
it('refuses handover without a code-only execution context and its complete core action links', () => {
  const root = account();
  root.permissions = root.permissions.filter((row) => row.perm_name.toString() !== 'execctx');
  expect(() => nativeHandoverActions('foo', config, input, [root, account('works')])).toThrow(
    'NATIVE_CONTEXT_REVIEW_REQUIRED',
  );
});
it.each(['extra key', 'missing link', 'wildcard', 'foreign account'] as const)(
  'refuses unsafe execctx snapshots: %s',
  (kind) => {
    const root = account(),
      ctx = root.getPermission('execctx'),
      first = ctx.linked_actions?.[0];
    if (!first) throw new Error('Fixture context link missing');
    if (kind === 'extra key')
      ctx.required_auth = Authority.from({
        ...ctx.required_auth,
        keys: [{ key: publicKey, weight: 1 }],
      });
    else if (kind === 'missing link') ctx.linked_actions = [];
    else if (kind === 'wildcard') first.action = Name.from('');
    // A different contract is outside the managed execution-context boundary.
    if (kind === 'foreign account') first.account = account('unknown').account_name;
    expect(() => nativeHandoverActions('foo', config, input, [root, account('works')])).toThrow(
      'NATIVE_CONTEXT_REVIEW_REQUIRED',
    );
  },
);
