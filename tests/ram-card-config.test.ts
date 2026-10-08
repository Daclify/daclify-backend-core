import { expect, it } from 'vitest';
import { readRamCardConfig } from '../services/api/src/resources/card-config.js';
import { requireCheckoutUrl } from '../services/api/src/billing/checkout.js';
const env = {
  STRIPE_SECRET_KEY: 'sk_test_' + 'a'.repeat(24),
  DACLIFY_RAM_STRIPE_PRODUCT_ID: 'prod_ram',
  DACLIFY_RAM_WEBHOOK_SECRET: 'whsec_' + 'b'.repeat(24),
  DACLIFY_RAM_STRIPE_ACCOUNT_ID: 'acct_fixture',
};
it('keeps card RAM off until its separate product, webhook and account are configured', () => {
  expect(readRamCardConfig({}, 'local', 'http://localhost:5208')).toBeUndefined();
  expect(() => readRamCardConfig(env, 'mainnet', 'https://app.daclify.com')).toThrow(
    'RAM_BILLING_CONFIGURATION_INVALID',
  );
  expect(readRamCardConfig(env, 'testnet', 'https://testnet.daclify.com')).toMatchObject({
    accountId: 'acct_fixture',
    livemode: false,
    liveChargesEnabled: false,
  });
  for (const change of [
    { DACLIFY_RAM_STRIPE_ACCOUNT_ID: '' },
    { STRIPE_SECRET_KEY: 'sk_live_' + 'a'.repeat(24) },
    { DACLIFY_RAM_WEBHOOK_SECRET: '' },
  ])
    expect(() =>
      readRamCardConfig({ ...env, ...change }, 'testnet', 'https://testnet.daclify.com'),
    ).toThrow();
});
it('refuses credential-bearing and nonstandard-port checkout URLs', () => {
  for (const value of [
    'https://name:password@checkout.stripe.com/pay',
    'https://checkout.stripe.com:444/pay',
    'https://checkout.stripe.com.evil.example/pay',
  ])
    expect(() => requireCheckoutUrl(value)).toThrow('CHECKOUT_URL');
});
