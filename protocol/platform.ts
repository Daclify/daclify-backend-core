import { z } from 'zod';
import { ResourcePolicySchema } from './resources.js';
import { NetworkSchema, CreateDaoSchema, VaultAccountSchema } from './api.js';
import { DaoRefSchema, ChainIdSchema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
export const DeploymentKindSchema = z.enum(['shared', 'independent']);
export const CreationMethodSchema = z.enum(['card', 'tlos', 'free']);
export const CreationRequestSchema = z.strictObject({
  requestId: z.uuid(),
  deployment: DeploymentKindSchema,
  method: CreationMethodSchema,
  request: CreateDaoSchema,
});
export const CreationOrderViewSchema = z.strictObject({
  network: NetworkSchema,
  setup: CreateDaoSchema,
  creator: VaultAccountSchema.pick({ signingKey: true, encryptionKey: true, custody: true }),
  requestId: z.uuid(),
  deployment: DeploymentKindSchema,
  method: CreationMethodSchema,
  usdCents: z.int().nonnegative(),
  tlosAmount: z.string().nullable(),
  recipient: z.string(),
  tokenContract: z.string(),
  memo: z.string(),
  expires: z.int().nonnegative(),
  state: z.enum(['awaiting-payment', 'expired', 'paid', 'created']),
  dao: DaoRefSchema.nullable(),
  checkoutUrl: z.url().nullable(),
});
export const ContractStatusSchema = z.strictObject({
  account: z.string(),
  moduleId: z.string().nullable(),
  codeHash: ChainIdSchema.nullable(),
  expectedHash: ChainIdSchema.nullable(),
  verified: z.boolean(),
  ramBytes: z.int().min(-1).nullable(),
  ramUsed: z.number().nonnegative().nullable(),
  permissions: z.array(
    z.strictObject({
      name: z.string(),
      parent: z.string(),
      threshold: z.int(),
      keys: z.array(z.strictObject({ key: z.string(), weight: z.int() })),
      accounts: z.array(
        z.strictObject({ actor: z.string(), permission: z.string(), weight: z.int() }),
      ),
      waits: z.array(z.strictObject({ seconds: z.int(), weight: z.int() })),
    }),
  ),
});
export const ChainPlatformSchema = z.strictObject({
  network: NetworkSchema,
  chainId: ChainIdSchema,
  chainMatches: z.boolean(),
  headBlock: z.int().nonnegative(),
  irreversibleBlock: z.int().nonnegative(),
  headTime: z.string(),
  contracts: z.array(ContractStatusSchema),
  catalogue: z.array(RuntimeTableSchemas.catalogue),
  fees: RuntimeTableSchemas.feecfg.nullable(),
  market: RuntimeTableSchemas.mktcfg.nullable(),
  creation: RuntimeTableSchemas.createcfg.nullable(),
  hosting: RuntimeTableSchemas.capcfg.nullable().default(null),
  seatPricing: RuntimeTableSchemas.seatcfg.nullable().default(null),
  paymentPolicy: RuntimeTableSchemas.paycfg.nullable().default(null),
  resourcePolicy: ResourcePolicySchema.nullable().default(null),
  runtimeSettings: RuntimeTableSchemas.settings.nullable(),
  rateFresh: z.boolean(),
  platformDao: DaoRefSchema.nullable(),
  sharedAvailable: z.boolean(),
  independentAvailable: z.literal(false),
});
export const PlatformStatusSchema = z.strictObject({
  checkedAt: z.iso.datetime(),
  apiVersion: z.string(),
  moduleVersion: z.string(),
  chain: ChainPlatformSchema.nullable(),
  rpc: z.enum(['reachable', 'unavailable', 'unconfigured']),
  database: z.strictObject({
    state: z.enum(['reachable', 'unavailable']),
    migrations: z.array(
      z.strictObject({ namespace: z.string(), name: z.string(), appliedAt: z.iso.datetime() }),
    ),
  }),
  limits: z.strictObject({
    sponsoredWritesPerAccount: z.int().positive(),
    sponsoredWritesGlobal: z.int().positive(),
    windowMs: z.int().positive(),
    uploadBytes: z.int().nonnegative(),
  }),
  services: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      configured: z.boolean(),
      qualification: z.enum(['local-fixture', 'not-qualified']),
      detail: z.string(),
    }),
  ),
  defaults: z.strictObject({
    sharedUsdCents: z.literal(0),
    independentUsdCents: z.literal(5000),
    tlosPremiumBps: z.literal(2000),
  }),
});
export const PlatformRoutes = {
  status: {
    method: 'GET',
    path: '/v1/platform/status',
    response: PlatformStatusSchema,
    helpTopic: 'platform',
  },
  creationOrder: {
    method: 'POST',
    path: '/v1/dao-orders',
    input: CreationRequestSchema,
    response: CreationOrderViewSchema,
    helpTopic: 'creation-fees',
  },
  creationOrderStatus: {
    method: 'GET',
    path: '/v1/dao-orders/:id',
    response: CreationOrderViewSchema,
    helpTopic: 'creation-fees',
  },
  creationCheckout: {
    method: 'POST',
    path: '/v1/dao-orders/:id/checkout',
    input: z.strictObject({}),
    response: z.strictObject({ url: z.url() }),
    helpTopic: 'creation-fees',
  },
  creationFulfill: {
    method: 'POST',
    path: '/v1/dao-orders/:id/fulfill',
    input: z.strictObject({}),
    response: CreationOrderViewSchema,
    helpTopic: 'creation-fees',
  },
} satisfies Record<
  string,
  {
    method: 'GET' | 'POST';
    path: string;
    input?: z.ZodType;
    response: z.ZodType;
    helpTopic: string;
  }
>;
export type CreationRequest = z.infer<typeof CreationRequestSchema>;
export type CreationOrderView = z.infer<typeof CreationOrderViewSchema>;
export type ChainPlatform = z.infer<typeof ChainPlatformSchema>;
export type PlatformStatus = z.infer<typeof PlatformStatusSchema>;
