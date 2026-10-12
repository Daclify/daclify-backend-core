import { z } from 'zod';
import { ChainIdSchema, IdSchema, NativeAccountSchema } from './base.js';
import { PublicProfileSchema } from './people.js';
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
