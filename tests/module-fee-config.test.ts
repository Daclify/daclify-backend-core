import { expect, it } from 'vitest';
import { readModuleFeesConfig } from '../services/api/src/billing/module-fees-config.js';
const settings = {
  DACLIFY_MODULE_FEES_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_' + 'a'.repeat(24),
  DACLIFY_MODULE_FEES_STRIPE_ACCOUNT_ID: 'acct_testmodules',
};
it('requires explicit enablement and a matching provider account and mode', () => {
  expect(readModuleFeesConfig({}, 'testnet', 'https://app.example')).toBeUndefined();
  expect(readModuleFeesConfig(settings, 'testnet', 'https://app.example')).toMatchObject({
    livemode: false,
    liveChargesEnabled: false,
  });
  for (const value of [
    { ...settings, STRIPE_SECRET_KEY: 'sk_live_' + 'a'.repeat(24) },
    { ...settings, DACLIFY_MODULE_FEES_STRIPE_ACCOUNT_ID: undefined },
    { ...settings, DACLIFY_MODULE_FEES_ENABLED: 'yes' },
  ])
    expect(() => readModuleFeesConfig(value, 'testnet', 'https://app.example')).toThrow(
      'MODULE_BILLING_CONFIGURATION_INVALID',
    );
  expect(() => readModuleFeesConfig(settings, 'mainnet', 'https://app.example')).toThrow(
    'MODULE_BILLING_CONFIGURATION_INVALID',
  );
  expect(() => readModuleFeesConfig(settings, 'testnet', 'http://app.example')).toThrow(
    'MODULE_BILLING_CONFIGURATION_INVALID',
  );
});
