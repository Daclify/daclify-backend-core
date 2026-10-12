import { it, expect } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { ConnectedAppConfigSchema, appConfigurationHash } from '../protocol/connected-apps.js';
import { CleanupNoticeSchema } from '../protocol/account-exit.js';
import { verifyCleanupNotice, VerifiedIssuerKeysSchema } from '../sdk/mini-app-cleanup.js';
import { miniBinding } from './helpers/mini-app-store.js';

const notice = () =>
  CleanupNoticeSchema.parse({
    version: 1,
    eventId: randomUUID(),
    binding: miniBinding,
    subject: randomUUID(),
    memberId: '18446744073709551615',
    kind: 'account-erased',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  });
it('preserves legacy configuration hashes and binds approved cleanup in a versioned revision', () => {
  const legacy = {
    dao: {
      chainId: miniBinding.chainId,
      contract: miniBinding.runtime,
      daoId: miniBinding.daoId,
      interfaceVersion: 1,
    },
    appId: miniBinding.appId,
    revision: '1',
    name: 'Tasks',
    origins: ['https://tasks.example'],
    redirectUris: ['https://tasks.example/callback'],
    activityAccount: 'daclifyactiv',
    enabled: true,
  };
  const hash = appConfigurationHash(legacy);
  const next = ConnectedAppConfigSchema.parse({
    ...legacy,
    schemaVersion: 2,
    cleanupUrl: 'https://tasks.example/cleanup',
  });
  expect(appConfigurationHash(next)).not.toBe(hash);
  expect(appConfigurationHash(legacy)).toBe(hash);
  expect(() =>
    ConnectedAppConfigSchema.parse({ ...next, cleanupUrl: 'https://other.example/cleanup' }),
  ).toThrow();
  expect(() =>
    ConnectedAppConfigSchema.parse({ ...legacy, cleanupUrl: 'https://tasks.example/cleanup' }),
  ).toThrow();
});
it('verifies genuine issuer signatures and rejects scope, audience, expiry and subject substitution', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const keys = VerifiedIssuerKeysSchema.parse({
    keys: [{ ...(await exportJWK(publicKey)), kid: 'cleanup-1', alg: 'ES256', use: 'sig' }],
  });
  const value = notice();
  const sign = (changes: Record<string, unknown> = {}) =>
    new SignJWT({ ...value, ...changes })
      .setProtectedHeader({ alg: 'ES256', kid: 'cleanup-1', typ: 'daclify-cleanup+jwt' })
      .setIssuer(miniBinding.issuer)
      .setAudience(
        typeof changes.aud === 'string' ? changes.aud : 'daclify.cleanup:' + miniBinding.clientId,
      )
      .setSubject(value.subject)
      .setJti(value.eventId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  expect(await verifyCleanupNotice(await sign(), miniBinding.issuer, keys, miniBinding)).toEqual(
    value,
  );
  await expect(
    verifyCleanupNotice(await sign(), 'https://other.example', keys, miniBinding),
  ).rejects.toThrow();
  await expect(
    verifyCleanupNotice(await sign(), miniBinding.issuer, keys, { ...miniBinding, daoId: '2' }),
  ).rejects.toThrow();
  await expect(
    verifyCleanupNotice(await sign({ aud: 'openid' }), miniBinding.issuer, keys, miniBinding),
  ).rejects.toThrow();
  await expect(
    verifyCleanupNotice(
      await sign({ subject: randomUUID() }),
      miniBinding.issuer,
      keys,
      miniBinding,
    ),
  ).rejects.toThrow();
  await expect(
    verifyCleanupNotice(
      await sign({ expiresAt: new Date(Date.now() - 1).toISOString() }),
      miniBinding.issuer,
      keys,
      miniBinding,
    ),
  ).rejects.toThrow();
  const altered = await sign({ memberId: '2' });
  const parts = altered.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...value, memberId: '3' })).toString('base64url');
  await expect(
    verifyCleanupNotice(parts.join('.'), miniBinding.issuer, keys, miniBinding),
  ).rejects.toThrow();
});
