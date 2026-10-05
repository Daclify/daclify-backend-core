import { z } from 'zod';
import { PublicKey } from '@wharfkit/antelope';
export const SigningPublicKeySchema = z
  .string()
  .max(128)
  .refine((value) => {
    try {
      return PublicKey.from(value).toString() === value;
    } catch {
      return false;
    }
  });
const Base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
  .max(140_000_000);
const Coordinate = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const EncryptionPublicKeySchema = z.strictObject({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: Coordinate,
  y: Coordinate,
});
export const EncryptionPrivateKeySchema = EncryptionPublicKeySchema.extend({ d: Coordinate });
export const VaultSecretsSchema = z.strictObject({
  signingKey: z.string().regex(/^PVT_K1_[1-9A-HJ-NP-Za-km-z]+$/),
  encryptionPrivateKey: EncryptionPrivateKeySchema,
});
export const VaultEnvelopeSchema = z.strictObject({
  version: z.literal(1),
  kdf: z.literal('PBKDF2-SHA256'),
  iterations: z.int().min(600_000).max(2_000_000),
  salt: Base64.max(24),
  iv: Base64.max(16),
  ciphertext: Base64.max(16384),
});
export const ContentEnvelopeSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('AES-256-GCM'),
  iv: Base64.max(16),
  ciphertext: Base64,
});
export const EpochGrantSchema = z.strictObject({
  version: z.literal(1),
  ephemeralKey: EncryptionPublicKeySchema,
  salt: Base64.max(44),
  envelope: ContentEnvelopeSchema,
});
export type EncryptionPublicKey = z.infer<typeof EncryptionPublicKeySchema>;
export type EncryptionPrivateKey = z.infer<typeof EncryptionPrivateKeySchema>;
export type VaultSecrets = z.infer<typeof VaultSecretsSchema>;
export type VaultEnvelope = z.infer<typeof VaultEnvelopeSchema>;
export type ContentEnvelope = z.infer<typeof ContentEnvelopeSchema>;
export type EpochGrant = z.infer<typeof EpochGrantSchema>;

export const RecoveryKitSchema = z.strictObject({
  version: z.literal(1),
  localEnvelope: VaultEnvelopeSchema,
  recoveryEnvelope: VaultEnvelopeSchema,
  signingPublicKey: SigningPublicKeySchema,
  encryptionPublicKey: EncryptionPublicKeySchema,
});
export type RecoveryKit = z.infer<typeof RecoveryKitSchema>;
