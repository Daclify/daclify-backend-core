import { ABI, Action, PublicKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { NativeAccountSchema } from '../protocol/base.js';
import { SYSTEM_ABI } from './system-abi.js';

export const RelayCoreActions = [
  'submit',
  'submitsess',
  'submitevm',
  'orderfree',
  'ordercreate',
  'cardcreate',
  'createpaid',
  'setcapacity',
  'revokecap',
  'resumecap',
  'fulfilram',
  'archattest',
  'prunedocs',
  'payob',
] as const;
export const ServiceAccountConfigurationSchema = z
  .strictObject({
    runtime: NativeAccountSchema,
    relay: NativeAccountSchema,
    treasury: NativeAccountSchema,
    names: NativeAccountSchema.optional(),
    decide: NativeAccountSchema.optional(),
    payroll: NativeAccountSchema.optional(),
    relayKey: z.string().min(1).max(128),
  })
  .refine(
    (value) => new Set([value.runtime, value.relay, value.treasury]).size === 3,
    'SERVICE_ACCOUNTS_DISTINCT',
  );
export type ServiceAccountConfiguration = z.infer<typeof ServiceAccountConfigurationSchema>;

export function relayActionLinks(
  input: ServiceAccountConfiguration,
): { code: string; type: string }[] {
  const config = ServiceAccountConfigurationSchema.parse(input);
  const decide = config.decide;
  return [
    ...RelayCoreActions.map((type) => ({ code: config.runtime, type })),
    ...(config.names ? [{ code: config.names, type: 'fulfillnet' }] : []),
    ...(decide
      ? ['finalize', 'execute', 'executeaward', 'prunevotes'].map((type) => ({
          code: decide,
          type,
        }))
      : []),
    ...(config.payroll ? [{ code: config.payroll, type: 'settle' }] : []),
  ];
}

export function serviceAccountPermissionActions(input: ServiceAccountConfiguration): Action[] {
  const config = ServiceAccountConfigurationSchema.parse(input),
    key = PublicKey.from(config.relayKey),
    abi = ABI.from(SYSTEM_ABI);
  const governance = {
    threshold: 1,
    keys: [],
    waits: [],
    accounts: [{ permission: { actor: config.runtime, permission: 'active' }, weight: 1 }],
  };
  const action = (name: string, account: string, data: object) =>
    Action.from(
      { account: 'eosio', name, authorization: [{ actor: account, permission: 'owner' }], data },
      abi,
    );
  return [
    action('updateauth', config.relay, {
      account: config.relay,
      permission: 'operator',
      parent: 'active',
      auth: { threshold: 1, keys: [{ key, weight: 1 }], accounts: [], waits: [] },
    }),
    ...relayActionLinks(config).map((link) =>
      action('linkauth', config.relay, { account: config.relay, ...link, requirement: 'operator' }),
    ),
    ...[config.relay, config.treasury].flatMap((account) => [
      ...['setcode', 'setabi'].map((type) =>
        action('linkauth', account, { account, code: 'eosio', type, requirement: 'owner' }),
      ),
      action('updateauth', account, {
        account,
        permission: 'active',
        parent: 'owner',
        auth: governance,
      }),
      action('updateauth', account, { account, permission: 'owner', parent: '', auth: governance }),
    ]),
  ];
}
