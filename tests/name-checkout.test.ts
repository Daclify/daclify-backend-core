import { readFileSync } from 'node:fs';
import { ABI, PrivateKey, Serializer } from '@wharfkit/antelope';
import { describe, expect, it, vi } from 'vitest';
import {
  classifyStripeEvent,
  nameCheckoutParams,
  nameReference,
} from '../services/api/src/billing/name.js';
import { decideStripeEvent } from '../services/api/src/billing/decision.js';
import { quoteName } from '../services/api/src/market/read.js';
import { readMarketplace } from '../services/api/src/market/routes.js';

const accountId = '11111111-1111-4111-8111-111111111111';
const owner = PrivateKey.generate('K1').toPublic().toString();
const active = PrivateKey.generate('K1').toPublic().toString();

function nameEvent(paymentStatus: 'paid' | 'unpaid' | 'no_payment_required', usd = 500) {
  return {
    id: 'evt_name',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_name',
        payment_status: paymentStatus,
        client_reference_id: accountId,
        amount_total: usd,
        currency: 'usd',
        metadata: {
          purpose: 'name',
          account_id: accountId,
          account_name: 'alice12345ab',
          owner_key: owner,
          active_key: active,
          usd_cents: String(usd),
        },
      },
    },
  };
}

describe('Telos name checkout', () => {
  it('prices the card session from the chain amount', () => {
    const params = nameCheckoutParams({
      accountId,
      accountName: 'alice12345ab',
      ownerKey: owner,
      activeKey: active,
      usdCents: 500,
      successUrl: 'https://app.example/marketplace?names=submitted',
      cancelUrl: 'https://app.example/marketplace?names=cancelled',
      integrationIdentifier: 'daclifyabcdefgh',
    });
    expect(params.line_items).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 500,
          product_data: { name: 'Telos account alice12345ab' },
        },
      },
    ]);
    expect(params.metadata).toMatchObject({ purpose: 'name', usd_cents: '500' });
    expect(Object.hasOwn(params, 'payment_method_types')).toBe(false);
  });

  it('classifies a paid name session before the service-payment shape check', () => {
    const paid = classifyStripeEvent(nameEvent('paid'));
    expect(paid).toMatchObject({
      kind: 'purchase',
      purchase: {
        accountName: 'alice12345ab',
        usdCents: 500,
        reference: nameReference('cs_test_name'),
      },
    });
    expect(decideStripeEvent(nameEvent('paid'))).toEqual({
      kind: 'ignore',
      reason: 'SESSION_SHAPE',
    });
    expect(classifyStripeEvent(nameEvent('unpaid'))).toEqual({ kind: 'ignore', reason: 'UNPAID' });
    expect(classifyStripeEvent(nameEvent('no_payment_required'))).toEqual({
      kind: 'ignore',
      reason: 'UNPAID',
    });
    const mismatched = nameEvent('paid', 500);
    mismatched.data.object.amount_total = 100;
    expect(classifyStripeEvent(mismatched)).toEqual({ kind: 'invalid' });
  });

  it('keeps service checkout on its own decision', () => {
    const service = {
      id: 'evt_service',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_service',
          payment_status: 'paid',
          client_reference_id: accountId,
          amount_total: 1000,
          currency: 'usd',
          metadata: { account_id: accountId, price_id: 'price_servicefixture', purpose: 'service' },
        },
      },
    };
    expect(classifyStripeEvent(service)).toMatchObject({ kind: 'fulfill', accountId });
  });

  it('quotes a basic name to the treasury and a listed name to its seller', () => {
    const tiers = [
      { kind: 'basic' as const, price: '1.0000 TLOS', usdCents: 500, ramBytes: 4096 },
      { kind: 'premium' as const, price: '20.0000 TLOS', usdCents: 10000, ramBytes: 4096 },
    ];
    expect(
      quoteName({
        accountName: 'alice12345ab',
        tiers,
        listings: [],
        treasury: 'fees',
        thirdPartyBps: 500,
        firstPartyBps: 10000,
      }),
    ).toMatchObject({ party: 'first-party', seller: 'fees', usdCents: 500, platformBps: 10000 });
    expect(
      quoteName({
        accountName: 'premname',
        tiers,
        listings: [
          {
            accountName: 'premname',
            seller: 'bob',
            price: '2.0000 TLOS',
            usdCents: 1000,
            sold: false,
          },
        ],
        treasury: 'fees',
        thirdPartyBps: 500,
        firstPartyBps: 10000,
      }),
    ).toMatchObject({
      party: 'third-party',
      seller: 'bob',
      usdCents: 1000,
      platformBps: 500,
      kind: 'premium',
    });
    expect(
      quoteName({
        accountName: 'alice12345ab',
        tiers,
        listings: [],
        treasury: 'fees',
        thirdPartyBps: 500,
        firstPartyBps: 10000,
        policy: {
          bumpBps: 2000,
          quotePremiumBps: 2000,
          median: 50000n,
          quotedPrecision: 4,
          observedAt: 1,
        },
      }).price,
    ).toBe('1.2000 TLOS');
    expect(
      quoteName({
        accountName: 'zz.aa.bob',
        tiers,
        listings: [],
        suffixes: [
          { suffix: 'bob', seller: 'bob', price: '10.0000 TLOS', usdCents: 500, sales: 2 },
          { suffix: 'aa.bob', seller: 'carol', price: '3.0000 TLOS', usdCents: 0, sales: 0 },
        ],
        treasury: 'fees',
        thirdPartyBps: 500,
        firstPartyBps: 10000,
      }),
    ).toMatchObject({
      seller: 'carol',
      price: '3.0000 TLOS',
      suffix: 'aa.bob',
      platformBps: 500,
      nextPrice: '3.6000 TLOS',
    });
    expect(() =>
      quoteName({
        accountName: 'zz.dao',
        tiers,
        listings: [],
        suffixes: [],
        treasury: 'fees',
        thirdPartyBps: 500,
        firstPartyBps: 10000,
      }),
    ).toThrow('SUFFIX');
  });

  it('encodes a name fulfillment with the names contract ABI', () => {
    const abi = ABI.from(readFileSync('.artifacts/contracts/names.abi', 'utf8'));
    const bytes = Serializer.encode({
      abi,
      type: 'fulfill',
      object: {
        settler: 'relay',
        account_name: 'alice12345ab',
        owner_key: owner,
        active_key: active,
        usd_cents: 500,
        reference: 'ab'.repeat(32),
      },
    }).array;
    expect(bytes.byteLength).toBeGreaterThan(40);
  });

  it('reports a missing fee table instead of failing the read', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            error: { details: [{ message: 'Table feecfg is not specified in the ABI' }] },
          }),
          { status: 500 },
        ),
    );
    await expect(readMarketplace('http://127.0.0.1:9', 'daclifycore')).resolves.toEqual({
      configured: false,
      reason: 'The catalogue is not on this chain yet.',
      thirdPartyBps: null,
      firstPartyBps: null,
      treasury: null,
      modules: [],
    });
    vi.unstubAllGlobals();
  });
});
