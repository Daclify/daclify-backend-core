import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { AccountSchema, CreateDaoSchema, DaoSummarySchema } from '../../protocol/api.js';
import { ChainPlatformSchema } from '../../protocol/platform.js';
import { RuntimeTableSchemas } from '../../sdk/index.js';
import { CreationService } from '../../services/api/src/creation.js';
import { StripeBilling } from '../../services/api/src/billing/service.js';
import { createStripeClient } from '../../services/api/src/billing/stripe.js';
import { migrate } from '../../services/api/src/store.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Isolated test database required');
const pool = new Pool({ connectionString: url });
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const account = AccountSchema.parse({
  id: randomUUID(),
  signingKey: PrivateKey.generate('K1').toPublic().toString(),
  custody: 'user-controlled',
  encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
});
const network = {
  chainId: 'ab'.repeat(32),
  rpcUrl: 'http://localhost:19988',
  runtime: 'daclifycore',
  hub: null,
  environment: 'local',
  interfaceVersion: 1,
  coreVersion: '0.3.0-alpha.1',
  capabilities: ['shared-dao-create'],
};
const platform = ChainPlatformSchema.parse({
  network,
  chainId: network.chainId,
  chainMatches: true,
  headBlock: 1,
  irreversibleBlock: 1,
  headTime: '2026-10-07T00:00:00',
  contracts: [],
  catalogue: [],
  fees: {
    third_party_bps: 500,
    first_party_bps: 10000,
    treasury: 'alice',
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
    names: '',
  },
  market: null,
  creation: {
    shared_usd: 2000,
    independent_usd: 5000,
    premium_bps: 2000,
    settler: 'relay',
    median: '10000',
    precision: 4,
    observed_at: Math.floor(Date.now() / 1000),
  },
  runtimeSettings: { chain_id: network.chainId, interface_version: 1 },
  rateFresh: true,
  platformDao: null,
  sharedAvailable: true,
  independentAvailable: false,
});
const orders = new Map<string, ReturnType<typeof RuntimeTableSchemas.createords.parse>>();
let creations = 0;
const chain = {
  validateCreation: vi.fn(async (_input: ReturnType<typeof CreateDaoSchema.parse>) => {}),
  platform: async () => platform,
  creationOrder: async (reference: string) => orders.get(reference) ?? null,
  orderCreation: async (reference: string, creator: string, method: 'card' | 'tlos') => {
    const saved = orders.get(reference);
    if (saved) return saved;
    const now = Math.floor(Date.now() / 1000);
    const order = RuntimeTableSchemas.createords.parse({
      id: String(orders.size + 1),
      reference,
      creator,
      deployment: 0,
      method: method === 'card' ? 1 : 0,
      usd_cents: 2000,
      tlos_due: method === 'card' ? '0.0000 TLOS' : '24.0000 TLOS',
      created_at: now,
      expires: now + 3600,
      paid: false,
      used: false,
      dao_id: '0',
      card_reference: '00'.repeat(32),
    });
    orders.set(reference, order);
    return order;
  },
  attestCreation: async (reference: string, _card: string, usd: number) => {
    const row = orders.get(reference);
    if (!row || row.usd_cents !== usd) throw new Error('Fixture amount');
    row.paid = true;
  },
  createDao: async (
    _account: typeof account,
    input: ReturnType<typeof CreateDaoSchema.parse>,
    paid?: { reference: string; daoId: string },
  ) => {
    if (!paid) throw new Error('Missing receipt');
    const row = orders.get(paid.reference);
    if (!row?.paid || row.used) throw new Error('Fixture payment');
    row.used = true;
    row.dao_id = paid.daoId;
    creations++;
    return DaoSummarySchema.parse({
      reference: {
        chainId: network.chainId,
        contract: network.runtime,
        daoId: paid.daoId,
        interfaceVersion: 1,
      },
      title: input.metadata.title,
      description: '',
      privacy: 'public',
      owner: 'alice',
      token: input.token,
      members: 1,
      available: '0',
      reserved: '0',
      claims: '0',
      keyEpoch: '0',
    });
  },
};
const service = new CreationService(pool, chain);
const stripeConfig = {
  secretKey: 'rk_test_fixturekeyvalue',
  webhookSecret: 'whsec_fixture',
  priceId: 'price_fixture',
};
const billing = new StripeBilling(pool, stripeConfig, 'http://localhost:5178', undefined, service);
const checkoutSpy = vi
  .spyOn(billing, 'startCreationCheckout')
  .mockImplementation(async (input) => ({
    id: 'cs_' + input.orderId.replaceAll('-', ''),
    url: 'https://checkout.stripe.com/c/pay/test',
  }));
beforeAll(async () => {
  await migrate(pool);
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key)VALUES($1,$2,$3,$4)',
    [account.id, account.signingKey, account.custody, account.encryptionKey],
  );
});
afterAll(async () => {
  checkoutSpy.mockRestore();
  await pool.end();
});
const request = CreateDaoSchema.parse({
  metadata: { schemaVersion: 1, title: 'PG order fixture', description: '' },
  privacy: 'public',
  token: { chainId: network.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
});
it('blocks strict-private creation after assisted authority was enabled and reports honest custody for public creation', async () => {
  await pool.query(
    'INSERT INTO vault_recovery_state(account_id,assisted_ever) VALUES($1,true) ON CONFLICT(account_id) DO UPDATE SET assisted_ever=true',
    [account.id],
  );
  try {
    await expect(
      service.prepare(account, {
        requestId: randomUUID(),
        deployment: 'shared',
        method: 'tlos',
        request: { ...request, privacy: 'encrypted-user-controlled' },
      }),
    ).rejects.toMatchObject({ code: 'CUSTODY_POLICY' });
    const view = await service.prepare(account, {
      requestId: randomUUID(),
      deployment: 'shared',
      method: 'tlos',
      request,
    });
    expect(view.creator.custody).toBe('managed');
  } finally {
    await pool.query('DELETE FROM vault_recovery_state WHERE account_id=$1', [account.id]);
  }
});
describe('creation order PostgreSQL ownership and settlement', () => {
  it('persists immutable requests and rejects cross-account access, unpaid fulfillment and independent checkout', async () => {
    const input = {
      requestId: randomUUID(),
      deployment: 'shared' as const,
      method: 'tlos' as const,
      request,
    };
    const quote = await service.prepare(account, input);
    expect(await service.prepare(account, input)).toEqual(quote);
    platform.rateFresh = false;
    platform.sharedAvailable = false;
    try {
      expect(await service.prepare(account, input)).toEqual(quote);
    } finally {
      platform.rateFresh = true;
      platform.sharedAvailable = true;
    }

    await expect(
      service.prepare(account, {
        ...input,
        request: { ...request, metadata: { ...request.metadata, title: 'Changed' } },
      }),
    ).rejects.toMatchObject({ code: 'CREATION_ORDER_CONFLICT' });
    await expect(service.status(randomUUID(), quote.requestId)).rejects.toMatchObject({
      code: 'CREATION_ORDER_UNKNOWN',
    });
    await expect(service.fulfill(account, quote.requestId)).rejects.toMatchObject({
      code: 'CREATION_PAYMENT_REQUIRED',
    });
    await expect(
      service.prepare(account, { ...input, requestId: randomUUID(), deployment: 'independent' }),
    ).rejects.toMatchObject({ code: 'INDEPENDENT_UNAVAILABLE' });
  });
  it('validates deterministic prerequisites before publishing an order and exposes its immutable setup', async () => {
    const input = {
      requestId: randomUUID(),
      deployment: 'shared' as const,
      method: 'tlos' as const,
      request,
    };
    const before = orders.size;
    chain.validateCreation.mockRejectedValueOnce(new Error('POLICY_GUARDIAN'));
    await expect(service.prepare(account, input)).rejects.toThrow('POLICY_GUARDIAN');
    expect(orders.size).toBe(before);
    const quote = await service.prepare(account, input);
    expect(quote).toMatchObject({
      setup: request,
      creator: { signingKey: account.signingKey, encryptionKey: account.encryptionKey },
    });
    const row = orders.get(quote.memo.slice(7));
    if (!row) throw new Error('Fixture');
    row.expires = Math.floor(Date.now() / 1000) - 1;
    expect((await service.status(account.id, quote.requestId)).state).toBe('expired');
    row.paid = true;
    const fail = vi.spyOn(chain, 'createDao').mockRejectedValueOnce(new Error('CHAIN_UNAVAILABLE'));
    await expect(service.fulfill(account, quote.requestId)).rejects.toThrow('CHAIN_UNAVAILABLE');
    expect((await service.status(account.id, quote.requestId)).state).toBe('paid');
    expect((await service.fulfill(account, quote.requestId)).state).toBe('created');
    fail.mockRestore();
  });
  it('settles only a verified, bound card checkout and creates once under concurrent retries', async () => {
    const quote = await service.prepare(account, {
      requestId: randomUUID(),
      deployment: 'shared',
      method: 'card',
      request,
    });
    await service.checkout(account.id, quote.requestId, billing);
    await service.checkout(account.id, quote.requestId, billing);
    expect(checkoutSpy).toHaveBeenCalledTimes(1);
    const checkoutId = 'cs_' + quote.requestId.replaceAll('-', '');
    await expect(
      service.recordCard({
        orderId: quote.requestId,
        accountId: account.id,
        checkoutId: 'cs_wrong',
        usdCents: 2000,
        paidAt: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toMatchObject({ code: 'CREATION_CARD_MISMATCH' });
    await expect(
      service.recordCard({
        orderId: quote.requestId,
        accountId: account.id,
        checkoutId,
        usdCents: 1999,
        paidAt: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toMatchObject({ code: 'CREATION_CARD_MISMATCH' });
    const event = {
      id: 'evt_fixture',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: checkoutId,
          mode: 'payment',
          payment_status: 'paid',
          currency: 'usd',
          amount_total: 2000,
          client_reference_id: account.id,
          metadata: { purpose: 'dao-creation', account_id: account.id, order_id: quote.requestId },
        },
      },
    };
    const raw = Buffer.from(JSON.stringify(event));
    const stripe = createStripeClient(stripeConfig.secretKey);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: raw.toString(),
      secret: stripeConfig.webhookSecret,
    });
    await expect(billing.receiveWebhook(raw, 'invalid')).rejects.toThrow('SIGNATURE_INVALID');
    await billing.receiveWebhook(raw, signature);
    await billing.receiveWebhook(raw, signature);
    const before = creations;
    const results = await Promise.all([
      service.fulfill(account, quote.requestId),
      service.fulfill(account, quote.requestId),
    ]);
    expect(creations - before).toBe(1);
    expect(results[0]?.dao).toEqual(results[1]?.dao);
    expect(results[0]?.state).toBe('created');
  });
  it('rejects fulfillment after a chain switch before submitting another transaction', async () => {
    const view = await service.prepare(account, {
      requestId: randomUUID(),
      deployment: 'shared',
      method: 'tlos',
      request,
    });
    const reference = view.memo.slice('create:'.length);
    const order = orders.get(reference);
    if (!order) throw new Error('Fixture order');
    order.paid = true;
    const before = creations;
    platform.chainMatches = false;
    try {
      await expect(service.fulfill(account, view.requestId)).rejects.toMatchObject({
        code: 'DAO_REFERENCE',
      });
      expect(creations).toBe(before);
    } finally {
      platform.chainMatches = true;
    }
  });
});
