import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import Stripe from 'stripe';
import { PrivateKey } from '@wharfkit/antelope';
import {
  AccountSchema,
  NetworkSchema,
  UserMembershipSchema,
  ChallengeSchema,
  SessionSchema,
} from '../../protocol/api.js';
import {
  ModuleFeeChainSchema,
  ModuleFeeApprovalSchema,
  moduleFeePricingHash,
  type ModuleFeeTermSchema,
} from '../../protocol/module-fees.js';
import type { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { ModuleFees } from '../../services/api/src/billing/module-fees.js';
import { createServer } from '../../services/api/src/server.js';
import { authChain } from '../helpers/auth-chain.js';
import { STRIPE_API_VERSION } from '../../services/api/src/billing/stripe.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('OWNED_TEST_DATABASE_REQUIRED');
const pool = new Pool({ connectionString: url });
const rootKey = PrivateKey.generate('K1');
const account = AccountSchema.parse({
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
    'INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,$2,$3,$4)',
    [account.id, account.signingKey, account.encryptionKey, account.custody],
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
  const pricing = {
    account: 'decide',
    revision: '1',
    monthlyUsdCents: 200,
    actions: ['open' as const],
  };
  const config = {
    secretKey: 'sk_test_' + 'a'.repeat(24),
    accountId: 'acct_modules',
    frontendOrigin: 'http://localhost:5208',
    livemode: false,
    liveChargesEnabled: false,
  };
  let admin = true,
    members = 11,
    installed = true,
    wrong = false,
    lostChain = false,
    refund = false,
    disputed = false,
    won = false,
    creates = 0,
    attestations = 0,
    refundCreates = 0;
  let term: z.infer<typeof ModuleFeeTermSchema> | null = null;
  const sessions = new Map<
    string,
    { id: string; intent: string; metadata: Record<string, string>; paid: boolean; paidAt: number }
  >();
  const chain = {
    network: async () =>
      NetworkSchema.parse({
        chainId: dao.chainId,
        runtime: dao.contract,
        rpcUrl: 'http://localhost:20588',
        hub: null,
        environment: 'local',
        interfaceVersion: 1,
        coreVersion: '0.13.0-alpha.7',
        capabilities: [],
      }),
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
    moduleFeeState: async () =>
      ModuleFeeChainSchema.parse({
        dao,
        activeMembers: members,
        freeMembers: 10,
        modules: [{ pricing, title: 'Decide', codeHash: 'cd'.repeat(32), installed, term }],
      }),
    attestModuleTerm: async (
      _dao: typeof dao,
      module: string,
      expected: string,
      expires: number,
      receipt: string,
    ) => {
      expect(module).toBe('decide');
      if (term?.receipt !== receipt && (term?.receipt ?? '00'.repeat(32)) !== expected)
        throw new Error('MODULE_TERM_CHANGED');
      if (term?.receipt !== receipt) {
        term = { account: module, expires, receipt, revoked: false };
        attestations++;
      }
      if (lostChain) {
        lostChain = false;
        throw new Error('Lost irreversible native response');
      }
    },
    revokeModuleTerm: async (_dao: typeof dao, _module: string, receipt: string) => {
      if (term?.receipt === receipt) term.revoked = true;
    },
    resumeModuleTerm: async (_dao: typeof dao, _module: string, receipt: string) => {
      if (term?.receipt === receipt) term.revoked = false;
    },
  };
  function checkout(id: string) {
    const row = sessions.get(id);
    if (!row) throw new Error('Unknown owned checkout');
    return {
      id,
      object: 'checkout.session',
      status: row.paid ? 'complete' : 'open',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      mode: 'payment',
      currency: wrong ? 'eur' : 'usd',
      amount_total: 200,
      livemode: false,
      client_reference_id: account.id,
      metadata: row.metadata,
      url: 'https://checkout.stripe.com/c/pay/' + id,
      payment_status: row.paid ? 'paid' : 'unpaid',
      payment_intent: row.paid
        ? {
            id: row.intent,
            object: 'payment_intent',
            livemode: false,
            currency: 'usd',
            status: 'succeeded',
            amount: 200,
            amount_received: 200,
            metadata: row.metadata,
            latest_charge: {
              id: 'ch_' + row.intent,
              object: 'charge',
              livemode: false,
              currency: 'usd',
              paid: true,
              captured: true,
              status: 'succeeded',
              amount: 200,
              amount_refunded: refund ? 1 : 0,
              disputed,
              created: row.paidAt,
              payment_intent: row.intent,
            },
          }
        : null,
    };
  }
  const stripe = new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const address = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input : input.url,
        ),
        body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
      let result: unknown;
      if (address.pathname === '/v1/account') result = { id: config.accountId, object: 'account' };
      else if (address.pathname === '/v1/checkout/sessions' && init?.method === 'POST') {
        const order = body.get('metadata[order_id]') ?? '',
          id = 'cs_test_' + order.replaceAll('-', '');
        if (!sessions.has(id)) {
          creates++;
          sessions.set(id, {
            id,
            intent: 'pi_' + order.replaceAll('-', ''),
            metadata: Object.fromEntries(
              [...body]
                .filter(([key]) => key.startsWith('metadata['))
                .map(([key, value]) => [key.slice(9, -1), value]),
            ),
            paid: false,
            paidAt: Math.floor(Date.now() / 1000),
          });
        }
        expect(body.get('mode')).toBe('payment');
        expect(body.get('line_items[0][price_data][unit_amount]')).toBe('200');
        result = checkout(id);
      } else if (address.pathname.startsWith('/v1/checkout/sessions/'))
        result = checkout(address.pathname.split('/').at(-1) ?? '');
      else if (address.pathname === '/v1/refunds' && init?.method === 'POST') {
        refundCreates++;
        refund = true;
        result = { id: 're_owned', object: 'refund', status: 'succeeded' };
      } else if (address.pathname === '/v1/refunds')
        result = {
          object: 'list',
          has_more: false,
          data: refund ? [{ id: 're_owned', object: 'refund', status: 'succeeded' }] : [],
        };
      else if (address.pathname === '/v1/disputes')
        result = {
          object: 'list',
          has_more: false,
          data:
            disputed || won
              ? [{ id: 'dp_owned', object: 'dispute', status: won ? 'won' : 'needs_response' }]
              : [],
        };
      else throw new Error('Unexpected owned Stripe request');
      return Response.json(result);
    }),
  });
  const service = new ModuleFees(pool, chain, config, stripe);
  const approval = () =>
    ModuleFeeApprovalSchema.parse({
      schemaVersion: 1,
      requestId: randomUUID(),
      dao,
      account: 'decide',
      pricingHash: moduleFeePricingHash(pricing),
      monthlyUsdCents: 200,
      codeHash: 'cd'.repeat(32),
    });
  return {
    service,
    chain,
    dao,
    approval,
    term: () => term,
    stats: () => ({ creates, attestations, refundCreates }),
    paid(id: string) {
      const s = sessions.get('cs_test_' + id.replaceAll('-', ''));
      if (!s) throw new Error('Unknown owned order');
      s.paid = true;
    },
    admin: (v: boolean) => (admin = v),
    members: (v: number) => (members = v),
    installed: (v: boolean) => (installed = v),
    wrong: () => (wrong = true),
    refund: () => (refund = true),
    dispute: () => (disputed = true),
    won: () => {
      disputed = false;
      won = true;
    },
    loseChain: () => (lostChain = true),
  };
}
it('requires a current administrator, paid tier, installed module and exact approved price', async () => {
  const f = fixture();
  f.admin(false);
  await expect(f.service.checkout(account, f.approval())).rejects.toMatchObject({
    code: 'PAYMENT_ADMIN_REQUIRED',
  });
  f.admin(true);
  f.members(10);
  await expect(f.service.checkout(account, f.approval())).rejects.toMatchObject({
    code: 'MODULE_ACCESS_FREE',
  });
  f.members(11);
  f.installed(false);
  await expect(f.service.checkout(account, f.approval())).rejects.toMatchObject({
    code: 'MODULE_NOT_INSTALLED',
  });
  f.installed(true);
  await expect(
    f.service.checkout(account, { ...f.approval(), monthlyUsdCents: 300 }),
  ).rejects.toMatchObject({ code: 'MODULE_APPROVAL_CHANGED' });
  expect(f.stats().creates).toBe(0);
});
it('serializes checkout, verifies actual provider proof and survives native acknowledgement loss without extending the month', async () => {
  const f = fixture(),
    a = f.approval();
  const [first, again] = await Promise.all([
    f.service.checkout(account, a),
    f.service.checkout(account, a),
  ]);
  expect(first).toEqual(again);
  expect(f.stats().creates).toBe(1);
  await expect(f.service.checkout(account, f.approval())).rejects.toMatchObject({
    code: 'MODULE_ORDER_PENDING',
  });
  f.paid(a.requestId);
  f.loseChain();
  await expect(f.service.reconcile(a.requestId)).rejects.toThrow('Lost irreversible');
  const end = f.term()?.expires;
  await f.service.reconcile(a.requestId);
  expect((await f.service.order(account, a.requestId)).state).toBe('active');
  expect(f.term()?.expires).toBe(end);
  expect(f.stats().attestations).toBe(1);
  await expect(f.service.checkout(account, f.approval())).rejects.toMatchObject({
    code: 'MODULE_RENEWAL_EARLY',
  });
});
it('rejects wrong provider currency and revokes refunded or disputed terms, restoring a won dispute only', async () => {
  const invalid = fixture(),
    a = invalid.approval();
  await invalid.service.checkout(account, a);
  invalid.paid(a.requestId);
  invalid.wrong();
  await invalid.service.reconcile(a.requestId);
  expect((await invalid.service.order(account, a.requestId)).state).toBe('review');
  expect(invalid.term()).toBeNull();
  const f = fixture(),
    b = f.approval();
  await f.service.checkout(account, b);
  f.paid(b.requestId);
  await f.service.reconcile(b.requestId);
  f.dispute();
  await f.service.reconcile(b.requestId);
  expect(f.term()?.revoked).toBe(true);
  f.won();
  await f.service.reconcile(b.requestId);
  expect(f.term()?.revoked).toBe(false);
  f.refund();
  await f.service.reconcile(b.requestId);
  expect(f.term()?.revoked).toBe(true);
});
it('refunds a payment when the DAO becomes free before fulfillment', async () => {
  const f = fixture(),
    a = f.approval();
  await f.service.checkout(account, a);
  f.paid(a.requestId);
  f.members(10);
  await f.service.reconcile(a.requestId);
  expect(f.term()).toBeNull();
  expect(f.stats().refundCreates).toBe(1);
  expect((await f.service.order(account, a.requestId)).state).toBe('refunded');
});

it('enforces authentication, CSRF and current administrator status at the actual HTTP routes', async () => {
  const f = fixture(),
    origin = 'http://localhost:5208',
    app = await createServer(pool, { ...authChain, ...f.chain }, origin, { moduleFees: f.service });
  try {
    expect(
      (
        await app.inject({
          url: '/v1/modules/billing?dao=' + encodeURIComponent(JSON.stringify(f.dao)),
        })
      ).statusCode,
    ).toBe(401);
    const challenge = ChallengeSchema.parse(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/challenge',
          headers: { origin },
          payload: { signingKey: account.signingKey, encryptionKey: account.encryptionKey },
        })
      ).json(),
    );
    const logged = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin },
      payload: {
        challengeId: challenge.id,
        signature: rootKey.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        encryptionKey: account.encryptionKey,
      },
    });
    const session = SessionSchema.parse(logged.json()),
      cookie = logged.cookies.map((c) => c.name + '=' + c.value).join('; '),
      approval = f.approval();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/modules/billing/checkout',
          headers: { origin, cookie },
          payload: approval,
        })
      ).statusCode,
    ).toBe(403);
    const headers = { origin, cookie, 'x-csrf-token': session.csrfToken };
    f.admin(false);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/modules/billing/checkout',
          headers,
          payload: approval,
        })
      ).statusCode,
    ).toBe(403);
    f.admin(true);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/modules/billing/checkout',
          headers,
          payload: approval,
        })
      ).statusCode,
    ).toBe(200);
    f.admin(false);
    expect(
      (await app.inject({ url: '/v1/modules/billing/orders/' + approval.requestId, headers }))
        .statusCode,
    ).toBe(403);
  } finally {
    await app.close();
  }
});
