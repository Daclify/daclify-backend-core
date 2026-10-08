import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STORAGE_PRICING,
  StoragePricingSchema,
  storageCapacity,
  monthlyStorageUsdCents,
  storagePricingHash,
  validateStorageApproval,
} from '../protocol/storage.js';

describe('administrator-approved pinned storage', () => {
  it('provides 100 decimal MB free and adds one decimal GB per approved paid unit', () => {
    for (const [units, bytes, cents] of [
      [0, 100_000_000n, 0],
      [1, 1_100_000_000n, 100],
      [5, 5_100_000_000n, 500],
    ] as const) {
      expect(storageCapacity(units, DEFAULT_STORAGE_PRICING)).toBe(bytes);
      expect(monthlyStorageUsdCents(units, DEFAULT_STORAGE_PRICING)).toBe(cents);
    }
  });
  it('rejects invalid units and unrepresentable capacity or Stripe amounts', () => {
    for (const units of [-1, 0.1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000]) {
      expect(() => storageCapacity(units, DEFAULT_STORAGE_PRICING)).toThrow();
      expect(() => monthlyStorageUsdCents(units, DEFAULT_STORAGE_PRICING)).toThrow();
    }
    expect(() =>
      storageCapacity(1, { ...DEFAULT_STORAGE_PRICING, freeBytes: '18446744073709551615' }),
    ).toThrow();
    expect(() =>
      monthlyStorageUsdCents(999_999, { ...DEFAULT_STORAGE_PRICING, monthlyUnitUsdCents: 100_000 }),
    ).toThrow();
  });
  it('binds an accepted agreement to the complete immutable pricing snapshot', () => {
    const original = storagePricingHash(DEFAULT_STORAGE_PRICING);
    expect(original).toMatch(/^[a-f0-9]{64}$/);
    for (const value of [
      { ...DEFAULT_STORAGE_PRICING, revision: '1' },
      { ...DEFAULT_STORAGE_PRICING, freeBytes: '100000001' },
      { ...DEFAULT_STORAGE_PRICING, unitBytes: '1000000001' },
      { ...DEFAULT_STORAGE_PRICING, monthlyUnitUsdCents: 200 },
    ])
      expect(storagePricingHash(value)).not.toBe(original);
    expect(
      StoragePricingSchema.safeParse({ ...DEFAULT_STORAGE_PRICING, unitBytes: '0' }).success,
    ).toBe(false);
    expect(
      StoragePricingSchema.safeParse({ ...DEFAULT_STORAGE_PRICING, freeBytes: '01' }).success,
    ).toBe(false);
    expect(
      StoragePricingSchema.safeParse({ ...DEFAULT_STORAGE_PRICING, monthlyUnitUsdCents: 0 })
        .success,
    ).toBe(false);
    expect(
      StoragePricingSchema.safeParse({ ...DEFAULT_STORAGE_PRICING, archiveSurcharge: 100 }).success,
    ).toBe(false);
  });
});

it('requires consent to exact approved storage capacity and immutable prices', () => {
  const value = {
    schemaVersion: 1,
    requestId: '8ef6cfa7-4da5-46cb-8a4b-73e7df738172',
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    units: 1,
    pricingHash: storagePricingHash(DEFAULT_STORAGE_PRICING),
    monthlyUsdCents: 100,
    recurringConsent: true,
  };
  expect(validateStorageApproval(value, DEFAULT_STORAGE_PRICING).units).toBe(1);
  expect(() =>
    validateStorageApproval({ ...value, recurringConsent: false }, DEFAULT_STORAGE_PRICING),
  ).toThrow();
  expect(() => validateStorageApproval({ ...value, units: 2 }, DEFAULT_STORAGE_PRICING)).toThrow(
    'STORAGE_APPROVAL_CHANGED',
  );
  expect(() =>
    validateStorageApproval(value, {
      ...DEFAULT_STORAGE_PRICING,
      revision: '1',
      monthlyUnitUsdCents: 125,
    }),
  ).toThrow('STORAGE_APPROVAL_CHANGED');
  expect(
    validateStorageApproval(
      { ...value, units: 0, monthlyUsdCents: 0, recurringConsent: false },
      DEFAULT_STORAGE_PRICING,
    ).units,
  ).toBe(0);
});
