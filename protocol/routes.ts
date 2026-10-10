import { z } from 'zod';
import { RecoveryRoutes } from './recovery.js';
import {
  ChallengeRequestSchema,
  ChallengeSchema,
  LoginRequestSchema,
  ProviderLinkResultSchema,
  ProviderProofSchema,
  ProviderUnlinkSchema,
  SessionSchema,
  AccountSchema,
  NetworkSchema,
  DaoSummarySchema,
  CreateDaoSchema,
  UserMembershipSchema,
  VaultAttachRequestSchema,
  VaultAttachFinishSchema,
} from './api.js';
import { ContentPageQuerySchema, DaoContentSchema } from './content.js';
import { RuntimeActionSchemas } from '../sdk/generated/schemas.js';
import { DaoPresetSchema, GovernanceStateSchema } from './dao.js';
import {
  StorageStatusSchema,
  HostedStorageUsageSchema,
  HostedUploadSchema,
  HostedDocumentSchema,
  UploadStatusSchema,
  HostedBytesSchema,
  BrandingUploadSchema,
  BrandingReceiptSchema,
  StorageRecoveryRequestSchema,
  StorageRecoveryPageSchema,
} from './storage.js';
import { TreasurySchema, SettlementRequestSchema, SettlementResultSchema } from './treasury.js';
import { Uint64Schema } from './base.js';
import { PlatformRoutes } from './platform.js';
import { SpendingReportSchema } from './reporting.js';
import {
  RamUsageSchema,
  RamQuoteRequestSchema,
  RamQuoteSchema,
  CardRamTermsSchema,
  CardRamApprovalSchema,
  CardRamOrderSchema,
} from './resources.js';
import { StorageCurationRoutes } from './storage-retention.js';
export const ApiRoutes = {
  ...RecoveryRoutes,
  ...StorageCurationRoutes,
  ramCardQuote: {
    method: 'POST',
    path: '/v1/resources/ram/card/quote',
    input: RamQuoteRequestSchema.omit({ payer: true }),
    response: CardRamTermsSchema,
    helpTopic: 'resources-and-retention',
  },
  ramCardCheckout: {
    method: 'POST',
    path: '/v1/resources/ram/card/checkout',
    input: CardRamApprovalSchema,
    response: CardRamOrderSchema,
    helpTopic: 'resources-and-retention',
  },
  ramCardStatus: {
    method: 'GET',
    path: '/v1/resources/ram/card/orders/:id',
    response: CardRamOrderSchema,
    helpTopic: 'resources-and-retention',
  },
  ramCardReconcile: {
    method: 'POST',
    path: '/v1/resources/ram/card/orders/:id/reconcile',
    response: CardRamOrderSchema,
    helpTopic: 'resources-and-retention',
  },
  ramQuote: {
    method: 'POST',
    path: '/v1/resources/ram/quote',
    input: RamQuoteRequestSchema,
    response: RamQuoteSchema,
    helpTopic: 'resources-and-retention',
  },
  ramUsage: {
    method: 'GET',
    path: '/v1/daos/:id/ram',
    response: RamUsageSchema,
    helpTopic: 'resources-and-retention',
  },
  storageUsage: {
    method: 'GET',
    path: '/v1/daos/:id/storage',
    response: HostedStorageUsageSchema,
    helpTopic: 'resources-and-retention',
  },
  vaultAttachChallenge: {
    method: 'POST',
    path: '/v1/account/vault/challenge',
    input: VaultAttachRequestSchema,
    response: ChallengeSchema,
    helpTopic: 'recovery',
  },
  vaultAttach: {
    method: 'POST',
    path: '/v1/account/vault',
    input: VaultAttachFinishSchema,
    response: SessionSchema,
    helpTopic: 'recovery',
  },
  ...PlatformRoutes,
  spendingReport: {
    method: 'GET',
    path: '/v1/daos/:id/reports/spending',
    response: SpendingReportSchema,
    helpTopic: 'spending-reports',
  },
  spendingCsv: {
    method: 'GET',
    path: '/v1/daos/:id/reports/spending/csv',
    response: z.strictObject({
      format: z.literal('csv'),
      content: z.string().max(16 * 1024 * 1024),
    }),
    helpTopic: 'spending-reports',
  },
  branding: {
    method: 'GET',
    path: '/v1/daos/:id/branding/:slot',
    response: z.strictObject({
      content: HostedBytesSchema.refine(
        (value) => value.length <= Math.ceil((2 * 1024 * 1024) / 3) * 4,
      ),
      mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    }),
    helpTopic: 'dao-discovery',
  },
  brandingUpload: {
    method: 'POST',
    path: '/v1/branding/uploads',
    input: BrandingUploadSchema,
    response: BrandingReceiptSchema,
    helpTopic: 'dao-discovery',
  },
  storageRecover: {
    method: 'POST',
    path: '/v1/storage/recover',
    input: StorageRecoveryRequestSchema,
    response: StorageRecoveryPageSchema,
    helpTopic: 'recovery',
  },
  presets: {
    method: 'GET',
    path: '/v1/dao-presets',
    response: z.strictObject({ presets: z.array(DaoPresetSchema) }),
    helpTopic: 'dao-presets',
  },
  governance: {
    method: 'GET',
    path: '/v1/daos/:id/governance',
    response: GovernanceStateSchema,
    helpTopic: 'dao-governance',
  },
  network: {
    method: 'GET',
    path: '/v1/network',
    response: NetworkSchema,
    helpTopic: 'deployments',
  },
  daos: {
    method: 'GET',
    path: '/v1/daos',
    response: z.strictObject({
      daos: z.array(DaoSummarySchema),
      next: Uint64Schema.nullable().default(null),
    }),
    query: z.strictObject({ after: Uint64Schema.optional() }),
    helpTopic: 'deployments',
  },
  content: {
    method: 'GET',
    path: '/v1/daos/:id/content',
    query: ContentPageQuerySchema,
    response: DaoContentSchema,
    helpTopic: 'resources-and-retention',
  },
  dao: {
    method: 'GET',
    path: '/v1/daos/:id',
    response: DaoSummarySchema,
    helpTopic: 'deployments',
  },
  treasury: {
    method: 'GET',
    path: '/v1/daos/:id/treasury',
    response: TreasurySchema,
    helpTopic: 'treasury',
  },
  settle: {
    method: 'POST',
    path: '/v1/treasury/settle',
    input: SettlementRequestSchema,
    response: SettlementResultSchema,
    helpTopic: 'treasury',
  },
  storage: {
    method: 'GET',
    path: '/v1/storage',
    response: StorageStatusSchema,
    helpTopic: 'providers',
  },
  upload: {
    method: 'POST',
    path: '/v1/uploads',
    input: HostedUploadSchema,
    response: HostedDocumentSchema,
    helpTopic: 'resources-and-retention',
  },
  uploadStatus: {
    method: 'GET',
    path: '/v1/uploads/:requestId',
    response: UploadStatusSchema,
    helpTopic: 'resources-and-retention',
  },
  uploadReconcile: {
    method: 'POST',
    path: '/v1/uploads/:requestId/reconcile',
    input: z.strictObject({}).default({}),
    response: UploadStatusSchema,
    helpTopic: 'resources-and-retention',
  },
  documentBytes: {
    method: 'GET',
    path: '/v1/daos/:id/documents/:documentId/:version/content',
    response: z.strictObject({ content: HostedBytesSchema }),
    helpTopic: 'resources-and-retention',
  },
  challenge: {
    method: 'POST',
    path: '/v1/auth/challenge',
    input: ChallengeRequestSchema,
    response: ChallengeSchema,
    helpTopic: 'accounts',
  },
  login: {
    method: 'POST',
    path: '/v1/auth/login',
    input: LoginRequestSchema,
    response: SessionSchema,
    helpTopic: 'accounts',
  },
  me: {
    method: 'GET',
    path: '/v1/me',
    response: z.strictObject({ account: AccountSchema }),
    helpTopic: 'accounts',
  },
  memberships: {
    method: 'GET',
    path: '/v1/me/memberships',
    response: z.strictObject({ memberships: z.array(UserMembershipSchema) }),
    helpTopic: 'members',
  },
  logout: {
    method: 'POST',
    path: '/v1/auth/logout',
    input: z.strictObject({}).default({}),
    response: z.null(),
    helpTopic: 'accounts',
  },
  providerLink: {
    method: 'POST',
    path: '/v1/auth/providers/link',
    input: ProviderProofSchema,
    response: ProviderLinkResultSchema,
    helpTopic: 'providers',
  },
  providerLogin: {
    method: 'POST',
    path: '/v1/auth/providers/login',
    input: ProviderProofSchema,
    response: SessionSchema,
    helpTopic: 'providers',
  },
  providerUnlink: {
    method: 'POST',
    path: '/v1/auth/providers/unlink',
    input: ProviderUnlinkSchema,
    response: z.null(),
    helpTopic: 'providers',
  },
  createDao: {
    method: 'POST',
    path: '/v1/daos',
    input: CreateDaoSchema,
    response: z.strictObject({
      code: z.literal('CREATION_PAYMENT_REQUIRED'),
      message: z.literal('Prepare and pay a DAO creation order first.'),
    }),
    helpTopic: 'creation-fees',
  },
  relay: {
    method: 'POST',
    path: '/v1/relay',
    input: z.union([RuntimeActionSchemas.submit, RuntimeActionSchemas.submitsess]),
    response: z.strictObject({ transactionId: z.string().regex(/^[0-9a-f]{64}$/) }),
    helpTopic: 'modules',
  },
} satisfies Record<
  string,
  {
    method: 'GET' | 'POST';
    path: string;
    input?: z.ZodType;
    query?: z.ZodType;
    response: z.ZodType;
    helpTopic: string;
  }
>;
