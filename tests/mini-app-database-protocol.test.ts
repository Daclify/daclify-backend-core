import { expect, it } from 'vitest';
import * as protocol from '../protocol/index.js';
const binding = {
  schemaVersion: 1 as const,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '1',
  appId: '1',
  issuer: 'https://issuer.example',
  clientId: '550e8400-e29b-41d4-a716-446655440002',
};
const claims = protocol.AppClaimsSchema.parse({
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
});
it('derives an actor only from the verified issuer/client and native membership', () => {
  expect(protocol.actorFromVerifiedClaims(binding, claims, binding)).toEqual({
    binding,
    subject: claims.sub,
    memberId: '3',
  });
  for (const wrong of [
    { issuer: 'https://other.example' },
    { clientId: '550e8400-e29b-41d4-a716-446655440003' },
  ])
    expect(() =>
      protocol.actorFromVerifiedClaims(binding, claims, { ...binding, ...wrong }),
    ).toThrow('APP_ACTOR_BINDING');
  for (const wrong of [
    { ...claims, appId: '2' },
    { ...claims, dao: { ...claims.dao, daoId: '2' } },
    { ...claims, dao: { ...claims.dao, contract: 'otherdao' } },
    { ...claims, dao: { ...claims.dao, chainId: 'cd'.repeat(32) } },
  ])
    expect(() => protocol.actorFromVerifiedClaims(binding, wrong, binding)).toThrow(
      'APP_ACTOR_BINDING',
    );
});
it('uses ordered versioned binding bytes regardless of object property order', () => {
  const reordered = {
    clientId: binding.clientId,
    issuer: binding.issuer,
    appId: '1',
    daoId: '1',
    runtime: binding.runtime,
    chainId: binding.chainId,
    schemaVersion: 1 as const,
  };
  expect(protocol.appBindingHash(reordered)).toBe(protocol.appBindingHash(binding));
  expect(protocol.appBindingHash(binding)).toBe(
    '7562ab93941f962728197070f4a688972ae4d38a9d68dfe6263c8b46cea4d1cd',
  );
  expect(protocol.appBindingHash({ ...binding, daoId: '2' })).not.toBe(
    protocol.appBindingHash(binding),
  );
});
it('preserves_max_uint64_ids', () => {
  const maximum = '18446744073709551615';
  const bound = protocol.AppBindingSchema.parse({ ...binding, daoId: maximum, appId: maximum });
  expect(
    protocol.AppActorSchema.parse({ binding: bound, subject: claims.sub, memberId: maximum })
      .memberId,
  ).toBe(maximum);
  for (const value of ['18446744073709551616', '01', '0', '1e3'])
    expect(protocol.AppBindingSchema.safeParse({ ...binding, daoId: value }).success).toBe(false);
});
it('rejects malformed binding values and unrecognized actor fields', () => {
  for (const wrong of [
    { schemaVersion: 2 },
    { issuer: 'https://issuer.example/path' },
    { clientId: 'not-a-client' },
    { chainId: 'AB'.repeat(32) },
    { runtime: 'bad!' },
  ])
    expect(protocol.AppBindingSchema.safeParse({ ...binding, ...wrong }).success).toBe(false);
  expect(
    protocol.AppActorSchema.safeParse({ binding, subject: claims.sub, memberId: '3', admin: true })
      .success,
  ).toBe(false);
});
