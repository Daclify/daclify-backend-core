import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-07-29.dahlia' as const;

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

export function readStripeEvent(
  stripe: Stripe,
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new Error('SIGNATURE_INVALID');
  }
}
