import { generateKeyPair, SignJWT, createRemoteJWKSet, customFetch, exportJWK } from 'jose';
import { expect, it } from 'vitest';
import { verifyTelegramOidcToken } from '../services/api/src/auth/telegram-oidc.js';
const keys = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const timestamp = Math.floor(Date.now() / 1000);
const base = {
  iss: 'https://oauth.telegram.org',
  sub: '12345',
  aud: '54321',
  nonce: 'fixture-nonce',
  iat: timestamp,
  exp: timestamp + 300,
};
it('verifies immutable OIDC identity without merging it with a widget ID', async () => {
  const token = await new SignJWT(base).setProtectedHeader({ alg: 'RS256' }).sign(keys.privateKey);
  expect(
    await verifyTelegramOidcToken(token, '54321', 'fixture-nonce', keys.publicKey),
  ).toMatchObject({ provider: 'telegram', subject: 'oidc:12345' });
});
it('rejects wrong issuer, audience, nonce, freshness, authorized party and signing key', async () => {
  for (const changes of [
    { iss: 'https://other.test' },
    { aud: 'other' },
    { nonce: 'other' },
    { iat: timestamp + 120 },
    { exp: timestamp - 120 },
    { iat: timestamp - 1000 },
    { aud: ['54321', 'other'] },
    { azp: 'other' },
    { sub: 'unsafe\nsubject' },
  ]) {
    const token = await new SignJWT({ ...base, ...changes })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(keys.privateKey);
    await expect(
      verifyTelegramOidcToken(token, '54321', 'fixture-nonce', keys.publicKey),
    ).rejects.toMatchObject({ code: 'PROVIDER_INVALID' });
  }
  const wrongKey = await new SignJWT(base)
    .setProtectedHeader({ alg: 'RS256' })
    .sign(other.privateKey);
  await expect(
    verifyTelegramOidcToken(wrongKey, '54321', 'fixture-nonce', keys.publicKey),
  ).rejects.toMatchObject({ code: 'PROVIDER_INVALID' });
});

it('refreshes a JWKS for a rotated signing kid using actual jose key selection', async () => {
  const first = { ...(await exportJWK(keys.publicKey)), kid: 'first', alg: 'RS256', use: 'sig' };
  const second = { ...(await exportJWK(other.publicKey)), kid: 'second', alg: 'RS256', use: 'sig' };
  let published = [first];
  const remote = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'), {
    cooldownDuration: 0,
    [customFetch]: async () =>
      new Response(JSON.stringify({ keys: published }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });
  const oldToken = await new SignJWT(base)
    .setProtectedHeader({ alg: 'RS256', kid: 'first' })
    .sign(keys.privateKey);
  expect((await verifyTelegramOidcToken(oldToken, '54321', 'fixture-nonce', remote)).subject).toBe(
    'oidc:12345',
  );
  published = [second];
  const nextToken = await new SignJWT(base)
    .setProtectedHeader({ alg: 'RS256', kid: 'second' })
    .sign(other.privateKey);
  expect((await verifyTelegramOidcToken(nextToken, '54321', 'fixture-nonce', remote)).subject).toBe(
    'oidc:12345',
  );
  const forged = await new SignJWT(base)
    .setProtectedHeader({ alg: 'RS256', kid: 'second' })
    .sign(keys.privateKey);
  await expect(
    verifyTelegramOidcToken(forged, '54321', 'fixture-nonce', remote),
  ).rejects.toMatchObject({ code: 'PROVIDER_INVALID' });
});
