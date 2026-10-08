import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_RESOURCE_POLICY,
  ResourcePolicySchema,
  ramPurchasePrice,
} from '../protocol/resources.js';
import { MAX_ASSET_UNITS } from '../protocol/base.js';

describe('RAM purchase policy', () => {
  it('applies exactly one fee to the full acquisition cost', () => {
    expect(ramPurchasePrice(100n, 'tlos', DEFAULT_RESOURCE_POLICY)).toEqual({
      base: 100n,
      fee: 5n,
      total: 105n,
    });
    expect(ramPurchasePrice(100n, 'card', DEFAULT_RESOURCE_POLICY)).toEqual({
      base: 100n,
      fee: 20n,
      total: 120n,
    });
    expect(ramPurchasePrice(101n, 'tlos', DEFAULT_RESOURCE_POLICY).fee).toBe(6n);
  });
  it('rejects nonpositive, out-of-range and overflowing native amounts', () => {
    for (const amount of [-1n, 0n, MAX_ASSET_UNITS, MAX_ASSET_UNITS + 1n])
      expect(() => ramPurchasePrice(amount, 'tlos', DEFAULT_RESOURCE_POLICY)).toThrow();
  });
  it('uses the approved policy revision without mutating the launch policy', () => {
    const revised = { ...DEFAULT_RESOURCE_POLICY, revision: '1', nativeRamBps: 1000 };
    expect(ramPurchasePrice(100n, 'tlos', revised).total).toBe(110n);
    expect(DEFAULT_RESOURCE_POLICY.nativeRamBps).toBe(500);
    expect(ResourcePolicySchema.safeParse({ ...revised, nativeRamBps: -1 }).success).toBe(false);
    expect(ResourcePolicySchema.safeParse({ ...revised, extra: true }).success).toBe(false);
    expect(ResourcePolicySchema.safeParse({ ...revised, revision: '01' }).success).toBe(false);
    expect(ResourcePolicySchema.safeParse({ ...revised, cardRamBps: 10_001 }).success).toBe(false);
  });
  it('rounds fees upward and conserves the quoted total for bounded amounts', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 1_000_000_000n }), (base) => {
        const quote = ramPurchasePrice(base, 'tlos', DEFAULT_RESOURCE_POLICY);
        expect(quote.total).toBe(base + quote.fee);
        expect(quote.fee * 10_000n).toBeGreaterThanOrEqual(base * 500n);
        expect((quote.fee - 1n) * 10_000n).toBeLessThan(base * 500n);
      }),
      { seed: 20261008 },
    );
  });
});
