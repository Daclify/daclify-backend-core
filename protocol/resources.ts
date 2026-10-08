import { z } from 'zod';
import { checkedAdd, Uint64Schema } from './base.js';
import { DEFAULT_STORAGE_PRICING, StoragePricingSchema } from './storage.js';

export const RamPaymentRailSchema = z.enum(['tlos', 'card']);
export type RamPaymentRail = z.infer<typeof RamPaymentRailSchema>;
export const ResourcePolicySchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: Uint64Schema,
  nativeRamBps: z.int().min(0).max(10_000),
  cardRamBps: z.int().min(0).max(10_000),
  includedActivityBytes: Uint64Schema,
  identityBytesPerSlot: Uint64Schema,
  quoteLifetimeSeconds: z.int().min(1).max(3600),
  graceSeconds: z.literal(30 * 86_400),
  storage: StoragePricingSchema,
});
export type ResourcePolicy = z.infer<typeof ResourcePolicySchema>;
export const DEFAULT_RESOURCE_POLICY: ResourcePolicy = ResourcePolicySchema.parse({
  schemaVersion: 1,
  revision: '0',
  nativeRamBps: 500,
  cardRamBps: 2000,
  includedActivityBytes: '262144',
  identityBytesPerSlot: '2048',
  quoteLifetimeSeconds: 300,
  graceSeconds: 30 * 86_400,
  storage: DEFAULT_STORAGE_PRICING,
});

export function ramPurchasePrice(base: bigint, rail: RamPaymentRail, value: ResourcePolicy) {
  if (base <= 0n) throw new RangeError('RAM_AMOUNT_RANGE');
  checkedAdd(base, 0n);
  const policy = ResourcePolicySchema.parse(value);
  const rate = BigInt(
    RamPaymentRailSchema.parse(rail) === 'tlos' ? policy.nativeRamBps : policy.cardRamBps,
  );
  const numerator = base * rate;
  const fee = numerator / 10_000n + (numerator % 10_000n === 0n ? 0n : 1n);
  return { base, fee, total: checkedAdd(base, fee) };
}
