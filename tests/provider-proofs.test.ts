import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createHash, createHmac } from 'node:crypto';
import { verifyGoogle, verifyTelegram } from '../services/api/src/providers/proofs.js';
const now = Math.floor(Date.now() / 1000);
const bot = '12345:local-fixture-token';
let privateKey: CryptoKey;
let publicKey: CryptoKey;
beforeAll(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  publicKey = keys.publicKey;
});
async function google(overrides: Record<string, unknown> = {}, key = privateKey) {
  return new SignJWT({
    iss: 'https://accounts.google.com',
    sub: '123456789',
    aud: 'client',
    nonce: 'one-time-nonce',
    iat: now,
    exp: now + 300,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(key);
}
function telegram(fields: Record<string, string> = {}) {
  const pairs = {
    auth_date: String(now),
    user: JSON.stringify({ id: 123456789, first_name: 'Fixture' }),
    query_id: 'fixture',
    ...fields,
  };
  const check = Object.entries(pairs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(bot).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...pairs, hash }).toString();
}
describe('Google cryptographic boundaries', () => {
  it('uses the stable subject instead of email', async () => {
    const principal = await verifyGoogle(
      await google({ email: 'mutable@example.test' }),
      'client',
      'one-time-nonce',
      publicKey,
    );
    expect(principal.subject).toBe('123456789');
  });
  it.each([
    { iss: 'https://evil.example' },
    { aud: 'another-client' },
    { nonce: 'another-nonce' },
    { exp: now - 300 },
    { iat: now + 1000 },
    { azp: 'another-client' },
    { sub: '' },
  ])('rejects claim confusion %j', async (claims) => {
    await expect(
      verifyGoogle(await google(claims), 'client', 'one-time-nonce', publicKey),
    ).rejects.toThrow('PROVIDER_INVALID');
  });
  it('rejects a signature by another issuer key', async () => {
    const other = await generateKeyPair('RS256');
    await expect(
      verifyGoogle(await google({}, other.privateKey), 'client', 'one-time-nonce', publicKey),
    ).rejects.toThrow('PROVIDER_INVALID');
  });
});
describe('Telegram initialization proof', () => {
  it('validates actual HMAC data with additional signed fields', () => {
    expect(
      verifyTelegram(telegram({ signature: 'additional-signed-field' }), bot, now).subject,
    ).toBe('123456789');
  });
  it('rejects a changed user', () => {
    const data = new URLSearchParams(telegram());
    data.set('user', JSON.stringify({ id: 987, first_name: 'Attacker' }));
    expect(() => verifyTelegram(data.toString(), bot, now)).toThrow('PROVIDER_INVALID');
  });
  it('rejects stale data', () => {
    expect(() => verifyTelegram(telegram({ auth_date: String(now - 301) }), bot, now)).toThrow(
      'PROVIDER_INVALID',
    );
  });
  it('rejects future data', () => {
    expect(() => verifyTelegram(telegram({ auth_date: String(now + 1000) }), bot, now)).toThrow(
      'PROVIDER_INVALID',
    );
  });
  it('rejects duplicate parameters', () => {
    expect(() => verifyTelegram(`${telegram()}&user=%7B%22id%22%3A987%7D`, bot, now)).toThrow(
      'PROVIDER_INVALID',
    );
  });
  it('rejects a different bot', () => {
    expect(() => verifyTelegram(telegram(), '6789:other-fixture-token', now)).toThrow(
      'PROVIDER_INVALID',
    );
  });
  it('accepts a website login widget proof and keeps the numeric id as the subject', () => {
    const pairs = {
      auth_date: String(now),
      first_name: 'Fixture',
      id: '123456789',
      username: 'fixture_user',
    };
    const check = Object.entries(pairs)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secret = createHash('sha256').update(bot).digest();
    const hash = createHmac('sha256', secret).update(check).digest('hex');
    const proof = new URLSearchParams({ ...pairs, hash }).toString();
    expect(verifyTelegram(proof, bot, now).subject).toBe('123456789');
    const webAppSecret = createHmac('sha256', 'WebAppData').update(bot).digest();
    const wrong = createHmac('sha256', webAppSecret).update(check).digest('hex');
    expect(() =>
      verifyTelegram(new URLSearchParams({ ...pairs, hash: wrong }).toString(), bot, now),
    ).toThrow('PROVIDER_INVALID');
  });
  it('normalizes reordered proof identity for replay protection', () => {
    const original = telegram();
    const reversed = Array.from(new URLSearchParams(original)).reverse();
    expect(verifyTelegram(new URLSearchParams(reversed).toString(), bot, now).proofHash).toEqual(
      verifyTelegram(original, bot, now).proofHash,
    );
  });
});
