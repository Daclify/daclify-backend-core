import { expect, it } from 'vitest';
import { verifyAppAccess } from '../examples/community-mini-app/access.js';
const binding = {
  schemaVersion: 1 as const,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '1',
  appId: '1',
  issuer: 'https://issuer.example',
  clientId: '550e8400-e29b-41d4-a716-446655440002',
};
const claims = {
  sub: '550e8400-e29b-41d4-a716-446655440001',
  dao: { chainId: binding.chainId, contract: binding.runtime, daoId: '1', interfaceVersion: 1 },
  memberId: '3',
  admin: false,
  reviewer: false,
  nonce: '0',
  appId: '1',
  appRevision: '1',
  sessionId: null,
  sessionExpires: null,
};
it('checks current membership again and never serves a cached actor after denial', async () => {
  let active = true;
  const fetcher: typeof fetch = async (input, options) => {
    const url = new URL(String(input));
    if (
      url.origin !== binding.issuer ||
      url.pathname !== '/v1/connected-apps/userinfo' ||
      url.searchParams.get('clientId') !== binding.clientId ||
      new Headers(options?.headers).get('authorization') !== 'Bearer ' + 'a'.repeat(43)
    )
      return Response.json({}, { status: 403 });
    return active
      ? Response.json(claims, { headers: { 'x-daclify-client-id': binding.clientId } })
      : Response.json({}, { status: 403 });
  };
  expect((await verifyAppAccess(binding, 'Bearer ' + 'a'.repeat(43), fetcher)).actor.memberId).toBe(
    '3',
  );
  active = false;
  await expect(verifyAppAccess(binding, 'Bearer ' + 'a'.repeat(43), fetcher)).rejects.toThrow(
    'MEMBERSHIP_REQUIRED',
  );
});
it('rejects another native deployment and malformed authorization before returning an actor', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      { ...claims, dao: { ...claims.dao, contract: 'otherdao' } },
      { headers: { 'x-daclify-client-id': binding.clientId } },
    );
  await expect(verifyAppAccess(binding, 'Bearer ' + 'a'.repeat(43), fetcher)).rejects.toThrow(
    'APP_ACTOR_BINDING',
  );
  await expect(verifyAppAccess(binding, 'Cookie secret', fetcher)).rejects.toThrow(
    'LOGIN_REQUIRED',
  );
});

it('requires returned verified client context instead of trusting an ignored query', async () => {
  for (const clientId of [undefined, '550e8400-e29b-41d4-a716-446655440003']) {
    const fetcher: typeof fetch = async () =>
      Response.json(claims, { headers: clientId ? { 'x-daclify-client-id': clientId } : {} });
    await expect(verifyAppAccess(binding, 'Bearer ' + 'a'.repeat(43), fetcher)).rejects.toThrow(
      'APP_ACTOR_BINDING',
    );
  }
});
