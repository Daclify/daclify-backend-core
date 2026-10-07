import { expect, it } from 'vitest';
import { AccountSchema, JoinIdentitySchema } from '../protocol/api.js';
import { AccountControlMessageSchema } from '../protocol/sign-in.js';
const wallet = {
  id: 'ea8725ba-243d-4dd4-8455-c9f6da55cbfe',
  custody: 'user-controlled',
  signingKey: null,
  encryptionKey: null,
};
it('represents wallet-only access without claiming lost vault keys', () => {
  expect(AccountSchema.safeParse(wallet).success).toBe(true);
  expect(JoinIdentitySchema.safeParse({ ...wallet, version: 1, id: undefined }).success).toBe(
    false,
  );
});
it('rejects partial key identities and managed accounts without custody keys', () => {
  expect(AccountSchema.safeParse({ ...wallet, custody: 'managed' }).success).toBe(false);
  expect(AccountSchema.safeParse({ ...wallet, encryptionKey: {} }).success).toBe(false);
});
it('binds wallet account-control challenges to the service identity without a fake signing key', () => {
  expect(
    AccountControlMessageSchema.safeParse({
      domain: 'daclify.account-control.v1',
      origin: 'https://app.example',
      accountId: wallet.id,
      signingKey: null,
      challengeId: wallet.id,
      expires: new Date(Date.now() + 60000).toISOString(),
      path: '/v1/account/native/link',
      bodyHash: 'ab'.repeat(32),
    }).success,
  ).toBe(true);
});
