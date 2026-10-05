import { z } from 'zod';
import { DaoRefSchema, IdSchema, Uint64Schema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
// Records are generated from the producer's C++ ABI, including transport normalization.
export const DaoContentSchema = z.strictObject({
  dao: DaoRefSchema,
  members: z.array(RuntimeTableSchemas.members).max(5000),
  documents: z.array(RuntimeTableSchemas.documents).max(1000),
  keyGrants: z.array(RuntimeTableSchemas.keygrants).max(1000),
  epochs: z.array(RuntimeTableSchemas.epochs).max(1000),
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
