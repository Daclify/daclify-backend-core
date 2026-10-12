import { z } from 'zod';
import {
  EncryptedProfileSchema,
  ProfileContextSchema,
  StoredProfileJsonSchema,
  DecodedProfileSchema,
  MAX_PROFILE_PLAINTEXT_BYTES,
  profileCipherDomain,
  type ProfileContext,
  type EncryptedProfile,
  type DecodedProfile,
  ProfileKeyGrantSchema,
  profileKeyGrantDomain,
  type ProfileKeyGrant,
} from '../protocol/profiles.js';
import {
  EncryptionPrivateKeySchema,
  type EncryptionPublicKey,
  type EncryptionPrivateKey,
} from '../protocol/crypto.js';
import { sealRecoveryDelivery, openRecoveryDelivery } from './recovery.js';
function bytes(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}
function encoded(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}
function decoded(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
function checkKey(key: Uint8Array) {
  if (key.length !== 32) throw new Error('PROFILE_KEY');
}
export async function encryptProfile(
  plaintext: Uint8Array,
  key: Uint8Array,
  input: ProfileContext,
): Promise<EncryptedProfile> {
  checkKey(key);
  if (!plaintext.length || plaintext.length > MAX_PROFILE_PLAINTEXT_BYTES)
    throw new Error('PROFILE_SIZE');
  const context = ProfileContextSchema.parse(input),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const secret = await crypto.subtle.importKey('raw', bytes(key), 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: bytes(iv),
      additionalData: new TextEncoder().encode(profileCipherDomain(context)),
    },
    secret,
    bytes(plaintext),
  );
  return EncryptedProfileSchema.parse({
    version: 2,
    context,
    algorithm: 'AES-256-GCM',
    iv: encoded(iv),
    ciphertext: encoded(new Uint8Array(ciphertext)),
  });
}
export async function decryptProfile(
  input: EncryptedProfile,
  key: Uint8Array,
  expected: ProfileContext,
): Promise<Uint8Array> {
  checkKey(key);
  const parsed = EncryptedProfileSchema.safeParse(input);
  if (!parsed.success) throw new Error('PROFILE_FORMAT');
  const value = parsed.data,
    domain = profileCipherDomain(expected);
  if (domain !== profileCipherDomain(value.context)) throw new Error('PROFILE_CONTEXT');
  try {
    const secret = await crypto.subtle.importKey('raw', bytes(key), 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: bytes(decoded(value.iv)),
          additionalData: new TextEncoder().encode(domain),
        },
        secret,
        bytes(decoded(value.ciphertext)),
      ),
    );
  } catch {
    throw new Error('PROFILE_DECRYPTION');
  }
}
export function decodeRawNativeProfile(input: unknown): DecodedProfile {
  try {
    const { profile } = z.object({ profile: StoredProfileJsonSchema }).parse(input),
      payload: unknown = JSON.parse(profile);
    const encrypted = EncryptedProfileSchema.safeParse(payload);
    return DecodedProfileSchema.parse(
      encrypted.success ? encrypted.data : { version: 1, profile: payload },
    );
  } catch {
    throw new Error('PROFILE_FORMAT');
  }
}
export async function profileCiphertextCommitment(input: EncryptedProfile): Promise<string> {
  const source = new TextEncoder().encode(JSON.stringify(EncryptedProfileSchema.parse(input)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(source)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function sealProfileKey(
  key: Uint8Array,
  recipient: EncryptionPublicKey,
  context: ProfileContext,
  ciphertextCommitment: string,
): Promise<ProfileKeyGrant> {
  checkKey(key);
  const binding = { context, recipientEncryptionKey: recipient, ciphertextCommitment };
  const domain = profileKeyGrantDomain(binding);
  return ProfileKeyGrantSchema.parse({
    version: 1,
    ...binding,
    grant: await sealRecoveryDelivery(key, recipient, domain),
  });
}
export async function openProfileKey(
  input: ProfileKeyGrant,
  recipient: EncryptionPrivateKey,
  expectedContext: ProfileContext,
  expectedCommitment: string,
): Promise<Uint8Array> {
  const grant = ProfileKeyGrantSchema.parse(input);
  const own = EncryptionPrivateKeySchema.parse(recipient);
  const expected = profileKeyGrantDomain({
    context: expectedContext,
    recipientEncryptionKey: { kty: own.kty, crv: own.crv, x: own.x, y: own.y },
    ciphertextCommitment: expectedCommitment,
  });
  if (expected !== profileKeyGrantDomain(grant)) throw new Error('PROFILE_KEY_CONTEXT');
  try {
    return await openRecoveryDelivery(grant.grant, own, expected);
  } catch {
    throw new Error('PROFILE_KEY_DECRYPTION');
  }
}
