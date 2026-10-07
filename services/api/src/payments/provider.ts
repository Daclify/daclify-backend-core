import type Stripe from 'stripe';
import { z } from 'zod';
import { ApiError } from '../errors.js';
export function requireStripeConnectUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'connect.stripe.com' ||
    url.username ||
    url.password ||
    url.port
  )
    throw new ApiError('PAYMENT_REDIRECT', 502);
  return url.toString();
}
const Base = z.object({ id: z.string().regex(/^acct_[A-Za-z0-9]+$/), livemode: z.boolean() });
const V1 = Base.extend({
  type: z.literal('standard'),
  charges_enabled: z.boolean(),
  payouts_enabled: z.boolean(),
  controller: z
    .object({
      fees: z.object({ payer: z.enum(['account', 'stripe']) }),
      losses: z.object({ payments: z.literal('stripe') }),
      stripe_dashboard: z.object({ type: z.literal('full') }),
    })
    .optional(),
});
const V2 = Base.extend({
  object: z.literal('v2.core.account'),
  closed: z.boolean().optional(),
  dashboard: z.literal('full'),
  defaults: z.object({
    responsibilities: z.object({
      fees_collector: z.literal('stripe'),
      losses_collector: z.literal('stripe'),
    }),
  }),
  configuration: z
    .object({
      merchant: z
        .object({
          capabilities: z
            .object({
              card_payments: z.object({ status: z.string() }).optional(),
              stripe_balance: z
                .object({ payouts: z.object({ status: z.string() }).optional() })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
export function merchantReadiness(value: unknown, kind: 'oauth' | 'v2', livemode: boolean) {
  if (kind === 'oauth') {
    const parsed = V1.safeParse(value);
    if (!parsed.success) throw new ApiError('PAYMENT_MERCHANT_UNSUPPORTED', 409);
    if (parsed.data.livemode !== livemode) throw new ApiError('PAYMENT_MODE', 409);
    return {
      chargesEnabled: parsed.data.charges_enabled,
      payoutsEnabled: parsed.data.payouts_enabled,
    };
  }
  const parsed = V2.safeParse(value);
  if (!parsed.success || parsed.data.closed)
    throw new ApiError('PAYMENT_MERCHANT_UNSUPPORTED', 409);
  if (parsed.data.livemode !== livemode) throw new ApiError('PAYMENT_MODE', 409);
  const capabilities = parsed.data.configuration?.merchant?.capabilities;
  return {
    chargesEnabled: capabilities?.card_payments?.status === 'active',
    payoutsEnabled: capabilities?.stripe_balance?.payouts?.status === 'active',
  };
}
export function connectCheckoutParams(input: {
  id: string;
  title: string;
  amountMinor: number;
  applicationFeeMinor: number;
  returnUrl: string;
  daoKey: string;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = { purpose: 'dao-module', order_id: input.id, dao_key: input.daoKey };
  return {
    mode: 'payment',
    payment_method_types: ['card'],
    success_url: input.returnUrl,
    cancel_url: input.returnUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: input.amountMinor,
          product_data: { name: input.title },
        },
      },
    ],
    payment_intent_data: {
      metadata,
      ...(input.applicationFeeMinor ? { application_fee_amount: input.applicationFeeMinor } : {}),
    },
    metadata,
  };
}
