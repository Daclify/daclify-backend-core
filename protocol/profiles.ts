import { z } from 'zod';
import { ChainIdSchema, IdSchema, NativeAccountSchema } from './base.js';
import { PublicProfileSchema } from './people.js';
import { EncryptionPublicKeySchema, EpochGrantSchema } from './crypto.js';
export const MAX_PROFILE_PLAINTEXT_BYTES = 4096;
export const MAX_PROFILE_ENVELOPE_BYTES = 8192;
const canonicalBase64 = (minimum: number, maximum: number) =>
  z
    .string()
    .max(Math.ceil(maximum / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
    .refine((value) => {
      try {
        const decoded = atob(value);
        return decoded.length >= minimum && decoded.length <= maximum && btoa(decoded) === value;
      } catch {
        return false;
      }
    });
export const ProfileContextSchema = z.strictObject({
  version: z.literal(2),
  chainId: ChainIdSchema,
  runtime: NativeAccountSchema,
  daoId: IdSchema,
  memberId: IdSchema,
  profileRevision: z
    .uuid()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
});
export const EncryptedProfileSchema = z.strictObject({
  version: z.literal(2),
  context: ProfileContextSchema,
  algorithm: z.literal('AES-256-GCM'),
  iv: canonicalBase64(12, 12),
  ciphertext: canonicalBase64(17, MAX_PROFILE_PLAINTEXT_BYTES + 16),
});
export const ProfilePayloadSchema = z.union([EncryptedProfileSchema, PublicProfileSchema]);
export const StoredProfileJsonSchema = z.string().refine((value) => {
  if (value.length > MAX_PROFILE_ENVELOPE_BYTES) return false;
  if (new TextEncoder().encode(value).length > MAX_PROFILE_ENVELOPE_BYTES) return false;
  try {
    return ProfilePayloadSchema.safeParse(JSON.parse(value)).success;
  } catch {
    return false;
  }
});
export const DecodedProfileSchema = z.union([
  EncryptedProfileSchema,
  z.strictObject({ version: z.literal(1), profile: PublicProfileSchema }),
]);
export type ProfileContext = z.infer<typeof ProfileContextSchema>;
export type EncryptedProfile = z.infer<typeof EncryptedProfileSchema>;
export type DecodedProfile = z.infer<typeof DecodedProfileSchema>;
export function profileCipherDomain(input: ProfileContext): string {
  return JSON.stringify({
    domain: 'daclify.profile.v2',
    context: ProfileContextSchema.parse(input),
  });
}
export const ProfileKeyGrantSchema = z.strictObject({
  version: z.literal(1),
  context: ProfileContextSchema,
  recipientEncryptionKey: EncryptionPublicKeySchema,
  ciphertextCommitment: ChainIdSchema,
  grant: EpochGrantSchema.extend({
    salt: canonicalBase64(32, 32),
    envelope: EpochGrantSchema.shape.envelope.extend({
      iv: canonicalBase64(12, 12),
      ciphertext: canonicalBase64(48, 48),
    }),
  }),
});
export type ProfileKeyGrant = z.infer<typeof ProfileKeyGrantSchema>;
export const ProfileShareSchema = z
  .strictObject({
    context: ProfileContextSchema,
    grants: z.array(ProfileKeyGrantSchema).min(1).max(64),
  })
  .superRefine((value, ctx) => {
    const audience = new Set<string>();
    const commitment = value.grants[0]?.ciphertextCommitment;
    for (const grant of value.grants) {
      const recipient = JSON.stringify(grant.recipientEncryptionKey);
      if (
        audience.has(recipient) ||
        profileCipherDomain(grant.context) !== profileCipherDomain(value.context) ||
        grant.ciphertextCommitment !== commitment
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Profile grants must have one context, one cipher and distinct recipients.',
        });
      audience.add(recipient);
    }
  });
export const ProfileRemoveSchema = z.strictObject({
  context: ProfileContextSchema,
  ciphertextCommitment: ChainIdSchema,
});
export const KeyDeletionStatusSchema = z.strictObject({
  state: z.enum(['removed', 'backup-expiry-pending', 'unavailable']),
  backupExpiresAt: z.iso.datetime().nullable(),
});
export type KeyDeletionStatus = z.infer<typeof KeyDeletionStatusSchema>;
export const ProfileKeyStatusSchema = z.strictObject({
  state: z.enum(['staged', 'active']),
  expiresAt: z.iso.datetime().nullable(),
});
export const ProfileRecipientSchema = z.strictObject({
  memberId: IdSchema,
  encryptionKey: EncryptionPublicKeySchema,
});
export type ProfileRecipient = z.infer<typeof ProfileRecipientSchema>;
export const ProfileRecipientPageSchema = z.strictObject({
  recipients: z.array(ProfileRecipientSchema).max(50),
  next: IdSchema.nullable(),
});
export type ProfileRecipientPage = z.infer<typeof ProfileRecipientPageSchema>;
export function profileKeyGrantDomain(
  input: Pick<ProfileKeyGrant, 'context' | 'recipientEncryptionKey' | 'ciphertextCommitment'>,
): string {
  return JSON.stringify({
    domain: 'daclify.profile.key.v1',
    context: ProfileContextSchema.parse(input.context),
    recipientEncryptionKey: EncryptionPublicKeySchema.parse(input.recipientEncryptionKey),
    ciphertextCommitment: ChainIdSchema.parse(input.ciphertextCommitment),
  });
}
export const ProfileRoutes = {
  profileRecipients: {
    method: 'GET',
    path: '/v1/profiles/:daoId/recipients',
    params: z.strictObject({ daoId: IdSchema }),
    query: z.strictObject({ after: IdSchema.optional() }),
    response: ProfileRecipientPageSchema,
    helpTopic: 'accounts',
  },
  profileKeysShare: {
    method: 'POST',
    path: '/v1/profiles/keys/share',
    input: ProfileShareSchema,
    response: ProfileKeyStatusSchema,
    helpTopic: 'accounts',
  },
  profileKeysRemove: {
    method: 'POST',
    path: '/v1/profiles/keys/remove',
    input: ProfileRemoveSchema,
    response: KeyDeletionStatusSchema,
    helpTopic: 'accounts',
  },
  profileKeysGet: {
    method: 'GET',
    path: '/v1/profiles/:daoId/:memberId/keys/:profileRevision',
    params: ProfileContextSchema.pick({ daoId: true, memberId: true, profileRevision: true }),
    response: ProfileKeyGrantSchema,
    helpTopic: 'accounts',
  },
} as const;
