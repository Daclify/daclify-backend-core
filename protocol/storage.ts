import { z } from 'zod';
import { Checksum256 } from '@wharfkit/antelope';
import { DaoRefSchema, IdSchema, Uint64Schema, ChainIdSchema, CidSchema } from './base.js';
export const MAX_HOSTED_CONTENT_BYTES = 5 * 1024 * 1024;
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
