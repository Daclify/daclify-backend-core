import { describe, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { SignupRoutes, SignupMessageSchema } from '../protocol/signup.js';
import { RecoveryRoutes } from '../protocol/recovery.js';

const id = '00000000-0000-4000-8000-000000000001';
const signingKey = PrivateKey.generate('K1').toPublic().toString();
const encryptionKey = { kty: 'EC', crv: 'P-256', x: 'A'.repeat(43), y: 'B'.repeat(43) };

describe('explicit quick signup boundaries', () => {
  it('requires affirmative assisted consent and rejects secret-bearing fields', () => {
    const input = { id, signingKey, encryptionKey, assistedConsent: true };
    expect(SignupRoutes.signupPrepare.input.safeParse(input).success).toBe(true);
    for (const extra of [
      { assistedConsent: false },
      { password: 'a private password' },
      { signingKey: 'invalid' },
    ]) {
      expect(SignupRoutes.signupPrepare.input.safeParse({ ...input, ...extra }).success).toBe(
        false,
      );
    }
  });
  it('does not accept a key-login message as signup authority', () => {
    expect(
      SignupMessageSchema.safeParse({
        domain: 'daclify.login.v3',
        origin: 'http://localhost:5178',
        audience: 'http://localhost:3000',
        id,
        accountId: id,
        signingKey,
        encryptionKey,
        expires: '2026-10-11T12:00:00.000Z',
        assistedConsent: true,
      }).success,
    ).toBe(false);
  });
  it('rejects oversized signup ciphertext before recovery work', () => {
    expect(
      SignupRoutes.signupFinish.input.safeParse({
        id,
        envelope: {
          version: 1,
          algorithm: 'AES-256-GCM',
          iv: btoa('a'.repeat(12)),
          ciphertext: btoa('a'.repeat(20000)),
        },
        keyGrant: {},
      }).success,
    ).toBe(false);
  });
  it('does not treat a bare checkbox as an independent opt-out fallback', () => {
    expect(RecoveryRoutes.recoveryOptOut.input.safeParse({ keepKitFallback: true }).success).toBe(
      false,
    );
    expect(RecoveryRoutes.recoveryOptOut.input.safeParse({}).success).toBe(true);
  });
});
