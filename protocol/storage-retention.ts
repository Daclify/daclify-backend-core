import { z } from 'zod';
import { DaoRefSchema, Uint64Schema } from './base.js';
import { CidSchema } from './base.js';
import {
  HostedReferenceKindSchema,
  StorageFundingSchema,
  StorageCleanupSchema,
} from './storage.js';
const StoredObjectSchema = z.strictObject({
  id: z.uuid(),
  bytes: Uint64Schema.refine((v) => BigInt(v) > 0n),
  createdAt: z.iso.datetime({ offset: true }),
});
export function selectRetainedObjects(
  value: unknown,
  capacityValue: unknown,
  prioritiesValue: unknown,
  dependenciesValue: unknown = [],
  unavailableValue: unknown = [],
): string[] {
  const objects = z.array(StoredObjectSchema).max(10000).parse(value),
    capacity = BigInt(Uint64Schema.parse(capacityValue)),
    priorities = z.array(z.uuid()).max(10000).parse(prioritiesValue),
    byId = new Map(objects.map((o) => [o.id, o]));
  if (byId.size !== objects.length || new Set(priorities).size !== priorities.length)
    throw new RangeError('STORAGE_OBJECT_DUPLICATE');
  const dependencies = z
      .array(z.array(z.uuid()).min(1).max(33))
      .max(10000)
      .parse(dependenciesValue),
    roots = new Map(objects.map((o) => [o.id, o.id]));
  const root = (id: string): string => {
    let value = roots.get(id);
    if (!value) throw new RangeError('STORAGE_DEPENDENCY_UNKNOWN');
    while (value !== roots.get(value)) {
      const next = roots.get(value);
      if (!next) throw new RangeError('STORAGE_DEPENDENCY_UNKNOWN');
      value = next;
    }
    roots.set(id, value);
    return value;
  };
  let edges = 0;
  for (const group of dependencies) {
    if (new Set(group).size !== group.length || (edges += group.length) > 330000)
      throw new RangeError('STORAGE_DEPENDENCY_BOUNDS');
    const first = group[0];
    if (!first) throw new RangeError('STORAGE_DEPENDENCY_BOUNDS');
    for (const id of group) roots.set(root(id), root(first));
  }
  const unavailable = z.array(z.uuid()).max(10000).parse(unavailableValue),
    blocked = new Set(unavailable.map(root));
  const groups = new Map<string, string[]>();
  for (const object of objects) {
    const owner = root(object.id),
      members = groups.get(owner) ?? [];
    members.push(object.id);
    groups.set(owner, members);
  }
  let used = 0n;
  const kept: string[] = [],
    selected = new Set<string>();
  const add = (id: string, required: boolean) => {
    if (selected.has(id)) return;
    if (!byId.has(id)) throw new RangeError('STORAGE_KEEP_UNKNOWN');
    const owner = root(id);
    if (blocked.has(owner)) {
      if (required) throw new RangeError('STORAGE_KEEP_UNAVAILABLE');
      return;
    }
    const group = groups.get(owner);
    if (!group) throw new RangeError('STORAGE_DEPENDENCY_UNKNOWN');
    const pending = [id, ...group.filter((member) => member !== id)].filter(
      (member) => !selected.has(member),
    );
    const bytes = pending.reduce((sum, member) => {
      const object = byId.get(member);
      if (!object) throw new RangeError('STORAGE_DEPENDENCY_UNKNOWN');
      return sum + BigInt(object.bytes);
    }, 0n);
    if (used + bytes > capacity) {
      if (required) throw new RangeError('STORAGE_KEEP_CAPACITY');
      return;
    }
    used += bytes;
    for (const member of pending) {
      selected.add(member);
      kept.push(member);
    }
  };
  for (const id of priorities) add(id, true);
  for (const object of [...objects].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
  ))
    add(object.id, false);
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
export const StorageArchiveGroupSchema = z.strictObject({
  key: z.string().min(1).max(256),
  objectIds: z.array(z.uuid()).min(1).max(33),
});
export const StorageCurationStatusSchema = z.strictObject({
  dao: DaoRefSchema,
  generation: Uint64Schema,
  funding: StorageFundingSchema,
  cleanup: StorageCleanupSchema,
  bundles: z.array(StorageArchiveGroupSchema).max(10000).default([]),
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
