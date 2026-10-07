import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { HostedSubscriptions } from '../../services/api/src/billing/hosting.js';
import { migrate } from '../../services/api/src/store.js';
import { STRIPE_API_VERSION } from '../../services/api/src/billing/stripe.js';
import { AccountSchema, NetworkSchema, UserMembershipSchema } from '../../protocol/api.js';
import {
  hostedPricingHash,
  hostedMonthlyPrice,
  HostingChainSchema,
} from '../../protocol/hosting.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
const database = process.env.DATABASE_URL;
if (
  !database ||
  !new URL(database).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(database).hostname)
)
  throw new Error('Owned test DB required');
const pool = new Pool({ connectionString: database });
const encryptionKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const account = AccountSchema.parse({
  id: randomUUID(),
  signingKey: PrivateKey.generate('K1').toPublic().toString(),
  encryptionKey: { kty: 'EC', crv: 'P-256', x: encryptionKey.x, y: encryptionKey.y },
  custody: 'user-controlled',
});
let dao = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '0',
  interfaceVersion: 1 as const,
};
let pricing = {
  freeSlots: 10,
  rates: { first_usd: 100, next_usd: 50, rest_usd: 20, revision: '0' },
};
let capacity = 10,
  expires: number | null = null,
  receipt: string | null = null;
let failures = 0,
  attestations = 0;
const unavailable = async (): Promise<never> => {
  throw new Error('Not in fixture');
};
const chain: ChainGateway = {
  network: async () =>
    NetworkSchema.parse({
      chainId: dao.chainId,
      runtime: dao.contract,
      rpcUrl: 'http://localhost:18888',
      hub: 'daclifyhub',
      environment: 'local',
      coreVersion: '0.7.0-alpha.1',
      interfaceVersion: 1,
      capabilities: [],
    }),
  hosting: async () =>
    HostingChainSchema.parse({
      dao,
      pricing,
      activeMembers: 10,
      effectiveCapacity: capacity,
      expires,
      receipt,
      exempt: false,
    }),
  attestCapacity: async (_, members, end, reference) => {
    attestations++;
    nativeReceipts.set(reference, { members, end });
    if (end > (expires ?? 0) || (end === expires && members > capacity) || !expires) {
      capacity = members;
      expires = end;
      receipt = reference;
    }
    if (failures-- > 0) throw new Error('Lost chain response');
  },
  restoreCapacity: async (_, reference) => {
    const saved = nativeReceipts.get(reference);
    if (!saved) throw new Error('No issued receipt');
    capacity = saved.members;
    expires = saved.end;
    receipt = reference;
  },
  revokeCapacity: async (_, reference) => {
    if (receipt === reference) {
      capacity = 10;
      expires = 0;
      receipt = null;
    }
  },
  memberships: async () => [
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
    }),
  ],
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
  secretKey: 'sk_test_hostingfixture',
  webhookSecret: 'whsec_hostingfixture',
  frontendOrigin: 'http://localhost:5178',
  productId: 'prod_' + randomUUID().replaceAll('-', ''),
  livemode: false,
  liveChargesEnabled: false,
};
let checkout: Record<string, unknown> = {},
  subscription: Record<string, unknown> = {},
  invoice: Record<string, unknown> = {},
  price: Record<string, unknown> = {};
let updateCount = 0;
let loseCheckout = false,
  paymentPending = false;
const prices = new Map<string, Record<string, unknown>>(),
  invoices = new Map<string, Record<string, unknown>>(),
  refunds = new Map<string, number>();
const prorations: string[] = [];
const nativeReceipts = new Map<string, { members: number; end: number }>(),
  disputes = new Map<string, string>();
const stripe = new Stripe(config.secretKey, {
  apiVersion: STRIPE_API_VERSION,
  maxNetworkRetries: 0,
  httpClient: Stripe.createFetchHttpClient(async (input, init) => {
    const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input : input.url,
      ),
      body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    let response: unknown;
    if (url.pathname === '/v1/prices' && init?.method === 'POST') {
      price = {
        id: 'price_' + randomUUID().replaceAll('-', ''),
        object: 'price',
        livemode: false,
        product: config.productId,
        currency: 'usd',
        billing_scheme: 'tiered',
        tiers_mode: 'graduated',
        recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
        tiers: [
          { up_to: 40, unit_amount: Number(body.get('tiers[0][unit_amount]')), flat_amount: null },
          { up_to: 240, unit_amount: Number(body.get('tiers[1][unit_amount]')), flat_amount: null },
          {
            up_to: null,
            unit_amount: Number(body.get('tiers[2][unit_amount]')),
            flat_amount: null,
          },
        ],
      };
      prices.set(String(price.id), price);
      response = price;
    } else if (url.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
      price = prices.get(body.get('line_items[0][price]') ?? '') ?? price;
      const quantity = Number(body.get('line_items[0][quantity]'));
      const total = hostedMonthlyPrice(quantity, pricing);
      const metadata = {
        purpose: 'dao-hosting',
        agreement_id: body.get('metadata[agreement_id]'),
        dao_key: body.get('metadata[dao_key]'),
      };
      checkout = {
        id: 'cs_' + randomUUID().replaceAll('-', ''),
        object: 'checkout.session',
        metadata,
        livemode: false,
        mode: 'subscription',
        status: 'open',
        payment_status: 'unpaid',
        subscription: null,
        url: 'https://checkout.stripe.com/c/pay/hosting',
        line_items: {
          data: [{ price, quantity: Number(body.get('line_items[0][quantity]')) }],
          has_more: false,
        },
      };
      const subId = 'sub_' + randomUUID().replaceAll('-', ''),
        end = Math.floor(Date.now() / 1000) + 2592000;
      subscription = {
        id: subId,
        object: 'subscription',
        metadata,
        livemode: false,
        status: 'active',
        currency: 'usd',
        collection_method: 'charge_automatically',
        application_fee_percent: null,
        cancel_at_period_end: false,
        pending_update: null,
        items: {
          data: [
            {
              id: 'si_fixture',
              price,
              quantity: Number(body.get('line_items[0][quantity]')),
              current_period_end: end,
            },
          ],
          has_more: false,
        },
        latest_invoice: 'in_' + randomUUID().replaceAll('-', ''),
      };
      invoice = {
        id: subscription.latest_invoice,
        object: 'invoice',
        livemode: false,
        status: 'open',
        currency: 'usd',
        amount_remaining: total,
        amount_paid: 0,
        subtotal: total,
        billing_reason: 'subscription_create',
        hosted_invoice_url: 'https://invoice.stripe.com/i/fixture',
        parent: { type: 'subscription_details', subscription_details: { subscription: subId } },
        lines: {
          has_more: false,
          data: [
            {
              quantity: Number(body.get('line_items[0][quantity]')),
              pricing: { price_details: { price: price.id } },
              period: { end },
            },
          ],
        },
      };
      invoices.set(String(invoice.id), invoice);
      if (loseCheckout) {
        loseCheckout = false;
        throw new Error('Lost provider response');
      }
      response = checkout;
    } else if (url.pathname.startsWith('/v1/checkout/sessions/')) response = checkout;
    else if (url.pathname.startsWith('/v1/subscriptions/') && init?.method === 'POST') {
      updateCount++;
      if (body.has('cancel_at_period_end'))
        subscription.cancel_at_period_end = body.get('cancel_at_period_end') === 'true';
      else {
        prorations.push(body.get('proration_behavior') ?? '');
        const items = z
          .object({ data: z.array(z.record(z.string(), z.unknown())), has_more: z.boolean() })
          .parse(subscription.items);
        const selected = prices.get(body.get('items[0][price]') ?? '');
        if (!selected || !items.data[0]) throw new Error('Missing update price');
        const quantity = Number(body.get('items[0][quantity]'));
        if (paymentPending) {
          subscription.pending_update = { expires_at: Math.floor(Date.now() / 1000) + 3600 };
        } else {
          items.data[0].quantity = quantity;
          items.data[0].price = selected;
          subscription.items = items;
          subscription.pending_update = null;
        }
        if (body.get('proration_behavior') === 'always_invoice') {
          const end = z.number().parse(items.data[0].current_period_end);
          invoice = {
            ...invoice,
            id: 'in_' + randomUUID().replaceAll('-', ''),
            billing_reason: 'subscription_update',
            status: paymentPending ? 'open' : 'paid',
            amount_remaining: paymentPending ? 100 : 0,
            amount_paid: paymentPending ? 0 : 100,
            subtotal: 100,
            lines: {
              has_more: false,
              data: [
                { quantity, pricing: { price_details: { price: selected.id } }, period: { end } },
              ],
            },
          };
          subscription.latest_invoice = invoice.id;
          invoices.set(String(invoice.id), invoice);
        }
      }
      response = subscription;
    } else if (url.pathname.startsWith('/v1/subscriptions/')) response = subscription;
    else if (url.pathname.startsWith('/v1/invoices/'))
      response = invoices.get(url.pathname.split('/').at(-1) ?? '');
    else if (url.pathname === '/v1/invoice_payments') {
      const id = url.searchParams.get('invoice') ?? invoice.id;
      const record = invoices.get(String(id));
      if (!record) throw new Error('Unknown fixture invoice');
      response = {
        object: 'list',
        data: [
          {
            id: 'inpay_fixture',
            invoice: record.id,
            status: 'paid',
            livemode: false,
            currency: 'usd',
            amount_paid: record.amount_paid,
            payment: { type: 'payment_intent', payment_intent: 'pi_' + record.id },
          },
        ],
        has_more: false,
      };
    } else if (url.pathname.startsWith('/v1/payment_intents/')) {
      const id = url.pathname.split('/').at(-1) ?? '',
        invoiceId = id.slice(3),
        record = invoices.get(invoiceId);
      if (!record) throw new Error('Unknown fixture intent');
      response = {
        id,
        object: 'payment_intent',
        livemode: false,
        currency: 'usd',
        status: 'succeeded',
        amount_received: record.amount_paid,
        latest_charge: {
          id: 'ch_' + invoiceId,
          payment_intent: id,
          paid: true,
          amount: record.amount_paid,
          amount_refunded: refunds.get(invoiceId) ?? 0,
          disputed: disputes.has(invoiceId),
          currency: 'usd',
          livemode: false,
        },
      };
    } else if (url.pathname === '/v1/disputes') {
      const intentId = url.searchParams.get('payment_intent') ?? '';
      response = {
        object: 'list',
        data: [{ status: disputes.get(intentId.slice(3)) }],
        has_more: false,
      };
    } else
      return Response.json(
        { error: { message: 'Unexpected hosting fixture route' } },
        { status: 404 },
      );
    return Response.json(response);
  }),
});
const service = new HostedSubscriptions(pool, chain, config, stripe);
const input = (extraSlots = 10) => ({
  dao,
  requestId: randomUUID(),
  extraSlots,
  pricingHash: hostedPricingHash(pricing),
  monthlyUsdCents: hostedMonthlyPrice(extraSlots, pricing),
  acceptCurrentPricing: false,
});
async function paidWebhook() {
  checkout.status = 'complete';
  checkout.subscription = subscription.id;
  checkout.payment_status = 'paid';
  invoice.status = 'paid';
  invoice.amount_paid = invoice.subtotal;
  invoice.amount_remaining = 0;
  const raw = Buffer.from(
    JSON.stringify({
      id: 'evt_' + randomUUID().replaceAll('-', ''),
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: checkout },
    }),
  );
  await service.webhook(
    raw,
    stripe.webhooks.generateTestHeaderString({
      payload: raw.toString(),
      secret: config.webhookSecret,
    }),
  );
}
beforeAll(async () => {
  await migrate(pool);
  await pool.query(
    "INSERT INTO accounts(id,signing_key,encryption_key,custody)VALUES($1,$2,$3,'user-controlled')",
    [account.id, account.signingKey, account.encryptionKey],
  );
});
beforeEach(() => {
  dao = { ...dao, daoId: BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)).toString() };
  capacity = 10;
  expires = null;
  receipt = null;
  failures = 0;
  attestations = 0;
  updateCount = 0;
  loseCheckout = false;
  paymentPending = false;
  prorations.length = 0;
  pricing = { freeSlots: 10, rates: { first_usd: 100, next_usd: 50, rest_usd: 20, revision: '0' } };
});
afterAll(() => pool.end());
it('rejects changed or unapproved prices before opening a subscription', async () => {
  await expect(service.change(account, { ...input(), monthlyUsdCents: 1 })).rejects.toMatchObject({
    code: 'HOSTING_APPROVAL_CHANGED',
  });
  await expect(
    service.change(account, { ...input(), pricingHash: 'cd'.repeat(32) }),
  ).rejects.toMatchObject({ code: 'HOSTING_APPROVAL_CHANGED' });
});
it('gates capacity until a verified paid invoice and retries a lost chain response', async () => {
  const request = input();
  const pending = await service.change(account, request);
  expect(pending.effectiveCapacity).toBe(10);
  expect(pending.subscription?.state).toBe('pending');
  failures = 1;
  await paidWebhook();
  expect(capacity).toBe(10); // queued; the browser return grants no entitlement
  const job = await pool.query<{ invoice_id: string }>(
    'SELECT invoice_id FROM hosting_invoices WHERE subscription_id=$1',
    [pending.subscription?.id],
  );
  const invoiceId = job.rows[0]?.invoice_id;
  if (!invoiceId) throw new Error('No durable invoice');
  await expect(service.attest(invoiceId)).rejects.toThrow('Lost chain response');
  await service.attest(invoiceId);
  expect(capacity).toBe(20);
  expect(attestations).toBe(2);
  expect((await service.status(account, dao)).subscription?.monthlyUsdCents).toBe(1000);
});
it('keeps accepted rates and cancellation capacity through the paid period', async () => {
  const initial = await service.change(account, input());
  await paidWebhook();
  const record = await pool.query<{ invoice_id: string }>(
    'SELECT invoice_id FROM hosting_invoices WHERE subscription_id=$1',
    [initial.subscription?.id],
  );
  const id = record.rows[0]?.invoice_id;
  if (!id) throw new Error('No invoice');
  await service.attest(id);
  pricing = { freeSlots: 10, rates: { first_usd: 125, next_usd: 60, rest_usd: 25, revision: '1' } };
  const status = await service.status(account, dao);
  expect(status.subscription?.monthlyUsdCents).toBe(1000);
  if (!status.subscription) throw new Error('Subscription missing');
  const cancel = await service.change(account, {
    ...input(0),
    pricingHash: hostedPricingHash(status.subscription.pricing),
    monthlyUsdCents: 0,
  });
  expect(cancel.subscription?.state).toBe('canceling');
  expect(cancel.effectiveCapacity).toBe(20);
  expect(updateCount).toBe(1);
});

it('resumes a stored checkout request after a lost response without approving a second agreement', async () => {
  const request = input();
  loseCheckout = true;
  await expect(service.change(account, request)).rejects.toThrow();
  const pending = await service.status(account, dao);
  expect(pending.subscription?.requestId).toBe(request.requestId);
  expect(pending.subscription?.checkoutUrl).toBeNull();
  await expect(
    service.change(account, { ...request, requestId: randomUUID() }),
  ).rejects.toMatchObject({ code: 'HOSTING_REQUEST_CONFLICT' });
  const resumed = await service.change(account, request);
  expect(resumed.subscription?.id).toBe(pending.subscription?.id);
  expect(resumed.subscription?.checkoutUrl).toContain('checkout.stripe.com');
});
it('requires captured consent for quantity changes and retains purchased capacity on a decrease', async () => {
  const initial = await service.change(account, input());
  await paidWebhook();
  await service.attest(String(invoice.id));
  await expect(
    pool.query('UPDATE hosting_subscriptions SET extra_slots=20 WHERE id=$1', [
      initial.subscription?.id,
    ]),
  ).rejects.toThrow('captured consent');
  paymentPending = true;
  const upgrade = await service.change(account, input(20));
  expect(upgrade.subscription?.pendingChange?.extraSlots).toBe(20);
  expect(capacity).toBe(20);
  expect(prorations.at(-1)).toBe('always_invoice');
  const items = z
    .object({ data: z.array(z.record(z.string(), z.unknown())), has_more: z.boolean() })
    .parse(subscription.items);
  if (!items.data[0]) throw new Error('Missing item');
  items.data[0].quantity = 20;
  subscription.items = items;
  subscription.pending_update = null;
  paymentPending = false;
  invoice.status = 'paid';
  invoice.amount_paid = 100;
  invoice.amount_remaining = 0;
  await service.status(account, dao);
  await service.attest(String(invoice.id));
  expect(capacity).toBe(30);
  const decrease = await service.change(account, input(5));
  expect(decrease.subscription?.monthlyUsdCents).toBe(500);
  expect(decrease.effectiveCapacity).toBe(30);
  expect(prorations.at(-1)).toBe('none');
  const result = await pool.query('SELECT members FROM hosting_invoices WHERE invoice_id=$1', [
    invoice.id,
  ]);
  expect(result.rows[0]?.members).toBe(30);
});
it('revokes a fully refunded upgrade and can restore the unrefunded earlier receipt', async () => {
  await service.change(account, input());
  await paidWebhook();
  const first = String(invoice.id);
  await service.attest(first);
  await service.change(account, input(20));
  const second = String(invoice.id);
  await service.attest(second);
  expect(capacity).toBe(30);
  refunds.set(second, 100);
  await service.attest(second);
  expect(capacity).toBe(10);
  await service.attest(first);
  expect(capacity).toBe(20);
  await expect(
    pool.query('UPDATE hosting_invoices SET members=100 WHERE invoice_id=$1', [first]),
  ).rejects.toThrow('immutable');
});

it('revokes a prorated upgrade when its original period payment is refunded', async () => {
  await service.change(account, input());
  await paidWebhook();
  const first = String(invoice.id);
  await service.attest(first);
  await service.change(account, input(20));
  const second = String(invoice.id);
  await service.attest(second);
  expect(capacity).toBe(30);
  refunds.set(first, 1000);
  await service.attest(first);
  await service.attest(second);
  expect(capacity).toBe(10);
  const row = await pool.query(
    'SELECT base_invoice,state FROM hosting_invoices WHERE invoice_id=$1',
    [second],
  );
  expect(row.rows[0]).toMatchObject({ base_invoice: first, state: 'revoked' });
  await expect(
    pool.query('UPDATE hosting_invoices SET base_invoice=NULL WHERE invoice_id=$1', [second]),
  ).rejects.toThrow('immutable');
});

it('restores the same verified paid-period entitlements when an opened dispute is won', async () => {
  await service.change(account, input());
  await paidWebhook();
  const first = String(invoice.id);
  await service.attest(first);
  await service.change(account, input(20));
  const second = String(invoice.id);
  await service.attest(second);
  disputes.set(first, 'under_review');
  await service.attest(first);
  await service.attest(second);
  expect(capacity).toBe(10);
  disputes.set(first, 'won');
  await service.attest(first);
  expect(capacity).toBe(20);
  await service.attest(second);
  expect(capacity).toBe(30);
});
