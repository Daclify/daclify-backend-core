import { describe, expect, it } from 'vitest';
import { quoteName, type NameTier } from '../services/api/src/market/read.js';

const tiers: NameTier[] = [
  {
    kind: 'basic',
    price: '71.5910 TLOS',
    tlosQuote: '71.5910 TLOS',
    usdCents: 142,
    ramBytes: 30720,
  },
  { kind: 'premium', price: '20.0000 TLOS', usdCents: 20000, ramBytes: 4096 },
];
const base = {
  accountName: 'aa.bob',
  tiers,
  listings: [],
  treasury: 'fees',
  thirdPartyBps: 500,
  firstPartyBps: 10000,
};
describe('suffix quote floor', () => {
  it('clamps old suffix offers to the current basic quote and increases the effective amounts', () => {
    expect(
      quoteName({
        ...base,
        suffixes: [{ suffix: 'bob', seller: 'bob', price: '1.0000 TLOS', usdCents: 100, sales: 2 }],
      }),
    ).toMatchObject({
      price: '71.5910 TLOS',
      usdCents: 142,
      nextPrice: '85.9092 TLOS',
      nextUsdCents: 171,
      sales: 2,
      ramBytes: 4096,
    });
  });
  it('keeps higher seller prices and unset USD rails', () => {
    expect(
      quoteName({
        ...base,
        suffixes: [{ suffix: 'bob', seller: 'bob', price: '80.0000 TLOS', usdCents: 0, sales: 0 }],
      }),
    ).toMatchObject({
      price: '80.0000 TLOS',
      usdCents: 0,
      nextPrice: '96.0000 TLOS',
      nextUsdCents: null,
    });
  });
  it('floors explicit dotted listings but leaves undotted premium listings unchanged', () => {
    const listing = {
      accountName: 'aa.bob',
      seller: 'bob',
      price: '1.0000 TLOS',
      usdCents: 100,
      sold: false,
    };
    expect(quoteName({ ...base, listings: [listing] })).toMatchObject({
      price: '71.5910 TLOS',
      usdCents: 142,
      listed: true,
    });
    expect(
      quoteName({
        ...base,
        accountName: 'premname',
        listings: [{ ...listing, accountName: 'premname' }],
      }),
    ).toMatchObject({ price: '1.0000 TLOS', usdCents: 100 });
  });
  it('preserves USD-only suffix conversion and raises the USD reference before conversion', () => {
    expect(
      quoteName({
        ...base,
        policy: {
          bumpBps: 2000,
          quotePremiumBps: 2000,
          median: 176n,
          quotedPrecision: 4,
          observedAt: 1791633600,
        },
        suffixes: [{ suffix: 'bob', seller: 'bob', price: '0.0000 TLOS', usdCents: 100, sales: 0 }],
      }),
    ).toMatchObject({
      price: '96.8182 TLOS',
      usdCents: 142,
      nextPrice: '116.5910 TLOS',
      nextUsdCents: 171,
      priceFromOracle: true,
    });
  });
  it('disables USD when the basic card price is unavailable without blocking native offers', () => {
    expect(
      quoteName({
        ...base,
        tiers: tiers.map((tier) => (tier.kind === 'basic' ? { ...tier, usdCents: 0 } : tier)),
        suffixes: [
          { suffix: 'bob', seller: 'bob', price: '80.0000 TLOS', usdCents: 200, sales: 0 },
        ],
      }),
    ).toMatchObject({ price: '80.0000 TLOS', usdCents: 0, nextUsdCents: null });
  });
});
