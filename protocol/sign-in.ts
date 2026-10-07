import { z } from 'zod';
import { SigningPublicKeySchema } from './crypto.js';
import { TelosEvmChainSchema, EvmAddressSchema, EvmSignatureSchema, Uint64Schema } from './base.js';
export const SignInProofSchema = z.strictObject({ proof: z.string().min(1).max(16384) });
export const SignInEmailSchema = z.strictObject({ email: z.string().min(3).max(254) });
export const SignInEmailCodeSchema = SignInEmailSchema.extend({
  code: z.string().regex(/^\d{8}$/),
});
const EncodedSchema = z.string().regex(/^[A-Za-z0-9_-]{1,16384}$/);
export const SignInPasskeyRegisterSchema = z.strictObject({
  clientDataJSON: EncodedSchema,
  attestationObject: EncodedSchema,
});
export const SignInPasskeyLoginSchema = z.strictObject({
  credentialId: z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/),
  clientDataJSON: EncodedSchema,
  authenticatorData: EncodedSchema,
  signature: EncodedSchema,
});
export const SignInRemoveSchema = z.strictObject({
  method: z.enum(['telegram', 'email', 'passkey']),
  subject: z.string().min(1).max(2048),
});
export const TelegramStartSchema = z.strictObject({ returnTo: z.string().max(2048).optional() });
export const NativeProofSchema = z.strictObject({
  packedTransaction: z.string().regex(/^(?:[0-9a-f]{2}){1,4096}$/),
  signatures: z.array(z.string().min(1).max(160)).min(1).max(8),
});
export const AccountControlProofSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('root'), signature: z.string().min(1).max(160) }),
  z.strictObject({
    kind: z.literal('native'),
    chainId: z.string().regex(/^[0-9a-f]{64}$/),
    account: z.string().min(1).max(13),
    proof: NativeProofSchema,
  }),
  z.strictObject({
    kind: z.literal('evm'),
    chainId: TelosEvmChainSchema,
    address: EvmAddressSchema,
    signature: EvmSignatureSchema,
  }),
]);
export type AccountControlProof = z.infer<typeof AccountControlProofSchema>;

export const AccountControlPaths = Object.freeze([
  '/v1/account/vault',
  '/v1/auth/providers/link',
  '/v1/auth/providers/unlink',
  '/v1/sign-in/email/confirm',
  '/v1/sign-in/telegram',
  '/v1/sign-in/telegram/oidc/pair/confirm',
  '/v1/sign-in/passkey/register',
  '/v1/sign-in/remove',
  '/v1/account/evm/link',
  '/v1/account/evm/unlink',
  '/v1/account/native/link',
  '/v1/account/native/unlink',
  '/v1/account/evm/sign-in/link',
] as const);
export const AccountControlPathSchema = z.enum(AccountControlPaths);
export const AccountControlRequestSchema = z.strictObject({
  path: AccountControlPathSchema,
  bodyHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export const AccountControlMessageSchema = AccountControlRequestSchema.extend({
  domain: z.literal('daclify.account-control.v1'),
  origin: z.url(),
  accountId: z.uuid(),
  signingKey: SigningPublicKeySchema.nullable(),
  challengeId: z.uuid(),
  expires: z.string().datetime(),
});
export const AccountControlChallengeSchema = z.strictObject({
  id: z.uuid(),
  message: z.string().max(2048),
  expires: z.string().datetime(),
});
export type AccountControlChallenge = z.infer<typeof AccountControlChallengeSchema>;
export const CredentialHistorySchema = z.strictObject({
  entries: z.array(
    z.strictObject({
      id: Uint64Schema,
      action: z.enum(['linked', 'unlinked', 'updated']),
      method: z.enum(['email', 'telegram', 'google', 'passkey', 'native', 'evm']),
      subject: z.string().min(1).max(2048),
      chainId: z.string().nullable(),
      at: z.string().datetime(),
    }),
  ),
  next: Uint64Schema.nullable(),
});
export const TelegramAuthorizationSchema = z.strictObject({ authorizationUrl: z.url() });
export const TelegramPendingPairSchema = z.strictObject({
  id: z.uuid(),
  subject: z.string().nullable(),
  expires: z.string().datetime(),
});

export const CredentialHistoryQuerySchema = z.strictObject({
  before: Uint64Schema.refine((value) => BigInt(value) < 1n << 63n).optional(),
});
export const TelegramPairConfirmSchema = z.strictObject({ id: z.uuid() });
