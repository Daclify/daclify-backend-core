import { z } from 'zod';
import { EncryptionPublicKeySchema, SigningPublicKeySchema } from './crypto.js';
import type { NativeIdentity } from './native-wallet.js';
import type { EvmIntentSchema } from './evm-wallet.js';
import {
  DaoRefSchema,
  PrivacySchema,
  CustodySchema,
  Uint64Schema,
  AssetRefSchema,
  ApiOriginSchema,
} from './base.js';
import {
  MetadataSchema,
  DaoSetupSchema,
  FoundingAgentSchema,
  DaoPurposeSchema,
  ParticipantModeSchema,
  DaoBrandingSchema,
} from './dao.js';
export { SigningPublicKeySchema } from './crypto.js';
export const VaultAccountSchema = z.strictObject({
  id: z.uuid(),
  signingKey: SigningPublicKeySchema,
  custody: CustodySchema,
  encryptionKey: EncryptionPublicKeySchema,
});
export const WalletAccountSchema = z.strictObject({
  id: z.uuid(),
  custody: z.literal('user-controlled'),
  signingKey: z.null(),
  encryptionKey: z.null(),
});
export const AccountSchema = z.union([VaultAccountSchema, WalletAccountSchema]);
export const JoinIdentitySchema = VaultAccountSchema.omit({ id: true }).extend({
  version: z.literal(1),
});
export const ChallengeRequestSchema = z.strictObject({ signingKey: SigningPublicKeySchema });
export const LoginMessageSchema = ChallengeRequestSchema.extend({
  domain: z.literal('daclify.login.v2'),
  origin: z.url(),
  audience: ApiOriginSchema,
  challenge: z.uuid(),
  expires: z.iso.datetime(),
});
export const ChallengeSchema = z.strictObject({
  id: z.uuid(),
  message: z.string().max(2048),
  expires: z.string().datetime(),
});
export const VaultAttachRequestSchema = JoinIdentitySchema.omit({ version: true, custody: true });
export const VaultAttachFinishSchema = z.strictObject({
  id: z.uuid(),
  signature: z.string().min(1).max(160),
});
export const VaultAttachMessageSchema = VaultAttachRequestSchema.extend({
  domain: z.literal('daclify.vault-attach.v2'),
  audience: ApiOriginSchema,
  origin: z.url(),
  accountId: z.uuid(),
  id: z.uuid(),
  expires: z.string().datetime(),
});
export const LoginRequestSchema = z.strictObject({
  challengeId: z.uuid(),
  signature: z.string().max(160),
  encryptionKey: EncryptionPublicKeySchema,
});
export const SessionSchema = z.strictObject({
  account: AccountSchema,
  csrfToken: z.string().min(32).max(128),
});
export const ProviderNameSchema = z.enum(['google', 'telegram']);
export const ProviderProofSchema = z.strictObject({
  provider: ProviderNameSchema,
  proof: z.string().min(1).max(16384),
  nonce: z.string().min(1).max(256).optional(),
});
export const ProviderLinkResultSchema = z.strictObject({
  provider: ProviderNameSchema,
  subject: z.string().min(1).max(255),
});
export const ProviderUnlinkSchema = z.strictObject({
  provider: ProviderNameSchema,
  subject: z.string().regex(/^[\x21-\x7e]{1,255}$/),
});
export const DaoSummarySchema = z.strictObject({
  reference: DaoRefSchema,
  title: z.string(),
  description: z.string(),
  privacy: PrivacySchema,
  owner: z.string(),
  token: AssetRefSchema,
  members: z.int().min(0),
  available: Uint64Schema,
  reserved: Uint64Schema,
  claims: Uint64Schema,
  keyEpoch: Uint64Schema,
  purpose: DaoPurposeSchema.optional(),
  participantMode: ParticipantModeSchema.optional(),
  setup: DaoSetupSchema.nullable().optional(),
  branding: DaoBrandingSchema.optional(),
});
export const CreateDaoSchema = z
  .strictObject({
    metadata: MetadataSchema,
    privacy: PrivacySchema,
    token: AssetRefSchema,
    setup: DaoSetupSchema.optional(),
    foundingAgent: FoundingAgentSchema.optional(),
  })
  .refine(
    (value) =>
      (value.setup?.participantMode === 'agents-guarded') === (value.foundingAgent !== undefined),
    'Agent-only creation requires an agent public identity; other modes enrol the creator',
  )
  .refine(
    (value) =>
      value.metadata.schemaVersion !== 2 ||
      (value.setup !== undefined &&
        JSON.stringify(value.metadata.setup) === JSON.stringify(value.setup)),
    'Metadata and requested setup must match',
  );
export const NetworkSchema = z.strictObject({
  chainId: z.string().regex(/^[0-9a-f]{64}$/),
  rpcUrl: z.url(),
  runtime: z.string(),
  hub: z.string().nullable(),
  environment: z.enum(['local', 'testnet', 'mainnet']),
  interfaceVersion: z.literal(1),
  coreVersion: z.string(),
  capabilities: z.array(z.string()),
});
export const UserMembershipSchema = z.strictObject({
  dao: DaoRefSchema,
  memberId: Uint64Schema,
  nonce: Uint64Schema,
  active: z.boolean(),
  admin: z.boolean(),
  reviewer: z.boolean(),
  credits: Uint64Schema,
  claim: Uint64Schema,
  stake: Uint64Schema,
  nativeAccount: z.string(),
  custody: CustodySchema,
  signingKey: SigningPublicKeySchema.optional(),
});
export type Account = z.infer<typeof AccountSchema>;
export type VaultAccount = z.infer<typeof VaultAccountSchema>;
export type WalletIdentity =
  | ({ kind: 'native' } & Omit<NativeIdentity, 'permission'>)
  | ({ kind: 'evm' } & Pick<z.infer<typeof EvmIntentSchema>, 'chainId' | 'address'>);
export type Session = z.infer<typeof SessionSchema>;
export type DaoSummary = z.infer<typeof DaoSummarySchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type UserMembership = z.infer<typeof UserMembershipSchema>;
