import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import { StripeBilling } from '../../services/api/src/billing/service.js';
import { readStripeConfig } from '../../services/api/src/billing/config.js';
import { createStripeClient } from '../../services/api/src/billing/stripe.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { ChallengeSchema, NetworkSchema, SessionSchema } from '../../protocol/api.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');

const priceId = 'price_servicefixture';
const webhookSecret = 'whsec_fixture';
const stripeConfig = readStripeConfig({
  STRIPE_SECRET_KEY: 'rk_test_fixturekeyvalue',
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  STRIPE_PRICE_ID: priceId,
});
if (!stripeConfig) throw new Error('STRIPE_CONFIGURATION_INVALID');

const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const stripe = createStripeClient(stripeConfig.secretKey);
const chain: ChainGateway = {
  governance: async () => {
    throw new Error('Not part of this fixture');
  },
  execute: async () => {
    throw new Error('Not part of this fixture');
  },
  finalize: async () => ({ state: 'already-finalized' }),
  treasury: async () => {
    throw new Error('Not part of this fixture');
  },
  settle: async () => ({ state: 'already-settled' }),
  async dao() {
    throw new Error('not deployed');
  },
  async content() {
    throw new Error('not deployed');
  },
  async moduleState() {
    throw new Error('not deployed');
  },
  async network() {
    return NetworkSchema.parse({
      chainId: 'ab'.repeat(32),
      rpcUrl: 'http://localhost:18888',
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      interfaceVersion: 1,
      coreVersion: '0.1.0-alpha.1',
      capabilities: [],
    });
  },
  async listDaos() {
    return [];
  },
  async memberships() {
    return [];
  },
  async memberProfile() {
    return { accountName: null, profile: null };
  },
  async createDao() {
    throw new Error('not deployed');
  },
  async relay() {
    throw new Error('not deployed');
  },
};
const billing = new StripeBilling(pool, stripeConfig, origin);
const app = await createServer(pool, chain, origin, { billing });

function eventId(): string {
  return `evt_it${randomUUID().replaceAll('-', '')}`;
}

function checkoutId(): string {
  return `cs_it${randomUUID().replaceAll('-', '')}`;
}

function sessionEvent(input: {
  id: string;
  type: string;
  checkoutId: string;
  accountId: string;
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  priceId?: string;
  amount?: number | string;
}): string {
  return JSON.stringify({
    id: input.id,
    type: input.type,
    data: {
      object: {
        id: input.checkoutId,
        object: 'checkout.session',
        payment_status: input.paymentStatus,
        client_reference_id: input.accountId,
        amount_total: input.amount ?? 1000,
        currency: 'usd',
        metadata: {
          account_id: input.accountId,
          price_id: input.priceId ?? priceId,
          purpose: 'service',
        },
      },
    },
  });
}

async function postWebhook(payload: string) {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return app.inject({
    method: 'POST',
    url: '/v1/billing/stripe/webhook',
    headers: {
      origin: 'https://evil.example',
      'content-type': 'application/json',
      'stripe-signature': header,
    },
    payload,
  });
}

async function login(): Promise<{ accountId: string; cookie: string; csrfToken: string }> {
  const key = PrivateKey.generate('K1');
  const challengeResponse = await app.inject({
    method: 'POST',
    url: '/v1/auth/challenge',
    headers: { origin },
    payload: { signingKey: key.toPublic().toString() },
  });
  const challenge = ChallengeSchema.parse(challengeResponse.json());
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    },
  });
  const session = SessionSchema.parse(response.json());
  return {
    accountId: session.account.id,
    csrfToken: session.csrfToken,
    cookie: response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(';'),
  };
}

beforeAll(() => migrate(pool));
afterAll(async () => {
  await pool.query("DELETE FROM service_payments WHERE checkout_id LIKE 'cs_it%'");
  await pool.query("DELETE FROM billing_events WHERE event_id LIKE 'evt_it%'");
  await app.close();
  await pool.end();
});

describe('service payment receipts on PostgreSQL', () => {
  it('records a signed paid webhook and does not downgrade it or change storage', async () => {
    const user = await login();
    const before = await pool.query<{ count: string }>('SELECT count(*)::text FROM entitlements');
    const checkout = checkoutId();
    const paid = sessionEvent({
      id: eventId(),
      type: 'checkout.session.completed',
      checkoutId: checkout,
      accountId: user.accountId,
      paymentStatus: 'paid',
    });
    const first = await postWebhook(paid);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ received: true });
    const replay = await postWebhook(paid);
    expect(replay.statusCode).toBe(200);
    const failed = sessionEvent({
      id: eventId(),
      type: 'checkout.session.async_payment_failed',
      checkoutId: checkout,
      accountId: user.accountId,
      paymentStatus: 'unpaid',
    });
    expect((await postWebhook(failed)).statusCode).toBe(200);
    const other = await login();
    const replaced = sessionEvent({
      id: eventId(),
      type: 'checkout.session.completed',
      checkoutId: checkout,
      accountId: other.accountId,
      paymentStatus: 'paid',
      amount: 1,
    });
    expect((await postWebhook(replaced)).statusCode).toBe(200);
    const receipts = await app.inject({
      method: 'GET',
      url: '/v1/billing/receipts',
      headers: { cookie: user.cookie },
    });
    expect(receipts.statusCode).toBe(200);
    expect(receipts.json()).toEqual({
      receipts: [{ status: 'paid', currency: 'usd', amountMinor: 1000, paymentStatus: 'paid' }],
    });
    const after = await pool.query<{ count: string }>('SELECT count(*)::text FROM entitlements');
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    const stored = await pool.query<{ account_id: string; amount_minor: string }>(
      'SELECT account_id::text, amount_minor::text FROM service_payments WHERE checkout_id=$1',
      [checkout],
    );
    expect(stored.rows[0]).toEqual({ account_id: user.accountId, amount_minor: '1000' });
  });

  it('ignores an unpaid completion, a wrong price, and an unknown account', async () => {
    const user = await login();
    const unpaid = sessionEvent({
      id: eventId(),
      type: 'checkout.session.completed',
      checkoutId: checkoutId(),
      accountId: user.accountId,
      paymentStatus: 'unpaid',
    });
    expect((await postWebhook(unpaid)).statusCode).toBe(200);
    const wrongPrice = sessionEvent({
      id: eventId(),
      type: 'checkout.session.completed',
      checkoutId: checkoutId(),
      accountId: user.accountId,
      paymentStatus: 'paid',
      priceId: 'price_otherfixture',
    });
    expect((await postWebhook(wrongPrice)).statusCode).toBe(200);
    const unknown = sessionEvent({
      id: eventId(),
      type: 'checkout.session.async_payment_succeeded',
      checkoutId: checkoutId(),
      accountId: randomUUID(),
      paymentStatus: 'paid',
    });
    expect((await postWebhook(unknown)).statusCode).toBe(200);
    const receipts = await app.inject({
      method: 'GET',
      url: '/v1/billing/receipts',
      headers: { cookie: user.cookie },
    });
    expect(receipts.json()).toEqual({ receipts: [] });
  });

  it('asks Stripe to retry a malformed known event and rejects a bad signature', async () => {
    const user = await login();
    const malformed = JSON.stringify({
      id: eventId(),
      type: 'checkout.session.completed',
      data: { object: { id: checkoutId() } },
    });
    const retry = await postWebhook(malformed);
    expect(retry.statusCode).toBe(500);
    expect(retry.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    const unsigned = await app.inject({
      method: 'POST',
      url: '/v1/billing/stripe/webhook',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      payload: { id: eventId() },
    });
    expect(unsigned.statusCode).toBe(400);
    expect(unsigned.json()).toMatchObject({ code: 'SIGNATURE_INVALID' });
    const checkout = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      headers: { origin },
      payload: {},
    });
    expect(checkout.statusCode).toBe(401);
    expect(user.accountId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('rejects a receipt that is not a checkout or a negative amount', async () => {
    const user = await login();
    await expect(
      pool.query(
        `INSERT INTO service_payments(checkout_id, account_id, price_id, status, payment_status)
         VALUES('not-a-checkout',$1,'price_servicefixture','paid','paid')`,
        [user.accountId],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        `INSERT INTO service_payments(checkout_id, account_id, price_id, amount_minor, status, payment_status)
         VALUES($1,$2,'price_servicefixture',-1,'paid','paid')`,
        [checkoutId(), user.accountId],
      ),
    ).rejects.toThrow();
  });
});
