import { z } from 'zod';
import { PeopleRoutes } from './people.js';
import { PaymentRoutes, BrokerRoutes } from './payments.js';
import { StorageBillingRoutes } from './storage.js';
import { HostingRoutes } from './hosting.js';
import { DirectoryRoutes } from './directory.js';
import { SessionSchema, ProviderLinkResultSchema } from './api.js';
import {
  AccountControlChallengeSchema,
  AccountControlRequestSchema,
  SignInProofSchema,
  SignInEmailSchema,
  SignInEmailCodeSchema,
  SignInPasskeyRegisterSchema,
  SignInPasskeyLoginSchema,
  SignInRemoveSchema,
  TelegramStartSchema,
  TelegramPairConfirmSchema,
  CredentialHistoryQuerySchema,
  TelegramAuthorizationSchema,
  TelegramPendingPairSchema,
  CredentialHistorySchema,
} from './sign-in.js';
import {
  NativeChallengeSchema,
  NativeIdentitySchema,
  NativeLinksSchema,
  NativeIntentSchema,
  NativeFinishSchema,
  NativeUnlinkSchema,
} from './native-wallet.js';
import {
  EvmSignInChallengeSchema,
  EvmGovernanceBindingSchema,
  EvmIntentSchema,
  EvmFinishSchema,
  EvmRelaySchema,
  EvmChainInputSchema,
  EvmLinkInputSchema,
} from './evm-wallet.js';
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
  telegram: z.strictObject({
    configured: z.boolean(),
    username: z.string().nullable(),
    oidc: z.boolean().default(false),
    miniApp: z.boolean().default(false),
  }),
  email: z.strictObject({ delivery: SignInDeliverySchema }),
  passkey: z.strictObject({ rpId: z.string().min(1) }),
});
export const SignInMethodsSchema = z.strictObject({
  telegram: z.strictObject({
    configured: z.boolean(),
    username: z.string().nullable(),
    subjects: z.array(z.string()),
    oidc: z.boolean().default(false),
    miniApp: z.boolean().default(false),
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
export const EvmLinkedCredentialSchema = EvmLinkSchema.extend({ controlVerified: z.boolean() });
export const EvmLinksSchema = z.strictObject({ links: z.array(EvmLinkedCredentialSchema) });
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
  contract: z.string().nullable().default(null),
  tokenContract: z.string().nullable().default(null),
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
  PeopleRoutes.members,
  PeopleRoutes.list,
  ...Object.values(StorageBillingRoutes),
  ...Object.values(HostingRoutes),
  ...Object.values(PaymentRoutes),
  ...Object.values(BrokerRoutes),
  ...Object.values(DirectoryRoutes),
  {
    method: 'POST',
    path: '/v1/sign-in/email/login/start',
    input: SignInEmailSchema,
    response: z.strictObject({ delivery: z.literal('sent') }),
  },
  {
    method: 'POST',
    path: '/v1/sign-in/remove',
    input: SignInRemoveSchema,
    status: 204,
    response: z.never(),
  },
  {
    method: 'POST',
    path: '/v1/account/native/unlink',
    input: NativeUnlinkSchema,
    status: 204,
    response: z.never(),
  },
  {
    method: 'POST',
    path: '/v1/account/evm/unlink',
    input: EvmChainInputSchema,
    status: 204,
    response: z.never(),
  },
  {
    method: 'GET',
    path: '/v1/account/history',
    query: CredentialHistoryQuerySchema,
    response: CredentialHistorySchema,
  },
  { method: 'GET', path: '/v1/daos/:id/evm/:member', response: EvmGovernanceBindingSchema },
  {
    method: 'POST',
    path: '/v1/relay/evm',
    input: EvmRelaySchema,
    response: z.strictObject({ transactionId: z.string().regex(/^[0-9a-f]{64}$/) }),
  },
  {
    method: 'POST',
    path: '/v1/account/evm/sign-in/challenge',
    input: EvmIntentSchema,
    response: EvmSignInChallengeSchema,
  },
  {
    method: 'POST',
    path: '/v1/account/evm/sign-in/link',
    input: EvmFinishSchema,
    response: EvmLinkSchema,
  },
  { method: 'POST', path: '/v1/sign-in/evm', input: EvmFinishSchema, response: SessionSchema },
  { method: 'GET', path: '/v1/account/native', response: NativeLinksSchema },
  {
    method: 'POST',
    path: '/v1/account/native/challenge',
    input: NativeIntentSchema,
    response: NativeChallengeSchema,
  },
  {
    method: 'POST',
    path: '/v1/account/native/link',
    input: NativeFinishSchema,
    response: NativeIdentitySchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/native',
    input: NativeFinishSchema,
    response: SessionSchema,
  },
  {
    method: 'POST',
    path: '/v1/account/control',
    input: AccountControlRequestSchema,
    response: AccountControlChallengeSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/session',
    input: z.strictObject({}),
    response: SessionSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/telegram/oidc/login/start',
    input: TelegramStartSchema,
    response: TelegramAuthorizationSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/telegram/oidc/pair/start',
    input: TelegramStartSchema,
    response: TelegramAuthorizationSchema,
  },
  {
    method: 'GET',
    path: '/v1/sign-in/telegram/oidc/pair/:id',
    response: TelegramPendingPairSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/telegram/oidc/pair/confirm',
    input: TelegramPairConfirmSchema,
    response: ProviderLinkResultSchema,
  },
  { method: 'GET', path: '/v1/profile', response: MemberProfileSchema },
  { method: 'POST', path: '/v1/billing/checkout', response: ServiceCheckoutSchema },
  { method: 'GET', path: '/v1/billing/receipts', response: ServiceReceiptsSchema },
  { method: 'GET', path: '/v1/sign-in/options', response: SignInOptionsSchema },
  { method: 'GET', path: '/v1/sign-in/methods', response: SignInMethodsSchema },
  {
    method: 'POST',
    path: '/v1/sign-in/email/start',
    input: SignInEmailSchema,
    response: EmailStartSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/email/confirm',
    input: SignInEmailCodeSchema,
    response: EmailSubjectSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/email/login',
    input: SignInEmailCodeSchema,
    response: SessionSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/telegram',
    input: SignInProofSchema,
    response: ProviderLinkResultSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/telegram/login',
    input: SignInProofSchema,
    response: SessionSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/passkey/register/options',
    input: z.strictObject({}),
    response: PasskeyRegisterOptionsSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/passkey/register',
    input: SignInPasskeyRegisterSchema,
    response: PasskeyRegisteredSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/passkey/login/options',
    input: z.strictObject({}),
    response: PasskeyLoginOptionsSchema,
  },
  {
    method: 'POST',
    path: '/v1/sign-in/passkey/login',
    input: SignInPasskeyLoginSchema,
    response: SessionSchema,
  },
  { method: 'GET', path: '/v1/account/evm', response: EvmLinksSchema },
  {
    method: 'POST',
    path: '/v1/account/evm/challenge',
    input: EvmChainInputSchema,
    response: EvmChallengeSchema,
  },
  {
    method: 'POST',
    path: '/v1/account/evm/link',
    input: EvmLinkInputSchema,
    response: EvmLinkSchema,
  },
  { method: 'GET', path: '/v1/marketplace', response: MarketplaceSchema },
  { method: 'GET', path: '/v1/names', response: NamesServiceSchema },
  { method: 'GET', path: '/v1/names/quote', response: NameQuoteSchema },
  { method: 'POST', path: '/v1/names/checkout', response: ServiceCheckoutSchema },
  { method: 'GET', path: '/v1/docs/agent', response: DocsAgentStatusSchema },
  { method: 'POST', path: '/v1/docs/ask', response: DocsAnswerSchema },
] satisfies readonly {
  method: 'GET' | 'POST';
  path: string;
  response: z.ZodType;
  input?: z.ZodType;
  query?: z.ZodType;
  status?: number;
}[];

export const ContractFailureMessages = {
  NATIVE_EXECUTIVE_ROLES:
    'Administrator rights on this governing DAO follow the eligible paired executive roster. Change executive office or pairing instead.',
  SERVICE_KEY_EXECUTIVE:
    'Use separate keys: the hosting service key must not control an executive native wallet.',
  LAST_NATIVE_EXECUTIVE:
    'The final paired native executive cannot leave. Replace the wallet atomically or appoint another paired executive first.',
  LAST_EXECUTIVE: 'Appoint a replacement before removing the final executive.',
  EXECUTIVE_REQUIRED: 'Only a currently appointed executive can confirm executive activity.',
  NATIVE_GOVERNANCE_REQUIRED:
    'This deployment requires a native executive quorum transaction for appointments.',
  NATIVE_EXECUTIVE_REQUIRED:
    'An appointed executive must pair a Telos Zero account before native handover.',
  NATIVE_HANDOVER_CHANGED:
    'The executive roster, wallet bindings or quorum changed. Prepare and review a fresh handover transaction.',
  NATIVE_HANDOVER:
    'Native governance has already been handed over or this is a different governing DAO.',
  EXECUTIVE_HANDOVER_PENDING:
    'A successor roster is already pending. Activate or cancel it before scheduling another.',
  EXECUTIVE_TERM: 'This executive result is expired, superseded or already applied.',
  VOTER_INELIGIBLE:
    'You are a DAO member without voting rights. Ask the DAO administrator about its admission policy.',
  EXECUTIVE_LIMIT: 'Select between one and eight unique eligible executive members.',
  EXECUTIVE_POLICY:
    'Choose an inactivity timeout between one minute and one year, or disable it with zero, and a quorum from 1% to 100%.',

  PAYOUT_TOKEN_ROW_REQUIRED:
    'The receiving wallet must prepare its balance row for this token and precision before payment. Preparation pays the wallet’s RAM cost; it does not authorize a withdrawal.',
  PAYOUT_WALLET_REQUIRED:
    'Connect the receiving account’s wallet on this DAO’s blockchain to prepare its token balance row.',
  RAM_QUOTA_ACTIVE:
    'The operator must disable this DAO’s RAM guard before legacy completion adoption.',
  RAM_CREDENTIAL_REQUIRED:
    'The operator must complete legacy signing and recovery adoption before enabling this DAO’s RAM guard.',
  RAM_CLAIM_HOLD_REQUIRED:
    'The operator must provide a physical completion hold for existing claims before enabling this DAO’s RAM guard.',
  RAM_OBLIGATION_HOLD_REQUIRED:
    'The operator must provide physical completion holds for pending obligations before enabling this DAO’s RAM guard.',
  RAM_COMPLETION_SCAN_LIMIT:
    'This DAO needs bounded legacy completion qualification before its RAM guard can be enabled.',
  RAM_WORK_REFS_REQUIRED:
    'The operator must reserve document references for accepted work before enabling this DAO’s RAM guard.',
  RAM_PAYROLL_CONTROL_REQUIRED:
    'The operator must adopt existing Payroll settlement controls before enabling this DAO’s RAM guard.',
  RAM_ELECTION_HOLD_REQUIRED:
    'The operator must reserve finalization capacity for active elections before enabling this DAO’s RAM guard.',
  RAM_POLL_END_REQUIRED:
    'The operator must adopt ordinary poll completion markers before enabling this DAO’s RAM guard.',
  RAM_ORDINARY_EXHAUSTED:
    'This DAO needs additional ordinary RAM before this write or partial withdrawal. A full-claim withdrawal can use its reserved hold.',
  RAM_DAO_EXHAUSTED:
    'This DAO has exhausted its allocated and purchased RAM. Additional backed capacity is required.',
  RAM_ALLOCATION_REQUIRED:
    'The operator must issue physically backed capacity for this DAO and contract before enabling writes.',
  RAM_MIGRATION_ACTIVE:
    'The operator is completing the legacy RAM migration. Ordinary growth is temporarily unavailable.',
  RAM_PURCHASE_TRANSACTION:
    'Prepare the RAM order and its TLOS transfer together in one wallet transaction.',
  RAM_ORDER_UNKNOWN: 'This RAM order was not found on the selected operator.',
  RAM_BILLING_UNCONFIGURED: 'Card RAM purchases are not configured on this operator.',
  RAM_CARD_AMOUNT_RANGE:
    'Card RAM orders require a total of at least $5. Select a larger byte amount or pay with TLOS.',
  RAM_APPROVAL_CHANGED:
    'The RAM quote or exchange rate changed. Refresh and approve the new exact price.',
  RAM_RATE_UNAVAILABLE:
    'A current USD/TLOS rate and resource policy are required before card RAM checkout.',
  RAM_RESERVE_INSUFFICIENT:
    'The operator RAM reserve needs funding. Your order remains pending; DAO treasury and member claims cannot fund it.',
  RAM_RECEIPT_INVALID:
    'The payment or native resource receipt needs review before capacity can be provisioned.',
  RAM_PAYMENT_REVIEW: 'A RAM payment for this DAO needs operator review before another card order.',
  RAM_BILLING_AUTHORITY_UNCONFIGURED:
    'The operator must configure its billing authority before card RAM provisioning.',
  RAM_SYSTEM_UNQUALIFIED: 'This system contract or ABI has not been qualified for RAM purchases.',
  RAM_RECEIVER_UNQUALIFIED: 'This contract payer has no qualified finite RAM allocation.',
  RAM_RESOURCE_MODE_UNSUPPORTED:
    'This account uses a resource mode that cannot verify RAM acquisition.',
  RAM_RECEIVER_UNINSTALLED: 'Install and qualify this module before buying RAM for it.',
  RAM_QUOTE_EXPIRED: 'This RAM quote expired. Request and approve a new quote.',
  RAM_ACQUISITION_MINIMUM:
    'The RAM market moved beyond your approved minimum. The whole payment was rolled back.',
  RAM_PAYMENT_RANGE: 'The payment does not match the approved RAM price ceiling.',
  RAM_SOURCE_CODE: 'The payer contract changed. Request a new qualified quote.',
  RESOURCE_POLICY_CHANGED:
    'The resource policy changed. Refresh and review the current values before signing.',
  RESOURCE_POLICY:
    'Choose valid resource fees, a bounded quote lifetime, and positive storage units and monthly price.',
  MEMBERSHIP_CAPACITY:
    'This DAO has reached its member allowance. Ask an administrator to approve more capacity; existing members retain their rights.',
  HOSTED_PRICE:
    'Choose positive graduated rates, with each later band no more expensive than the previous one.',
  PAYMENTS_UNCONFIGURED:
    'Merchant payments are not configured on this operator. Free DAO governance remains available.',
  HOSTING_CAPACITY_RANGE:
    'Choose a capacity within the shared runtime limit of 5,000 active members.',
  HOSTING_UNCONFIGURED: 'Card subscriptions are not configured on this operator.',
  HOSTING_UNAVAILABLE:
    'Shared hosting is unavailable on this deployment. The operator must verify its runtime and hosting configuration.',
  HOSTING_APPROVAL_CHANGED:
    'The quote changed. Refresh the capacity screen and approve the displayed pricing.',
  HOSTING_CHANGE_PENDING:
    'A subscription change is pending. Complete or reconcile its Stripe invoice before another change.',
  HOSTING_REQUEST_CONFLICT:
    'An earlier subscription request is pending. Refresh and resume the saved checkout.',
  PAYMENT_PLATFORM_SETUP_REQUIRED:
    'Manage merchant configuration through the central Daclify payment service.',
  PAYMENT_ONBOARDING_REQUIRED:
    'Complete Stripe merchant verification with both charges and payouts enabled before accepting payments.',
  PAYMENT_ADMIN_REQUIRED: 'A current administrator of this DAO is required.',
  HOSTING_ADMIN_REQUIRED: 'A current administrator of this DAO is required.',
  PAYMENT_REFUND_AMOUNT:
    'This refund exceeds the amount remaining after completed and pending refunds.',
  PAYMENT_RECONCILIATION_REQUIRED:
    'A previous provider operation needs reconciliation. Keep its request ID and contact the operator before starting another.',
  HOSTING_RECONCILIATION_REQUIRED:
    'A previous billing operation needs reconciliation. Keep its saved request and contact the operator.',
  PAYMENT_LIVE_DISABLED: 'Live module payments are disabled on this operator.',
  HOSTING_LIVE_DISABLED: 'Live hosting payments are disabled on this operator.',
  INSUFFICIENT_AVAILABLE:
    'The DAO does not have enough available Treasury funds to reserve every milestone.',
  ROUND_CAP: 'This award would exceed the round’s lifetime cap.',
  APPLICATION_CHANGED:
    'The application changed after voting began. Open a new vote for the current revision.',
  APPLICATION_NOT_ELIGIBLE:
    'Submit consent and obtain an eligibility review before proposing or executing an award.',
  AWARDS_CLOSED: 'The award deadline has passed.',
  ADMISSION_REQUIRED: 'This DAO requires member endorsements before admission.',
  ADMISSION_POLICY_CHANGED: 'The admission policy changed. Submit a current application.',
  ENDORSEMENT_THRESHOLD: 'The application needs more current eligible member endorsements.',
  APPLICATION_REVISION:
    'This application revision changed. Review the current terms before signing.',
  APPLICATION_EXPIRED: 'The application expired. Ask its sponsor to renew it.',

  EVM_BINDING: 'The selected EVM wallet is not currently authorized for this DAO member.',
  EVM_UNLINKED: 'This member has no active EVM wallet authorization.',
  EVM_BINDING_EPOCH: 'The wallet authorization changed. Refresh it before signing again.',
  EVM_ADDRESS: 'The signature does not match the authorized EVM wallet.',
  EVM_SIGNATURE: 'The EVM signature could not be verified.',
  EVM_SIGNATURE_CANONICAL: 'The wallet returned an unsupported signature form.',
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
