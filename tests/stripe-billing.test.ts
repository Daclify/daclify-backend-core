import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import type { ChainGateway } from '../services/api/src/chain.js';
import { createServer } from '../services/api/src/server.js';
import {
  checkoutSessionParams,
  integrationIdentifier,
  randomIntegrationSuffix,
  requireCheckoutUrl,
} from '../services/api/src/billing/checkout.js';
import { decideStripeEvent } from '../services/api/src/billing/decision.js';
import { MemoryServicePayments, settleServicePayment } from '../services/api/src/billing/settle.js';
import { billingReturnUrls, readStripeConfig } from '../services/api/src/billing/config.js';
import { createStripeClient, readStripeEvent } from '../services/api/src/billing/stripe.js';

const priceId = 'price_servicefixture';
const accountId = randomUUID();
const checkoutId = 'cs_test_fixture';

function session(paymentStatus: 'paid' | 'unpaid' | 'no_payment_required') {
  return {
    id: 'evt_fixture',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: checkoutId,
        object: 'checkout.session',
        payment_status: paymentStatus,
        client_reference_id: accountId,
        amount_total: 1000,
        currency: 'usd',
        metadata: { account_id: accountId, price_id: priceId, purpose: 'service' },
      },
    },
  };
}

function unusedChain(): ChainGateway {
  const fail = async (): Promise<never> => {
    throw new Error('UNUSED');
  };
  return {
    treasury: fail,
    governance: fail,
    execute: fail,
    settle: fail,
    finalize: fail,
    content: fail,
    dao: fail,
    network: fail,
    moduleState: fail,
    listDaos: fail,
    memberships: fail,
    memberProfile: fail,
    createDao: fail,
    relay: fail,
  };
}

describe('Stripe service checkout', () => {
  it('charges the configured price and tags the session without choosing payment methods or tax', () => {
    const params = checkoutSessionParams({
      priceId,
      accountId,
      successUrl: 'https://app.example/account?billing=submitted',
      cancelUrl: 'https://app.example/account?billing=cancelled',
      integrationIdentifier: integrationIdentifier('abcdefgh'),
    });
    expect(params).toEqual({
      mode: 'payment',
      client_reference_id: accountId,
      success_url: 'https://app.example/account?billing=submitted',
      cancel_url: 'https://app.example/account?billing=cancelled',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { account_id: accountId, price_id: priceId, purpose: 'service' },
      integration_identifier: 'daclifyabcdefgh',
    });
    expect(Object.hasOwn(params, 'payment_method_types')).toBe(false);
    expect(Object.hasOwn(params, 'automatic_tax')).toBe(false);
  });

  it('builds return urls on the frontend origin and accepts only a hosted Stripe checkout url', () => {
    expect(billingReturnUrls('https://app.example')).toEqual({
      successUrl: 'https://app.example/account?billing=submitted',
      cancelUrl: 'https://app.example/account?billing=cancelled',
    });
    expect(requireCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_fixture')).toBe(
      'https://checkout.stripe.com/c/pay/cs_test_fixture',
    );
    expect(() => requireCheckoutUrl('https://example.com/pay')).toThrow('CHECKOUT_URL');
    expect(() => requireCheckoutUrl('http://checkout.stripe.com/c/pay/cs_test_fixture')).toThrow(
      'CHECKOUT_URL',
    );
    expect(() => requireCheckoutUrl('https://checkout.stripe.com.evil.example/pay')).toThrow(
      'CHECKOUT_URL',
    );
    expect(() => requireCheckoutUrl(null)).toThrow('CHECKOUT_URL');
    expect(integrationIdentifier('abcdefgh')).toBe('daclifyabcdefgh');
    expect(randomIntegrationSuffix()).toMatch(/^[a-z]{8}$/);
    expect(() => integrationIdentifier('ABCDEFGH')).toThrow('INTEGRATION_IDENTIFIER');
    expect(() => integrationIdentifier('abcdefg')).toThrow('INTEGRATION_IDENTIFIER');
  });

  it('rejects an unsigned webhook without treating it as a browser request', async () => {
    const pool = new Pool({ connectionString: 'postgres://127.0.0.1:9/none' });
    const app = await createServer(pool, unusedChain(), 'https://app.example');
    try {
      const webhook = await app.inject({
        method: 'POST',
        url: '/v1/billing/stripe/webhook',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        payload: { id: 'evt_unsigned' },
      });
      expect(webhook.statusCode).toBe(400);
      expect(webhook.json()).toMatchObject({ code: 'SIGNATURE_INVALID' });
      const browser = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        payload: {},
      });
      expect(browser.statusCode).toBe(403);
      expect(browser.json()).toMatchObject({ code: 'ORIGIN_REJECTED' });
    } finally {
      await app.close();
      await pool.end();
    }
  });

  it('verifies the webhook signature against the raw body', () => {
    const secret = 'whsec_fixture';
    const payload = JSON.stringify({ id: 'evt_signed', type: 'checkout.session.completed' });
    const stripe = createStripeClient('rk_test_fixturekeyvalue');
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(readStripeEvent(stripe, Buffer.from(payload), header, secret).id).toBe('evt_signed');
    expect(() => readStripeEvent(stripe, Buffer.from(`${payload}x`), header, secret)).toThrow(
      'SIGNATURE_INVALID',
    );
  });

  it.each(['local', 'testnet'] as const)('rejects live Stripe credentials on %s', (environment) => {
    for (const secretKey of ['rk_live_fixturekeyvalue', 'sk_live_fixturekeyvalue']) {
      expect(() =>
        readStripeConfig(
          {
            STRIPE_SECRET_KEY: secretKey,
            STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
            STRIPE_PRICE_ID: priceId,
          },
          environment,
        ),
      ).toThrow('STRIPE_CONFIGURATION_INVALID');
    }
  });

  it('defaults to test-only credentials when no chain environment is supplied', () => {
    expect(() =>
      readStripeConfig({
        STRIPE_SECRET_KEY: 'sk_live_fixturekeyvalue',
        STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
        STRIPE_PRICE_ID: priceId,
      }),
    ).toThrow('STRIPE_CONFIGURATION_INVALID');
  });

  it('accepts live credentials only with an explicit mainnet environment', () => {
    for (const secretKey of ['rk_live_fixturekeyvalue', 'sk_live_fixturekeyvalue']) {
      expect(
        readStripeConfig(
          {
            STRIPE_SECRET_KEY: secretKey,
            STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
            STRIPE_PRICE_ID: priceId,
          },
          'mainnet',
        )?.secretKey,
      ).toBe(secretKey);
    }
  });

  it('requires the restricted-key settings together and accepts no partial configuration', () => {
    expect(readStripeConfig({})).toBeUndefined();
    expect(() =>
      readStripeConfig({
        STRIPE_SECRET_KEY: 'rk_test_fixturekeyvalue',
        STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
      }),
    ).toThrow('STRIPE_CONFIGURATION_INVALID');
    const config = readStripeConfig({
      STRIPE_SECRET_KEY: 'rk_test_fixturekeyvalue',
      STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
      STRIPE_PRICE_ID: priceId,
    });
    expect(config?.priceId).toBe(priceId);
    expect(config?.secretKey.startsWith('rk_test_')).toBe(true);
    expect(
      readStripeConfig({
        STRIPE_SECRET_KEY: 'sk_test_fixturekeyvalue',
        STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
        STRIPE_PRICE_ID: priceId,
      })?.secretKey.startsWith('sk_test_'),
    ).toBe(true);
    expect(() =>
      readStripeConfig({
        STRIPE_SECRET_KEY: 'pk_test_fixturekeyvalue',
        STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
        STRIPE_PRICE_ID: priceId,
      }),
    ).toThrow('STRIPE_CONFIGURATION_INVALID');
    expect(() =>
      readStripeConfig({
        STRIPE_SECRET_KEY: 'rk_test_fixturekeyvalue',
        STRIPE_WEBHOOK_SECRET: 'notasecret',
        STRIPE_PRICE_ID: priceId,
      }),
    ).toThrow('STRIPE_CONFIGURATION_INVALID');
    expect(() =>
      readStripeConfig({
        STRIPE_SECRET_KEY: 'rk_test_fixturekeyvalue',
        STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
        STRIPE_PRICE_ID: 'not-a-price',
      }),
    ).toThrow('STRIPE_CONFIGURATION_INVALID');
  });

  it('fulfills a paid checkout and waits when the completed event is still unpaid', () => {
    expect(decideStripeEvent(session('paid'))).toMatchObject({
      kind: 'fulfill',
      checkoutId,
      accountId,
      priceId,
      amountMinor: 1000,
      currency: 'usd',
      paymentStatus: 'paid',
    });
    expect(decideStripeEvent(session('unpaid'))).toEqual({ kind: 'ignore', reason: 'UNPAID' });
    expect(decideStripeEvent(session('no_payment_required'))).toMatchObject({ kind: 'fulfill' });
    const zero = session('paid');
    zero.data.object.amount_total = 0;
    expect(decideStripeEvent(zero)).toMatchObject({ kind: 'fulfill', amountMinor: 0 });
  });

  it('ignores a checkout whose receipt fields are not a service payment', () => {
    const wrongPurpose = session('paid');
    wrongPurpose.data.object.metadata = { ...wrongPurpose.data.object.metadata, purpose: 'dao' };
    expect(decideStripeEvent(wrongPurpose)).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
    const mismatched = session('paid');
    mismatched.data.object.metadata = {
      ...mismatched.data.object.metadata,
      account_id: '00000000-0000-4000-8000-000000000000',
    };
    expect(decideStripeEvent(mismatched)).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
    const negative = session('paid');
    negative.data.object.amount_total = -1;
    expect(decideStripeEvent(negative)).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
    const fractional = session('paid');
    fractional.data.object.amount_total = 10.5;
    expect(decideStripeEvent(fractional)).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
    const currency = session('paid');
    currency.data.object.currency = 'USD';
    expect(decideStripeEvent(currency)).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
    expect(decideStripeEvent(null)).toEqual({ kind: 'ignore', reason: 'EVENT_TYPE' });
    expect(
      decideStripeEvent({
        id: 'evt_fail_shape',
        type: 'checkout.session.async_payment_failed',
        data: { object: { id: checkoutId } },
      }),
    ).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
  });

  it('fulfills async success and records async failure without granting a paid receipt', () => {
    const succeeded = decideStripeEvent({
      ...session('paid'),
      type: 'checkout.session.async_payment_succeeded',
    });
    const failed = decideStripeEvent({
      ...session('unpaid'),
      type: 'checkout.session.async_payment_failed',
    });
    expect(succeeded).toMatchObject({ kind: 'fulfill', paymentStatus: 'paid' });
    expect(failed).toEqual({
      kind: 'fail',
      eventId: 'evt_fixture',
      checkoutId,
      accountId,
      priceId,
    });
    expect(
      decideStripeEvent({ id: 'evt_other', type: 'charge.succeeded', data: { object: {} } }),
    ).toEqual({ kind: 'ignore', reason: 'EVENT_TYPE' });
    expect(
      decideStripeEvent({
        id: 'evt_bad',
        type: 'checkout.session.completed',
        data: { object: { id: 'not-a-session' } },
      }),
    ).toEqual({ kind: 'ignore', reason: 'SESSION_SHAPE' });
  });

  it('records a paid service receipt and does not downgrade it when a later failure arrives', async () => {
    const store = new MemoryServicePayments([accountId]);
    const paid = decideStripeEvent(session('paid'));
    const hash = createHash('sha256').update('paid').digest();
    expect(await settleServicePayment(store, paid, priceId, hash)).toEqual({ outcome: 'paid' });
    expect(await store.receipts(accountId)).toEqual([
      {
        status: 'paid',
        currency: 'usd',
        amountMinor: 1000,
        paymentStatus: 'paid',
      },
    ]);
    const failure = decideStripeEvent({
      ...session('unpaid'),
      id: 'evt_fail',
      type: 'checkout.session.async_payment_failed',
    });
    expect(await settleServicePayment(store, failure, priceId, hash)).toEqual({
      outcome: 'unchanged',
    });
    expect((await store.receipts(accountId))[0]?.status).toBe('paid');
    expect(await settleServicePayment(store, paid, priceId, hash)).toEqual({
      outcome: 'duplicate',
    });
  });

  it('rejects a checkout for a different price and an unknown account', async () => {
    const paid = decideStripeEvent(session('paid'));
    const hash = createHash('sha256').update('other').digest();
    const priced = new MemoryServicePayments([accountId]);
    expect(await settleServicePayment(priced, paid, 'price_other', hash)).toEqual({
      outcome: 'ignored',
    });
    const missing = new MemoryServicePayments([]);
    expect(await settleServicePayment(missing, paid, priceId, hash)).toEqual({
      outcome: 'ignored',
    });
    expect(await missing.receipts(accountId)).toEqual([]);
    expect(await priced.receipts(accountId)).toEqual([]);
  });
});
