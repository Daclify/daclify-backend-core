import { expect, it, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { ConnectedAppClient } from '../sdk/connected-apps.js';
const clientId = '550e8400-e29b-41d4-a716-446655440000',
  issuer = 'https://api.example',
  callback = 'https://garden.example/callback';
const claims = {
  sub: '550e8400-e29b-41d4-a716-446655440001',
  dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  memberId: '3',
  admin: false,
  reviewer: false,
  nonce: '0',
  appId: '1',
  appRevision: '1',
  sessionId: null,
  sessionExpires: null,
};
it('creates S256 login and app-only native authority without persistent private storage', () => {
  const client = new ConnectedAppClient({ issuer, clientId, redirectUri: callback }),
    url = new URL(client.beginLogin({ recording: true, grantSeconds: 600 }));
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('scope')).toBe('openid membership');
  expect(url.searchParams.get('signing_key')).toMatch(/^PUB_K1_/);
  expect(url.searchParams.get('grant_seconds')).toBe('600');
  client.clear();
  expect(() => client.signingPublicKey()).toThrow('APP_KEY_MISSING');
});
it('rejects callback, issuer and state alteration before token redemption', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const client = new ConnectedAppClient({
      issuer,
      clientId,
      redirectUri: callback,
      fetch: fetcher,
    }),
    login = new URL(client.beginLogin());
  const state = login.searchParams.get('state');
  for (const url of [
    `https://evil.example/callback?code=x&state=${state}&iss=${issuer}`,
    `${callback}?code=x&state=changed&iss=${issuer}`,
    `${callback}?code=x&state=${state}&iss=https://evil.example`,
  ])
    await expect(client.finishLogin(url)).rejects.toThrow('APP_CALLBACK');
  expect(fetcher).not.toHaveBeenCalled();
});
it('verifies real ES256 issuer/audience/nonce and refreshes live membership', async () => {
  const keys = await generateKeyPair('ES256'),
    publicKey = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'fixture-key',
      alg: 'ES256',
      use: 'sig',
    };
  let nonce = '',
    audience = clientId,
    current = claims;
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith('/jwks')) return Response.json({ keys: [publicKey] });
    if (url.endsWith('/userinfo')) return Response.json(current);
    const id = await new SignJWT({ nonce, daclify: claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'fixture-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(keys.privateKey);
    return Response.json({
      access_token: 'a'.repeat(43),
      token_type: 'Bearer',
      expires_in: 300,
      id_token: id,
      scope: 'openid membership',
    });
  });
  const client = new ConnectedAppClient({
      issuer,
      clientId,
      redirectUri: callback,
      fetch: fetcher,
    }),
    login = new URL(client.beginLogin());
  nonce = login.searchParams.get('nonce') ?? '';
  const result = await client.finishLogin(
    `${callback}?code=${'b'.repeat(43)}&state=${login.searchParams.get('state')}&iss=${issuer}`,
  );
  expect(result.memberId).toBe('3');
  current = { ...claims, nonce: '2' };
  expect((await client.membership()).nonce).toBe('2');
  current = { ...claims, memberId: '4' };
  await expect(client.membership()).rejects.toThrow('APP_IDENTITY_CHANGED');
  const wrong = new ConnectedAppClient({ issuer, clientId, redirectUri: callback, fetch: fetcher }),
    second = new URL(wrong.beginLogin());
  nonce = second.searchParams.get('nonce') ?? '';
  audience = 'another-app';
  await expect(
    wrong.finishLogin(
      `${callback}?code=${'b'.repeat(43)}&state=${second.searchParams.get('state')}&iss=${issuer}`,
    ),
  ).rejects.toThrow('APP_ID_TOKEN');
});
it('coalesces access refresh and discards late refresh after logout', async () => {
  const keys = await generateKeyPair('ES256'),
    publicKey = {
      ...(await exportJWK(keys.publicKey)),
      kid: 'fixture-key',
      alg: 'ES256',
      use: 'sig',
    };
  let nonce = '',
    refreshes = 0,
    release: (() => void) | undefined;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/jwks')) return Response.json({ keys: [publicKey] });
    if (url.endsWith('/userinfo')) return Response.json(claims);
    if (url.endsWith('/logout')) return Response.json({ revoked: true });
    if (String(init?.body).includes('grant_type=refresh_token')) {
      refreshes++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    const token = await new SignJWT({ nonce, daclify: claims })
      .setProtectedHeader({ alg: 'ES256', kid: 'fixture-key' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(keys.privateKey);
    return Response.json({
      access_token: 'a'.repeat(43),
      refresh_token: 'r'.repeat(43),
      token_type: 'Bearer',
      expires_in: 300,
      id_token: token,
      scope: 'openid membership',
    });
  });
  const client = new ConnectedAppClient({
      issuer,
      clientId,
      redirectUri: callback,
      fetch: fetcher,
    }),
    login = new URL(client.beginLogin());
  nonce = login.searchParams.get('nonce') ?? '';
  await client.finishLogin(
    `${callback}?code=${'b'.repeat(43)}&state=${login.searchParams.get('state')}&iss=${issuer}`,
  );
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 291000);
  const first = client.membership(),
    second = client.membership();
  await vi.waitFor(() => expect(refreshes).toBe(1));
  client.clear();
  release?.();
  await expect(first).rejects.toThrow('APP_CONTEXT_CHANGED');
  await expect(second).rejects.toThrow('APP_CONTEXT_CHANGED');
  clock.mockRestore();
  await expect(client.membership()).rejects.toThrow('APP_LOGIN_REQUIRED');
});
