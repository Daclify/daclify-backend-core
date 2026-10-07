import { z } from 'zod';
import { Checksum256 } from '@wharfkit/antelope';
import { DaoRefSchema, ChainIdSchema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { PaymentQuerySchema } from './payments.js';
export const HostingExtraSlotsSchema = z.int().min(0).max(4999);
export const HostedPricingSchema = z
  .strictObject({ freeSlots: z.int().min(1).max(5000), rates: RuntimeTableSchemas.seatcfg })
  .refine(
    ({ rates }) =>
      rates.first_usd >= 50 &&
      rates.first_usd <= 99999 &&
      rates.next_usd > 0 &&
      rates.next_usd <= rates.first_usd &&
      rates.rest_usd > 0 &&
      rates.rest_usd <= rates.next_usd,
  );
export type HostedPricing = z.infer<typeof HostedPricingSchema>;
export const HostingChainSchema = z.strictObject({
  dao: DaoRefSchema,
  pricing: HostedPricingSchema,
  activeMembers: z.int().nonnegative().max(5000),
  effectiveCapacity: z.int().min(1).max(5000),
  expires: z.int().nonnegative().nullable(),
  receipt: ChainIdSchema.nullable(),
  exempt: z.boolean(),
});
export function hostedMonthlyPrice(extraSlots: number, value: HostedPricing): number {
  const pricing = HostedPricingSchema.parse(value),
    extra = HostingExtraSlotsSchema.parse(extraSlots);
  if (extra + pricing.freeSlots > 5000) throw new Error('HOSTING_CAPACITY_RANGE');
  return (
    Math.min(extra, 40) * pricing.rates.first_usd +
    Math.min(Math.max(extra - 40, 0), 200) * pricing.rates.next_usd +
    Math.max(extra - 240, 0) * pricing.rates.rest_usd
  );
}
export function hostedPricingHash(value: HostedPricing): string {
  return Checksum256.hash(
    new TextEncoder().encode(JSON.stringify(HostedPricingSchema.parse(value))),
  ).toString();
}
export const HostingSubscriptionSchema = z.strictObject({
  id: z.uuid(),
  requestId: z.uuid(),
  state: z.enum(['pending', 'active', 'past-due', 'canceling', 'ended', 'review']),
  extraSlots: HostingExtraSlotsSchema,
  pricing: HostedPricingSchema,
  monthlyUsdCents: z.int().nonnegative(),
  checkoutUrl: z.url().nullable(),
  invoiceUrl: z.url().nullable(),
  pendingChange: z
    .strictObject({
      requestId: z.uuid(),
      extraSlots: HostingExtraSlotsSchema,
      pricing: HostedPricingSchema,
      monthlyUsdCents: z.int().nonnegative(),
    })
    .nullable(),
});
export const HostingStatusSchema = HostingChainSchema.extend({
  configured: z.boolean(),
  subscription: HostingSubscriptionSchema.nullable(),
});
export const HostingChangeInputSchema = z.strictObject({
  dao: DaoRefSchema,
  requestId: z.uuid(),
  extraSlots: HostingExtraSlotsSchema,
  pricingHash: ChainIdSchema,
  monthlyUsdCents: z.int().nonnegative().max(499900000),
  acceptCurrentPricing: z.boolean().default(false),
});
export const HostingRoutes = {
  hostingStatus: {
    method: 'GET',
    path: '/v1/hosting/status',
    query: PaymentQuerySchema,
    response: HostingStatusSchema,
    helpTopic: 'shared-hosting',
  },
  hostingChange: {
    method: 'POST',
    path: '/v1/hosting/change',
    input: HostingChangeInputSchema,
    response: HostingStatusSchema,
    helpTopic: 'shared-hosting',
  },
} as const;
export type HostingChain = z.infer<typeof HostingChainSchema>;
export type HostingStatus = z.infer<typeof HostingStatusSchema>;
export type HostingChangeInput = z.infer<typeof HostingChangeInputSchema>;
