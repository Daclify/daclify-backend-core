import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { BrandImageSchema, brandImageMatchesType } from '../../../../protocol/dao.js';
import { ApiError } from '../errors.js';
export function validateBrandImage(
  reference: z.infer<typeof BrandImageSchema>,
  bytes: Uint8Array,
): void {
  BrandImageSchema.parse(reference);
  validateBrandImagePayload(reference, bytes);
}
export function validateBrandImagePayload(
  reference: Pick<z.infer<typeof BrandImageSchema>, 'bytes' | 'mediaType' | 'commitment'>,
  bytes: Uint8Array,
): void {
  BrandImageSchema.omit({ cid: true }).parse({
    bytes: reference.bytes,
    mediaType: reference.mediaType,
    commitment: reference.commitment,
  });
  if (bytes.length !== reference.bytes) throw new ApiError('CONTENT_SIZE', 502);
  if (createHash('sha256').update(bytes).digest('hex') !== reference.commitment)
    throw new ApiError('CONTENT_INTEGRITY', 502);
  if (!brandImageMatchesType(bytes, reference.mediaType))
    throw new ApiError('CONTENT_MEDIA_TYPE', 502);
}
