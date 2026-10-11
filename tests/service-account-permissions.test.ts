import { expect, it } from 'vitest';
import { ABI, PrivateKey } from '@wharfkit/antelope';
import { serviceAccountPermissionActions } from '../sdk/service-accounts.js';
import { SYSTEM_ABI } from '../sdk/system-abi.js';
import { z } from 'zod';
const key = PrivateKey.generate('K1').toPublic().toString();
it('gives Fees only executive account authority and puts Relay signing in an action-linked child', () => {
  const actions = serviceAccountPermissionActions({
    runtime: 'core',
    relay: 'relay',
    treasury: 'fees',
    names: 'names',
    decide: 'decide',
    payroll: 'payroll',
    relayKey: key,
  });
  const decoded = actions.map((action) =>
    z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(JSON.stringify(action.decodeData(ABI.from(SYSTEM_ABI))))),
  );
  const updates = decoded.filter((value) => 'auth' in value);
  expect(updates).toHaveLength(5);
  const shape = updates;
  expect(shape.filter((row) => ['owner', 'active'].includes(String(row.permission)))).toEqual([
    {
      account: 'relay',
      permission: 'active',
      parent: 'owner',
      auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'core', permission: 'active' }, weight: 1 }],
      },
    },
    {
      account: 'relay',
      permission: 'owner',
      parent: '',
      auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'core', permission: 'active' }, weight: 1 }],
      },
    },
    {
      account: 'fees',
      permission: 'active',
      parent: 'owner',
      auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'core', permission: 'active' }, weight: 1 }],
      },
    },
    {
      account: 'fees',
      permission: 'owner',
      parent: '',
      auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'core', permission: 'active' }, weight: 1 }],
      },
    },
  ]);
  expect(shape[0]).toEqual({
    account: 'relay',
    permission: 'operator',
    parent: 'active',
    auth: { threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] },
  });
  const links = decoded.filter((value) => 'requirement' in value);
  expect(links.filter((row) => row.requirement === 'operator')).toHaveLength(20);
  expect(
    links.some((row) =>
      ['transfer', 'updateauth', 'deleteauth', 'linkauth', 'unlinkauth'].includes(String(row.type)),
    ),
  ).toBe(false);
  expect(
    actions.every((action) =>
      ['relay@owner', 'fees@owner'].includes(action.authorization[0]?.toString() ?? ''),
    ),
  ).toBe(true);
});
