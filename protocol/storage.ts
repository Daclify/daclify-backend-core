import { z } from 'zod';
import { PaymentQuerySchema } from './payments.js';
import { BrandImageSchema } from './dao.js';
import { Checksum256 } from '@wharfkit/antelope';
import { DaoRefSchema, IdSchema, Uint64Schema, ChainIdSchema, CidSchema } from './base.js';
export const MAX_HOSTED_CONTENT_BYTES = 5 * 1024 * 1024;
export const ProviderScopeSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
export const GatewayOriginSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === '/' &&
    value === url.origin
  );
});
const GatewayLimitSchema = Uint64Schema.refine(
  (value) => BigInt(value) > 0n && BigInt(value) <= (1n << 63n) - 1n,
);
export const GatewayFundingSchema = z
  .strictObject({
    id: z.uuid(),
    providerScope: ProviderScopeSchema,
    gateway: GatewayOriginSchema,
    startsAt: z.iso.datetime().transform((value) => new Date(value).toISOString()),
    endsAt: z.iso.datetime().transform((value) => new Date(value).toISOString()),
    byteLimit: GatewayLimitSchema,
    requestLimit: GatewayLimitSchema,
    fundingReference: z.string().regex(/^[\x21-\x7e]{1,128}$/),
  })
  .refine((value) => {
    const duration = Date.parse(value.endsAt) - Date.parse(value.startsAt);
    return duration > 0 && duration <= 31 * 86400000;
  });
export const GatewayAllowanceStatusSchema = z
  .strictObject({
    state: z.enum([
      'unconfigured',
      'unavailable',
      'scheduled',
      'available',
      'exhausted',
      'expired',
    ]),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    byteLimit: Uint64Schema,
    reservedBytes: Uint64Schema,
    requestLimit: Uint64Schema,
    requests: Uint64Schema,
    fundingQualification: z.enum(['unconfigured', 'operator-attested']),
  })
  .refine(
    (value) =>
      BigInt(value.reservedBytes) <= BigInt(value.byteLimit) &&
      BigInt(value.requests) <= BigInt(value.requestLimit),
  )
  .refine((value) => {
    if (value.fundingQualification === 'unconfigured')
      return (
        ['unconfigured', 'unavailable'].includes(value.state) &&
        value.startsAt === null &&
        value.endsAt === null &&
        [value.byteLimit, value.reservedBytes, value.requestLimit, value.requests].every(
          (n) => n === '0',
        )
      );
    return (
      !['unconfigured', 'unavailable'].includes(value.state) &&
      value.startsAt !== null &&
      value.endsAt !== null &&
      Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
      BigInt(value.byteLimit) > 0n &&
      BigInt(value.requestLimit) > 0n
    );
  });
const MAX_ENCODED_BYTES = Math.ceil(MAX_HOSTED_CONTENT_BYTES / 3) * 4;
// A repeated-group regular expression can overflow the JS stack on multi-MiB files.
// Check the alphabet and unused padding bits in one bounded pass instead.
export const HostedBytesSchema = z
  .string()
  .min(4)
  .max(MAX_ENCODED_BYTES)
  .refine((value) => {
    if (value.length < 4 || value.length > MAX_ENCODED_BYTES || value.length % 4 !== 0)
      return false;
    const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
    const end = value.length - padding;
    if (padding === 2 && !'AQgw'.includes(value.charAt(end - 1))) return false;
    if (padding === 1 && !'AEIMQUYcgkosw048'.includes(value.charAt(end - 1))) return false;
    for (let index = 0; index < end; index++) {
      const code = value.charCodeAt(index);
      if (!(
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        (code >= 48 && code <= 57) ||
        code === 43 ||
        code === 47
      ))
        return false;
    }
    return true;
  });
export const FileMetadataSchema = z.strictObject({
  version: z.literal(1),
  filename: z
    .string()
    .min(1)
    .max(160)
    .refine((value) => !/[\x00-\x1f/\\]/.test(value)),
  mediaType: z
    .string()
    .max(128)
    .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i),
});
export const PrivateFilePayloadSchema = FileMetadataSchema.extend({ content: HostedBytesSchema });
export const HostedUploadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  requestId: z.uuid(),
  dao: DaoRefSchema,
  documentId: IdSchema,
  version: z.int().min(1).max(4294967295),
  metadata: z
    .string()
    .max(4096)
    .refine((value) => new TextEncoder().encode(value).length <= 4096),
  commitment: ChainIdSchema,
  bytes: z.int().min(1).max(MAX_HOSTED_CONTENT_BYTES),
  envelopeVersion: z.union([z.literal(0), z.literal(1)]),
  keyEpoch: Uint64Schema,
  content: HostedBytesSchema,
});
export const HostedIntentSchema = HostedUploadSchema.omit({ content: true });
export const HostedDocumentSchema = HostedIntentSchema.extend({ cid: CidSchema });
export const HostedObjectDescriptorSchema = HostedDocumentSchema.pick({
  dao: true,
  cid: true,
  bytes: true,
  commitment: true,
});
export const HostedReferenceSchema = z.strictObject({
  kind: z.enum(['document-version', 'branding', 'media', 'archive']),
  referenceKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/),
  uploadId: z.uuid().optional(),
});
export type HostedObjectDescriptor = z.infer<typeof HostedObjectDescriptorSchema>;
export type HostedReference = z.infer<typeof HostedReferenceSchema>;
export const HostedAssetIntentSchema = HostedObjectDescriptorSchema.omit({ cid: true }).extend({
  requestId: z.uuid(),
  kind: z.enum(['branding', 'media', 'archive']),
  referenceKey: HostedReferenceSchema.shape.referenceKey,
});
export const HostedAssetUploadSchema = HostedAssetIntentSchema.extend({
  content: HostedBytesSchema,
});
export const HostedAssetReceiptSchema = HostedAssetIntentSchema.extend({ cid: CidSchema });
export type HostedAssetUpload = z.infer<typeof HostedAssetUploadSchema>;
export type HostedAssetReceipt = z.infer<typeof HostedAssetReceiptSchema>;
export const BrandingUploadSchema = BrandImageSchema.omit({ cid: true }).extend({
  dao: DaoRefSchema,
  requestId: z.uuid(),
  slot: z.enum(['logo', 'cover']),
  content: HostedBytesSchema,
  publicConsent: z.literal(true),
});
export const BrandingReceiptSchema = BrandingUploadSchema.pick({
  dao: true,
  requestId: true,
  slot: true,
}).extend({ image: BrandImageSchema });
export type BrandingUpload = z.infer<typeof BrandingUploadSchema>;
export const StorageRecoveryRequestSchema = z.strictObject({
  dao: DaoRefSchema,
  kind: z.enum(['document-version', 'branding', 'archive']),
  after: Uint64Schema.default('0'),
});
export const StorageRecoveryPageSchema = StorageRecoveryRequestSchema.pick({
  dao: true,
  kind: true,
}).extend({
  next: Uint64Schema.nullable(),
  billingRestored: z.literal(false),
  objects: z
    .array(
      z.strictObject({
        referenceKey: HostedReferenceSchema.shape.referenceKey,
        cid: CidSchema,
        state: z.enum(['recovered', 'tracked', 'external', 'unavailable', 'released']),
      }),
    )
    .max(58),
});
export type HostedUpload = z.infer<typeof HostedUploadSchema>;
export type HostedDocument = z.infer<typeof HostedDocumentSchema>;
export const StorageStatusSchema = z.strictObject({
  provider: z.enum(['pinata', 'local-fixture']),
  configured: z.boolean(),
  uploadLimit: z.literal(MAX_HOSTED_CONTENT_BYTES),
});
export const UploadStatusSchema = z.strictObject({
  requestId: z.uuid(),
  state: z.enum(['reserved', 'uploaded', 'verified', 'published', 'failed']),
  document: HostedDocumentSchema.optional(),
});

export const STORAGE_GRACE_SECONDS = 30 * 86_400;
export const StorageUnitsSchema = z.int().min(0).max(999_999);
export const StoragePricingSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: Uint64Schema,
  freeBytes: Uint64Schema,
  unitBytes: Uint64Schema.refine((value) => value !== '0'),
  monthlyUnitUsdCents: z.int().min(1).max(99_999_999),
});
export type StoragePricing = z.infer<typeof StoragePricingSchema>;
export const DEFAULT_STORAGE_PRICING: StoragePricing = StoragePricingSchema.parse({
  schemaVersion: 1,
  revision: '0',
  freeBytes: '100000000',
  unitBytes: '1000000000',
  monthlyUnitUsdCents: 100,
});

export function storageCapacity(units: number, value: StoragePricing): bigint {
  const pricing = StoragePricingSchema.parse(value);
  const bytes =
    BigInt(pricing.freeBytes) + BigInt(StorageUnitsSchema.parse(units)) * BigInt(pricing.unitBytes);
  Uint64Schema.parse(bytes.toString());
  return bytes;
}
export function monthlyStorageUsdCents(units: number, value: StoragePricing): number {
  const pricing = StoragePricingSchema.parse(value);
  const cents = StorageUnitsSchema.parse(units) * pricing.monthlyUnitUsdCents;
  if (!Number.isSafeInteger(cents) || cents > 99_999_999)
    throw new RangeError('STORAGE_AMOUNT_RANGE');
  return cents;
}
export function storagePricingHash(value: StoragePricing): string {
  return Checksum256.hash(
    new TextEncoder().encode(JSON.stringify(StoragePricingSchema.parse(value))),
  ).toString();
}

export const HostedReferenceKindSchema = z.enum([
  'document-version',
  'branding',
  'media',
  'archive',
]);
export const StorageCleanupSchema = z.enum(['disabled', 'qualified']);
export const HostedStorageUsageSchema = z.strictObject({
  dao: DaoRefSchema,
  capacityBytes: Uint64Schema,
  verifiedBytes: Uint64Schema,
  reservedBytes: Uint64Schema,
  totalBytes: Uint64Schema,
  objects: z.int().nonnegative(),
  references: z.int().nonnegative(),
  cleanup: StorageCleanupSchema,
});

export const StorageApprovalSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    requestId: z.uuid(),
    dao: DaoRefSchema,
    units: StorageUnitsSchema,
    pricingHash: ChainIdSchema,
    monthlyUsdCents: z.int().min(0).max(99_999_999),
    recurringConsent: z.boolean(),
    acceptCurrentPricing: z.boolean().default(false),
  })
  .refine((value) => value.units === 0 || value.recurringConsent, {
    path: ['recurringConsent'],
    message: 'Paid storage requires explicit recurring consent',
  });
export type StorageApproval = z.infer<typeof StorageApprovalSchema>;
export function validateStorageApproval(value: unknown, snapshot: StoragePricing): StorageApproval {
  const approval = StorageApprovalSchema.parse(value);
  if (
    approval.pricingHash !== storagePricingHash(snapshot) ||
    approval.monthlyUsdCents !== monthlyStorageUsdCents(approval.units, snapshot)
  )
    throw new RangeError('STORAGE_APPROVAL_CHANGED');
  storageCapacity(approval.units, snapshot);
  return approval;
}

export const StorageInstantSchema = z
  .union([z.iso.datetime({ precision: 0 }), z.iso.datetime({ precision: 3 })])
  .refine(
    (value) => Number.isFinite(Date.parse(value)) && new Date(value).getUTCFullYear() >= 1970,
  );
export const StoragePeriodSchema = z
  .strictObject({ startsAt: StorageInstantSchema, endsAt: StorageInstantSchema })
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    path: ['endsAt'],
    message: 'A paid period must end after its start',
  });

export const StorageSubscriptionStateSchema = z.enum([
  'pending',
  'active',
  'past-due',
  'canceling',
  'ended',
  'review',
]);
export const StorageFundingSchema = z.strictObject({
  state: z.enum(['free', 'pending', 'active', 'grace', 'overdue', 'review']),
  pricing: StoragePricingSchema,
  units: StorageUnitsSchema,
  paidThrough: StorageInstantSchema.nullable(),
  graceEndsAt: StorageInstantSchema.nullable(),
  uploadCapacityBytes: Uint64Schema,
  retainedCapacityBytes: Uint64Schema,
});
export const StorageNoticeSchema = z.strictObject({
  stage: z.enum([
    'renewal-due',
    'grace-started',
    'grace-ending',
    'hosting-ended',
    'billing-review',
  ]),
  paidThrough: StorageInstantSchema,
  graceEndsAt: StorageInstantSchema,
});
export function storageNotices(
  value: z.infer<typeof StorageFundingSchema>,
  now = new Date(),
): z.infer<typeof StorageNoticeSchema>[] {
  const funding = StorageFundingSchema.parse(value);
  if (!Number.isFinite(now.getTime())) throw new RangeError('STORAGE_PERIOD_RANGE');
  if (
    !funding.paidThrough ||
    !funding.graceEndsAt ||
    funding.state === 'free' ||
    funding.state === 'pending'
  )
    return [];
  const stage =
    funding.state === 'review'
      ? 'billing-review'
      : funding.state === 'overdue'
        ? 'hosting-ended'
        : funding.state === 'grace'
          ? Date.parse(funding.graceEndsAt) - now.getTime() <= 7 * 86400000
            ? 'grace-ending'
            : 'grace-started'
          : Date.parse(funding.paidThrough) - now.getTime() <= 7 * 86400000
            ? 'renewal-due'
            : null;
  return stage
    ? [
        StorageNoticeSchema.parse({
          stage,
          paidThrough: funding.paidThrough,
          graceEndsAt: funding.graceEndsAt,
        }),
      ]
    : [];
}
export const StorageBillingStatusSchema = z.strictObject({
  dao: DaoRefSchema,
  configured: z.boolean(),
  currentPricing: StoragePricingSchema.nullable(),
  funding: StorageFundingSchema,
  notices: z.array(StorageNoticeSchema).max(1).default([]),
  noticeDelivery: z.boolean().default(false),
  subscription: z
    .strictObject({
      id: z.uuid(),
      requestId: z.uuid(),
      state: StorageSubscriptionStateSchema,
      pricing: StoragePricingSchema,
      units: StorageUnitsSchema,
      monthlyUsdCents: z.int().min(0).max(99_999_999),
      checkoutUrl: z.url().nullable(),
      invoiceUrl: z.url().nullable(),
      pending: z
        .strictObject({
          requestId: z.uuid(),
          pricing: StoragePricingSchema,
          units: StorageUnitsSchema,
          monthlyUsdCents: z.int().min(0).max(99_999_999),
          effectiveAt: StorageInstantSchema.nullable(),
        })
        .nullable(),
    })
    .nullable(),
});
export const StorageBillingRoutes = {
  storageBillingStatus: {
    method: 'GET',
    path: '/v1/storage/billing',
    query: PaymentQuerySchema,
    response: StorageBillingStatusSchema,
    helpTopic: 'documents',
  },
  storageApprove: {
    method: 'POST',
    path: '/v1/storage/approve',
    input: StorageApprovalSchema,
    response: StorageBillingStatusSchema,
    helpTopic: 'documents',
  },
} as const;
