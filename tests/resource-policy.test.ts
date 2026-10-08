import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_RESOURCE_POLICY,
  ResourcePolicySchema,
  ramPurchasePrice,
  ramRowBytes,
  ramScopeBytes,
  ramMarketCost,
  tlosAsset,
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
  it('includes aligned native row/index/header costs rather than JSON character count', () => {
    expect(ramRowBytes(33, [16])).toBe(289n);
    expect(ramRowBytes(144, [8, 16, 32])).toBe(688n);
    expect(ramScopeBytes(0)).toBe(112n);
    expect(ramScopeBytes(1)).toBe(112n);
    expect(ramScopeBytes(3)).toBe(336n);
    for (const [bytes, widths] of [
      [-1, [8]],
      [1.5, [8]],
      [1, [12]],
      [1, Array(17).fill(8)],
    ] as const)
      expect(() => ramRowBytes(bytes, widths)).toThrow();
    expect(() => ramScopeBytes(17)).toThrow();
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

it('prices acquisition with the native system fee included and handles integer boundaries', () => {
  expect(tlosAsset(123n)).toBe('0.0123 TLOS');
  expect(tlosAsset(10000n)).toBe('1.0000 TLOS');
  for (const bytes of [0n, -1n, 1000000n])
    expect(() => ramMarketCost(bytes, 1000000n, 10000n)).toThrow();
  fc.assert(
    fc.property(fc.bigInt({ min: 1n, max: 999999n }), (bytes) => {
      const cost = ramMarketCost(bytes, 1000000n, 10000n);
      const nativeFee = (cost + 199n) / 200n;
      const net = cost - nativeFee;
      expect((net * 1000000n) / (10000n + net)).toBeGreaterThanOrEqual(bytes);
      expect(ramPurchasePrice(cost, 'tlos', DEFAULT_RESOURCE_POLICY).total).toBe(
        cost + (cost * 500n + 9999n) / 10000n,
      );
    }),
    { seed: 20261008 },
  );
});
