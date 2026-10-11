import { z } from 'zod';
import { Checksum256 } from '@wharfkit/antelope';
import { NativeAccountSchema, Uint64Schema, DaoRefSchema, ChainIdSchema } from './base.js';
import { PaymentQuerySchema } from './payments.js';
export const ModuleFeeActionSchema = z.enum([
  'open',
  'newelect',
  'propose',
  'offeragr',
  'commit',
  'newround',
  'applygrant',
  'applyjoin',
  'recordact',
]);
export const ModuleFeePriceSchema = z.strictObject({
  account: NativeAccountSchema,
  revision: Uint64Schema,
  monthlyUsdCents: z
    .int()
    .min(0)
    .max(99999999)
    .refine((value) => value === 0 || value >= 50),
  actions: z
    .array(ModuleFeeActionSchema)
    .min(1)
    .max(16)
    .refine((value) => new Set(value).size === value.length),
});
export type ModuleFeePrice = z.infer<typeof ModuleFeePriceSchema>;
export function moduleFeePricingHash(value: ModuleFeePrice): string {
  return Checksum256.hash(
    new TextEncoder().encode(JSON.stringify(ModuleFeePriceSchema.parse(value))),
  ).toString();
}
export const ModuleFeeTermSchema = z.strictObject({
  account: NativeAccountSchema,
  expires: z.int().min(0).max(4294967295),
  receipt: ChainIdSchema,
  revoked: z.boolean(),
});
export const ModuleFeePricingSchema = z.strictObject({
  chainId: ChainIdSchema,
  runtime: NativeAccountSchema,
  interfaceVersion: z.literal(1),
  freeMembers: z.literal(10),
  plans: z
    .array(
      z.strictObject({
        pricing: ModuleFeePriceSchema,
        title: z.string().min(1).max(64),
        codeHash: ChainIdSchema,
      }),
    )
    .max(32),
});
export const ModuleFeeChainSchema = z.strictObject({
  dao: DaoRefSchema,
  activeMembers: z.int().min(0).max(5000),
  freeMembers: z.literal(10),
  modules: z
    .array(
      ModuleFeePricingSchema.shape.plans.element.extend({
        installed: z.boolean(),
        term: ModuleFeeTermSchema.nullable(),
      }),
    )
    .max(32),
});
export const ModuleFeeStatusSchema = ModuleFeeChainSchema.extend({
  configured: z.boolean(),
  paymentMode: z.enum(['test', 'live', 'unconfigured']),
});
export const ModuleFeeApprovalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  requestId: z.uuid(),
  dao: DaoRefSchema,
  account: NativeAccountSchema,
  pricingHash: ChainIdSchema,
  monthlyUsdCents: z.int().min(50).max(99999999),
  codeHash: ChainIdSchema,
});
export const ModuleFeeOrderStateSchema = z.enum([
  'pending',
  'paid',
  'active',
  'refunding',
  'refunded',
  'revoked',
  'expired',
  'review',
]);
export const ModuleFeeOrderSchema = z.strictObject({
  id: z.uuid(),
  approval: ModuleFeeApprovalSchema,
  state: ModuleFeeOrderStateSchema,
  checkoutUrl: z.url().nullable(),
  starts: z.int().min(0).max(4294967295).nullable(),
  expires: z.int().min(0).max(4294967295).nullable(),
  receipt: ChainIdSchema.nullable(),
});
export const ModuleFeeRoutes = {
  moduleFeePricing: {
    method: 'GET',
    path: '/v1/modules/pricing',
    response: ModuleFeePricingSchema,
    helpTopic: 'shared-hosting',
  },
  moduleFeeStatus: {
    method: 'GET',
    path: '/v1/modules/billing',
    query: PaymentQuerySchema,
    response: ModuleFeeStatusSchema,
    helpTopic: 'shared-hosting',
  },
  moduleFeeCheckout: {
    method: 'POST',
    path: '/v1/modules/billing/checkout',
    input: ModuleFeeApprovalSchema,
    response: ModuleFeeOrderSchema,
    helpTopic: 'shared-hosting',
  },
  moduleFeeOrder: {
    method: 'GET',
    path: '/v1/modules/billing/orders/:id',
    response: ModuleFeeOrderSchema,
    helpTopic: 'shared-hosting',
  },
} as const;
export type ModuleFeePricing = z.infer<typeof ModuleFeePricingSchema>;
export type ModuleFeeChain = z.infer<typeof ModuleFeeChainSchema>;
export type ModuleFeeStatus = z.infer<typeof ModuleFeeStatusSchema>;
export type ModuleFeeApproval = z.infer<typeof ModuleFeeApprovalSchema>;
export type ModuleFeeOrder = z.infer<typeof ModuleFeeOrderSchema>;
