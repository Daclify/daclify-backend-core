import { z } from 'zod';
import { StoredProfileJsonSchema } from './profiles.js';
import { Uint64Schema } from './base.js';
import { DaoClaimRoutes } from './dao-claims.js';
import { RecoveryRoutes } from './recovery.js';
import { PeopleRoutes } from './people.js';
import { PaymentRoutes, BrokerRoutes } from './payments.js';
import { StorageBillingRoutes } from './storage.js';
import { HostingRoutes } from './hosting.js';
import { ModuleFeeRoutes } from './module-fees.js';
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
  profile: StoredProfileJsonSchema.nullable(),
});
export const SignInDeliverySchema = z.enum(['local', 'mail', 'unavailable']);
export const GoogleSignInConfigurationSchema = z.strictObject({
  clientId: z.string().min(1).max(255).nullable(),
});
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
export const NamesInventoryQuerySchema = z.strictObject({
  listingsCursor: Uint64Schema.optional(),
  suffixesCursor: Uint64Schema.optional(),
});
export type NamesInventoryQuery = z.infer<typeof NamesInventoryQuerySchema>;
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
  listingsNext: Uint64Schema.nullable().default(null),
  suffixesNext: Uint64Schema.nullable().default(null),
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
export const DocsAgentStatusSchema = z.strictObject({
  configured: z.boolean(),
  profile: z
    .strictObject({
      name: z.literal('Daxi'),
      scope: z.tuple([z.literal('Daclify'), z.literal('Telos'), z.literal('DAOs')]),
      answerModel: z.string().nullable(),
      decisionsModel: z.string().nullable(),
      knowledgeVersion: z.string(),
    })
    .optional(),
});
export const DocsAnswerSchema = z.strictObject({
  status: z.enum(['answered', 'outside']),
  topicId: z.string().nullable(),
  title: z.string().nullable(),
  answer: z.string(),
});

export const ServiceResponseRoutes = [
  { method: 'GET', path: '/v1/sign-in/google', response: GoogleSignInConfigurationSchema },
  ...Object.values(DaoClaimRoutes),
  ...Object.values(ModuleFeeRoutes),
  ...Object.values(RecoveryRoutes),
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
    path: '/v1/sign-up/native',
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
  {
    method: 'GET',
    path: '/v1/names',
    query: NamesInventoryQuerySchema,
    response: NamesServiceSchema,
  },
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
  PRIVATE_AGENT_REQUIRED: 'Use Agent as the public participant label. Keep operating details in encrypted content.',
  PRIVATE_PAYROLL_REQUIRED: 'Encrypt payroll names with a compatible client. Existing payments and pause controls remain available.',
  PRIVATE_PAYROLL_PARENT: 'The encrypted agreed name belongs to a different payroll schedule.',
  PRIVATE_BALLOT_REVIEW_REQUIRED: 'Read and verify the encrypted ballot wording before voting.',
  PRIVATE_BALLOT_CONTEXT:
    'The encrypted wording does not match this ballot, its ordered choices or its supporting document. Voting is unavailable.',
  PRIVATE_BALLOT_REQUIRED:
    'This DAO requires encrypted ballot wording. Use a compatible client or explicitly review public disclosure.',
  PRIVATE_BALLOT_PARENT: 'The encrypted wording belongs to a different ballot.',
  PRIVATE_BALLOT_FIELDS:
    'The private ballot format contains unsupported or public descriptive fields.',
  PRIVATE_BALLOT_UNSUPPORTED:
    'Private ballots are not enabled on this deployment. No public fallback was sent.',
  PRIVATE_CONTENT_REFERENCE:
    'The protected content must match its exact encrypted document version, hash and key epoch.',
  PRIVATE_CONTENT_EPOCH:
    'Publish new private content with the current DAO epoch and its permitted grants.',
  PRIVATE_RECORD_REFERENCE:
    'The exact encrypted record is missing or has changed. Content cannot be read safely.',
  PRIVATE_RECORD_CONTEXT: 'This encrypted record belongs to a different item or deployment.',
  PRIVATE_RECORD_FORMAT:
    'The encrypted record format is unsupported. No plaintext fallback was opened.',
  PRIVATE_FOUNDER_IDENTITY:
    'Use the selected founder’s original account keys to prepare this private DAO.',
  PRIVATE_METADATA_CHANGED:
    'The private DAO settings changed. Reload and review them before signing again.',
  PRIVATE_SETUP_CHANGED:
    'The sealed invitation no longer matches its reviewed setup. Reopen the original invitation or request a new one.',
  PRIVATE_METADATA_DOWNGRADE:
    'This DAO uses protected identity records. Use a compatible client to preserve them.',
  PRIVATE_IDENTITY_REFERENCE:
    'The private identity must reference an exact encrypted document version and key epoch.',
  PRIVATE_FOUNDER_REQUIRED: 'Unlock the original founder account keys and resume the sealed setup.',
  PRIVATE_IDENTITY_UNSUPPORTED:
    'This deployment has not enabled private identity. No public fallback was sent.',
  PRIVATE_INVITATION_REQUIRED:
    'Reopen the complete original private invitation link. Its content key is kept only in your browser.',
  PRIVATE_INITIALIZATION_CHANGED:
    'The saved private setup no longer matches the DAO key epoch. Review it before continuing.',
  PRIVATE_RECORD_PENDING:
    'The encrypted record is not confirmed yet. Resume this saved operation before starting another.',
  PENDING_UPLOAD_FINISH:
    'Finish the pending encrypted upload for this DAO before choosing another record.',
  RECOVERY_ROOT_PROOF_REQUIRED:
    'Unlock the original Daclify keys to change recovery contacts. A paired wallet can still cancel a pending recovery.',
  CONTACT_RECOVERY_CLAIM_REQUIRED:
    'Open Trusted-contact recovery, resume the replacement backup and choose Sign in with recovered identity.',
  RECOVERY_IDENTITY_CONFLICT:
    'Use a fresh replacement vault or the current vault for this recovery identity.',
  RECOVERY_USER_CONTROLLED_REQUIRED: 'Trusted-contact enrollment requires a user-controlled vault.',
  ACCOUNT_KEY_RETIRED:
    'This key was replaced through trusted-contact recovery. Use the replacement device.',
  RECOVERY_KEY_RETIRED:
    'Choose a fresh replacement key. This signing key has already been retired.',
  RECOVERY_NATIVE_ROLE_CHANGED:
    'Recovery would change your native governance role. Connect a replacement native account or refresh DAO governance before retrying.',
  RECOVERY_WAIT: 'Recovery needs to wait 48 hours after the second contact approval.',
  RECOVERY_PENDING: 'Recovery is waiting for two contact approvals or its waiting period.',
  RECOVERY_DOCUMENT_POLICY: 'This DAO has not allowed recovery of these document keys.',
  RECOVERY_POLICY_CHANGED: 'The recovery contacts or account key changed. Reload the membership.',
  RECOVERY_CONTEXT: 'The recovery proof does not match this request.',
  RECOVERY_EXPIRY: 'This recovery request has expired or has too little time remaining.',
  RECOVERY_CONTACTS_PENDING: 'All three contacts must accept before recovery is ready.',
  RECOVERY_ALREADY_PENDING: 'A recovery request is already pending for this membership.',
  RECOVERY_SEQUENCE: 'The recovery request is out of date. Reload and prepare it again.',
  RECOVERY_GRANT_EXISTS: 'This document key has already been restored for this device.',
  RECOVERY_NATIVE_WALLET_REQUIRED: 'Connect the replacement native wallet to complete recovery.',
  CONTACT_RECOVERY_CHANGED: 'The recovered account changed. Reload before continuing.',
  CONTACT_RECOVERY_UNAVAILABLE: 'This deployment does not support trusted-contact recovery yet.',
  CONTACT_RECOVERY_IDENTITY_CONFLICT:
    'The old and replacement keys belong to different service profiles. Recovery cannot merge them.',

  APP_JOIN_DISABLED: 'This app has not enabled the requested DAO admission. Ask its administrator.',
  APP_JOIN_UNAVAILABLE: 'This deployment does not provide compatible app admission.',
  APP_JOIN_GATEWAY: 'Review the approved admission gateway account and permission.',
  APP_JOIN_PENDING: 'DAO admission is being reconciled. Retry with the same account.',
  APP_INVITE_UNKNOWN: 'This invitation is unavailable. Ask for a new link.',
  APP_INVITE_DOMAIN: 'This invitation does not match the app, revision or verified token.',
  APP_INVITE_USED: 'Another member already accepted this invitation.',
  APP_INVITE_REVOKED: 'The administrator revoked this invitation.',
  APP_INVITE_EXPIRED: 'The invitation has expired. Ask for a new link.',
  APP_INVITE_ISSUER: 'The inviting administrator is no longer eligible. Ask for a new invitation.',
  APP_INVITE_CONFLICT: 'The invitation role or owner changed. Create a new invitation.',
  APP_INVITE_CAPACITY:
    'This DAO has reached its retained invitation capacity. Remove expired records before issuing more.',
  APP_INVITE_ID: 'Choose a nonzero invitation identifier.',
  APP_INVITE_PROOF:
    'A signature from the private invitation link must authorize this exact recipient.',
  APP_INVITE_EXPIRY: 'An invitation must have a valid token hash and expire within seven days.',
  APP_INVITE_EXISTS:
    'This invitation already exists. Check its native state rather than issuing it again.',
  DAO_CLAIM_UNKNOWN: 'This claim link is unavailable. Ask its issuer for a new link.',
  DAO_CLAIM_EXECUTIVE_REQUIRED:
    'A current executive of the Daclify governing DAO must authorize this invitation.',
  DAO_CLAIM_RESERVED: 'This invitation is already reserved. Its claimant can resume creation.',
  DAO_CLAIM_REVOKED: 'The issuer revoked this invitation. Ask for a new link.',
  DAO_CLAIM_EXPIRED: 'This invitation has expired. Ask for a new link.',
  DAO_CLAIM_PENDING: 'Creation is being reconciled. Retry to check the same DAO.',
  DAO_CLAIM_LIMIT: 'Finish or revoke existing invitations before creating another.',
  CLAIM_PARTICIPANT_MODE: 'Claim links require a human or mixed community.',
  ACCOUNT_SIGN_IN_REQUIRED: 'Sign in again with a paired method to approve this operation.',

  DOCUMENT_REGISTERED: 'This document is already registered. Open its existing registration.',
  CONSTITUTION_REGISTERED:
    'This DAO already has a constitution. Publish an amendment to that document.',
  DOCUMENT_REGISTER_LIMIT: 'This DAO has reached its limit of 64 managed documents.',
  DOCUMENT_SETTINGS: 'Choose a supported document type and approval rule.',
  DOCUMENT_DOMAIN: 'This document proposal belongs to another DAO. Refresh Documents.',
  DOCUMENT_REGISTER_UNKNOWN: 'The managed document could not be found. Refresh Documents.',
  DOCUMENT_PROPOSAL_UNKNOWN: 'The document proposal could not be found. Refresh Documents.',
  DOCUMENT_PROPOSAL_PENDING:
    'Approve, cancel or clear the current proposal before proposing another version.',
  DOCUMENT_REVISION_CHANGED:
    'The adopted version changed. Refresh Documents before proposing or approving an amendment.',
  DOCUMENT_VERSION_NOT_NEWER: 'Choose a version newer than the adopted version.',
  DOCUMENT_APPROVAL_METHOD: 'Use the approval rule selected for this document.',
  DOCUMENT_PROPOSAL_CLOSED: 'This proposal has already been adopted or closed. Refresh Documents.',
  DOCUMENT_PROPOSAL_EXPIRED: 'This proposal expired. Clear it and propose the version again.',
  DOCUMENT_SOURCE_CHANGED:
    'The governing-document contract changed. Cancel this proposal and request fresh approval.',
  DOCUMENT_APPROVAL_READY:
    'Members approved this proposal. Adopt it before proposing another amendment.',
  DOCUMENT_ADOPTION_CHANGED:
    'A different version is now adopted. Open it before signing acceptance.',
  DOCUMENT_ALREADY_ACCEPTED: 'You already accepted this adopted version.',
  DOCUMENT_NOT_ADOPTED: 'Only an adopted document version can be accepted.',
  DOCUMENT_ACCEPTANCE_DISABLED: 'Member acceptance is not tracked for this document.',
  DOCUMENT_CLEANUP_BOUNDS: 'Clear between one and 25 rejected or expired proposals at a time.',
  MODULE_FEE_REQUIRED:
    'This module needs renewed access for a DAO above 10 active members. Ask a DAO administrator to open Module access. Existing work can still be completed.',
  MODULE_TERM_CHANGED:
    'A newer module payment has already been recorded. Refresh module access before retrying.',
  MODULE_FEE_REVISION:
    'The module price changed. Refresh the configured price before approving it.',
  NATIVE_EXECUTIVE_DELEGATION:
    'Choose an independent executive account. An account controlled by core cannot become its own governing executive.',
  NATIVE_CREATOR_DELEGATION:
    'The creator recovery account must have independent authority and cannot delegate back to core.',
  NAME_BASIC_FIRST_PARTY:
    'Ordinary 12-character names are sold by the name service. Sellers can list special names or names under their own suffix.',
  NAME_COST_LOW:
    'The payment does not cover actual account resources and the platform fee. No native purchase was completed.',
  NAME_CARD_ROUTING: 'Third-party names use TLOS until seller card payment routing is available.',
  NAME_SETTLEMENT_STAGE:
    'Account settlement could not be finalized. Please contact support with your receipt.',
  NAME_PRICE_FLOOR:
    'Suffix accounts must be priced at least as high as a normal basic account. Refresh the current minimum and update your price.',
  NAME_PROFIT_LOW:
    'The payment no longer covers current account costs. Account creation is on hold for payment review.',
  NAME_NET_REQUIRED: 'Payment fees must be verified before this account can be created.',
  NAME_FEE_PENDING:
    'Payment processing fees are still being confirmed. Please wait for account creation.',
  NAME_RECEIPT_INVALID:
    'The payment could not be verified. Contact support with your payment receipt.',
  NAME_PROFIT_POLICY: 'Account pricing is temporarily unavailable. Please try again later.',
  NAME_RAM_MARKET: 'Current account resource costs are unavailable. Please try again later.',
  NAME_RESOURCE_FLOAT: 'Account provisioning is temporarily unavailable. Please try again later.',
  NAME_PROFIT_PENDING: 'Another account creation is being finalized. Please try again.',
  NAME_FEE_REFERENCE: 'Card pricing is temporarily unavailable. Please try again later.',

  NATIVE_CONTEXT_REVIEW_REQUIRED:
    'Restore the code-only execution context and complete core member-action links before handover.',
  NATIVE_POLICY_MIGRATION_REQUIRED:
    'This deployment uses an unsupported native ownership policy. An explicit reviewed migration is required.',
  NATIVE_CREATOR:
    'Choose a separate existing creator recovery account outside the managed contract set.',
  NATIVE_INLINE_CODE: 'Inline code authority must name unique managed contract accounts.',
  NATIVE_EXECUTIVE_ACCOUNT:
    'An executive wallet cannot be the runtime or one of its managed contracts.',
  SERVICE_KEY_CREATOR: 'The hosting service key must not control creator recovery.',
  NATIVE_OWNERSHIP_RUNTIME_REQUIRED:
    'The deployed runtime does not match the reviewed ownership release. Upgrade and verify its code and ABI before preparing ownership changes.',
  NATIVE_AUTHORITY_REVIEW_REQUIRED:
    'Current authorities or permission links need operator review before handover.',
  NATIVE_HANDOVER_ACCOUNTS:
    'Read a complete fresh snapshot of the runtime and every managed contract account.',
  NATIVE_HANDOVER_STATE: 'Native ownership has already been handed over.',
  NATIVE_EXECUTIVE_QUORUM: 'Select one to eight distinct executive wallets and a reachable quorum.',
  NATIVE_OWNER_REQUIRED: 'A valid owner and active authority are required for every account.',
  NATIVE_OWNER_THRESHOLD_UNSUPPORTED:
    'The current owner threshold cannot be safely staged for handover.',
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
  POLICY_CHANGED: 'The governance policy changed. Members must approve a new proposal.',
  DAO_PAUSED:
    'The DAO guardian has paused commitments and payments. Check the pause expiry in Settings.',
  OBLIGATION_PROTECTED:
    'This obligation requires its agreed dispute or matching settlement process.',
  ARBITRATION_REQUIRED:
    'Set up protected terms and obtain contributor consent before funding this work.',
  ARBITRATION_CONSENT: 'The contributor must accept the exact protected terms before funding.',
  ARBITRATION_CHANGED:
    'The protected commitment changed. Refresh and review it before signing again.',
  ARBITRATION_CONFLICT:
    'Choose eligible, distinct decision makers who are not the contributor or reviewers.',
  ARBITRATION_RULES: 'Check the frozen voting rules and supported thresholds.',
  ARBITRATION_DURATION: 'Each dispute window must be between one minute and 30 days.',
  ARBITRATION_STATE:
    'This dispute has moved to another stage. Refresh before approving an outcome.',
  ARBITRATION_DEADLINE: 'The deadline has not arrived yet.',
  ARBITRATION_EVIDENCE_ACCESS: 'Grant access to the exact private evidence before this action.',
  ARBITRATION_VOTER:
    'You are excluded from this dispute vote or were not in its frozen electorate.',
  ARBITRATION_CONSENT_MISMATCH:
    'The other party selected a different settlement. Withdraw your own consent before changing it.',
  ARBITRATION_POLICY_IMMUTABLE:
    'Protection is already required for this Works source and cannot be disabled.',
  ARBITRATION_ELECTORATE_LIMIT:
    'This community exceeds the supported primary electorate scan. Its deadline and agreed backup remain available.',
  ARBITRATION_REVIEWER_LIMIT:
    'The agreement already has 16 distinct reviewers. An existing reviewer can continue, or the dispute process can resolve it.',
  ARBITRATION_UNKNOWN: 'This protected obligation could not be found. Refresh the DAO.',
  ARBITRATION_UNSETTLED: 'Evidence remains protected until this obligation is paid or cancelled.',
  PAYROLL_TERMS_CHANGED:
    'The selected payroll terms do not match their stored commitment. Review the exact version again.',
  PAYROLL_ALREADY_RENEWED: 'This schedule already has a funded successor.',
  PAYROLL_TERM_OVERLAP: 'Start the successor after the previous term ends.',
  PAYROLL_UNSETTLED: 'Payroll terms remain protected until all installments have been paid.',
  DOCUMENT_REVIEW_REQUIRED: 'Open and verify the supporting document version before voting.',
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
