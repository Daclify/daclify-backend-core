import { ABI, Action, Authority, PermissionLevel, API } from '@wharfkit/antelope';
import { z } from 'zod';
import { NativeAccountSchema } from '../protocol/base.js';
import { runtimeAbi, type RuntimeActions } from './generated/runtime.js';
import { RuntimeActionSchemas, RuntimeTableSchemas } from './generated/schemas.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from './generated/releases.js';
import { CoreContextActions } from './permissions.js';
import { SYSTEM_ABI } from './system-abi.js';
export const NativeOwnershipPolicyVersion = 2;
export const NativeServiceActions = [
  'createdao',
  'createpaid',
  'initgov',
  'enroll',
  'enrollagent',
  'setmodule',
] as const;
export type NativeOwnershipState = z.infer<typeof RuntimeTableSchemas.nativegov>;
type OwnershipConfig = Pick<
  RuntimeActions['setnativegov'],
  'creator' | 'contracts' | 'inline_code'
>;
function ownershipConfig(runtime: string, config: OwnershipConfig) {
  NativeAccountSchema.parse(config.creator);
  for (const account of [...config.contracts, ...config.inline_code])
    NativeAccountSchema.parse(account);
  if (
    config.contracts.length > 16 ||
    new Set(config.contracts).size !== config.contracts.length ||
    config.contracts.includes(runtime)
  )
    throw new Error('NATIVE_CONTRACTS');
  if (config.creator === runtime || config.contracts.includes(config.creator))
    throw new Error('NATIVE_CREATOR');
  if (
    new Set(config.inline_code).size !== config.inline_code.length ||
    config.inline_code.some((account) => !config.contracts.includes(account))
  )
    throw new Error('NATIVE_INLINE_CODE');
}
export function nativeOwnershipAccount(value: unknown): API.v1.AccountObject {
  // The pinned SDK omits eosio.any links; inspect raw metadata before decoding.
  const metadata = z.object({ eosio_any_linked_actions: z.array(z.unknown()) }).safeParse(value);
  if (!metadata.success) throw new Error('PERMISSION_LINKS_UNAVAILABLE');
  if (metadata.data.eosio_any_linked_actions.length)
    throw new Error('PERMISSION_ANY_LINK_REVIEW_REQUIRED');
  const account = API.v1.AccountObject.from(value);
  if (account.permissions.some((permission) => permission.linked_actions === undefined))
    throw new Error('PERMISSION_LINKS_UNAVAILABLE');
  return account;
}
export function assertNativeOwnershipRuntime(observed: API.v1.GetRawAbiResponse) {
  if (
    observed.code_hash.toString() !== RuntimeCodeHash ||
    observed.abi_hash.toString() !== RuntimeRawAbiHash
  )
    throw new Error('NATIVE_OWNERSHIP_RUNTIME_REQUIRED');
}
export function nativeOwnershipAuthorities(
  runtimeInput: string,
  config: OwnershipConfig,
  signers: readonly string[],
  threshold: number,
) {
  const runtime = NativeAccountSchema.parse(runtimeInput);
  ownershipConfig(runtime, config);
  for (const signer of signers) NativeAccountSchema.parse(signer);
  if (
    !signers.length ||
    signers.length > 8 ||
    new Set(signers).size !== signers.length ||
    !Number.isInteger(threshold) ||
    threshold < 1 ||
    threshold > signers.length
  )
    throw new Error('NATIVE_EXECUTIVE_QUORUM');
  if (signers.some((signer) => signer === runtime || config.contracts.includes(signer)))
    throw new Error('NATIVE_EXECUTIVE_ACCOUNT');
  const authority = (
    accounts: { permission: { actor: string; permission: string }; weight: number }[],
    q = 1,
  ) => {
    const auth = Authority.from({ threshold: q, keys: [], waits: [], accounts });
    auth.sort();
    return authorityObject(auth);
  };
  return [
    {
      account: runtime,
      upgradePermission: 'active',
      owner: authority([
        { permission: { actor: config.creator, permission: 'active' }, weight: 1 },
      ]),
      active: authority(
        [
          ...signers.map((actor) => ({ permission: { actor, permission: 'active' }, weight: 1 })),
          { permission: { actor: runtime, permission: 'eosio.code' }, weight: threshold },
        ],
        threshold,
      ),
    },
    ...config.contracts.map((account) => ({
      account,
      upgradePermission: 'owner',
      owner: authority([{ permission: { actor: runtime, permission: 'active' }, weight: 1 }]),
      active: authority([
        { permission: { actor: runtime, permission: 'active' }, weight: 1 },
        ...(config.inline_code.includes(account)
          ? [{ permission: { actor: account, permission: 'eosio.code' }, weight: 1 }]
          : []),
      ]),
    })),
  ];
}
function authorityObject(auth: Authority) {
  return {
    threshold: auth.threshold.toNumber(),
    keys: auth.keys.map((key) => ({ key: key.key.toString(), weight: key.weight.toNumber() })),
    waits: auth.waits.map((wait) => ({
      wait_sec: wait.wait_sec.toNumber(),
      weight: wait.weight.toNumber(),
    })),
    accounts: auth.accounts.map((account) => ({
      permission: {
        actor: account.permission.actor.toString(),
        permission: account.permission.permission.toString(),
      },
      weight: account.weight.toNumber(),
    })),
  };
}
// Temporary owner code grants are returned only with their final handover action.
export function nativeHandoverActions(
  runtimeInput: string,
  config: NativeOwnershipState,
  input: RuntimeActions['handover'],
  accounts: readonly API.v1.AccountObject[],
): Action[] {
  const runtime = NativeAccountSchema.parse(runtimeInput),
    data = RuntimeActionSchemas.handover.parse(input),
    policy = config.ownership;
  if (!policy || policy.policy_version !== NativeOwnershipPolicyVersion)
    throw new Error('NATIVE_POLICY_MIGRATION_REQUIRED');
  if (config.handed_over) throw new Error('NATIVE_HANDOVER_STATE');
  if (
    data.dao_id !== config.dao_id ||
    data.expected_creator !== policy.creator ||
    data.expected_policy_version !== policy.policy_version ||
    BigInt(data.expected_revision) < 1n
  )
    throw new Error('NATIVE_HANDOVER_CHANGED');
  nativeOwnershipAuthorities(
    runtime,
    { contracts: config.contracts, ...policy },
    data.expected_signers,
    data.expected_threshold,
  );
  if (
    data.expected_signers.some(
      (signer, i) => i > 0 && signer <= (data.expected_signers[i - 1] ?? ''),
    )
  )
    throw new Error('NATIVE_HANDOVER_CHANGED');
  const expected = [runtime, ...config.contracts];
  if (
    accounts.length !== expected.length ||
    new Set(accounts.map((account) => account.account_name.toString())).size !== expected.length ||
    accounts.some((account) => !expected.includes(account.account_name.toString()))
  )
    throw new Error('NATIVE_HANDOVER_ACCOUNTS');
  const code = PermissionLevel.from(`${runtime}@eosio.code`);
  const stages = expected.map((name) => {
    const account = accounts.find((row) => row.account_name.toString() === name);
    if (!account) throw new Error('NATIVE_HANDOVER_ACCOUNTS');
    const owner = account.permissions.find((p) => p.perm_name.toString() === 'owner'),
      active = account.permissions.find((p) => p.perm_name.toString() === 'active');
    if (!owner || !active || owner.parent.toString() !== '' || active.parent.toString() !== 'owner')
      throw new Error('NATIVE_OWNER_REQUIRED');
    if (account.permissions.some((p) => p.linked_actions === undefined))
      throw new Error('PERMISSION_LINKS_UNAVAILABLE');
    const allowed =
      name === runtime ? ['owner', 'active', 'execctx', 'service'] : ['owner', 'active'];
    if (
      account.permissions.some((p) => !allowed.includes(p.perm_name.toString())) ||
      owner.required_auth.accounts.some((p) => p.permission.equals(code))
    )
      throw new Error('NATIVE_AUTHORITY_REVIEW_REQUIRED');
    const service = account.permissions.find((p) => p.perm_name.toString() === 'service');
    if (
      service &&
      (service.parent.toString() !== 'active' ||
        service.linked_actions?.some(
          (link) =>
            link.account.toString() !== runtime ||
            !NativeServiceActions.some((action) => action === link.action?.toString()),
        ))
    )
      throw new Error('NATIVE_AUTHORITY_REVIEW_REQUIRED');
    const execctx = account.permissions.find((p) => p.perm_name.toString() === 'execctx');
    if (
      execctx &&
      (execctx.parent.toString() !== 'active' ||
        !execctx.required_auth.equals(
          Authority.from({
            threshold: 1,
            keys: [],
            waits: [],
            accounts: [{ permission: code, weight: 1 }],
          }),
        ))
    )
      throw new Error('NATIVE_CONTEXT_REVIEW_REQUIRED');
    if (
      name === runtime &&
      (!execctx ||
        CoreContextActions.some(
          (action) =>
            !execctx.linked_actions?.some(
              (link) => link.account.toString() === runtime && link.action?.toString() === action,
            ),
        ) ||
        execctx.linked_actions?.some(
          (link) =>
            !link.action?.toString() ||
            (link.account.toString() === runtime
              ? !CoreContextActions.some((action) => action === link.action?.toString())
              : !config.contracts.includes(link.account.toString())),
        ))
    )
      throw new Error('NATIVE_CONTEXT_REVIEW_REQUIRED');
    const threshold = owner.required_auth.threshold.toNumber();
    if (threshold < 1 || threshold > 65535) throw new Error('NATIVE_OWNER_THRESHOLD_UNSUPPORTED');
    const auth = Authority.from({
      threshold,
      keys: owner.required_auth.keys,
      waits: owner.required_auth.waits,
      accounts: [...owner.required_auth.accounts, { permission: code, weight: threshold }],
    });
    auth.sort();
    return Action.from(
      {
        account: 'eosio',
        name: 'updateauth',
        authorization: [{ actor: name, permission: 'owner' }],
        data: { account: name, permission: 'owner', parent: '', auth },
      },
      ABI.from(SYSTEM_ABI),
    );
  });
  return [
    ...stages,
    Action.from(
      {
        account: runtime,
        name: 'handover',
        authorization: expected.map((actor) => ({ actor, permission: 'owner' })),
        data,
      },
      ABI.from(runtimeAbi),
    ),
  ];
}
export function nativeOwnershipSetupActions(
  runtimeInput: string,
  input: RuntimeActions['setnativegov'],
): Action[] {
  const runtime = NativeAccountSchema.parse(runtimeInput),
    data = RuntimeActionSchemas.setnativegov.parse(input);
  ownershipConfig(runtime, data);
  const authorization = [PermissionLevel.from(`${runtime}@owner`)];
  return [
    ...['setcode', 'setabi'].map((type) =>
      Action.from(
        {
          account: 'eosio',
          name: 'linkauth',
          authorization,
          data: { account: runtime, code: 'eosio', type, requirement: 'owner' },
        },
        ABI.from(SYSTEM_ABI),
      ),
    ),
    Action.from(
      { account: runtime, name: 'setnativegov', authorization, data },
      ABI.from(runtimeAbi),
    ),
  ];
}
