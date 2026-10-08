import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { HostedStorage } from '../../services/api/src/billing/storage.js';
import { createServer } from '../../services/api/src/server.js';
import { controlledInject } from '../helpers/account-control.js';
import { ChallengeSchema, SessionSchema } from '../../protocol/api.js';
import { STRIPE_API_VERSION } from '../../services/api/src/billing/stripe.js';
import { calendarMonthAt } from '../../services/api/src/billing/storage-period.js';
import { migrate } from '../../services/api/src/store.js';
import { AccountSchema, NetworkSchema, UserMembershipSchema } from '../../protocol/api.js';
import { DEFAULT_RESOURCE_POLICY } from '../../protocol/resources.js';
import { ResourcePolicySchema } from '../../protocol/resources.js';
import { DaoRefSchema } from '../../protocol/base.js';
import {
  StorageApprovalSchema,
  DEFAULT_STORAGE_PRICING,
  storagePricingHash,
} from '../../protocol/storage.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
const encryption = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const rootKey = PrivateKey.generate('K1');
const account = AccountSchema.parse({
  id: randomUUID(),
  signingKey: rootKey.toPublic().toString(),
  encryptionKey: { kty: 'EC', crv: 'P-256', x: encryption.x, y: encryption.y },
  custody: 'user-controlled',
});
beforeAll(async () => {
  await migrate(pool);
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
    [account.id, account.signingKey, account.custody, account.encryptionKey],
  );
});
afterAll(() => pool.end());
const unavailable = async (): Promise<never> => {
  throw new Error('Not part of this fixture');
};
function setup() {
  const dao = DaoRefSchema.parse({
    chainId: 'ef'.repeat(32),
    contract: 'daclifycore',
    daoId: BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 16)).toString(),
    interfaceVersion: 1,
  });
  let admin = true,
    wrongReceipt = '',
    refund = 0,
    lost = false,
    paymentPending = false;
  let policy = DEFAULT_RESOURCE_POLICY;
  const config = {
    secretKey: 'sk_test_' + 'a'.repeat(24),
    webhookSecret: 'whsec_' + 'b'.repeat(24),
    productId: 'prod_' + randomUUID().replaceAll('-', ''),
    frontendOrigin: 'http://localhost:5208',
    livemode: false,
    liveChargesEnabled: false,
    providerScope: randomUUID(),
  };
  const chain: ChainGateway = {
    network: async () =>
      NetworkSchema.parse({
        chainId: dao.chainId,
        runtime: dao.contract,
        rpcUrl: 'http://localhost:20588',
        hub: null,
        environment: 'local',
        interfaceVersion: 1,
        coreVersion: '0.7.0-alpha.1',
        capabilities: [],
      }),
    resourcePolicy: async () => policy,
    memberships: async () => [
      UserMembershipSchema.parse({
        dao,
        memberId: '1',
        nonce: '0',
        active: true,
        admin,
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
    listDaos: unavailable,
    memberProfile: unavailable,
    createDao: unavailable,
    relay: unavailable,
  };
  const priceId = 'price_' + randomUUID().replaceAll('-', ''),
    subId = 'sub_' + randomUUID().replaceAll('-', ''),
    checkoutId = 'cs_' + randomUUID().replaceAll('-', ''),
    invoiceId = 'in_' + randomUUID().replaceAll('-', '');
  let metadata: Record<string, string> = {},
    quantity = 1,
    initialQuantity = 1,
    upgradedQuantity: number | null = null,
    upgrading = false,
    canceling = false,
    scheduled = false,
    creates = 0;
  const upgradeInvoice = 'in_upgrade' + randomUUID().replaceAll('-', '');
  const scheduleId = 'sub_sched_' + randomUUID().replaceAll('-', '');
  const start = Math.floor(Date.now() / 1000) - 60,
    end = Date.parse(calendarMonthAt(new Date(start * 1000).toISOString(), 1)) / 1000;
  const price = () => ({
    id: priceId,
    object: 'price',
    livemode: false,
    currency: 'usd',
    unit_amount: 100,
    billing_scheme: 'per_unit',
    product: config.productId,
    recurring: {
      interval: 'month',
      interval_count: 1,
      usage_type: wrongReceipt === 'metered' ? 'metered' : 'licensed',
    },
  });
  const checkout = () => ({
    id: checkoutId,
    object: 'checkout.session',
    livemode: false,
    mode: 'subscription',
    metadata,
    status: 'complete',
    payment_status: paymentPending ? 'unpaid' : 'paid',
    subscription: paymentPending ? null : subId,
    url: 'https://checkout.stripe.com/c/pay/storage',
    line_items: { data: [{ price: price(), quantity }], has_more: false },
  });
  const subscription = () => ({
    id: subId,
    object: 'subscription',
    livemode: false,
    currency: wrongReceipt === 'currency' ? 'eur' : 'usd',
    metadata,
    status: 'active',
    collection_method: 'charge_automatically',
    application_fee_percent: null,
    transfer_data: null,
    cancel_at_period_end: canceling,
    pending_update: upgrading && paymentPending ? {} : null,
    latest_invoice: upgrading ? upgradeInvoice : invoiceId,
    billing_cycle_anchor: wrongReceipt === 'period' ? start - 1 : start,
    items: {
      data: [
        {
          id: 'si_fixture',
          price: price(),
          quantity: upgradedQuantity !== null && !paymentPending ? upgradedQuantity : quantity,
          current_period_start: start,
          current_period_end: end,
        },
      ],
      has_more: false,
    },
  });
  const invoice = (base = false) => ({
    id: upgrading && !base ? upgradeInvoice : invoiceId,
    object: 'invoice',
    livemode: false,
    currency: 'usd',
    status: !base && paymentPending ? 'open' : 'paid',
    amount_paid:
      !base && paymentPending
        ? 0
        : upgrading && !base
          ? ((upgradedQuantity ?? quantity) - initialQuantity) * 50
          : initialQuantity * 100,
    amount_remaining: !base && paymentPending ? 100 : 0,
    total:
      upgrading && !base
        ? ((upgradedQuantity ?? quantity) - initialQuantity) * 50
        : initialQuantity * 100,
    subtotal:
      upgrading && !base
        ? ((upgradedQuantity ?? quantity) - initialQuantity) * 50
        : initialQuantity * 100,
    billing_reason: upgrading && !base ? 'subscription_update' : 'subscription_create',
    hosted_invoice_url: 'https://invoice.stripe.com/i/storage',
    parent: { type: 'subscription_details', subscription_details: { subscription: subId } },
    lines: {
      data: [
        {
          quantity: upgrading && !base ? upgradedQuantity : initialQuantity,
          pricing: { price_details: { price: priceId } },
          period: { start: upgrading && !base ? start + 30 : start, end },
        },
      ],
      has_more: false,
    },
  });
  const stripe = new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const address = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input : input.url,
        ),
        body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      let result: unknown;
      if (address.pathname === '/v1/prices' && init?.method === 'POST') result = price();
      else if (address.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
        creates++;
        quantity = Number(body.get('line_items[0][quantity]'));
        initialQuantity = quantity;
        metadata = {
          purpose: body.get('metadata[purpose]') ?? '',
          agreement_id: body.get('metadata[agreement_id]') ?? '',
          dao_key: body.get('metadata[dao_key]') ?? '',
          provider_scope: body.get('metadata[provider_scope]') ?? '',
        };
        if (lost) {
          lost = false;
          throw new Error('Simulated lost checkout response');
        }
        result = checkout();
      } else if (address.pathname.startsWith('/v1/checkout/sessions/')) result = checkout();
      else if (address.pathname.startsWith('/v1/subscriptions/')) {
        if (init?.method === 'POST') {
          canceling = body.get('cancel_at_period_end') === 'true';
          const next = body.get('items[0][quantity]');
          if (next) {
            upgrading = true;
            upgradedQuantity = Number(next);
          }
        }
        result = subscription();
      } else if (address.pathname.startsWith('/v1/subscription_schedules')) {
        scheduled = true;
        result = { id: scheduleId, object: 'subscription_schedule', livemode: false };
      } else if (address.pathname.startsWith('/v1/invoices/'))
        result = invoice(address.pathname.endsWith('/' + invoiceId));
      else if (address.pathname === '/v1/invoice_payments')
        result = {
          object: 'list',
          has_more: false,
          data: [
            {
              id: 'inpay_fixture',
              invoice: address.searchParams.get('invoice') ?? invoiceId,
              livemode: false,
              currency: 'usd',
              amount_paid:
                address.searchParams.get('invoice') === upgradeInvoice
                  ? ((upgradedQuantity ?? quantity) - initialQuantity) * 50
                  : initialQuantity * 100,
              status: 'paid',
              payment: {
                type: 'payment_intent',
                payment_intent:
                  address.searchParams.get('invoice') === upgradeInvoice
                    ? 'pi_upgrade'
                    : 'pi_fixture',
              },
            },
          ],
        };
      else if (address.pathname.startsWith('/v1/payment_intents/'))
        result = {
          id:
            wrongReceipt === 'intent'
              ? 'pi_other'
              : address.pathname.endsWith('/pi_upgrade')
                ? 'pi_upgrade'
                : 'pi_fixture',
          object: 'payment_intent',
          livemode: false,
          currency: 'usd',
          status: 'succeeded',
          amount_received: address.pathname.endsWith('/pi_upgrade')
            ? ((upgradedQuantity ?? quantity) - initialQuantity) * 50
            : initialQuantity * 100,
          latest_charge: {
            id: 'ch_fixture',
            paid: true,
            livemode: false,
            currency: 'usd',
            payment_intent: address.pathname.endsWith('/pi_upgrade') ? 'pi_upgrade' : 'pi_fixture',
            amount: address.pathname.endsWith('/pi_upgrade')
              ? ((upgradedQuantity ?? quantity) - initialQuantity) * 50
              : initialQuantity * 100,
            amount_refunded: refund,
            disputed: false,
          },
        };
      else throw new Error('Unexpected simulated Stripe request');
      return Response.json(result);
    }),
  });
  const service = new HostedStorage(pool, chain, config, DEFAULT_STORAGE_PRICING, stripe);
  const approval = StorageApprovalSchema.parse({
    schemaVersion: 1,
    requestId: randomUUID(),
    dao,
    units: 1,
    pricingHash: storagePricingHash(DEFAULT_STORAGE_PRICING),
    monthlyUsdCents: 100,
    recurringConsent: true,
  });
  async function webhook(
    type = 'checkout.session.completed',
    id = 'evt_' + randomUUID().replaceAll('-', ''),
    live = false,
  ) {
    const body = JSON.stringify({
      id,
      object: 'event',
      type,
      livemode: live,
      data: { object: type.startsWith('checkout.') ? checkout() : invoice() },
    });
    await service.webhook(
      Buffer.from(body),
      stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret }),
    );
  }
  return {
    dao,
    config,
    service,
    chain,
    approval,
    webhook,
    creates: () => creates,
    setAdmin: (value: boolean) => {
      admin = value;
    },
    setRefund: (value: number) => {
      refund = value;
    },
    setLost: () => {
      lost = true;
    },
    setPending: (value: boolean) => {
      paymentPending = value;
    },
    setWrongReceipt: (value: string) => {
      wrongReceipt = value;
    },
    setPolicyPrice: () => {
      policy = ResourcePolicySchema.parse({
        ...policy,
        storage: { ...policy.storage, revision: '1', monthlyUnitUsdCents: 200 },
      });
    },
    scheduled: () => scheduled,
  };
}
it('does not provision paid capacity from a checkout link; grants only after invoice/intent/charge verification', async () => {
  const fixture = setup();
  const pending = await fixture.service.approve(account, fixture.approval);
  expect(pending.subscription?.checkoutUrl).toContain('checkout.stripe.com');
  expect(pending.funding.uploadCapacityBytes).toBe('100000000');
  await fixture.webhook();
  expect((await fixture.service.status(account, fixture.dao)).funding).toMatchObject({
    state: 'active',
    uploadCapacityBytes: '1100000000',
  });
  const before = (await fixture.service.status(account, fixture.dao)).funding.graceEndsAt;
  fixture.setRefund(1);
  await fixture.webhook();
  expect((await fixture.service.status(account, fixture.dao)).funding).toMatchObject({
    state: 'grace',
    uploadCapacityBytes: '100000000',
    graceEndsAt: before,
  });
});
it('requires exact administrator consent and rejects a deployment or amount mismatch before checkout', async () => {
  const fixture = setup();
  fixture.setAdmin(false);
  await expect(fixture.service.approve(account, fixture.approval)).rejects.toThrow(
    'STORAGE_ADMIN_REQUIRED',
  );
  fixture.setAdmin(true);
  await expect(
    fixture.service.approve(account, {
      ...fixture.approval,
      dao: { ...fixture.dao, contract: 'other' },
    }),
  ).rejects.toThrow('DAO_REFERENCE');
  await expect(
    fixture.service.approve(account, { ...fixture.approval, monthlyUsdCents: 1 }),
  ).rejects.toThrow('STORAGE_APPROVAL_CHANGED');
  expect(fixture.creates()).toBe(0);
});
it('holds failed first payments and reuses an exact retry after a lost response', async () => {
  const fixture = setup();
  fixture.setLost();
  await expect(fixture.service.approve(account, fixture.approval)).rejects.toThrow();
  fixture.setPending(true);
  await fixture.service.approve(account, fixture.approval);
  await fixture.webhook();
  expect((await fixture.service.status(account, fixture.dao)).funding.uploadCapacityBytes).toBe(
    '100000000',
  );
  fixture.setPending(false);
  await fixture.webhook();
  expect((await fixture.service.status(account, fixture.dao)).funding.uploadCapacityBytes).toBe(
    '1100000000',
  );
});
it.each(['metered', 'currency', 'period', 'intent'])(
  'rejects a %s provider receipt without granting paid storage',
  async (kind) => {
    const fixture = setup();
    await fixture.service.approve(account, fixture.approval);
    fixture.setWrongReceipt(kind);
    await expect(fixture.webhook()).rejects.toThrow('STORAGE_RECEIPT_INVALID');
    const result = await pool.query<{ count: string }>(
      'SELECT count(*) FROM storage_invoices i JOIN storage_subscriptions s ON s.id=i.subscription_id WHERE s.dao_key=$1',
      [JSON.stringify([fixture.dao.chainId, fixture.dao.contract, fixture.dao.daoId])],
    );
    expect(result.rows[0]?.count).toBe('0');
  },
);
it('deduplicates signed events, rejects contradictory event IDs and wrong modes', async () => {
  const fixture = setup();
  await fixture.service.approve(account, fixture.approval);
  const id = 'evt_' + randomUUID().replaceAll('-', '');
  await fixture.webhook('checkout.session.completed', id);
  await fixture.webhook('checkout.session.completed', id);
  fixture.setRefund(1);
  await expect(fixture.webhook('invoice.paid', id)).rejects.toThrow('STORAGE_EVENT_CONFLICT');
  await expect(fixture.webhook('invoice.paid', undefined, true)).rejects.toThrow('BILLING_MODE');
  await expect(fixture.service.webhook(Buffer.from('{}'), 'invalid')).rejects.toThrow(
    'SIGNATURE_INVALID',
  );
});
it('retains agreed prices, and a retried initial approval cannot create a second subscription change', async () => {
  const fixture = setup();
  await fixture.service.approve(account, fixture.approval);
  await fixture.webhook();
  fixture.setPolicyPrice();
  const retried = await fixture.service.approve(account, fixture.approval);
  expect(retried.subscription?.monthlyUsdCents).toBe(100);
  expect(retried.currentPricing?.monthlyUnitUsdCents).toBe(200);
  expect(retried.subscription?.pending).toBeNull();
  await expect(
    fixture.service.approve(account, {
      ...fixture.approval,
      requestId: randomUUID(),
      monthlyUsdCents: 200,
    }),
  ).rejects.toThrow('STORAGE_APPROVAL_CHANGED');
  expect(fixture.creates()).toBe(1);
});
it('keeps paid base capacity during authentication and verifies upgrade dependencies before raising it', async () => {
  const fixture = setup();
  await fixture.service.approve(account, fixture.approval);
  await fixture.webhook();
  fixture.setPending(true);
  const upgrade = { ...fixture.approval, requestId: randomUUID(), units: 2, monthlyUsdCents: 200 };
  const waiting = await fixture.service.approve(account, upgrade);
  expect(waiting.funding.uploadCapacityBytes).toBe('1100000000');
  expect(waiting.subscription?.pending?.units).toBe(2);
  fixture.setPending(false);
  const funded = await fixture.service.status(account, fixture.dao);
  expect(funded.funding.uploadCapacityBytes).toBe('2100000000');
  expect(funded.subscription?.pending).toBeNull();
  expect(
    (
      await pool.query('SELECT base_invoice FROM storage_invoices WHERE approval_id=$1', [
        upgrade.requestId,
      ])
    ).rows[0]?.base_invoice,
  ).toMatch(/^in_/);
  expect((await fixture.service.approve(account, upgrade)).funding.uploadCapacityBytes).toBe(
    '2100000000',
  );
});
it('schedules reduced capacity and cancellation without revoking the already paid period', async () => {
  const fixture = setup();
  await fixture.service.approve(account, { ...fixture.approval, units: 2, monthlyUsdCents: 200 });
  await fixture.webhook();
  const reduced = await fixture.service.approve(account, {
    ...fixture.approval,
    requestId: randomUUID(),
  });
  expect(fixture.scheduled()).toBe(true);
  expect(reduced.funding.uploadCapacityBytes).toBe('2100000000');
  expect(reduced.subscription?.pending?.effectiveAt).not.toBeNull();
  const other = setup();
  await other.service.approve(account, other.approval);
  await other.webhook();
  const stopped = await other.service.approve(account, {
    ...other.approval,
    requestId: randomUUID(),
    units: 0,
    monthlyUsdCents: 0,
    recurringConsent: false,
  });
  expect(stopped.subscription?.state).toBe('canceling');
  expect(stopped.funding.uploadCapacityBytes).toBe('1100000000');
});
it('requires session, CSRF, fresh signed intent and current administrator access at the API boundary', async () => {
  const fixture = setup(),
    origin = 'http://localhost:5208';
  const app = await createServer(pool, fixture.chain, origin, { hostedStorage: fixture.service });
  try {
    const path = '/v1/storage/billing?dao=' + encodeURIComponent(JSON.stringify(fixture.dao));
    expect((await app.inject({ url: path })).statusCode).toBe(401);
    const challenge = ChallengeSchema.parse(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/challenge',
          headers: { origin },
          payload: { signingKey: account.signingKey },
        })
      ).json(),
    );
    const loggedIn = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin },
      payload: {
        challengeId: challenge.id,
        signature: rootKey.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        encryptionKey: account.encryptionKey,
      },
    });
    const session = SessionSchema.parse(loggedIn.json());
    const headers = {
      origin,
      cookie: loggedIn.cookies.map((c) => `${c.name}=${c.value}`).join(';'),
      'x-csrf-token': session.csrfToken,
    };
    const options = {
      method: 'POST' as const,
      url: '/v1/storage/approve',
      headers,
      payload: fixture.approval,
    };
    const unsigned = await app.inject(options);
    expect(unsigned.statusCode).toBe(403);
    expect(unsigned.json().code).toBe('ACCOUNT_CONTROL_REQUIRED');
    expect((await controlledInject(app, rootKey, options)).statusCode).toBe(200);
    fixture.setAdmin(false);
    expect((await app.inject({ url: path, headers })).statusCode).toBe(403);
    const denied = await controlledInject(app, rootKey, {
      ...options,
      payload: { ...fixture.approval, requestId: randomUUID() },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe('STORAGE_ADMIN_REQUIRED');
    expect(fixture.creates()).toBe(1);
  } finally {
    await app.close();
  }
});
