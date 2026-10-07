import { z } from 'zod';
import { SessionSchema, ProviderLinkResultSchema } from './api.js';
export const ServiceCheckoutSchema = z.strictObject({ url: z.url() });
export const ServiceReceiptSchema = z.strictObject({
  status: z.enum(['paid', 'failed']),
  currency: z
    .string()
    .regex(/^[a-z]{3}$/)
    .nullable(),
  amountMinor: z.number().int().nonnegative().nullable(),
  paymentStatus: z.string().min(1),
});
export const ServiceReceiptsSchema = z.strictObject({ receipts: z.array(ServiceReceiptSchema) });
export const MemberProfileSchema = z.strictObject({
  accountName: z.string().nullable(),
  profile: z.string().nullable(),
});
export const SignInDeliverySchema = z.enum(['local', 'mail', 'unavailable']);
export const SignInOptionsSchema = z.strictObject({
  telegram: z.strictObject({ configured: z.boolean(), username: z.string().nullable() }),
  email: z.strictObject({ delivery: SignInDeliverySchema }),
  passkey: z.strictObject({ rpId: z.string().min(1) }),
});
export const SignInMethodsSchema = z.strictObject({
  telegram: z.strictObject({
    configured: z.boolean(),
    username: z.string().nullable(),
    subjects: z.array(z.string()),
  }),
  email: z.strictObject({ delivery: SignInDeliverySchema, subjects: z.array(z.string()) }),
  passkeys: z.array(z.strictObject({ id: z.string().min(1) })),
});
export const EmailStartSchema = z.union([
  z.strictObject({ delivery: z.literal('local'), code: z.string().regex(/^\d{8}$/) }),
  z.strictObject({ delivery: z.literal('sent') }),
]);
export const EmailSubjectSchema = z.strictObject({ subject: z.string().min(1) });
export const PasskeyRegisterOptionsSchema = z.strictObject({
  challenge: z.string().regex(/^[A-Za-z0-9_-]+$/),
  rp: z.strictObject({ name: z.string(), id: z.string() }),
  user: z.strictObject({ id: z.string(), name: z.string(), displayName: z.string() }),
  pubKeyCredParams: z.array(z.strictObject({ type: z.literal('public-key'), alg: z.literal(-7) })),
  timeout: z.number().int().positive(),
  attestation: z.literal('none'),
  authenticatorSelection: z.strictObject({
    residentKey: z.literal('required'),
    requireResidentKey: z.literal(true),
    userVerification: z.literal('required'),
  }),
  excludeCredentials: z.array(z.strictObject({ type: z.literal('public-key'), id: z.string() })),
});
export const PasskeyLoginOptionsSchema = z.strictObject({
  challenge: z.string().regex(/^[A-Za-z0-9_-]+$/),
  timeout: z.number().int().positive(),
  rpId: z.string().min(1),
  userVerification: z.literal('required'),
});
export const PasskeyRegisteredSchema = z.strictObject({ id: z.string().min(1) });
export const TelosChainSchema = z.union([z.literal(40), z.literal(41)]);
export const EvmLinkSchema = z.strictObject({
  chainId: TelosChainSchema,
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});
export const EvmLinksSchema = z.strictObject({ links: z.array(EvmLinkSchema) });
export const EvmChallengeSchema = z.strictObject({
  chainId: TelosChainSchema,
  message: z.string().min(1),
  expiresAt: z.string().min(1),
});
export const ListedModuleSchema = z.strictObject({
  account: z.string(),
  publisher: z.string(),
  party: z.enum(['first-party', 'third-party']),
  price: z.string(),
  title: z.string(),
  codeHash: z.string(),
  summary: z.string(),
  detail: z.string(),
});
export const MarketplaceSchema = z.strictObject({
  configured: z.boolean(),
  reason: z.string().nullable(),
  thirdPartyBps: z.number().int().nullable(),
  firstPartyBps: z.number().int().nullable(),
  treasury: z.string().nullable(),
  modules: z.array(ListedModuleSchema),
});
export const NameTierSchema = z.strictObject({
  kind: z.enum(['basic', 'premium']),
  price: z.string(),
  usdCents: z.number().int().nonnegative(),
  ramBytes: z.number().int().positive(),
  netStake: z.string(),
  cpuStake: z.string(),
  tlosQuote: z.string().nullable(),
});
export const NameListingSchema = z.strictObject({
  accountName: z.string(),
  seller: z.string(),
  price: z.string(),
  usdCents: z.number().int().nonnegative(),
  sold: z.boolean(),
});
export const NameSuffixSchema = z.strictObject({
  suffix: z.string(),
  seller: z.string(),
  price: z.string(),
  usdCents: z.number().int().nonnegative(),
  sales: z.number().int().nonnegative(),
});
export const NamesServiceSchema = z.strictObject({
  configured: z.boolean(),
  reason: z.string().nullable(),
  cardPayments: z.boolean(),
  thirdPartyBps: z.number().int().nullable(),
  firstPartyBps: z.number().int().nullable(),
  treasury: z.string().nullable(),
  tiers: z.array(NameTierSchema),
  listings: z.array(NameListingSchema),
  suffixes: z.array(NameSuffixSchema),
  bumpBps: z.number().int().nullable(),
  quotePremiumBps: z.number().int().nullable(),
  oracleMedian: z.string().nullable(),
  oraclePrecision: z.number().int().nullable(),
  oracleObservedAt: z.number().int().nullable(),
  daoId: z.string().nullable(),
});
export const NameQuoteSchema = z.strictObject({
  accountName: z.string(),
  kind: z.enum(['basic', 'premium']),
  listed: z.boolean(),
  seller: z.string(),
  party: z.enum(['first-party', 'third-party']),
  price: z.string(),
  usdCents: z.number().int().nonnegative(),
  platformBps: z.number().int().nonnegative(),
  suffix: z.string().nullable(),
  bumpBps: z.number().int().nonnegative(),
  quotePremiumBps: z.number().int().nonnegative(),
  ramBytes: z.number().int().nonnegative(),
  netStake: z.string(),
  cpuStake: z.string(),
  priceFromOracle: z.boolean(),
  sales: z.number().int().nonnegative(),
  nextPrice: z.string().nullable(),
  nextUsdCents: z.number().int().nullable(),
});
export const DocsAgentStatusSchema = z.strictObject({ configured: z.boolean() });
export const DocsAnswerSchema = z.strictObject({
  status: z.enum(['answered', 'outside']),
  topicId: z.string().nullable(),
  title: z.string().nullable(),
  answer: z.string(),
});

export const ServiceResponseRoutes = [
  { method: 'GET', path: '/v1/profile', response: MemberProfileSchema },
  { method: 'POST', path: '/v1/billing/checkout', response: ServiceCheckoutSchema },
  { method: 'GET', path: '/v1/billing/receipts', response: ServiceReceiptsSchema },
  { method: 'GET', path: '/v1/sign-in/options', response: SignInOptionsSchema },
  { method: 'GET', path: '/v1/sign-in/methods', response: SignInMethodsSchema },
  { method: 'POST', path: '/v1/sign-in/email/start', response: EmailStartSchema },
  { method: 'POST', path: '/v1/sign-in/email/confirm', response: EmailSubjectSchema },
  { method: 'POST', path: '/v1/sign-in/email/login', response: SessionSchema },
  { method: 'POST', path: '/v1/sign-in/telegram', response: ProviderLinkResultSchema },
  { method: 'POST', path: '/v1/sign-in/telegram/login', response: SessionSchema },
  {
    method: 'POST',
    path: '/v1/sign-in/passkey/register/options',
    response: PasskeyRegisterOptionsSchema,
  },
  { method: 'POST', path: '/v1/sign-in/passkey/register', response: PasskeyRegisteredSchema },
  {
    method: 'POST',
    path: '/v1/sign-in/passkey/login/options',
    response: PasskeyLoginOptionsSchema,
  },
  { method: 'POST', path: '/v1/sign-in/passkey/login', response: SessionSchema },
  { method: 'GET', path: '/v1/account/evm', response: EvmLinksSchema },
  { method: 'POST', path: '/v1/account/evm/challenge', response: EvmChallengeSchema },
  { method: 'POST', path: '/v1/account/evm/link', response: EvmLinkSchema },
  { method: 'GET', path: '/v1/marketplace', response: MarketplaceSchema },
  { method: 'GET', path: '/v1/names', response: NamesServiceSchema },
  { method: 'GET', path: '/v1/names/quote', response: NameQuoteSchema },
  { method: 'POST', path: '/v1/names/checkout', response: ServiceCheckoutSchema },
  { method: 'GET', path: '/v1/docs/agent', response: DocsAgentStatusSchema },
  { method: 'POST', path: '/v1/docs/ask', response: DocsAnswerSchema },
] satisfies readonly { method: 'GET' | 'POST'; path: string; response: z.ZodType }[];

export const ContractFailureMessages = {
  GOVERNANCE_LOCKED:
    'An active ballot has locked voting weights or policy. Close the ballot before making this change.',
  POLICY_CHANGED: 'The funding policy changed. Members must approve a new funding vote.',
  DAO_PAUSED:
    'The DAO guardian has paused commitments and payments. Check the pause expiry in Settings.',
  SELF_REVIEW: 'Contributors cannot review their own work. Ask another reviewer or administrator.',
  MODULE_ACTION:
    'This action is absent from the installed module permissions. Ask an administrator to review the grant.',
  PAYROLL_PAUSED:
    'Schedule settlement is paused. Approved due obligations may still be paid directly through Treasury.',
  DOCUMENT_VERSION:
    'This document version already exists. Refresh before preparing another version.',
  DOCUMENT_UNKNOWN: 'Publish the evidence document before referencing it in this action.',
  MEMBER_INACTIVE: 'This membership is inactive. Existing claim and stake exits remain available.',
  NO_ELIGIBLE_WEIGHT:
    'There is no eligible voting weight. Check active members, credits or deposits.',
  NO_VOTING_WEIGHT: 'Your membership has no eligible weight for this ballot.',
  NONCE: 'Another action advanced your member nonce. Refresh before signing again.',
  POLICY_GUARDIAN:
    'The guardian account does not exist on this native chain. Correct it before preparing payment.',
  POLICY_BUDGET: 'Commitment limits exceed the supported asset range or daily policy.',
  NOT_PAYABLE: 'This obligation is not approved and due for payment.',
  BALLOT_OPEN: 'This ballot is still open. Wait until its closing time.',
  BALLOT_CLOSED: 'This ballot no longer accepts votes.',
  EXECUTION_EXPIRED: 'This funding execution expired. Propose a new funding vote.',
  CREATION_EXPIRED: 'This unpaid setup order expired. Prepare a new order before paying.',
  CREATION_ASSET_IMMUTABLE:
    'The creation payment token cannot change after creation fees are enabled.',
};
