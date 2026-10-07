import { NativeAccountSchema } from '../../protocol/base.js';
import { CoreContextActions } from '../../sdk/permissions.js';
import { ModulePermissions } from '@daclify/modules';
export function contextPermissionPlan(
  runtimeInput: string,
  modules: readonly { id: keyof typeof ModulePermissions; account: string }[],
) {
  const runtime = NativeAccountSchema.parse(runtimeInput),
    accounts = modules.map((module) => ({
      ...module,
      account: NativeAccountSchema.parse(module.account),
    }));
  if (
    new Set([runtime, ...accounts.map((module) => module.account)]).size !== accounts.length + 1 ||
    new Set(accounts.map((module) => module.id)).size !== accounts.length
  )
    throw new Error('DUPLICATE_CONTEXT_ACCOUNT');
  return {
    account: runtime,
    permission: 'execctx',
    parent: 'active',
    authority: {
      threshold: 1,
      keys: [],
      waits: [],
      accounts: [{ permission: { actor: runtime, permission: 'eosio.code' }, weight: 1 }],
    },
    links: [
      ...CoreContextActions.map((action) => ({ account: runtime, action })),
      ...accounts.flatMap((module) =>
        ModulePermissions[module.id].actions.map((action) => ({ account: module.account, action })),
      ),
    ],
  };
}
