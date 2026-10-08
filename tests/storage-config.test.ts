import { expect, it } from 'vitest';
import { readStorageConfig } from '../services/api/src/billing/storage-config.js';
const env = {
  STRIPE_SECRET_KEY: 'sk_test_' + 'a'.repeat(24),
  DACLIFY_STORAGE_STRIPE_PRODUCT_ID: 'prod_storage',
  DACLIFY_STORAGE_WEBHOOK_SECRET: 'whsec_' + 'b'.repeat(24),
};
it('requires a complete storage setup and a stable separate provider ownership scope', () => {
  expect(readStorageConfig({}, 'local', 'http://localhost:5208', 'fixture')).toBeUndefined();
  expect(
    readStorageConfig(env, 'testnet', 'https://testnet.daclify.com', 'pinata-testnet'),
  ).toMatchObject({ providerScope: 'pinata-testnet', livemode: false, liveChargesEnabled: false });
  for (const config of [
    { ...env, STRIPE_SECRET_KEY: '' },
    { ...env, DACLIFY_STORAGE_WEBHOOK_SECRET: '' },
  ]) {
    expect(() =>
      readStorageConfig(config, 'testnet', 'https://testnet.daclify.com', 'pinata-testnet'),
    ).toThrow('STORAGE_CONFIGURATION_INVALID');
  }
  expect(() => readStorageConfig(env, 'testnet', 'https://testnet.daclify.com', '')).toThrow(
    'STORAGE_CONFIGURATION_INVALID',
  );
});
it('rejects live keys on testnet and gates mainnet live charges explicitly', () => {
  const live = {
    ...env,
    STRIPE_SECRET_KEY: 'sk_live_' + 'a'.repeat(24),
    DACLIFY_STORAGE_LIVE_PAYMENTS: 'true',
  };
  expect(() =>
    readStorageConfig(live, 'testnet', 'https://testnet.daclify.com', 'testnet'),
  ).toThrow('STORAGE_CONFIGURATION_INVALID');
  expect(() => readStorageConfig(env, 'testnet', 'http://testnet.daclify.com', 'testnet')).toThrow(
    'STORAGE_CONFIGURATION_INVALID',
  );
  expect(
    readStorageConfig(
      { ...live, DACLIFY_STORAGE_LIVE_PAYMENTS: 'false' },
      'mainnet',
      'https://app.daclify.com',
      'mainnet',
    )?.liveChargesEnabled,
  ).toBe(false);
  expect(
    readStorageConfig(live, 'mainnet', 'https://app.daclify.com', 'mainnet')?.liveChargesEnabled,
  ).toBe(true);
});
