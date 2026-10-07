import { expect, it } from 'vitest';
import { ABI, Serializer } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import {
  loadEnvironment,
  parseEnvironment,
  deploymentAccounts,
} from '../tools/deploy/environment.js';
import { planDeployment } from '../tools/deploy/plan.js';
import { encodeContractAbi } from '../tools/deploy/actions.js';
it('includes only explicitly configured grant/admission accounts without changing the existing production names', async () => {
  const original = await loadEnvironment('production');
  const schema = {
    ...original,
    extraModules: [
      {
        name: 'grantreview',
        ramBytes: 1000000,
        cpuStake: '1.0000 TLOS',
        netStake: '1.0000 TLOS',
        contract: 'grants',
        inlineCode: true,
      },
      {
        name: 'joinreview',
        ramBytes: 1000000,
        cpuStake: '1.0000 TLOS',
        netStake: '1.0000 TLOS',
        contract: 'endorse',
        inlineCode: true,
      },
    ],
  };
  const parsed = parseEnvironment(schema);
  if (!parsed.chainId) throw new Error('FIXTURE_CHAIN');
  const environment = { ...parsed, chainId: parsed.chainId };
  expect(original.accounts).toEqual(environment.accounts);
  expect(deploymentAccounts(environment)).toHaveLength(9);
  const views = new Map(
    deploymentAccounts(environment).map((account) => [
      account.name,
      { exists: false, ramQuota: 0, ramUsage: 0, hasCode: false },
    ]),
  );
  const plan = planDeployment(environment, views, true);
  expect(plan.filter((change) => change.role === 'grants').map((change) => change.action)).toEqual([
    'create',
    'set-contract',
  ]);
  expect(() =>
    parseEnvironment({ ...schema, extraModules: [schema.extraModules[0], schema.extraModules[0]] }),
  ).toThrow('DEPLOY_ENVIRONMENT_INVALID');
  expect(() =>
    parseEnvironment({ ...schema, extraModules: [{ ...schema.extraModules[0], name: 'core.we' }] }),
  ).toThrow('DEPLOY_ENVIRONMENT_INVALID');
});
it('packs a compiled ABI as native abi_def bytes instead of uploading its JSON text', () => {
  const text = readFileSync('.artifacts/contracts/runtime.abi', 'utf8');
  const bytes = encodeContractAbi(text);
  expect(bytes[0]).not.toBe('{'.charCodeAt(0));
  const decoded: unknown = JSON.parse(
      JSON.stringify(Serializer.decode({ type: ABI, data: bytes })),
    ),
    original: unknown = JSON.parse(JSON.stringify(ABI.from(text)));
  expect(decoded).toEqual(original);
});

it('limits the prepared runtime context permission to supported producer actions and operator-selected accounts', async () => {
  const { contextPermissionPlan } = await import('../tools/deploy/permissions.js');
  const { RuntimeActionSchemas } = await import('../sdk/generated/schemas.js');
  const plan = contextPermissionPlan('corefixture', [
    { id: 'grants-rounds', account: 'grantreview' },
    { id: 'endorsement-admission', account: 'joinreview' },
  ]);
  expect(plan.authority).toEqual({
    threshold: 1,
    keys: [],
    waits: [],
    accounts: [{ permission: { actor: 'corefixture', permission: 'eosio.code' }, weight: 1 }],
  });
  expect(
    plan.links
      .filter((link) => link.account === 'corefixture')
      .every((link) => link.action in RuntimeActionSchemas),
  ).toBe(true);
  expect(plan.links).toContainEqual({ account: 'joinreview', action: 'admit' });
  expect(
    plan.links.some((link) => ['admitfrom', 'reserve', 'transfer'].includes(link.action)),
  ).toBe(false);
  expect(() =>
    contextPermissionPlan('corefixture', [{ id: 'decide', account: 'corefixture' }]),
  ).toThrow('DUPLICATE_CONTEXT_ACCOUNT');
});
