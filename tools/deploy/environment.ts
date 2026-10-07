import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ChainIdSchema, NativeAccountSchema } from '../../protocol/base.js';

const StakeSchema = z.string().regex(/^(?:0|[1-9][0-9]*)\.[0-9]{4} TLOS$/);
const RoleSchema = z.enum(['runtime', 'hub', 'decide', 'works', 'payroll', 'relay', 'billing']);
const AccountSchema = z.strictObject({
  name: NativeAccountSchema,
  ramBytes: z
    .number()
    .int()
    .min(4096)
    .max(64 * 1024 * 1024),
  cpuStake: StakeSchema,
  netStake: StakeSchema,
  contract: z
    .enum(['runtime', 'hub', 'decide', 'works', 'payroll', 'grants', 'endorse', 'names'])
    .nullable(),
  inlineCode: z.boolean(),
});
const NameSchema = z.enum(['develop', 'production', 'testnet']);
export type DeployName = z.infer<typeof NameSchema>;
const EnvironmentSchema = z
  .strictObject({
    name: NameSchema,
    resourceModel: z.enum(['bare', 'telos']),
    chainId: ChainIdSchema.nullable(),
    chainIdFile: z.string().min(1).optional(),
    rpcUrl: z.url(),
    creatorAccount: NativeAccountSchema,
    tokenContract: NativeAccountSchema,
    evmContract: z.literal('eosio.evm'),
    billingRole: z.literal('billing'),
    oracle: z.strictObject({
      rpcUrl: z.url(),
      contract: z.literal('delphioracle'),
      pair: z.literal('tlosusd'),
      maxAgeSeconds: z.literal(900),
      premiumBps: z.literal(2000),
    }),
    accounts: z.array(AccountSchema).length(7),
    namesAccount: AccountSchema.extend({
      contract: z.literal('names'),
      inlineCode: z.literal(true),
    }).optional(),
    extraModules: z
      .array(
        AccountSchema.extend({
          contract: z.enum(['grants', 'endorse']),
          inlineCode: z.literal(true),
        }),
      )
      .max(2)
      .default([]),
  })
  .refine((environment) => environment.chainId !== null || environment.chainIdFile, 'CHAIN_SOURCE')
  .refine(
    (environment) => new Set(environment.accounts.map((account) => account.name)).size === 7,
    'DUPLICATE_ACCOUNT',
  )
  .refine((environment) => {
    const contracts = ['runtime', 'hub', 'decide', 'works', 'payroll', null, null] as const;
    return contracts.every((contract, index) => environment.accounts[index]?.contract === contract);
  }, 'ACCOUNT_ORDER')
  .refine(
    (environment) =>
      new Set(
        [
          ...environment.accounts,
          ...environment.extraModules,
          ...(environment.namesAccount ? [environment.namesAccount] : []),
        ].map((account) => account.name),
      ).size ===
        environment.accounts.length +
          environment.extraModules.length +
          (environment.namesAccount ? 1 : 0) &&
      new Set(environment.extraModules.map((account) => account.contract)).size ===
        environment.extraModules.length,
    'DUPLICATE_MODULE_ACCOUNT',
  )
  .refine((environment) => {
    if (environment.name !== 'testnet') return true;
    const names = [
      environment.creatorAccount,
      ...[
        ...environment.accounts,
        ...environment.extraModules,
        ...(environment.namesAccount ? [environment.namesAccount] : []),
      ].map((account) => account.name),
    ];
    return names.every((name) => /^[a-z1-5]{12}$/.test(name));
  }, 'TESTNET_NAME');

export type DeployEnvironment = z.infer<typeof EnvironmentSchema> & { chainId: string };
export type DeployAccount = DeployEnvironment['accounts'][number];
export const DEPLOY_ROLES = RoleSchema.options;
export function deploymentAccounts(
  environment: z.infer<typeof EnvironmentSchema>,
): readonly DeployAccount[] {
  return [
    ...environment.accounts,
    ...environment.extraModules,
    ...(environment.namesAccount ? [environment.namesAccount] : []),
  ];
}

const directory = path.dirname(fileURLToPath(import.meta.url));
export const CORE_ROOT = path.resolve(directory, '../..');

export function parseEnvironment(value: unknown): z.infer<typeof EnvironmentSchema> {
  const parsed = EnvironmentSchema.safeParse(value);
  if (!parsed.success) throw new Error('DEPLOY_ENVIRONMENT_INVALID');
  const roles = new Set(DEPLOY_ROLES);
  if (parsed.data.accounts.length !== roles.size) throw new Error('DEPLOY_ENVIRONMENT_INVALID');
  return parsed.data;
}

export async function loadEnvironment(name: DeployName): Promise<DeployEnvironment> {
  const file = path.join(directory, 'environments', `${name}.json`);
  const environment = parseEnvironment(JSON.parse(await readFile(file, 'utf8')));
  if (environment.name !== name) throw new Error('DEPLOY_ENVIRONMENT_INVALID');
  if (environment.chainId) return { ...environment, chainId: environment.chainId };
  if (!environment.chainIdFile) throw new Error('DEPLOY_ENVIRONMENT_INVALID');
  const recorded = z
    .object({ chainId: ChainIdSchema })
    .parse(JSON.parse(readFileSync(path.join(CORE_ROOT, environment.chainIdFile), 'utf8')));
  return { ...environment, chainId: recorded.chainId };
}
