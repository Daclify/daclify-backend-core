import { z } from 'zod';
import { ApiError } from '../errors.js';
import { ceilDiv } from '../service-price.js';
import { decimalRatio } from '../market/eur-reference.js';
import { classifyStripeEvent, type NamePurchase } from './name.js';

const money = z.number().int().min(0).max(100000000);
const sessionShape = z.object({
  id: z.string(),
  mode: z.literal('payment'),
  status: z.literal('complete'),
  payment_status: z.literal('paid'),
  currency: z.literal('usd'),
  amount_total: money,
  livemode: z.boolean(),
  payment_intent: z.string(),
});
const intentShape = z.object({
  id: z.string(),
  livemode: z.boolean(),
  currency: z.literal('usd'),
  status: z.literal('succeeded'),
  amount: money,
  amount_received: money,
  latest_charge: z.unknown(),
});
const chargeShape = z.object({
  id: z.string(),
  payment_intent: z.string(),
  livemode: z.boolean(),
  currency: z.literal('usd'),
  amount: money,
  paid: z.literal(true),
  captured: z.literal(true),
  refunded: z.literal(false),
  amount_refunded: z.literal(0),
  disputed: z.literal(false),
  balance_transaction: z.unknown(),
});
const balanceShape = z.object({
  id: z.string(),
  source: z.string(),
  currency: z.enum(['usd', 'eur']),
  amount: money,
  fee: money,
  net: money,
  exchange_rate: z.number().positive().nullable(),
});

// These values are retrieved from Stripe, never accepted from a checkout event alone.
export async function verifiedNamePayment(
  provider: { session(id: string): Promise<unknown>; intent(id: string): Promise<unknown> },
  id: string,
  purchase: NamePurchase,
  livemode: boolean,
): Promise<NamePurchase & { netUsdCents: number }> {
  const raw = await provider.session(id);
  const session = sessionShape.safeParse(raw);
  const decision = classifyStripeEvent({
    type: 'checkout.session.completed',
    data: { object: raw },
  });
  const invalid = () => new ApiError('NAME_RECEIPT_INVALID', 409);
  if (
    !session.success ||
    session.data.id !== id ||
    session.data.livemode !== livemode ||
    decision.kind !== 'purchase'
  )
    throw invalid();
  const receipt = decision.purchase;
  if (
    receipt.reference !== purchase.reference ||
    receipt.accountName !== purchase.accountName ||
    receipt.ownerKey !== purchase.ownerKey ||
    receipt.activeKey !== purchase.activeKey ||
    receipt.usdCents !== purchase.usdCents
  )
    throw invalid();
  const intent = intentShape.safeParse(await provider.intent(session.data.payment_intent));
  if (
    !intent.success ||
    intent.data.id !== session.data.payment_intent ||
    intent.data.livemode !== livemode ||
    intent.data.amount !== purchase.usdCents ||
    intent.data.amount_received !== purchase.usdCents
  )
    throw invalid();
  if (intent.data.latest_charge === null || typeof intent.data.latest_charge === 'string')
    throw new ApiError('NAME_FEE_PENDING', 503);
  const charge = chargeShape.safeParse(intent.data.latest_charge);
  if (
    !charge.success ||
    charge.data.payment_intent !== intent.data.id ||
    charge.data.livemode !== livemode ||
    charge.data.amount !== purchase.usdCents
  )
    throw invalid();
  if (
    charge.data.balance_transaction === null ||
    typeof charge.data.balance_transaction === 'string'
  )
    throw new ApiError('NAME_FEE_PENDING', 503);
  return {
    ...purchase,
    netUsdCents: verifiedNameBalance(
      charge.data.balance_transaction,
      purchase.usdCents,
      charge.data.id,
    ),
  };
}

export function verifiedNameBalance(value: unknown, usdCents: number, chargeId: string): number {
  const invalid = () => new ApiError('NAME_RECEIPT_INVALID', 409);
  if (!money.safeParse(usdCents).success || usdCents < 1) throw invalid();
  const balance = balanceShape.safeParse(value);
  if (
    !balance.success ||
    balance.data.source !== chargeId ||
    balance.data.net !== balance.data.amount - balance.data.fee
  )
    throw invalid();
  let net: bigint;
  if (balance.data.currency === 'usd') {
    if (
      balance.data.amount !== usdCents ||
      (balance.data.exchange_rate !== null && balance.data.exchange_rate !== 1)
    )
      throw invalid();
    net = BigInt(balance.data.net);
  } else {
    if (balance.data.exchange_rate === null) throw invalid();
    let ratio: ReturnType<typeof decimalRatio>;
    try {
      ratio = decimalRatio(String(balance.data.exchange_rate));
    } catch {
      throw invalid();
    }
    const expected = (BigInt(usdCents) * ratio.numerator) / ratio.denominator;
    if (BigInt(balance.data.amount) < expected - 1n || BigInt(balance.data.amount) > expected + 1n)
      throw invalid();
    const fromNet = (BigInt(balance.data.net) * ratio.denominator) / ratio.numerator;
    const fromFee =
      BigInt(usdCents) - ceilDiv(BigInt(balance.data.fee) * ratio.denominator, ratio.numerator);
    net = fromNet < fromFee ? fromNet : fromFee;
  }
  if (net < 1n || net > BigInt(usdCents)) throw invalid();
  return Number(net);
}
