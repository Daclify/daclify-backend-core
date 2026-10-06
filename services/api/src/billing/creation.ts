import { z } from 'zod';
const Purpose = z.object({
  data: z.object({
    object: z.object({ metadata: z.object({ purpose: z.literal('dao-creation') }) }),
  }),
});
const Event = z.object({
  type: z.string(),
  created: z.int().nonnegative(),
  data: z.object({
    object: z.object({
      id: z.string().regex(/^cs_[A-Za-z0-9_]+$/),
      mode: z.literal('payment'),
      payment_status: z.enum(['paid', 'unpaid', 'no_payment_required']),
      currency: z.literal('usd'),
      amount_total: z.int().positive().max(100000000),
      client_reference_id: z.uuid(),
      metadata: z.object({
        purpose: z.literal('dao-creation'),
        account_id: z.uuid(),
        order_id: z.uuid(),
      }),
    }),
  }),
});
export function creationCardEvent(value: unknown) {
  if (!Purpose.safeParse(value).success) return { kind: 'other' as const };
  const event = Event.safeParse(value);
  if (!event.success) return { kind: 'invalid' as const };
  const session = event.data.data.object;
  if (session.client_reference_id !== session.metadata.account_id)
    return { kind: 'invalid' as const };
  if (
    !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
      event.data.type,
    ) ||
    session.payment_status !== 'paid'
  )
    return { kind: 'ignore' as const };
  return {
    kind: 'paid' as const,
    input: {
      orderId: session.metadata.order_id,
      accountId: session.metadata.account_id,
      checkoutId: session.id,
      usdCents: session.amount_total,
      paidAt: event.data.created,
    },
  };
}
