import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { ConnectedPayments } from '../../services/api/src/payments/service.js';
import { STRIPE_API_VERSION } from '../../services/api/src/billing/stripe.js';
import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import {
  AccountSchema,
  ChallengeSchema,
  NetworkSchema,
  SessionSchema,
  UserMembershipSchema,
} from '../../protocol/api.js';
import { daoPaymentKey } from '../../protocol/payments.js';
import { controlledInject } from '../helpers/account-control.js';

const database = process.env.DATABASE_URL;
if (
  !database ||
  !new URL(database).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(database).hostname)
)
  throw new Error('Owned test DB required');
const pool = new Pool({ connectionString: database });
const origin = 'http://localhost:5178';
const dao = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '984731',
  interfaceVersion: 1 as const,
};
const network = NetworkSchema.parse({
  chainId: dao.chainId,
  runtime: dao.contract,
  hub: 'daclifyhub',
  rpcUrl: 'http://localhost:18888',
  environment: 'local',
  interfaceVersion: 1,
  coreVersion: '0.7.0-alpha.1',
  capabilities: [],
});
const unavailable = async (): Promise<never> => {
  throw new Error('Not in fixture');
};
let administrator = '';
let rate = 500;
const chain: ChainGateway = {
  network: async () => network,
  paymentPolicy: async () => ({ basisPoints: rate, revision: '1' }),
  memberships: async (account) =>
    account.id === administrator
      ? [
          UserMembershipSchema.parse({
            dao,
            memberId: '1',
            nonce: '0',
            active: true,
            admin: true,
            reviewer: false,
            credits: '0',
            claim: '0',
            stake: '0',
            nativeAccount: '',
            custody: 'user-controlled',
            signingKey: account.signingKey,
          }),
        ]
      : [],
  governance: unavailable,
  execute: unavailable,
  treasury: unavailable,
  settle: unavailable,
  finalize: unavailable,
  content: unavailable,
  dao: unavailable,
  moduleState: unavailable,
  listDaos: async () => [],
  memberProfile: unavailable,
  createDao: unavailable,
  relay: unavailable,
};
const config = {
  secretKey: 'sk_test_fixturekeyvalue',
  clientId: 'ca_fixture',
  webhookSecret: 'whsec_fixturesecret',
  apiOrigin: 'http://localhost:3008',
  frontendOrigin: origin,
  livemode: false,
  liveChargesEnabled: false,
};
let session: Record<string, unknown> = {};
let intent: Record<string, unknown> = {};
let refunded = 0;
let refundRequests = 0;
let refundParams = new URLSearchParams();
let beforeCheckoutReturn: (() => Promise<void>) | undefined;
const requests: { path: string; headers: Headers; body: URLSearchParams }[] = [];
const stripe = new Stripe(config.secretKey, {
  apiVersion: STRIPE_API_VERSION,
  maxNetworkRetries: 0,
  httpClient: Stripe.createFetchHttpClient(async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url,
    );
    const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    const headers = new Headers(init?.headers);
    requests.push({ path: url.pathname, headers, body });
    let result: unknown;
    if (url.pathname === '/v1/accounts/acct_fixture')
      result = {
        id: 'acct_fixture',
        object: 'account',
        type: 'standard',
        livemode: false,
        charges_enabled: true,
        payouts_enabled: true,
      };
    else if (url.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
      const metadata = {
        purpose: body.get('metadata[purpose]'),
        order_id: body.get('metadata[order_id]'),
        dao_key: body.get('metadata[dao_key]'),
      };
      session = {
        id: 'cs_' + randomUUID().replaceAll('-', ''),
        object: 'checkout.session',
        livemode: false,
        mode: 'payment',
        metadata,
        amount_total: Number(body.get('line_items[0][price_data][unit_amount]')),
        currency: 'usd',
        payment_status: 'unpaid',
        status: 'open',
        payment_intent: 'pi_fixture',
        url: 'https://checkout.stripe.com/c/pay/fixture',
      };
      intent = {
        id: 'pi_fixture',
        object: 'payment_intent',
        livemode: false,
        status: 'succeeded',
        amount_received: session.amount_total,
        currency: 'usd',
        metadata,
        application_fee_amount: Number(
          body.get('payment_intent_data[application_fee_amount]') ?? 0,
        ),
        latest_charge: {
          id: 'ch_fixture',
          object: 'charge',
          livemode: false,
          amount: session.amount_total,
          currency: 'usd',
          paid: true,
          payment_intent: 'pi_fixture',
          application_fee_amount: Number(
            body.get('payment_intent_data[application_fee_amount]') ?? 0,
          ),
          amount_refunded: refunded,
          disputed: false,
        },
      };
      await beforeCheckoutReturn?.();
      result = session;
    } else if (url.pathname.startsWith('/v1/checkout/sessions/')) result = session;
    else if (url.pathname === '/v1/payment_intents/pi_fixture') {
      const charge = z.record(z.string(), z.unknown()).parse(intent.latest_charge);
      result = { ...intent, latest_charge: { ...charge, amount_refunded: refunded } };
    } else if (url.pathname === '/v1/disputes')
      result = { object: 'list', data: [], has_more: false };
    else if (url.pathname === '/oauth/token')
      result = { stripe_user_id: 'acct_fixture', livemode: false, scope: 'read_write' };
    else if (url.pathname === '/v2/core/accounts')
      result = {
        id: 'acct_v2fixture',
        object: 'v2.core.account',
        livemode: false,
        dashboard: 'full',
        defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { status: 'pending' },
              stripe_balance: { payouts: { status: 'pending' } },
            },
          },
        },
      };
    else if (url.pathname === '/v2/core/account_links')
      result = { url: 'https://connect.stripe.com/setup/fixture' };
    else if (url.pathname === '/v1/refunds' && init?.method === 'POST') {
      refundRequests++;
      refundParams = body;
      refunded += Number(body.get('amount'));
      result = {
        id: 're_' + randomUUID().replaceAll('-', ''),
        object: 'refund',
        amount: Number(body.get('amount')),
        currency: 'usd',
        payment_intent: 'pi_fixture',
        status: 'succeeded',
        metadata: {
          request_id: body.get('metadata[request_id]'),
          order_id: body.get('metadata[order_id]'),
        },
      };
    } else
      return new Response(JSON.stringify({ error: { message: 'Unexpected fixture route' } }), {
        status: 404,
      });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json', 'request-id': 'req_fixture' },
    });
  }),
});
const service = new ConnectedPayments(pool, chain, config, stripe);
const app = await createServer(pool, chain, origin, { payments: service });
const key = PrivateKey.generate('K1');
let user: ReturnType<typeof SessionSchema.parse>;
let cookie = '';
const headers = () => ({ origin, cookie, 'x-csrf-token': user.csrfToken });
let productId = '';
async function notification(
  account = 'acct_fixture',
  id = 'evt_' + randomUUID().replaceAll('-', ''),
) {
  const raw = Buffer.from(
    JSON.stringify({
      id,
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      account,
      data: { object: session },
    }),
  );
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: raw.toString(),
    secret: config.webhookSecret,
  });
  return service.webhook(raw, signature);
}
async function checkout() {
  return service.checkout(
    dao,
    productId,
    randomUUID(),
    'account:' + user.account.id,
    user.account.id,
  );
}
beforeAll(async () => {
  await migrate(pool);
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const challenge = ChallengeSchema.parse(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/challenge',
        headers: { origin },
        payload: {
          signingKey: key.toPublic().toString(),
          encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
        },
      })
    ).json(),
  );
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
  user = SessionSchema.parse(response.json());
  cookie = response.cookies.map((c) => c.name + '=' + c.value).join(';');
});
beforeEach(async () => {
  administrator = user.account.id;
  rate = 500;
  refunded = 0;
  refundRequests = 0;
  beforeCheckoutReturn = undefined;
  requests.length = 0;
  await pool.query(
    'DELETE FROM dao_payment_refunds WHERE order_id IN(SELECT id FROM dao_payment_orders WHERE dao_key=$1)',
    [daoPaymentKey(dao)],
  );
  await pool.query('DELETE FROM dao_payment_orders WHERE dao_key=$1', [daoPaymentKey(dao)]);
  await pool.query('DELETE FROM dao_payment_products WHERE dao_key=$1', [daoPaymentKey(dao)]);
  await pool.query('DELETE FROM dao_payment_oauth WHERE dao_key=$1', [daoPaymentKey(dao)]);
  await pool.query('DELETE FROM dao_merchants WHERE dao_key=$1', [daoPaymentKey(dao)]);
  await pool.query(
    "INSERT INTO dao_merchants(dao_key,dao,creation_request,stripe_account,account_kind,state,charges_enabled,payouts_enabled)VALUES($1,$2,$3,'acct_fixture','oauth','ready',true,true)",
    [daoPaymentKey(dao), dao, randomUUID()],
  );
  productId = randomUUID();
  await service.product(user.account, {
    dao,
    id: productId,
    moduleId: 'works',
    title: 'Community workshop',
    amountMinor: 1000,
    active: true,
  });
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
describe('connected payment flows with PostgreSQL, real SDK and real account proofs', () => {
  it('requires fresh signing proof for merchant controls and scopes broker access to the current administrator', async () => {
    const input = {
      dao,
      id: productId,
      moduleId: 'works',
      title: 'Workshop',
      amountMinor: 1234,
      active: true,
    };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/payments/product',
          headers: headers(),
          payload: input,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await controlledInject(app, key, {
          method: 'POST',
          url: '/v1/payments/product',
          headers: headers(),
          payload: input,
        })
      ).statusCode,
    ).toBe(200);
    const credential = await service.credential(user.account, dao);
    if (!credential) throw new Error('Credential absent');
    expect(AccountSchema.parse(await service.broker(credential.token, dao)).id).toBe(
      user.account.id,
    );
    administrator = '';
    await expect(service.broker(credential.token, dao)).rejects.toMatchObject({
      code: 'PAYMENT_ADMIN_REQUIRED',
    });
  });
  it('snapshots the rate and charges the merchant directly', async () => {
    const request = randomUUID();
    const order = await service.checkout(
      dao,
      productId,
      request,
      'account:' + user.account.id,
      user.account.id,
    );
    expect(order.applicationFeeMinor).toBe(50);
    rate = 1000;
    expect(
      (
        await service.checkout(
          dao,
          productId,
          request,
          'account:' + user.account.id,
          user.account.id,
        )
      ).applicationFeeMinor,
    ).toBe(50);
    const create = requests.find((r) => r.path === '/v1/checkout/sessions');
    expect(create?.headers.get('stripe-context')).toBe('acct_fixture');
    expect(create?.body.has('payment_intent_data[transfer_data][destination]')).toBe(false);
    await expect(
      pool.query('UPDATE dao_payment_orders SET fee_bps=1000,application_fee=100 WHERE id=$1', [
        order.id,
      ]),
    ).rejects.toThrow('immutable');
  });
  it('settles a paid webhook arriving before checkout creation returns', async () => {
    beforeCheckoutReturn = async () => {
      session.payment_status = 'paid';
      session.status = 'complete';
      await notification();
      const stored = await pool.query<{ state: string }>(
        'SELECT state FROM dao_payment_orders WHERE id=$1',
        [z.object({ order_id: z.uuid() }).parse(session.metadata).order_id],
      );
      expect(stored.rows[0]?.state).toBe('paid');
    };
    const order = await checkout();
    expect((await service.readOrder(user.account, order.id)).state).toBe('paid');
  });
  it('rejects a known order reported under a different connected account', async () => {
    await checkout();
    session.payment_status = 'paid';
    await expect(notification('acct_wrong')).rejects.toMatchObject({
      code: 'PAYMENT_RECEIPT_INVALID',
    });
  });
  it('reserves refunds against external refunds and prevents over-refunding', async () => {
    const order = await checkout();
    session.payment_status = 'paid';
    refunded = 600;
    await notification();
    await expect(
      service.refund(user.account, dao, order.id, randomUUID(), 500),
    ).rejects.toMatchObject({ code: 'PAYMENT_REFUND_AMOUNT' });
    expect(refundRequests).toBe(0);
  });
  it('refunds zero-commission payments without requesting an application fee refund', async () => {
    rate = 0;
    const order = await checkout();
    session.payment_status = 'paid';
    await notification();
    const request = randomUUID();
    await service.refund(user.account, dao, order.id, request, 400);
    expect(refundParams.has('refund_application_fee')).toBe(false);
    await service.refund(user.account, dao, order.id, request, 400);
    expect(refundRequests).toBe(1);
  });
});

it('binds existing merchant OAuth to the initiating session and consumes its code only once', async () => {
  await pool.query("UPDATE dao_merchants SET state='disconnected' WHERE dao_key=$1", [
    daoPaymentKey(dao),
  ]);
  const auth = await service.onboard(user.account, dao, 'existing', 'session-bound');
  const state = new URL(auth.url).searchParams.get('state');
  if (!state) throw new Error('No state');
  await expect(
    service.callback(user.account, 'other-session', state, 'code_fixture'),
  ).rejects.toMatchObject({ code: 'PAYMENT_OAUTH_INVALID' });
  const url = await service.callback(user.account, 'session-bound', state, 'code_fixture');
  expect(url).toContain('/payments');
  await expect(
    service.callback(user.account, 'session-bound', state, 'code_fixture'),
  ).rejects.toMatchObject({ code: 'PAYMENT_OAUTH_INVALID' });
  expect(requests.filter((r) => r.path === '/oauth/token')).toHaveLength(1);
});
it('requests hosted full-dashboard merchant onboarding without exposing provider keys', async () => {
  await pool.query('DELETE FROM dao_payment_products WHERE dao_key=$1', [daoPaymentKey(dao)]);
  await pool.query('DELETE FROM dao_merchants WHERE dao_key=$1', [daoPaymentKey(dao)]);
  const result = await service.onboard(user.account, dao, 'new', 'session-bound');
  expect(result.url).toBe('https://connect.stripe.com/setup/fixture');
  const create = requests.find((r) => r.path === '/v2/core/accounts');
  expect(create).toBeDefined();
  expect(create?.headers.get('idempotency-key')).toMatch(/^dao-merchant-/);
  expect(create?.headers.get('stripe-context')).toBeNull();
});

it('retains the first checkout return address as an immutable order snapshot', async () => {
  const order = await checkout();
  const saved = await pool.query<{ return_url: string }>(
    'SELECT return_url FROM dao_payment_orders WHERE id=$1',
    [order.id],
  );
  expect(saved.rows[0]?.return_url).toContain('/payments');
  await expect(
    pool.query("UPDATE dao_payment_orders SET return_url='https://other.example' WHERE id=$1", [
      order.id,
    ]),
  ).rejects.toThrow('immutable');
});
