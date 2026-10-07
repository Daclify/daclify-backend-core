import { describe, expect, it } from 'vitest';
import { readConnectConfig } from '../services/api/src/payments/config.js';
import {
  connectCheckoutParams,
  merchantReadiness,
  requireStripeConnectUrl,
} from '../services/api/src/payments/provider.js';
describe('Stripe Connect provider boundary', () => {
  it('requires complete isolated configuration and never defaults live charges on', () => {
    expect(readConnectConfig({}, 'local', 'http://localhost:5178')).toBeUndefined();
    const env = {
      STRIPE_SECRET_KEY: 'sk_test_abcdefghijklmnopqrstuv',
      STRIPE_CONNECT_CLIENT_ID: 'ca_fixture',
      STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_fixturefixture',
      API_PUBLIC_ORIGIN: 'http://localhost:3008',
    };
    expect(readConnectConfig(env, 'local', 'http://localhost:5178')?.liveChargesEnabled).toBe(
      false,
    );
    expect(() =>
      readConnectConfig(
        { ...env, STRIPE_SECRET_KEY: 'sk_live_abcdefghijklmnopqrstuv' },
        'testnet',
        'https://testnet.app.example',
      ),
    ).toThrow();
    expect(() =>
      readConnectConfig(
        { STRIPE_CONNECT_CLIENT_ID: 'ca_fixture' },
        'local',
        'http://localhost:5178',
      ),
    ).toThrow();
  });
  it('creates direct charges with the snapshotted fee and no transfer destination', () => {
    const params = connectCheckoutParams({
      id: crypto.randomUUID(),
      title: 'Support work',
      amountMinor: 10000,
      applicationFeeMinor: 500,
      returnUrl: 'https://app.example/payments',
      daoKey: 'opaque',
    });
    expect(params.payment_intent_data?.application_fee_amount).toBe(500);
    expect(params.payment_intent_data?.transfer_data).toBeUndefined();
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(10000);
    expect(
      connectCheckoutParams({
        id: crypto.randomUUID(),
        title: 'Support work',
        amountMinor: 100,
        applicationFeeMinor: 0,
        returnUrl: 'https://app.example/payments',
        daoKey: 'opaque',
      }).payment_intent_data?.application_fee_amount,
    ).toBeUndefined();
  });
  it('checks merchant payment readiness, responsibilities and test/live mode', () => {
    const value = {
      id: 'acct_fixture',
      object: 'v2.core.account',
      livemode: false,
      dashboard: 'full',
      defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { status: 'active' },
            stripe_balance: { payouts: { status: 'active' } },
          },
        },
      },
    };
    expect(merchantReadiness(value, 'v2', false)).toEqual({
      chargesEnabled: true,
      payoutsEnabled: true,
    });
    expect(() => merchantReadiness(value, 'v2', true)).toThrow('PAYMENT_MODE');
    expect(() => merchantReadiness({ ...value, dashboard: 'none' }, 'v2', false)).toThrow();
    for (const url of [
      'https://evil.example/setup',
      'https://connect.stripe.com.evil.example',
      'http://connect.stripe.com',
      'https://user:secret@connect.stripe.com',
    ])
      expect(() => requireStripeConnectUrl(url)).toThrow();
    expect(requireStripeConnectUrl('https://connect.stripe.com/setup/fixture')).toContain(
      'connect.stripe.com',
    );
  });
});
