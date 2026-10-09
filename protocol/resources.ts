import { z } from 'zod';
import {
  checkedAdd,
  Uint64Schema,
  DaoRefSchema,
  NativeAccountSchema,
  IdSchema,
  MAX_ASSET_UNITS,
} from './base.js';
import { RuntimeTableSchemas, RuntimeActionSchemas } from '../sdk/generated/schemas.js';
import { DEFAULT_STORAGE_PRICING, StoragePricingSchema, STORAGE_GRACE_SECONDS } from './storage.js';
import { SpendingReportSchema } from './reporting.js';

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
  graceSeconds: z.literal(STORAGE_GRACE_SECONDS),
  storage: StoragePricingSchema,
});
export type ResourcePolicy = z.infer<typeof ResourcePolicySchema>;
export const RamPayerUsageSchema = z.strictObject({
  payer: NativeAccountSchema,
  moduleId: z.string().min(1).max(64).nullable(),
  sourceVerified: z.boolean(),
  usage: RuntimeTableSchemas.ramstats
    .pick({ identity: true, activity: true, retained: true, platform: true })
    .nullable(),
  purchasedBytes: Uint64Schema,
  allocation: RuntimeTableSchemas.ramlimits
    .pick({ activity: true, identity: true, completion: true })
    .nullable()
    .default(null),
  entitlement: RuntimeTableSchemas.ramentitle
    .pick({ policy_revision: true, identity_per_slot: true, slots: true })
    .nullable()
    .default(null),
  globalQuotaBytes: Uint64Schema.nullable(),
  globalUsedBytes: Uint64Schema,
});
export const RamUsageSchema = z
  .strictObject({
    dao: DaoRefSchema,
    observation: z.enum(['active', 'disabled']),
    enforcement: z.literal('disabled'),
    completionHolds: z
      .strictObject({ rows: z.int().min(0).max(5000), bytes: Uint64Schema })
      .nullable()
      .default(null),
    policy: ResourcePolicySchema.nullable(),
    read: SpendingReportSchema.shape.read,
    totalObservedBytes: Uint64Schema.nullable(),
    purchasedBytes: Uint64Schema,
    payers: z
      .array(RamPayerUsageSchema)
      .min(1)
      .max(64)
      .refine((rows) => new Set(rows.map((r) => r.payer)).size === rows.length),
  })
  .superRefine((value, context) => {
    const valid =
        value.observation === 'active' &&
        value.payers.every((p) => p.sourceVerified && p.usage !== null),
      observed = value.payers.reduce(
        (n, p) =>
          n +
          (p.usage
            ? BigInt(p.usage.identity) +
              BigInt(p.usage.activity) +
              BigInt(p.usage.retained) +
              BigInt(p.usage.platform)
            : 0n),
        0n,
      ),
      purchased = value.payers.reduce((n, p) => n + BigInt(p.purchasedBytes), 0n);
    if (
      value.totalObservedBytes !== (valid ? observed.toString() : null) ||
      value.purchasedBytes !== purchased.toString() ||
      value.payers.some((p) => (value.observation === 'active') === (p.usage === null)) ||
      Date.parse(value.read.completedAt) < Date.parse(value.read.startedAt)
    )
      context.addIssue({ code: 'custom', message: 'RESOURCE_RESPONSE_INCONSISTENT' });
  });
export type RamUsage = z.infer<typeof RamUsageSchema>;
export const RamQuoteRequestSchema = z.strictObject({
  dao: DaoRefSchema,
  payer: NativeAccountSchema,
  allocations: z
    .array(z.strictObject({ receiver: NativeAccountSchema, minimumBytes: IdSchema }))
    .min(1)
    .max(6)
    .refine((rows) => new Set(rows.map((r) => r.receiver)).size === rows.length),
});
export type RamQuoteRequest = z.infer<typeof RamQuoteRequestSchema>;
export const RamQuoteSchema = z
  .strictObject({
    dao: DaoRefSchema,
    rail: z.literal('tlos'),
    baseUnits: IdSchema,
    feeUnits: Uint64Schema,
    totalUnits: IdSchema,
    feeBps: z.int().min(0).max(10000),
    order: RuntimeActionSchemas.orderram,
    systemCodeHash: z.string().regex(/^[0-9a-f]{64}$/),
    systemRawAbiHash: z.string().regex(/^[0-9a-f]{64}$/),
    quotedAt: z.iso.datetime(),
  })
  .superRefine((v, ctx) => {
    const base = BigInt(v.baseUnits),
      fee = (base * BigInt(v.feeBps) + 9999n) / 10000n;
    let valid = false;
    try {
      valid =
        v.order.dao_id === v.dao.daoId &&
        v.order.payer !== v.dao.contract &&
        v.feeUnits === fee.toString() &&
        v.totalUnits === (base + fee).toString() &&
        v.order.maximum === tlosAsset(base + fee) &&
        v.order.purchases.length > 0 &&
        v.order.purchases.length <= 6 &&
        new Set(v.order.purchases.map((p) => p.receiver)).size === v.order.purchases.length &&
        v.order.purchases.every((p) => BigInt(p.minimum_bytes) > 0n) &&
        v.order.purchases.reduce((n, p) => n + tlosUnits(p.quantity), 0n) === base &&
        v.order.expires > Date.parse(v.quotedAt) / 1000 &&
        v.order.expires <= Date.parse(v.quotedAt) / 1000 + 3600;
    } catch {
      valid = false;
    }
    if (!valid) ctx.addIssue({ code: 'custom', message: 'RAM_QUOTE_INCONSISTENT' });
  });
export type RamQuote = z.infer<typeof RamQuoteSchema>;
export const CardRamTermsSchema = z.strictObject({
  quote: RamQuoteSchema,
  policy: ResourcePolicySchema,
  oracle: RuntimeTableSchemas.createcfg.pick({ median: true, precision: true, observed_at: true }),
  baseUsdCents: z.int().positive().max(99999999),
  feeUsdCents: z.int().nonnegative().max(99999999),
  totalUsdCents: z.int().min(500).max(99999999),
});
export const CardRamApprovalSchema = CardRamTermsSchema.extend({
  requestId: z.uuid(),
  consent: z.literal(true),
}).superRefine((v, ctx) => {
  try {
    const expected = cardRamPrice(
      BigInt(v.quote.baseUnits),
      v.oracle.median,
      v.oracle.precision,
      v.policy,
    );
    if (
      v.quote.order.policy_revision !== v.policy.revision ||
      expected.base !== BigInt(v.baseUsdCents) ||
      expected.fee !== BigInt(v.feeUsdCents) ||
      expected.total !== BigInt(v.totalUsdCents)
    )
      throw new Error('price');
  } catch {
    ctx.addIssue({ code: 'custom', message: 'RAM_APPROVAL_INCONSISTENT' });
  }
});
export type CardRamApproval = z.infer<typeof CardRamApprovalSchema>;
export const CardRamOrderSchema = z.strictObject({
  id: z.uuid(),
  dao: DaoRefSchema,
  state: z.enum(['pending', 'paid', 'provisioning', 'settled', 'review']),
  approval: CardRamApprovalSchema,
  checkoutUrl: z.url().nullable(),
  acquiredBytes: Uint64Schema.nullable(),
  settledAt: z.iso.datetime().nullable(),
});
export function cardRamPrice(
  nativeBase: bigint,
  median: string,
  precision: number,
  policy: ResourcePolicy,
) {
  const rate = BigInt(Uint64Schema.parse(median));
  if (
    rate <= 0n ||
    nativeBase <= 0n ||
    nativeBase > MAX_ASSET_UNITS ||
    !Number.isInteger(precision) ||
    precision < 0 ||
    precision > 18
  )
    throw new RangeError('RAM_RATE_RANGE');
  const divisor = 10000n * 10n ** BigInt(precision),
    numerator = nativeBase * rate * 100n;
  const base = (numerator + divisor - 1n) / divisor;
  return ramPurchasePrice(base, 'card', policy);
}
function tlosUnits(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)\.[0-9]{4} TLOS$/.test(value)) throw new RangeError('RAM_AMOUNT_RANGE');
  const amount = BigInt(value.replace('.', '').split(' ')[0] ?? '');
  if (amount <= 0n || amount > MAX_ASSET_UNITS) throw new RangeError('RAM_AMOUNT_RANGE');
  return amount;
}
export function tlosAsset(units: bigint): string {
  if (units < 0n || units > MAX_ASSET_UNITS) throw new RangeError('RAM_AMOUNT_RANGE');
  return `${units / 10000n}.${(units % 10000n).toString().padStart(4, '0')} TLOS`;
}
// This is a bounded estimate; the native minimum check is the authority on actual acquired bytes.
export function ramMarketCost(bytes: bigint, ramReserve: bigint, tokenReserve: bigint): bigint {
  if (bytes <= 0n || bytes >= ramReserve || tokenReserve <= 0n)
    throw new RangeError('RAM_MARKET_RANGE');
  const net = (tokenReserve * bytes + ramReserve - bytes - 1n) / (ramReserve - bytes);
  const cost = (net * 200n + 198n) / 199n + 2n;
  if (cost > MAX_ASSET_UNITS) throw new RangeError('RAM_AMOUNT_RANGE');
  return cost;
}
export const DEFAULT_RESOURCE_POLICY: ResourcePolicy = ResourcePolicySchema.parse({
  schemaVersion: 1,
  revision: '0',
  nativeRamBps: 500,
  cardRamBps: 2000,
  includedActivityBytes: '262144',
  identityBytesPerSlot: '2048',
  quoteLifetimeSeconds: 300,
  graceSeconds: STORAGE_GRACE_SECONDS,
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

const PackedRowBytesSchema = z.int().min(0).max(4_294_967_295);
const IndexWidthsSchema = z.array(z.union([z.literal(8), z.literal(16), z.literal(32)])).max(16);
// Spring 1.2.2 billing layout 1; target-chain qualification is required before enforcement.
export function ramRowBytes(packedBytes: number, indexWidths: readonly number[]): bigint {
  const widths = IndexWidthsSchema.parse(indexWidths);
  return (
    BigInt(PackedRowBytesSchema.parse(packedBytes)) +
    112n +
    widths.reduce((sum, width) => sum + BigInt(Math.ceil((24 + width + 96) / 16) * 16), 0n)
  );
}
export function ramScopeBytes(indexCount: number): bigint {
  return BigInt(Math.max(1, z.int().min(0).max(16).parse(indexCount))) * 112n;
}

export function resourcePolicyFromRow(value: unknown): ResourcePolicy {
  const row = RuntimeTableSchemas.resourcecfg.parse(value);
  return ResourcePolicySchema.parse({
    schemaVersion: row.schema_version,
    revision: row.revision,
    nativeRamBps: row.native_ram_bps,
    cardRamBps: row.card_ram_bps,
    includedActivityBytes: row.included_activity_bytes,
    identityBytesPerSlot: row.identity_bytes_per_slot,
    quoteLifetimeSeconds: row.quote_lifetime_seconds,
    graceSeconds: row.grace_seconds,
    storage: {
      schemaVersion: row.schema_version,
      revision: row.revision,
      freeBytes: row.storage_free_bytes,
      unitBytes: row.storage_unit_bytes,
      monthlyUnitUsdCents: row.storage_monthly_usd,
    },
  });
}
