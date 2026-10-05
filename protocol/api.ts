import { z } from 'zod';
import { EncryptionPublicKeySchema, SigningPublicKeySchema } from './crypto.js';
import {
  DaoRefSchema,
  MetadataSchema,
  PrivacySchema,
  CustodySchema,
  Uint64Schema,
  AssetRefSchema,
} from './base.js';
export { SigningPublicKeySchema } from './crypto.js';
export const AccountSchema = z.strictObject({
  id: z.uuid(),
  signingKey: SigningPublicKeySchema,
  custody: CustodySchema,
  encryptionKey: EncryptionPublicKeySchema,
});
export const ChallengeRequestSchema = z.strictObject({ signingKey: SigningPublicKeySchema });
export const ChallengeSchema = z.strictObject({
  id: z.uuid(),
  message: z.string().max(2048),
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
});
export const CreateDaoSchema = z.strictObject({
  metadata: MetadataSchema,
  privacy: PrivacySchema,
  token: AssetRefSchema,
});
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
});
export type Account = z.infer<typeof AccountSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type DaoSummary = z.infer<typeof DaoSummarySchema>;
export type Network = z.infer<typeof NetworkSchema>;
export type UserMembership = z.infer<typeof UserMembershipSchema>;
