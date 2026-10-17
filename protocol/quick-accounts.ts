import { Name } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  ChainIdSchema,
  EvmAddressSchema,
  NativeAccountSchema,
  TelosEvmChainSchema,
} from './base.js';
import { SigningPublicKeySchema } from './crypto.js';
import {
  QuickauthActionSchemas,
  QuickauthTableSchemas,
} from '../sdk/generated/quickauth-schemas.js';
import { NativeProofSchema } from './sign-in.js';

const CanonicalAccount = NativeAccountSchema.refine(
  (value) => Name.from(value).toString() === value,
);
export const QuickAccountAnchorSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('key'),
    publicKey: SigningPublicKeySchema.refine((value) => value.startsWith('PUB_K1_')),
  }),
  z.strictObject({
    kind: z.literal('native'),
    account: CanonicalAccount,
    permission: z.literal('active'),
  }),
  z.strictObject({
    kind: z.literal('evm'),
    chainId: TelosEvmChainSchema,
    address: EvmAddressSchema.toLowerCase(),
  }),
]);
export type QuickAccountAnchor = z.infer<typeof QuickAccountAnchorSchema>;
export const QuickAccountDomainSchema = z.strictObject({
  chainId: ChainIdSchema,
  runtime: CanonicalAccount,
});
const hex = (maximumBytes: number) =>
  z
    .string()
    .max(maximumBytes * 2)
    .regex(/^(?:[0-9a-f]{2})*$/);
export const QuickAccountIntentSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('register') }),
  z.strictObject({
    operation: z.literal('default'),
    method: z
      .union([QuickAccountAnchorSchema.options[1], QuickAccountAnchorSchema.options[2]])
      .nullable(),
  }),
  z.strictObject({
    operation: z.literal('submit'),
    action: z.enum(['respond', 'remove']),
    data: hex(4096).refine((value) => value.length >= 52),
    useDefault: z.boolean(),
  }),
  z.strictObject({ operation: z.literal('deactivate'), useDefault: z.boolean() }),
]);
export const QuickAccountContextSchema = QuickAccountDomainSchema.extend({
  authority: CanonicalAccount,
  authorityCodeHash: ChainIdSchema,
  source: CanonicalAccount,
  sourceCodeHash: ChainIdSchema,
  gateway: z.strictObject({ actor: CanonicalAccount, permission: CanonicalAccount }),
  anchor: QuickAccountAnchorSchema,
  approvalKey: SigningPublicKeySchema.optional(),
  identity: ChainIdSchema,
  frozen: z.boolean(),
  record: QuickauthTableSchemas.qaccounts.nullable(),
});
export const QuickAccountRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('qregister'),
    request: QuickauthActionSchemas.qregister.shape.request,
  }),
  z.strictObject({
    action: z.literal('qdefault'),
    request: QuickauthActionSchemas.qdefault.shape.request,
  }),
  z.strictObject({
    action: z.literal('qsubmit'),
    request: QuickauthActionSchemas.qsubmit.shape.request,
  }),
  z.strictObject({
    action: z.literal('qdeactivate'),
    request: QuickauthActionSchemas.qdeactivate.shape.request,
  }),
]);
const prepared = { id: z.uuid(), context: QuickAccountContextSchema, expiresAt: z.iso.datetime() };
export const QuickAccountPreparedSchema = z.discriminatedUnion('action', [
  QuickAccountRequestSchema.options[0].extend(prepared),
  QuickAccountRequestSchema.options[1].extend(prepared),
  QuickAccountRequestSchema.options[2].extend(prepared),
  QuickAccountRequestSchema.options[3].extend(prepared),
]);
export const QuickAccountProofsSchema = z.strictObject({ proof: hex(66), incoming: hex(65) });
export const QuickAccountRoutes = {
  quickAccountStatus: {
    method: 'GET',
    path: '/v1/me/quick-account',
    response: z.discriminatedUnion('available', [
      z.strictObject({ available: z.literal(false), context: z.null() }),
      z.strictObject({ available: z.literal(true), context: QuickAccountContextSchema }),
    ]),
    helpTopic: 'accounts',
  },
  quickAccountPrepare: {
    method: 'POST',
    path: '/v1/me/quick-account/prepare',
    input: z.strictObject({ expectedIdentity: ChainIdSchema, intent: QuickAccountIntentSchema }),
    response: QuickAccountPreparedSchema,
    helpTopic: 'accounts',
  },
  quickAccountSubmit: {
    method: 'POST',
    path: '/v1/me/quick-account/submit',
    input: QuickAccountProofsSchema.extend({ id: z.uuid(), native: NativeProofSchema.optional() }),
    response: z.strictObject({
      transactionId: ChainIdSchema,
      state: z.enum(['confirmed', 'pending']),
    }),
    helpTopic: 'accounts',
  },
} as const;
export type QuickAccountIntent = z.infer<typeof QuickAccountIntentSchema>;
export type QuickAccountContext = z.infer<typeof QuickAccountContextSchema>;
export type QuickAccountPrepared = z.infer<typeof QuickAccountPreparedSchema>;
