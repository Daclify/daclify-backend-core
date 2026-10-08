import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { controlledInject } from '../helpers/account-control.js';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { PrivateKey } from '@wharfkit/antelope';
import { CardRam } from '../../services/api/src/resources/card.js';
import { processRamJob } from '../../services/api/src/resources/jobs.js';
import { migrate } from '../../services/api/src/store.js';
import {
  AccountSchema,
  NetworkSchema,
  UserMembershipSchema,
  ChallengeSchema,
  SessionSchema,
} from '../../protocol/api.js';
import { ChainPlatformSchema } from '../../protocol/platform.js';
import {
  DEFAULT_RESOURCE_POLICY,
  RamQuoteSchema,
  CardRamApprovalSchema,
} from '../../protocol/resources.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import type { RuntimeActions } from '../../sdk/index.js';
import { STRIPE_API_VERSION } from '../../services/api/src/billing/stripe.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('OWNED_TEST_DATABASE_REQUIRED');
const rootKey = PrivateKey.generate('K1');
const pool = new Pool({ connectionString: url }),
  account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: rootKey.toPublic().toString(),
    encryptionKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    }),
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
function fixture() {
  const dao = {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 16)).toString(),
    interfaceVersion: 1,
  };
  const config = {
    secretKey: 'sk_test_' + 'a'.repeat(24),
    productId: 'prod_ram',
    webhookSecret: 'whsec_' + 'b'.repeat(24),
    frontendOrigin: 'http://localhost:5208',
    livemode: false,
    liveChargesEnabled: false,
    accountId: 'acct_ramtest',
  };
  const checkoutId = 'cs_test_' + randomUUID().replaceAll('-', ''),
    paymentId = 'pi_' + randomUUID().replaceAll('-', '');
  let reserve = '100.0000 TLOS';
  let admin = true,
    paid = false,
    refund = false,
    wrong = false,
    providerOutage = false,
    lostCheckout = false,
    lostChain = false,
    creates = 0,
    fulfilments = 0;
  let metadata: Record<string, string> = {},
    recorded: z.infer<typeof RuntimeTableSchemas.ramorders> | null = null;
  const network = NetworkSchema.parse({
    chainId: dao.chainId,
    runtime: dao.contract,
    rpcUrl: 'http://localhost:20588',
    hub: null,
    environment: 'local',
    interfaceVersion: 1,
    coreVersion: '0.7.0-alpha.1',
    capabilities: [],
  });
  const policy = { ...DEFAULT_RESOURCE_POLICY, revision: '1' };
  const platform = () =>
    ChainPlatformSchema.parse({
      network,
      chainId: dao.chainId,
      chainMatches: true,
      headBlock: 10,
      irreversibleBlock: 9,
      headTime: new Date().toISOString(),
      contracts: [],
      catalogue: [],
      fees: null,
      market: null,
      creation: {
        shared_usd: 0,
        independent_usd: 5000,
        premium_bps: 2000,
        settler: 'relay',
        median: '10000',
        precision: 4,
        observed_at: Math.floor(Date.now() / 1000),
      },
      runtimeSettings: null,
      resourcePolicy: policy,
      ramReserve: { available: reserve },
      rateFresh: true,
      platformDao: null,
      sharedAvailable: true,
      independentAvailable: false,
    });
  const chain = {
    network: async () => network,
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
    platform: async () => platform(),
    ramQuote: async () =>
      RamQuoteSchema.parse({
        dao,
        rail: 'tlos',
        baseUnits: '50000',
        feeUnits: '2500',
        totalUnits: '52500',
        feeBps: 500,
        order: {
          dao_id: dao.daoId,
          payer: 'relay',
          reference: 'cd'.repeat(32),
          policy_revision: '1',
          maximum: '5.2500 TLOS',
          expires: Math.floor(Date.now() / 1000) + 300,
          purchases: [{ receiver: dao.contract, quantity: '5.0000 TLOS', minimum_bytes: '1024' }],
        },
        systemCodeHash: 'ef'.repeat(32),
        systemRawAbiHash: 'fe'.repeat(32),
        quotedAt: new Date().toISOString(),
      }),
    ramOrder: async () => recorded,
    fulfilRam: async (input: RuntimeActions['fulfilram']) => {
      fulfilments++;
      expect(input.maximum).toBe('5.0000 TLOS');
      recorded = RuntimeTableSchemas.ramorders.parse({
        id: '1',
        dao_id: dao.daoId,
        reference: input.reference,
        payer: dao.contract,
        treasury: 'treasury',
        policy_revision: '1',
        fee_bps: 0,
        expires: input.expires,
        maximum: input.maximum,
        spent: input.maximum,
        platform_fee: '0.0000 TLOS',
        received: input.maximum,
        purchases: input.purchases.map((p) => ({
          ...p,
          before_bytes: '1000000',
          acquired_bytes: '2048',
        })),
        funded: true,
        settled: true,
      });
      if (lostChain) {
        lostChain = false;
        throw new Error('Provider timeout after irreversible settlement');
      }
      return { transactionId: 'ee'.repeat(32) };
    },
  };
  const checkout = () => ({
    id: checkoutId,
    object: 'checkout.session',
    mode: 'payment',
    livemode: false,
    currency: wrong ? 'eur' : 'usd',
    amount_total: 600,
    client_reference_id: account.id,
    metadata,
    url: 'https://checkout.stripe.com/c/pay/' + checkoutId,
    payment_status: paid ? 'paid' : 'unpaid',
    payment_intent: paid
      ? {
          id: paymentId,
          object: 'payment_intent',
          livemode: false,
          currency: 'usd',
          status: 'succeeded',
          amount: 600,
          amount_received: 600,
          metadata,
          latest_charge: {
            id: 'ch_test',
            object: 'charge',
            livemode: false,
            currency: 'usd',
            paid: true,
            status: 'succeeded',
            amount: 600,
            amount_refunded: refund ? 1 : 0,
            disputed: false,
            payment_intent: paymentId,
          },
        }
      : null,
  });
  const stripe = new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const address = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input : input.url,
        ),
        body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      if (providerOutage)
        return Response.json({ error: { message: 'fixture private diagnostic' } }, { status: 503 });
      let result: unknown;
      if (address.pathname === '/v1/account') result = { id: config.accountId, object: 'account' };
      else if (address.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
        creates++;
        metadata = {
          purpose: body.get('metadata[purpose]') ?? '',
          order_id: body.get('metadata[order_id]') ?? '',
          account_id: body.get('metadata[account_id]') ?? '',
        };
        expect(body.get('line_items[0][price_data][unit_amount]')).toBe('600');
        expect(body.get('payment_intent_data[metadata][order_id]')).toBe(metadata.order_id);
        if (lostCheckout) {
          lostCheckout = false;
          throw new Error('Lost checkout response');
        }
        result = checkout();
      } else if (address.pathname === '/v1/checkout/sessions/' + checkoutId) result = checkout();
      else if (address.pathname === '/v1/refunds')
        result = { object: 'list', data: [], has_more: false };
      else throw new Error('Unexpected RAM Stripe request');
      return Response.json(result);
    }),
  });
  const service = new CardRam(pool, chain, config, stripe);
  return {
    dao,
    chain,
    service,
    config,
    checkoutId,
    setReserve: (value: string) => (reserve = value),
    getCreates: () => creates,
    getFulfilments: () => fulfilments,
    setPaid: () => (paid = true),
    setRefund: () => (refund = true),
    setWrong: () => (wrong = true),
    setOutage: (value: boolean) => (providerOutage = value),
    revoke: () => (admin = false),
    loseCheckout: () => (lostCheckout = true),
    loseChain: () => (lostChain = true),
    async approval() {
      return CardRamApprovalSchema.parse({
        ...(await service.offer(account, {
          dao,
          allocations: [{ receiver: dao.contract, minimumBytes: '1024' }],
        })),
        requestId: randomUUID(),
        consent: true,
      });
    },
    async webhook() {
      const data = {
        id: 'evt_' + randomUUID().replaceAll('-', ''),
        object: 'event',
        type: 'checkout.session.completed',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        data: { object: checkout() },
      };
      const payload = JSON.stringify(data),
        signature = Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: config.webhookSecret,
        });
      await service.webhook(Buffer.from(payload), signature);
    },
  };
}
import { z } from 'zod';
it('requires exact immutable administrator consent and checkout does not grant RAM', async () => {
  const f = fixture(),
    approval = await f.approval();
  expect((await f.service.checkout(account, approval)).state).toBe('pending');
  expect(await f.service.reconcile(approval.requestId)).toBe('retry');
  expect(f.getFulfilments()).toBe(0);
  expect((await f.service.checkout(account, approval)).state).toBe('pending');
  expect(f.getCreates()).toBe(1);
  await expect(
    pool.query('UPDATE ram_card_orders SET approval=approval||$1::jsonb WHERE id=$2', [
      { totalUsdCents: 601 },
      approval.requestId,
    ]),
  ).rejects.toThrow('RAM_ORDER_IMMUTABLE');
  await expect(
    pool.query('DELETE FROM ram_card_orders WHERE id=$1', [approval.requestId]),
  ).rejects.toThrow('RAM_ORDER_IMMUTABLE');
  f.revoke();
  await expect(f.service.status(account, approval.requestId)).rejects.toThrow(
    'PAYMENT_ADMIN_REQUIRED',
  );
});
it('settles a verified payment once even after a lost native response', async () => {
  const f = fixture(),
    approval = await f.approval();
  await f.service.checkout(account, approval);
  f.setPaid();
  f.loseChain();
  await expect(f.service.reconcile(approval.requestId)).rejects.toThrow('timeout');
  expect(await f.service.reconcile(approval.requestId)).toBe('completed');
  expect(await f.service.reconcile(approval.requestId)).toBe('completed');
  expect(f.getFulfilments()).toBe(1);
  const status = await f.service.status(account, approval.requestId);
  expect(status).toMatchObject({ state: 'settled', acquiredBytes: '2048' });
  f.setRefund();
  expect(await f.service.reconcile(approval.requestId)).toBe('manual');
  expect(await f.service.status(account, approval.requestId)).toMatchObject({
    state: 'review',
    acquiredBytes: '2048',
    settledAt: status.settledAt,
  });
  expect(f.getFulfilments()).toBe(1);
});
it('pauses transient provider failure and rejects wrong payment currency before spending', async () => {
  const f = fixture(),
    approval = await f.approval();
  await f.service.checkout(account, approval);
  f.setPaid();
  f.setOutage(true);
  await expect(f.service.reconcile(approval.requestId)).rejects.toThrow();
  expect((await f.service.status(account, approval.requestId)).state).toBe('pending');
  f.setOutage(false);
  f.setWrong();
  expect(await f.service.reconcile(approval.requestId)).toBe('manual');
  expect(f.getFulfilments()).toBe(0);
});
it('recovers a lost checkout response from a signed event without trusting its paid flag', async () => {
  const f = fixture(),
    approval = await f.approval();
  f.loseCheckout();
  await expect(f.service.checkout(account, approval)).rejects.toThrow();
  await f.webhook();
  expect(f.getCreates()).toBe(1);
  expect(await f.service.reconcile(approval.requestId)).toBe('retry');
  expect(f.getFulfilments()).toBe(0);
  f.setPaid();
  await f.webhook();
  expect(await f.service.reconcile(approval.requestId)).toBe('completed');
  expect(f.getFulfilments()).toBe(1);
});
it('preserves a new webhook generation while a worker owns its lease', async () => {
  const f = fixture(),
    approval = await f.approval();
  await f.service.checkout(account, approval);
  f.setPaid();
  const service = {
    reconcile: async (id: string) => {
      expect(id).toBe(approval.requestId);
      await f.webhook();
      return 'completed' as const;
    },
  };
  await pool.query("UPDATE jobs SET state='completed' WHERE module_id='core-ram' AND job_key<>$1", [
    'ram-card:' + approval.requestId,
  ]);
  expect(await processRamJob(pool, service, randomUUID())).toBe('completed');
  const row = await pool.query(
    "SELECT state,payload FROM jobs WHERE module_id='core-ram' AND job_key=$1",
    ['ram-card:' + approval.requestId],
  );
  expect(row.rows[0]).toMatchObject({ state: 'pending', payload: { generation: 2 } });
});

it('requires session, CSRF, fresh proof and current administrator authority at the card API', async () => {
  const f = fixture(),
    origin = 'http://localhost:5208',
    unavailable = async (): Promise<never> => {
      throw new Error('NOT_PART_OF_FIXTURE');
    };
  const chain: ChainGateway = {
    ...f.chain,
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
  const app = await createServer(pool, chain, origin, { ramCards: f.service });
  try {
    const approval = await f.approval();
    expect(
      (await app.inject({ url: '/v1/resources/ram/card/orders/' + approval.requestId })).statusCode,
    ).toBe(401);
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
    const session = SessionSchema.parse(loggedIn.json()),
      headers = {
        origin,
        cookie: loggedIn.cookies.map((c) => `${c.name}=${c.value}`).join(';'),
        'x-csrf-token': session.csrfToken,
      };
    const request = {
      method: 'POST' as const,
      url: '/v1/resources/ram/card/checkout',
      headers,
      payload: approval,
    };
    expect((await app.inject(request)).json().code).toBe('ACCOUNT_CONTROL_REQUIRED');
    expect((await controlledInject(app, rootKey, request)).statusCode).toBe(200);
    f.revoke();
    expect(
      (await app.inject({ url: '/v1/resources/ram/card/orders/' + approval.requestId, headers }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/resources/ram/stripe/webhook',
          headers: { 'content-type': 'application/json', 'stripe-signature': 'invalid' },
          payload: '{}',
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await app.close();
  }
});

it('refuses a known unfunded native reserve before preparing a Stripe payment', async () => {
  const f = fixture();
  f.setReserve('4.9999 TLOS');
  await expect(f.approval()).rejects.toThrow('RAM_RESERVE_INSUFFICIENT');
  expect(f.getCreates()).toBe(0);
  expect(f.getFulfilments()).toBe(0);
});
