import { z } from 'zod';

export const SERVICE_PREMIUM_BPS = 2000;
export const SERVICE_RATE_MAX_AGE_SECONDS = 900;
export const TLOS_PRECISION = 4;
export const USD_PRECISION = 2;

const WholeSchema = z.union([
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^(0|[1-9][0-9]*)$/),
]);

export const DelphiDatapointSchema = z.object({
  id: WholeSchema,
  median: WholeSchema,
  timestamp: z.string().min(1),
});

export interface DelphiRate {
  median: bigint;
  observedAt: Date;
}

function whole(value: z.infer<typeof WholeSchema>): bigint {
  return BigInt(value);
}

function powerOfTen(precision: number): bigint {
  if (!Number.isInteger(precision) || precision < 0 || precision > 18)
    throw new Error('PRICE_SCALE');
  return 10n ** BigInt(precision);
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('PRICE_DENOMINATOR');
  if (numerator < 0n) throw new Error('PRICE_AMOUNT');
  return (numerator + denominator - 1n) / denominator;
}

// median / 10^quotedPrecision is the quote-currency price of one TLOS.
// fiatMinor uses the fiat currency's own decimals. The result is TLOS minor units.
export function requiredTlosMinor(input: {
  fiatMinor: bigint;
  fiatPrecision: number;
  median: bigint;
  quotedPrecision: number;
  tlosPrecision: number;
  premiumBps: number;
}): bigint {
  if (input.fiatMinor <= 0n || input.median <= 0n) throw new Error('PRICE_AMOUNT');
  if (!Number.isInteger(input.premiumBps) || input.premiumBps < 0 || input.premiumBps > 10_000) {
    throw new Error('PRICE_PREMIUM');
  }
  const numerator =
    input.fiatMinor *
    powerOfTen(input.quotedPrecision) *
    BigInt(10_000 + input.premiumBps) *
    powerOfTen(input.tlosPrecision);
  const denominator = powerOfTen(input.fiatPrecision) * input.median * 10_000n;
  return ceilDiv(numerator, denominator);
}

export type ServiceSettlement =
  | { status: 'underpaid'; shortfallMinor: bigint; tipMinor: 0n }
  | { status: 'paid'; shortfallMinor: 0n; tipMinor: bigint };

export function settleServiceAmount(
  requiredMinor: bigint,
  receivedMinor: bigint,
): ServiceSettlement {
  if (requiredMinor <= 0n || receivedMinor <= 0n) throw new Error('PRICE_AMOUNT');
  if (receivedMinor < requiredMinor) {
    return { status: 'underpaid', shortfallMinor: requiredMinor - receivedMinor, tipMinor: 0n };
  }
  return { status: 'paid', shortfallMinor: 0n, tipMinor: receivedMinor - requiredMinor };
}

export function parseDelphiTimestamp(value: string): Date {
  const utc = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(utc);
  if (Number.isNaN(parsed.getTime())) throw new Error('ORACLE_TIMESTAMP');
  return parsed;
}

export function selectDelphiRate(
  rows: readonly z.infer<typeof DelphiDatapointSchema>[],
  now: Date,
  maxAgeSeconds: number,
): DelphiRate {
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds <= 0) throw new Error('ORACLE_AGE');
  let selected: DelphiRate | undefined;
  for (const row of rows) {
    const observedAt = parseDelphiTimestamp(row.timestamp);
    const median = whole(row.median);
    if (median <= 0n) continue;
    if (!selected || observedAt.getTime() > selected.observedAt.getTime()) {
      selected = { median, observedAt };
    }
  }
  if (!selected) throw new Error('ORACLE_EMPTY');
  const ageSeconds = Math.floor((now.getTime() - selected.observedAt.getTime()) / 1000);
  if (ageSeconds > maxAgeSeconds) throw new Error('ORACLE_STALE');
  return selected;
}

export function formatTlosMinor(minor: bigint): string {
  if (minor < 0n) throw new Error('PRICE_AMOUNT');
  const scale = powerOfTen(TLOS_PRECISION);
  const wholeUnits = minor / scale;
  const fraction = (minor % scale).toString().padStart(TLOS_PRECISION, '0');
  return `${wholeUnits}.${fraction} TLOS`;
}
