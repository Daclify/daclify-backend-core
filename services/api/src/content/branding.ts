import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { BrandImageSchema } from '../../../../protocol/dao.js';
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
  const starts = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);
  const valid =
    reference.mediaType === 'image/png'
      ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : reference.mediaType === 'image/jpeg'
        ? starts([255, 216, 255])
        : starts([82, 73, 70, 70]) &&
          [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte);
  if (!valid) throw new ApiError('CONTENT_MEDIA_TYPE', 502);
}
