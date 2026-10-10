import { describe, expect, it } from 'vitest';
import { basicNamePrice } from '../services/api/src/market/pricing.js';

const input = {
  resourceTlosMinor: 27587n,
  median: 176n,
  quotedPrecision: 4,
  tlosPrecision: 4,
  minimumProfitUsdCents: 100,
  cardFeeBps: 515,
  cardFixedUsdCents: 29,
  nativePremiumBps: 2000,
};
describe('basic name cost and profit pricing', () => {
  it('adds actual resources to the profit floor and grosses up card fees', () => {
    expect(basicNamePrice(input)).toEqual({
      resourceUsdCents: 5,
      minimumNetUsdCents: 105,
      cardUsdCents: 142,
      nativeTlosMinor: 715910n,
    });
  });
  it('raises and lowers the dollar price with resource cost and TLOS value', () => {
    expect(basicNamePrice({ ...input, resourceTlosMinor: 1000000n, median: 20000n })).toEqual({
      resourceUsdCents: 20000,
      minimumNetUsdCents: 20100,
      cardUsdCents: 21222,
      nativeTlosMinor: 1206000n,
    });
    expect(basicNamePrice({ ...input, resourceTlosMinor: 0n })).toEqual({
      resourceUsdCents: 0,
      minimumNetUsdCents: 100,
      cardUsdCents: 137,
      nativeTlosMinor: 681819n,
    });
  });
  it('does not lose the last cent to the percentage-fee rounding boundary', () => {
    expect(
      basicNamePrice({ ...input, resourceTlosMinor: 0n, cardFixedUsdCents: 0, cardFeeBps: 1 })
        .cardUsdCents,
    ).toBe(101);
    expect(
      basicNamePrice({ ...input, resourceTlosMinor: 0n, cardFixedUsdCents: 0, cardFeeBps: 0 })
        .cardUsdCents,
    ).toBe(100);
  });
  it.each([
    { cardFeeBps: 10000 },
    { cardFeeBps: -1 },
    { cardFixedUsdCents: -1 },
    { minimumProfitUsdCents: 0 },
    { median: 0n },
    { resourceTlosMinor: -1n },
    { resourceTlosMinor: 1000000000001n },
    { median: 1000000000000n, resourceTlosMinor: 1000000000000n },
  ])('rejects unsafe or unrepresentable monetary inputs %#', (change) => {
    expect(() => basicNamePrice({ ...input, ...change })).toThrow('NAME_PRICE_RANGE');
  });
});
