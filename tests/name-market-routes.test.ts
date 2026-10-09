import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { Pool } from 'pg';
import { describe, it, expect, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import type { ChainGateway } from '../services/api/src/chain.js';
import { registerMarketRoutes, type MarketChain } from '../services/api/src/market/routes.js';
import { StripeBilling } from '../services/api/src/billing/service.js';
import { NameQuoteSchema } from '../protocol/service-api.js';
// Route-only HTTP fixture. No provider charges, database access or chain account creation.
const fail = async (): Promise<never> => {
  throw new Error('UNUSED');
};
function fixture(
  party: 'first-party' | 'third-party',
  kind: 'basic' | 'premium' = 'basic',
): ChainGateway & MarketChain {
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
    marketplace: fail,
    nameService: fail,
    fulfillName: fail,
    nameQuote: async () =>
      NameQuoteSchema.parse({
        accountName: 'alice12345ab',
        kind,
        listed: false,
        seller: 'bob',
        party,
        price: '1.0000 TLOS',
        usdCents: 100,
        platformBps: 500,
        suffix: null,
        bumpBps: 2000,
        quotePremiumBps: 2000,
        ramBytes: 3000,
        netStake: '0.0000 TLOS',
        cpuStake: '0.0000 TLOS',
        priceFromOracle: false,
        sales: 0,
        nextPrice: null,
        nextUsdCents: null,
      }),
  };
}
describe('names card checkout routing', () => {
  it('blocks third-party card charges until seller routing exists; first-party checkout still uses the chain price', async () => {
    const pool = new Pool({ connectionString: 'postgres://127.0.0.1:9/unused' });
    const billing = new StripeBilling(
      pool,
      {
        secretKey: 'sk_test_fixtureunused',
        webhookSecret: 'whsec_fixtureunused',
        priceId: 'price_fixture',
      },
      'https://app.example',
    );
    const checkout = vi
      .spyOn(billing, 'startNameCheckout')
      .mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_fixture' });
    for (const [party, kind] of [
      ['third-party', 'basic'],
      ['first-party', 'premium'],
      ['first-party', 'basic'],
    ] as const) {
      const app = Fastify();
      await app.register(cookie);
      registerMarketRoutes(
        app,
        fixture(party, kind),
        billing,
        async () => ({ id: '11111111-1111-4111-8111-111111111111' }),
        () => true,
        'session',
      );
      const key = PrivateKey.generate('K1').toPublic().toString();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/names/checkout',
          payload: { accountName: 'alice12345ab', ownerKey: key, activeKey: key },
        });
        if (party === 'third-party' || kind === 'premium') {
          expect(response.statusCode).toBeGreaterThanOrEqual(400);
          expect(checkout).not.toHaveBeenCalled();
        } else {
          expect(response.statusCode).toBe(200);
          expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ usdCents: 100 }));
        }
      } finally {
        await app.close();
      }
    }
    await pool.end();
  });
});
