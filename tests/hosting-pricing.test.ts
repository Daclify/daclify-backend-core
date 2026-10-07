import { describe, expect, it } from 'vitest';
import {
  HostedPricingSchema,
  hostedMonthlyPrice,
  hostedPricingHash,
  HostingChangeInputSchema,
} from '../protocol/hosting.js';
describe('administrator-approved graduated capacity pricing', () => {
  const pricing = {
    freeSlots: 10,
    rates: { first_usd: 100, next_usd: 50, rest_usd: 20, revision: '0' },
  };
  it('calculates integer cents by band without price cliffs', () => {
    for (const [total, cents] of [
      [10, 0],
      [11, 100],
      [50, 4000],
      [51, 4050],
      [250, 14000],
      [251, 14020],
      [1000, 29000],
    ] as const)
      expect(hostedMonthlyPrice(total - 10, pricing)).toBe(cents);
    for (let extra = 1; extra <= 4990; extra++)
      expect(hostedMonthlyPrice(extra, pricing)).toBeGreaterThan(
        hostedMonthlyPrice(extra - 1, pricing),
      );
    expect(() => hostedMonthlyPrice(-1, pricing)).toThrow();
    expect(() => hostedMonthlyPrice(4991, pricing)).toThrow();
  });
  it('binds explicit approval to the complete pricing snapshot and amount', () => {
    expect(hostedPricingHash(pricing)).toMatch(/^[a-f0-9]{64}$/);
    expect(hostedPricingHash({ ...pricing, freeSlots: 11 })).not.toBe(hostedPricingHash(pricing));
    expect(hostedPricingHash({ ...pricing, rates: { ...pricing.rates, rest_usd: 25 } })).not.toBe(
      hostedPricingHash(pricing),
    );
    expect(
      HostedPricingSchema.safeParse({ ...pricing, rates: { ...pricing.rates, rest_usd: 500 } })
        .success,
    ).toBe(false);
    expect(HostingChangeInputSchema.safeParse({ extraSlots: 1, amountMinor: 1 }).success).toBe(
      false,
    );
  });
});
