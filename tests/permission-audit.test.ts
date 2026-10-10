import { readFileSync } from 'node:fs';
import { ABI, API, Authority, PrivateKey, Serializer } from '@wharfkit/antelope';
import { describe, expect, it } from 'vitest';
import {
  auditContextPermission,
  contextPermissionPlan,
  contextLinkRepairActions,
  deploymentContextPermissionPlan,
  upgradePermissionLinks,
  permissionAuditAccount,
} from '../tools/deploy/permissions.js';
import { loadEnvironment } from '../tools/deploy/environment.js';
import { CoreContextActions } from '../sdk/permissions.js';
import { SYSTEM_ABI } from '../sdk/system-abi.js';

const plan = contextPermissionPlan('auditcore', [{ id: 'works', account: 'auditworks' }]);
const key = PrivateKey.generate('K1').toPublic();
const permission = (
  name: string,
  links: readonly { account: string; action: string | null }[] = [],
  authority = Authority.from(plan.authority),
  parent = 'active',
) =>
  API.v1.AccountPermission.from({
    perm_name: name,
    parent,
    required_auth: authority,
    linked_actions: links,
  });
function account(permissions = [permission('execctx', plan.links)], name = 'auditcore') {
  return API.v1.AccountObject.from({
    account_name: name,
    head_block_num: 1,
    head_block_time: '2026-10-10T00:00:00.000',
    privileged: false,
    last_code_update: '2026-10-10T00:00:00.000',
    created: '2026-10-10T00:00:00.000',
    ram_quota: 0,
    net_weight: 0,
    cpu_weight: 0,
    ram_usage: 0,
    net_limit: { used: 0, available: 0, max: 0 },
    cpu_limit: { used: 0, available: 0, max: 0 },
    permissions,
  });
}

describe('deployment permission inspection', () => {
  it.each([undefined, null, 'unavailable'])(
    'refuses raw snapshots with unavailable eosio.any link information: %j',
    (value) => {
      expect(() =>
        permissionAuditAccount({
          ...Serializer.objectify(account()),
          eosio_any_linked_actions: value,
        }),
      ).toThrow('PERMISSION_LINKS_UNAVAILABLE');
    },
  );
  it('refuses an eosio.any link before the pinned SDK can discard its metadata', () => {
    expect(() =>
      permissionAuditAccount({
        ...Serializer.objectify(account()),
        eosio_any_linked_actions: [{ account: 'eosio', action: 'setcode' }],
      }),
    ).toThrow('PERMISSION_ANY_LINK_REVIEW_REQUIRED');
  });
  it('retains canonical typed permissions when the complete raw snapshot has no eosio.any links', () => {
    const reading = permissionAuditAccount({
      ...Serializer.objectify(account()),
      eosio_any_linked_actions: [],
    });
    expect(auditContextPermission(plan, reading).authorityMatches).toBe(true);
    expect(upgradePermissionLinks(reading)).toEqual([
      { action: 'setcode', permission: 'active' },
      { action: 'setabi', permission: 'active' },
    ]);
  });
  it('reports absent and differently assigned member links without changing the account', () => {
    const reading = account([
      permission(
        'execctx',
        plan.links.filter((link) => !['heartbeat', 'review'].includes(link.action)),
      ),
      permission('active', [{ account: 'auditworks', action: 'review' }]),
    ]);
    const before = JSON.stringify(reading);
    const audit = auditContextPermission(plan, reading);
    expect(audit.authorityMatches).toBe(true);
    expect(audit.missingLinks).toEqual([
      { account: 'auditcore', action: 'heartbeat', currentPermission: null },
      { account: 'auditworks', action: 'review', currentPermission: 'active' },
    ]);
    expect(audit.unexpectedLinks).toEqual([]);
    expect(JSON.stringify(reading)).toBe(before);
  });
  it('retains unexpected execution links for review instead of treating a wildcard as complete', () => {
    const audit = auditContextPermission(
      plan,
      account([permission('execctx', [{ account: 'auditworks', action: null }])]),
    );
    expect(audit.missingLinks).toHaveLength(47);
    expect(audit.unexpectedLinks).toEqual([{ account: 'auditworks', action: '*' }]);
  });
  it.each([
    ['signing key', Authority.from({ ...plan.authority, keys: [{ key, weight: 1 }] }), 'active'],
    ['threshold', Authority.from({ ...plan.authority, threshold: 2 }), 'active'],
    ['parent', Authority.from(plan.authority), 'owner'],
    [
      'external code',
      Authority.from({
        ...plan.authority,
        accounts: [{ permission: { actor: 'auditworks', permission: 'eosio.code' }, weight: 1 }],
      }),
      'active',
    ],
  ])('rejects execution authority drift: %s', (_label, authority, parent) => {
    expect(
      auditContextPermission(plan, account([permission('execctx', plan.links, authority, parent)]))
        .authorityMatches,
    ).toBe(false);
  });
  it('reports a missing execution authority and refuses a wrong account', () => {
    const audit = auditContextPermission(plan, account([]));
    expect(audit.authorityMatches).toBe(false);
    expect(audit.missingLinks).toHaveLength(47);
    expect(() => auditContextPermission(plan, account([], 'othercore'))).toThrow(
      'PERMISSION_ACCOUNT_MISMATCH',
    );
  });
  it('refuses a repair when the RPC omits permission-link information', () => {
    const reading = account([
      API.v1.AccountPermission.from({
        perm_name: 'execctx',
        parent: 'active',
        required_auth: plan.authority,
      }),
    ]);
    expect(() => contextLinkRepairActions(plan, reading)).toThrow('PERMISSION_LINKS_UNAVAILABLE');
  });
  it('distinguishes default active upgrades, wildcard protection and exact link overrides', () => {
    expect(upgradePermissionLinks(account([]))).toEqual([
      { action: 'setcode', permission: 'active' },
      { action: 'setabi', permission: 'active' },
    ]);
    expect(
      upgradePermissionLinks(
        account([
          permission('owner', [{ account: 'eosio', action: null }]),
          permission('active', [{ account: 'eosio', action: 'setabi' }]),
        ]),
      ),
    ).toEqual([
      { action: 'setcode', permission: 'owner' },
      { action: 'setabi', permission: 'active' },
    ]);
    expect(
      upgradePermissionLinks(
        account([
          permission('active', [{ account: 'eosio', action: null }]),
          permission('owner', [{ account: 'eosio', action: 'setcode' }]),
        ]),
      ),
    ).toEqual([
      { action: 'setcode', permission: 'owner' },
      { action: 'setabi', permission: 'active' },
    ]);
  });
  it('covers every member-context entry point in the compiled runtime ABI', () => {
    const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
    const actions = abi.actions
      .filter((action) => {
        const fields = abi.structs.find((entry) => entry.name === action.type)?.fields.slice(0, 3);
        return (
          fields?.map((field) => field.name).join(',') === 'runtime,dao_id,member_id' &&
          fields.map((field) => field.type).join(',') === 'name,uint64,uint64'
        );
      })
      .map((action) => action.name.toString());
    expect(actions.length).toBeGreaterThan(0);
    expect([...CoreContextActions].sort()).toEqual(actions.sort());
  });
  it('uses all configured modules while keeping service-only accounts out of member execution', async () => {
    const audit = deploymentContextPermissionPlan(await loadEnvironment('testnet'));
    expect(audit.account).toBe('daclifycore1');
    expect(audit.links).toHaveLength(68);
    expect(audit.links).toContainEqual({ account: 'daclifygrant', action: 'applygrant' });
    expect(audit.links).toContainEqual({ account: 'daclifyendor', action: 'admit' });
    expect(
      audit.links.some((link) =>
        ['daclifyrelay', 'daclifyfees1', 'daclifyhubv1', 'daclifynames'].includes(link.account),
      ),
    ).toBe(false);
  });
  it('prepares only absent links under owner authorization and never emits authority updates', () => {
    const reading = account([
      permission(
        'execctx',
        plan.links.filter((link) => link.action !== 'heartbeat'),
      ),
    ]);
    const actions = contextLinkRepairActions(plan, reading);
    expect(actions.map((action) => [action.account.toString(), action.name.toString()])).toEqual([
      ['eosio', 'linkauth'],
    ]);
    expect(actions[0]?.authorization.map((auth) => auth.toString())).toEqual(['auditcore@owner']);
    expect(
      actions.map((action) =>
        Serializer.objectify(
          Serializer.decode({ abi: ABI.from(SYSTEM_ABI), type: 'linkauth', data: action.data }),
        ),
      ),
    ).toEqual([
      { account: 'auditcore', code: 'auditcore', type: 'heartbeat', requirement: 'execctx' },
    ]);
    expect(contextLinkRepairActions(plan, account())).toEqual([]);
  });
  it('requires explicit review for authority drift, unrelated execution grants or existing link assignments', () => {
    const readings = [
      account([]),
      account([
        permission('execctx', plan.links, Authority.from({ ...plan.authority, threshold: 2 })),
      ]),
      account([
        permission('execctx', [...plan.links, { account: 'eosio.token', action: 'transfer' }]),
      ]),
      account([
        permission(
          'execctx',
          plan.links.filter((link) => link.action !== 'heartbeat'),
        ),
        permission('active', [{ account: 'auditcore', action: 'heartbeat' }]),
      ]),
    ];
    for (const reading of readings)
      expect(() => contextLinkRepairActions(plan, reading)).toThrow(
        'CONTEXT_PERMISSION_REVIEW_REQUIRED',
      );
  });
});
