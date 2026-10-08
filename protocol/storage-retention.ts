import { z } from 'zod';
import { DaoRefSchema, Uint64Schema } from './base.js';
import { CidSchema } from './base.js';
import { HostedReferenceKindSchema, StorageFundingSchema } from './storage.js';
const StoredObjectSchema = z.strictObject({
  id: z.uuid(),
  bytes: Uint64Schema.refine((v) => BigInt(v) > 0n),
  createdAt: z.iso.datetime({ offset: true }),
});
export function selectRetainedObjects(
  value: unknown,
  capacityValue: unknown,
  prioritiesValue: unknown,
): string[] {
  const objects = z.array(StoredObjectSchema).max(10000).parse(value),
    capacity = BigInt(Uint64Schema.parse(capacityValue)),
    priorities = z.array(z.uuid()).max(10000).parse(prioritiesValue),
    byId = new Map(objects.map((o) => [o.id, o]));
  if (byId.size !== objects.length || new Set(priorities).size !== priorities.length)
    throw new RangeError('STORAGE_OBJECT_DUPLICATE');
  let used = 0n;
  const kept: string[] = [];
  for (const id of priorities) {
    const object = byId.get(id);
    if (!object) throw new RangeError('STORAGE_KEEP_UNKNOWN');
    used += BigInt(object.bytes);
    if (used > capacity) throw new RangeError('STORAGE_KEEP_CAPACITY');
    kept.push(id);
  }
  for (const object of [...objects].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
  )) {
    if (kept.includes(object.id)) continue;
    const bytes = BigInt(object.bytes);
    if (used + bytes <= capacity) {
      used += bytes;
      kept.push(object.id);
    }
  }
  return kept;
}
export const StorageCurationRequestSchema = z.strictObject({
  dao: DaoRefSchema,
  generation: Uint64Schema,
  keep: z
    .array(z.uuid())
    .max(10000)
    .refine((v) => new Set(v).size === v.length),
});
export const StorageCurationStatusSchema = z.strictObject({
  dao: DaoRefSchema,
  generation: Uint64Schema,
  funding: StorageFundingSchema,
  cleanup: z.enum(['disabled', 'qualified']),
  objects: z
    .array(
      StoredObjectSchema.extend({
        cid: CidSchema,
        kinds: z.array(HostedReferenceKindSchema).min(1).max(4),
        selected: z.boolean(),
        retained: z.boolean(),
        releasedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    )
    .max(10000),
});
export const StorageCurationRoutes = {
  curation: {
    method: 'GET',
    path: '/v1/storage/curation',
    input: z.strictObject({ dao: DaoRefSchema }),
    response: StorageCurationStatusSchema,
    helpTopic: 'retention',
  },
  retain: {
    method: 'POST',
    path: '/v1/storage/retain',
    input: StorageCurationRequestSchema,
    response: StorageCurationStatusSchema,
    helpTopic: 'retention',
  },
} as const;
