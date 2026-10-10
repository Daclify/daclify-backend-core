import { NativeAccountSchema } from '../../protocol/base.js';
import { CoreContextActions } from '../../sdk/permissions.js';
import { ModulePermissions } from '@daclify/modules';
import { ABI, Action, Authority, API } from '@wharfkit/antelope';
import { deploymentAccounts, type DeployEnvironment } from './environment.js';
import { SYSTEM_ABI } from '../../sdk/system-abi.js';
import { nativeOwnershipAccount } from '../../sdk/executives.js';
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

export function deploymentContextPermissionPlan(environment: DeployEnvironment) {
  const runtime = environment.accounts[0];
  if (!runtime) throw new Error('DEPLOY_RUNTIME');
  const modules = deploymentAccounts(environment).flatMap<
    Parameters<typeof contextPermissionPlan>[1][number]
  >((account) => {
    const id =
      account.contract === 'grants'
        ? 'grants-rounds'
        : account.contract === 'endorse'
          ? 'endorsement-admission'
          : account.contract;
    return id === 'decide' ||
      id === 'works' ||
      id === 'payroll' ||
      id === 'grants-rounds' ||
      id === 'endorsement-admission'
      ? [{ id, account: account.name }]
      : [];
  });
  return contextPermissionPlan(runtime.name, modules);
}

export const permissionAuditAccount = nativeOwnershipAccount;

function accountLinks(account: API.v1.AccountObject) {
  if (account.permissions.some((permission) => permission.linked_actions === undefined))
    throw new Error('PERMISSION_LINKS_UNAVAILABLE');
  return account.permissions.flatMap((permission) =>
    (permission.linked_actions ?? []).map((link) => ({
      account: link.account.toString(),
      action: link.action?.toString() ?? '*',
      permission: permission.perm_name.toString(),
    })),
  );
}

export function auditContextPermission(
  plan: ReturnType<typeof contextPermissionPlan>,
  account: API.v1.AccountObject,
) {
  if (account.account_name.toString() !== plan.account)
    throw new Error('PERMISSION_ACCOUNT_MISMATCH');
  const permission = account.permissions.find(
    (row) => row.perm_name.toString() === plan.permission,
  );
  const links = accountLinks(account);
  const expected = new Set(plan.links.map((link) => link.account + ':' + link.action));
  return {
    account: plan.account,
    permission: plan.permission,
    authorityMatches:
      !!permission &&
      permission.parent.toString() === plan.parent &&
      permission.required_auth.equals(Authority.from(plan.authority)),
    missingLinks: plan.links.flatMap((link) => {
      const current = links.find(
        (row) => row.account === link.account && row.action === link.action,
      );
      return current?.permission === plan.permission
        ? []
        : [{ ...link, currentPermission: current?.permission ?? null }];
    }),
    unexpectedLinks: links
      .filter(
        (link) =>
          link.permission === plan.permission && !expected.has(link.account + ':' + link.action),
      )
      .map(({ account, action }) => ({ account, action })),
  };
}

export function upgradePermissionLinks(account: API.v1.AccountObject) {
  const links = accountLinks(account).filter((link) => link.account === 'eosio');
  return ['setcode', 'setabi'].map((action) => ({
    action,
    permission:
      links.find((link) => link.action === action)?.permission ??
      links.find((link) => link.action === '*')?.permission ??
      'active',
  }));
}

export function contextLinkRepairActions(
  plan: ReturnType<typeof contextPermissionPlan>,
  account: API.v1.AccountObject,
): Action[] {
  const audit = auditContextPermission(plan, account);
  if (
    !audit.authorityMatches ||
    audit.unexpectedLinks.length ||
    audit.missingLinks.some((link) => link.currentPermission !== null)
  )
    throw new Error('CONTEXT_PERMISSION_REVIEW_REQUIRED');
  return audit.missingLinks.map((link) =>
    Action.from(
      {
        account: 'eosio',
        name: 'linkauth',
        authorization: [{ actor: plan.account, permission: 'owner' }],
        data: {
          account: plan.account,
          code: link.account,
          type: link.action,
          requirement: plan.permission,
        },
      },
      ABI.from(SYSTEM_ABI),
    ),
  );
}
