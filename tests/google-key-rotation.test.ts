import { afterEach, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { googleKeyResolver } from '../services/api/src/providers/proofs.js';
import { verifyGoogle } from '../services/api/src/providers/proofs.js';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('refreshes the official Google key set after rotation and still rejects a forged token', async () => {
  const first = await generateKeyPair('RS256'),
    second = await generateKeyPair('RS256');
  let published = [
    { ...(await exportJWK(first.publicKey)), kid: 'first', alg: 'RS256', use: 'sig' },
  ];
  const fetched: string[] = [];
  vi.stubGlobal('fetch', async (url: URL) => {
    fetched.push(String(url));
    return new Response(JSON.stringify({ keys: published }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' },
    });
  });
  const resolver = googleKeyResolver();
  const now = Date.now(),
    stamp = Math.floor(now / 1000);
  const claims = {
    iss: 'https://accounts.google.com',
    sub: '123456789',
    aud: 'client',
    nonce: 'nonce',
    iat: stamp,
    exp: stamp + 300,
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'first' })
    .sign(first.privateKey);
  expect((await verifyGoogle(token, 'client', 'nonce', resolver)).subject).toBe('123456789');
  published = [{ ...(await exportJWK(second.publicKey)), kid: 'second', alg: 'RS256', use: 'sig' }];
  vi.spyOn(Date, 'now').mockReturnValue(now + 31000);
  const rotated = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'second' })
    .sign(second.privateKey);
  expect((await verifyGoogle(rotated, 'client', 'nonce', resolver)).subject).toBe('123456789');
  const forged = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'second' })
    .sign(first.privateKey);
  await expect(verifyGoogle(forged, 'client', 'nonce', resolver)).rejects.toThrow(
    'PROVIDER_INVALID',
  );
  expect(fetched).toEqual([
    'https://www.googleapis.com/oauth2/v3/certs',
    'https://www.googleapis.com/oauth2/v3/certs',
  ]);
});
