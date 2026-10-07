import { z } from 'zod';
import { DaoRefSchema, IdSchema, Uint64Schema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
export const ContentPageQuerySchema = z.strictObject({
  members: z.union([Uint64Schema, z.literal('done')]).optional(),
  documents: z.union([Uint64Schema, z.literal('done')]).optional(),
  keyGrants: z.union([Uint64Schema, z.literal('done')]).optional(),
  epochs: z.union([Uint64Schema, z.literal('done')]).optional(),
});
export type ContentPageQuery = z.infer<typeof ContentPageQuerySchema>;
// Records are generated from the producer's C++ ABI, including transport normalization.
export const DaoContentSchema = z.strictObject({
  dao: DaoRefSchema,
  next: z
    .strictObject({
      members: Uint64Schema.nullable(),
      documents: Uint64Schema.nullable(),
      keyGrants: Uint64Schema.nullable(),
      epochs: Uint64Schema.nullable(),
    })
    .default({ members: null, documents: null, keyGrants: null, epochs: null }),
  members: z.array(RuntimeTableSchemas.members),
  documents: z.array(RuntimeTableSchemas.documents),
  keyGrants: z.array(RuntimeTableSchemas.keygrants),
  epochs: z.array(RuntimeTableSchemas.epochs),
});
export type DaoContent = z.infer<typeof DaoContentSchema>;
export function contentDomain(
  dao: z.infer<typeof DaoRefSchema>,
  document: string,
  version: number,
  epoch: string,
): string {
  return JSON.stringify({
    domain: 'daclify.document.v1',
    dao: DaoRefSchema.parse(dao),
    document: IdSchema.parse(document),
    version: z.int().min(1).max(0xffffffff).parse(version),
    epoch: Uint64Schema.parse(epoch),
  });
}
export function epochGrantDomain(
  dao: z.infer<typeof DaoRefSchema>,
  epoch: string,
  member: string,
): string {
  return JSON.stringify({
    domain: 'daclify.key-grant.v1',
    dao: DaoRefSchema.parse(dao),
    epoch: IdSchema.parse(epoch),
    member: IdSchema.parse(member),
  });
}
