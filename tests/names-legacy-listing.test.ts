import { expect, it } from 'vitest';
import { quoteName } from '../services/api/src/market/read.js';

it.each([false, true])('ignores a legacy basic-name seller listing (sold=%s)', (sold) => {
  const quote = quoteName({
    accountName: 'reviewaaaaaa',
    tiers: [{ kind: 'basic', price: '10.0000 TLOS', usdCents: 100, ramBytes: 30720 }],
    listings: [
      {
        accountName: 'reviewaaaaaa',
        seller: 'attacker',
        price: '100.0000 TLOS',
        usdCents: 10000,
        sold,
      },
    ],
    treasury: 'treasury',
    thirdPartyBps: 500,
    firstPartyBps: 10000,
  });
  expect(quote).toMatchObject({
    listed: false,
    seller: 'treasury',
    party: 'first-party',
    price: '10.0000 TLOS',
    usdCents: 100,
  });
});
