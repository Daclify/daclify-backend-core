import { ABI, Action, Authority, PermissionLevel, type API } from '@wharfkit/antelope';
import { NativeAccountSchema } from '../protocol/base.js';
import { runtimeAbi, type RuntimeActions } from './generated/runtime.js';
import { RuntimeActionSchemas } from './generated/schemas.js';
import { SYSTEM_ABI } from './system-abi.js';
// Include these staging actions and handover in one transaction; never broadcast staging alone.
export function handoverOwnerActions(
  runtimeInput: string,
  accounts: readonly API.v1.AccountObject[],
): Action[] {
  const runtime = NativeAccountSchema.parse(runtimeInput);
  if (
    !accounts.length ||
    accounts.length > 17 ||
    new Set(accounts.map((a) => a.account_name.toString())).size !== accounts.length ||
    !accounts.some((a) => a.account_name.toString() === runtime)
  )
    throw new Error('NATIVE_HANDOVER_ACCOUNTS');
  return accounts.map((account) => {
    NativeAccountSchema.parse(account.account_name.toString());
    const owner = account.permissions.find((p) => p.perm_name.toString() === 'owner');
    if (!owner) throw new Error('NATIVE_OWNER_REQUIRED');
    const threshold = owner.required_auth.threshold.toNumber();
    if (threshold < 1 || threshold > 65535) throw new Error('NATIVE_OWNER_THRESHOLD_UNSUPPORTED');
    const code = PermissionLevel.from(`${runtime}@eosio.code`);
    const authorities = [
      ...owner.required_auth.accounts.filter((p) => !p.permission.equals(code)),
      { permission: code, weight: threshold },
    ];
    authorities.sort((a, b) => {
      const actorOrder =
        BigInt(a.permission.actor.value.toString()) - BigInt(b.permission.actor.value.toString());
      const left = BigInt(a.permission.permission.value.toString()),
        right = BigInt(b.permission.permission.value.toString());
      if (actorOrder !== 0n) return actorOrder < 0n ? -1 : 1;
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const auth = Authority.from({
      threshold,
      keys: owner.required_auth.keys,
      waits: owner.required_auth.waits,
      accounts: authorities,
    });
    return Action.from(
      {
        account: 'eosio',
        name: 'updateauth',
        authorization: [PermissionLevel.from(`${account.account_name}@owner`)],
        data: { account: account.account_name, permission: 'owner', parent: '', auth },
      },
      ABI.from(SYSTEM_ABI),
    );
  });
}

export function nativeOwnershipSetupActions(
  runtimeInput: string,
  input: RuntimeActions['setnativegov'],
): Action[] {
  const runtime = NativeAccountSchema.parse(runtimeInput),
    data = RuntimeActionSchemas.setnativegov.parse(input);
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
