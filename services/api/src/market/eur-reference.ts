import { ceilDiv } from '../service-price.js';

export function decimalRatio(value: string): { numerator: bigint; denominator: bigint } {
  if (!/^\d{1,3}(?:\.\d{1,18})?$/.test(value)) throw new Error('NAME_FEE_REFERENCE');
  const [whole, fraction = ''] = value.split('.');
  const numerator = BigInt(String(whole) + fraction);
  const denominator = 10n ** BigInt(fraction.length);
  if (numerator <= 0n || numerator > 100n * denominator) throw new Error('NAME_FEE_REFERENCE');
  return { numerator, denominator };
}

export function eurCardFee(xml: string, now: Date): { fixedUsdCents: number; observedAt: number } {
  if (xml.length > 65536 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('NAME_FEE_REFERENCE');
  const dates = [...xml.matchAll(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/g)];
  const rates = [...xml.matchAll(/<Cube\s+currency=['"]USD['"]\s+rate=['"]([^'"]+)['"]\s*\/>/g)];
  const date = dates[0]?.[1];
  const rate = rates[0]?.[1];
  if (dates.length !== 1 || rates.length !== 1 || !date || !rate)
    throw new Error('NAME_FEE_REFERENCE');
  const millis = Date.parse(date + 'T00:00:00Z');
  if (
    !Number.isFinite(millis) ||
    new Date(millis).toISOString().slice(0, 10) !== date ||
    millis > now.getTime() ||
    now.getTime() - millis > 7 * 86400000
  )
    throw new Error('NAME_FEE_REFERENCE');
  const { numerator, denominator } = decimalRatio(rate);
  return {
    fixedUsdCents: Number(ceilDiv(25n * numerator, denominator)),
    observedAt: millis / 1000,
  };
}
