import type Stripe from 'stripe';
import { ApiError } from '../errors.js';

export async function verifiedRecurringInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  subscriptionId: string,
  livemode: boolean,
  purpose: 'HOSTING' | 'STORAGE',
): Promise<boolean> {
  const parent = invoice.parent?.subscription_details?.subscription;
  if (
    invoice.livemode !== livemode ||
    invoice.currency !== 'usd' ||
    (typeof parent === 'string' ? parent : parent?.id) !== subscriptionId
  )
    throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
  if (invoice.status !== 'paid' || invoice.amount_remaining !== 0 || invoice.amount_paid <= 0)
    return false;
  const payments = await stripe.invoicePayments.list(
    { invoice: invoice.id, status: 'paid', limit: 100 },
    { timeout: 15000 },
  );
  if (payments.has_more) throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
  let paid = 0;
  const seen = new Set<string>();
  for (const payment of payments.data) {
    const invoiceId = typeof payment.invoice === 'string' ? payment.invoice : payment.invoice.id;
    const intentId =
      typeof payment.payment.payment_intent === 'string'
        ? payment.payment.payment_intent
        : payment.payment.payment_intent?.id;
    if (
      payment.livemode !== livemode ||
      payment.status !== 'paid' ||
      seen.has(payment.id) ||
      payment.currency !== 'usd' ||
      invoiceId !== invoice.id ||
      payment.payment.type !== 'payment_intent' ||
      !intentId ||
      payment.amount_paid === null ||
      !Number.isSafeInteger(payment.amount_paid) ||
      payment.amount_paid < 0
    )
      throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
    seen.add(payment.id);
    const intent = await stripe.paymentIntents.retrieve(
      intentId,
      { expand: ['latest_charge'] },
      { timeout: 15000 },
    );
    if (
      intent.id !== intentId ||
      intent.livemode !== livemode ||
      intent.currency !== 'usd' ||
      intent.status !== 'succeeded' ||
      intent.amount_received < payment.amount_paid
    )
      throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
    const charge = intent.latest_charge;
    if (
      !charge ||
      typeof charge === 'string' ||
      !charge.paid ||
      charge.livemode !== livemode ||
      charge.currency !== 'usd' ||
      (typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id) !== intentId ||
      charge.amount < payment.amount_paid
    )
      throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
    if (
      charge.amount_refunded >= charge.amount ||
      (purpose === 'STORAGE' && charge.amount_refunded > 0)
    )
      return false;
    if (charge.disputed) {
      const disputes = await stripe.disputes.list(
        { payment_intent: intentId, limit: 1 },
        { timeout: 15000 },
      );
      if (disputes.data[0]?.status !== 'won') return false;
    }
    paid += payment.amount_paid;
    if (!Number.isSafeInteger(paid)) throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
  }
  if (paid !== invoice.amount_paid) throw new ApiError(`${purpose}_RECEIPT_INVALID`, 409);
  return true;
}
