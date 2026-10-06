import { z } from 'zod';

const fulfillTypes = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

export type ServiceDecision =
  | { kind: 'ignore'; reason: 'UNPAID' | 'EVENT_TYPE' | 'SESSION_SHAPE' }
  | {
      kind: 'fulfill';
      eventId: string;
      checkoutId: string;
      accountId: string;
      priceId: string;
      amountMinor: number;
      currency: string;
      paymentStatus: 'paid' | 'no_payment_required';
    }
  | {
      kind: 'fail';
      eventId: string;
      checkoutId: string;
      accountId: string;
      priceId: string;
    };

interface SessionView {
  id: string;
  accountId: string;
  priceId: string;
  amountMinor: number;
  currency: string;
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
}

export function decideStripeEvent(value: unknown): ServiceDecision {
  const event = readEvent(value);
  if (!event) return { kind: 'ignore', reason: 'EVENT_TYPE' };
  if (event.type === 'checkout.session.async_payment_failed') {
    const session = readSession(event.object);
    if (!session) return { kind: 'ignore', reason: 'SESSION_SHAPE' };
    return {
      kind: 'fail',
      eventId: event.id,
      checkoutId: session.id,
      accountId: session.accountId,
      priceId: session.priceId,
    };
  }
  if (!fulfillTypes.has(event.type)) return { kind: 'ignore', reason: 'EVENT_TYPE' };
  const session = readSession(event.object);
  if (!session) return { kind: 'ignore', reason: 'SESSION_SHAPE' };
  if (session.paymentStatus === 'unpaid') return { kind: 'ignore', reason: 'UNPAID' };
  return {
    kind: 'fulfill',
    eventId: event.id,
    checkoutId: session.id,
    accountId: session.accountId,
    priceId: session.priceId,
    amountMinor: session.amountMinor,
    currency: session.currency,
    paymentStatus: session.paymentStatus,
  };
}

function readEvent(value: unknown): { id: string; type: string; object: unknown } | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('id' in value) || typeof value.id !== 'string' || value.id.length === 0) return undefined;
  if (!('type' in value) || typeof value.type !== 'string') return undefined;
  if (!('data' in value) || typeof value.data !== 'object' || value.data === null) return undefined;
  if (!('object' in value.data)) return undefined;
  return { id: value.id, type: value.type, object: value.data.object };
}

function readSession(value: unknown): SessionView | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('id' in value) || typeof value.id !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(value.id)) {
    return undefined;
  }
  if (!('payment_status' in value)) return undefined;
  if (
    value.payment_status !== 'paid' &&
    value.payment_status !== 'unpaid' &&
    value.payment_status !== 'no_payment_required'
  ) {
    return undefined;
  }
  if (!('client_reference_id' in value) || typeof value.client_reference_id !== 'string') {
    return undefined;
  }
  const accountId = z.uuid().safeParse(value.client_reference_id);
  if (!accountId.success) return undefined;
  if (!('metadata' in value)) return undefined;
  const metadata = readMetadata(value.metadata);
  if (!metadata || metadata.purpose !== 'service' || metadata.account_id !== accountId.data) {
    return undefined;
  }
  if (!/^price_[A-Za-z0-9]+$/.test(metadata.price_id ?? '')) return undefined;
  if (!('amount_total' in value) || typeof value.amount_total !== 'number') return undefined;
  if (!Number.isSafeInteger(value.amount_total) || value.amount_total < 0) return undefined;
  if (!('currency' in value) || typeof value.currency !== 'string') return undefined;
  if (!/^[a-z]{3}$/.test(value.currency)) return undefined;
  return {
    id: value.id,
    accountId: accountId.data,
    priceId: metadata.price_id ?? '',
    amountMinor: value.amount_total,
    currency: value.currency,
    paymentStatus: value.payment_status,
  };
}

function readMetadata(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') return undefined;
    metadata[key] = entry;
  }
  return metadata;
}
