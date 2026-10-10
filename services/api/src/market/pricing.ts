import { ceilDiv, requiredTlosMinor } from '../service-price.js';

export function basicNamePrice(input: {
  resourceTlosMinor: bigint;
  median: bigint;
  quotedPrecision: number;
  tlosPrecision: number;
  minimumProfitUsdCents: number;
  cardFeeBps: number;
  cardFixedUsdCents: number;
  nativePremiumBps: number;
}): {
  resourceUsdCents: number;
  minimumNetUsdCents: number;
  cardUsdCents: number;
  nativeTlosMinor: bigint;
} {
  const whole = (value: number, maximum: number, minimum = 0) =>
    Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  if (
    input.resourceTlosMinor < 0n ||
    input.resourceTlosMinor > 1000000000000n ||
    input.median <= 0n ||
    input.median > 1000000000000n ||
    !whole(input.quotedPrecision, 18) ||
    !whole(input.tlosPrecision, 18) ||
    input.quotedPrecision + input.tlosPrecision > 24 ||
    !whole(input.minimumProfitUsdCents, 100000000, 1) ||
    !whole(input.cardFeeBps, 9999) ||
    !whole(input.cardFixedUsdCents, 100000000) ||
    !whole(input.nativePremiumBps, 10000)
  )
    throw new Error('NAME_PRICE_RANGE');
  const resourceUsdCents = ceilDiv(
    input.resourceTlosMinor * input.median * 100n,
    10n ** BigInt(input.quotedPrecision + input.tlosPrecision),
  );
  const minimumNetUsdCents = resourceUsdCents + BigInt(input.minimumProfitUsdCents);
  const cardUsdCents = ceilDiv(
    (minimumNetUsdCents + BigInt(input.cardFixedUsdCents)) * 10000n,
    10000n - BigInt(input.cardFeeBps),
  );
  if (minimumNetUsdCents > 100000000n || cardUsdCents > 100000000n)
    throw new Error('NAME_PRICE_RANGE');
  const nativeTlosMinor = requiredTlosMinor({
    fiatMinor: minimumNetUsdCents,
    fiatPrecision: 2,
    median: input.median,
    quotedPrecision: input.quotedPrecision,
    tlosPrecision: input.tlosPrecision,
    premiumBps: input.nativePremiumBps,
  });
  if (nativeTlosMinor > 1000000000000n) throw new Error('NAME_PRICE_RANGE');
  return {
    resourceUsdCents: Number(resourceUsdCents),
    minimumNetUsdCents: Number(minimumNetUsdCents),
    cardUsdCents: Number(cardUsdCents),
    nativeTlosMinor,
  };
}
