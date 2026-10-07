import { z } from 'zod';
import { DaoRefSchema, Uint64Schema } from './base.js';

export const PaymentAmountSchema = z.int().min(50).max(99999999);
export const PaymentBasisPointsSchema = z.int().min(0).max(9999);
export const PaymentPolicySchema = z.strictObject({
  basisPoints: PaymentBasisPointsSchema.default(500),
  revision: Uint64Schema,
});
export const PublicEndpointSchema = z
  .url()
  .max(512)
  .refine((value) => {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !url.port &&
      !host.includes(':') &&
      !/^\d+(?:\.\d+){3}$/.test(host) &&
      host.includes('.') &&
      !host.endsWith('.localhost') &&
      !host.endsWith('.local') &&
      !host.endsWith('.internal') &&
      host !== 'localhost'
    );
  }, 'A public HTTPS endpoint without credentials or query parameters is required');
export const PublicApiOriginSchema = PublicEndpointSchema.refine(
  (value) => new URL(value).pathname === '/',
);
export const DeploymentOptionSchema = z.enum(['shared', 'self-hosted', 'external-portal']);
export const DeploymentOptions = [
  {
    id: 'shared',
    title: 'Shared contracts and hosting',
    price: 'Free · up to 10 active members',
    description:
      'Daclify operates the contracts and server. Approve additional slots with graduated monthly pricing.',
  },
  {
    id: 'self-hosted',
    title: 'Your contracts and server',
    price: 'Contact for pricing',
    description: 'Operate your contracts and backend, and connect through the Daclify app.',
  },
  {
    id: 'external-portal',
    title: 'Your complete DAO portal',
    price: 'Contact for pricing',
    description: 'Operate your contracts, backend and frontend. The Hub links to your portal.',
  },
] as const;
export const PaymentDaoInputSchema = z.strictObject({ dao: DaoRefSchema });
export const PaymentProductInputSchema = PaymentDaoInputSchema.extend({
  id: z.uuid(),
  moduleId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  title: z.string().trim().min(1).max(100),
  amountMinor: PaymentAmountSchema,
  active: z.boolean().default(true),
});
export const PaymentProductSchema = PaymentProductInputSchema.extend({
  currency: z.literal('usd'),
});
export const PaymentStatusSchema = z.strictObject({
  dao: DaoRefSchema,
  configured: z.boolean(),
  accountId: z
    .string()
    .regex(/^acct_[A-Za-z0-9]+$/)
    .nullable(),
  accountKind: z.enum(['oauth', 'v2']).nullable(),
  state: z.enum(['not-connected', 'pending', 'ready', 'restricted', 'disconnected']),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  policy: PaymentPolicySchema.nullable(),
  products: z.array(PaymentProductSchema),
  brokerConfigured: z.boolean(),
  merchantSetupUrl: z.url().nullable().default(null),
});
export const PaymentCatalogueSchema = z.strictObject({
  dao: DaoRefSchema,
  enabled: z.boolean(),
  policy: PaymentPolicySchema.nullable(),
  products: z.array(PaymentProductSchema),
});
export const PaymentOnboardInputSchema = PaymentDaoInputSchema.extend({
  mode: z.enum(['existing', 'new', 'resume']),
});
export const StripeAuthorizationSchema = z.strictObject({ url: z.url() });
export const PaymentCheckoutInputSchema = PaymentDaoInputSchema.extend({
  productId: z.uuid(),
  requestId: z.uuid(),
});
export const BrokerCheckoutInputSchema = PaymentCheckoutInputSchema.extend({
  customerReference: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
});
export const PaymentOrderSchema = z.strictObject({
  id: z.uuid(),
  dao: DaoRefSchema,
  productId: z.uuid(),
  title: z.string(),
  moduleId: z.string(),
  amountMinor: PaymentAmountSchema,
  currency: z.literal('usd'),
  applicationFeeMinor: z.int().nonnegative(),
  policy: PaymentPolicySchema,
  state: z.enum(['pending', 'open', 'paid', 'failed', 'expired']),
  checkoutUrl: z.url().nullable(),
  refundedMinor: z.int().nonnegative(),
  dispute: z.enum(['none', 'open', 'won', 'lost']),
});
export const PaymentOrderInputSchema = PaymentDaoInputSchema.extend({ orderId: z.uuid() });
export const PaymentRefundInputSchema = PaymentOrderInputSchema.extend({
  requestId: z.uuid(),
  amountMinor: z.int().positive().max(99999999),
});
export const BrokerCredentialSchema = z.strictObject({
  token: z.string().regex(/^dcp_[A-Za-z0-9_-]{43}$/),
});
export const PaymentQuerySchema = z.strictObject({
  dao: z
    .string()
    .min(1)
    .max(512)
    .transform((value, ctx) => {
      try {
        return DaoRefSchema.parse(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'DAO reference is invalid' });
        return z.NEVER;
      }
    }),
});
export const PaymentRoutes = {
  paymentStatus: {
    method: 'GET',
    path: '/v1/payments/status',
    query: PaymentQuerySchema,
    response: PaymentStatusSchema,
    helpTopic: 'payments',
  },
  paymentCatalogue: {
    method: 'GET',
    path: '/v1/payments/catalogue',
    query: PaymentQuerySchema,
    response: PaymentCatalogueSchema,
    helpTopic: 'payments',
  },
  paymentOnboard: {
    method: 'POST',
    path: '/v1/payments/onboard',
    input: PaymentOnboardInputSchema,
    response: StripeAuthorizationSchema,
    helpTopic: 'payments',
  },
  paymentProduct: {
    method: 'POST',
    path: '/v1/payments/product',
    input: PaymentProductInputSchema,
    response: PaymentProductSchema,
    helpTopic: 'payments',
  },
  paymentCheckout: {
    method: 'POST',
    path: '/v1/payments/checkout',
    input: PaymentCheckoutInputSchema,
    response: PaymentOrderSchema,
    helpTopic: 'payments',
  },
  paymentOrder: {
    method: 'GET',
    path: '/v1/payments/orders/:id',
    response: PaymentOrderSchema,
    helpTopic: 'payments',
  },
  paymentRefund: {
    method: 'POST',
    path: '/v1/payments/refund',
    input: PaymentRefundInputSchema,
    response: PaymentOrderSchema,
    helpTopic: 'payments',
  },
  paymentCredential: {
    method: 'POST',
    path: '/v1/payments/operator',
    input: PaymentDaoInputSchema,
    response: BrokerCredentialSchema,
    helpTopic: 'independent-operators',
  },
  paymentRevoke: {
    method: 'POST',
    path: '/v1/payments/operator/revoke',
    input: PaymentDaoInputSchema,
    response: z.null(),
    helpTopic: 'independent-operators',
  },
} as const;
export const BrokerRoutes = {
  brokerCheckout: {
    method: 'POST',
    path: '/v1/payments/broker/checkout',
    input: BrokerCheckoutInputSchema,
    response: PaymentOrderSchema,
    helpTopic: 'independent-operators',
  },
  brokerOrder: {
    method: 'POST',
    path: '/v1/payments/broker/order',
    input: PaymentOrderInputSchema,
    response: PaymentOrderSchema,
    helpTopic: 'independent-operators',
  },
  brokerStatus: {
    method: 'POST',
    path: '/v1/payments/broker/status',
    input: PaymentDaoInputSchema,
    response: PaymentStatusSchema,
    helpTopic: 'independent-operators',
  },
} as const;
export function daoPaymentKey(value: z.infer<typeof DaoRefSchema>): string {
  const dao = DaoRefSchema.parse(value);
  return JSON.stringify([dao.chainId, dao.contract, dao.daoId, dao.interfaceVersion]);
}
export function paymentFee(amount: number, bps: number): number {
  return Number(
    (BigInt(PaymentAmountSchema.parse(amount)) * BigInt(PaymentBasisPointsSchema.parse(bps))) /
      10000n,
  );
}
export type PaymentPolicy = z.infer<typeof PaymentPolicySchema>;
export type PaymentProduct = z.infer<typeof PaymentProductSchema>;
export type PaymentOrder = z.infer<typeof PaymentOrderSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
