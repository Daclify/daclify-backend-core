import { describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { ProfileContextSchema, EncryptedProfileSchema } from '../protocol/profiles.js';
import { encryptProfile, decryptProfile, decodeRawNativeProfile } from '../sdk/profiles.js';
const context = ProfileContextSchema.parse({
  version: 2,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '18446744073709551615',
  memberId: '1',
  profileRevision: randomUUID(),
});
const key = Uint8Array.from(randomBytes(32)),
  plaintext = new TextEncoder().encode('{"email":"synthetic@example.test"}');
describe('independent profile encryption', () => {
  it('round trips with a fresh IV and leaks no personal plaintext into the stored value', async () => {
    const first = await encryptProfile(plaintext, key, context),
      second = await encryptProfile(plaintext, key, context);
    expect(first.iv).not.toBe(second.iv);
    expect(JSON.stringify(first)).not.toContain('synthetic@example.test');
    expect(await decryptProfile(first, key, context)).toEqual(plaintext);
    expect(decodeRawNativeProfile({ profile: JSON.stringify(first) })).toEqual(first);
  });
  it('authenticates the full deployment/member/revision and refuses the wrong key', async () => {
    const encrypted = await encryptProfile(plaintext, key, context);
    for (const other of [
      { ...context, chainId: '12'.repeat(32) },
      { ...context, runtime: 'otherdao' },
      { ...context, daoId: '2' },
      { ...context, memberId: '2' },
      { ...context, profileRevision: randomUUID() },
    ]) {
      await expect(decryptProfile(encrypted, key, other)).rejects.toThrow('PROFILE_CONTEXT');
      await expect(decryptProfile({ ...encrypted, context: other }, key, other)).rejects.toThrow(
        'PROFILE_DECRYPTION',
      );
    }
    await expect(
      decryptProfile(encrypted, Uint8Array.from(randomBytes(32)), context),
    ).rejects.toThrow('PROFILE_DECRYPTION');
  });
  it('rejects corruption/truncation and noncanonical base64 including pad bits', async () => {
    const encrypted = await encryptProfile(plaintext, key, context),
      bytes = Buffer.from(encrypted.ciphertext, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await expect(
      decryptProfile({ ...encrypted, ciphertext: bytes.toString('base64') }, key, context),
    ).rejects.toThrow('PROFILE_DECRYPTION');
    await expect(
      decryptProfile(
        {
          ...encrypted,
          ciphertext: Buffer.from(encrypted.ciphertext, 'base64')
            .subarray(0, -1)
            .toString('base64'),
        },
        key,
        context,
      ),
    ).rejects.toThrow('PROFILE_DECRYPTION');
    expect(
      EncryptedProfileSchema.safeParse({ ...encrypted, iv: 'AAAAAAAAAAAAAABB==' }).success,
    ).toBe(false);
    expect(EncryptedProfileSchema.safeParse({ ...encrypted, ciphertext: 'AB==' }).success).toBe(
      false,
    );
  });
  it('enforces exact byte and key bounds', async () => {
    const bytes = new Uint8Array(4096).fill(65),
      encrypted = await encryptProfile(bytes, key, context);
    expect(encrypted.ciphertext).toHaveLength(5484);
    expect(await decryptProfile(encrypted, key, context)).toEqual(bytes);
    await expect(encryptProfile(new Uint8Array(4097), key, context)).rejects.toThrow(
      'PROFILE_SIZE',
    );
    await expect(encryptProfile(plaintext, new Uint8Array(31), context)).rejects.toThrow(
      'PROFILE_KEY',
    );
    await expect(decryptProfile(encrypted, new Uint8Array(33), context)).rejects.toThrow(
      'PROFILE_KEY',
    );
  });
  it('distinguishes legacy public profiles and rejects a malformed format 2 without fallback', () => {
    expect(
      decodeRawNativeProfile({ profile: '{"name":"alice","email":"legacy@example.test"}' }),
    ).toEqual({ version: 1, profile: { name: 'alice', email: 'legacy@example.test' } });
    expect(() => decodeRawNativeProfile({ profile: '{"version":2,"name":"alice"}' })).toThrow(
      'PROFILE_FORMAT',
    );
  });
});
