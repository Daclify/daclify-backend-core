import { z } from 'zod';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import {
  DaoRefSchema,
  ChainIdSchema,
  NativeAccountSchema,
  IdSchema,
  PrivacySchema,
  Uint64Schema,
} from './base.js';
import { DaoPurposeSchema } from './dao.js';
import { PublicApiOriginSchema, PublicEndpointSchema } from './payments.js';
export const HubDaoMetadataSchema = z.strictObject({
  daoId: IdSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  purpose: DaoPurposeSchema.default('custom'),
  privacy: PrivacySchema.default('public'),
  portal: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('daclify'), apiOrigin: PublicApiOriginSchema }),
    z.strictObject({ mode: z.literal('external'), url: PublicEndpointSchema }),
  ]),
});
export const HubMetadataSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    operator: z.string().trim().min(1).max(100),
    daos: z
      .array(HubDaoMetadataSchema)
      .min(1)
      .max(10)
      .refine(
        (rows) => new Set(rows.map((r) => r.daoId)).size === rows.length,
        'Duplicate DAO reference',
      ),
    modules: z
      .array(
        z.strictObject({
          id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
          account: NativeAccountSchema,
        }),
      )
      .max(5)
      .default([]),
  })
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).length <= 4096,
    'Hub metadata exceeds 4096 bytes',
  );
export const HubDeploymentRowSchema = z.object({
  id: RuntimeTableSchemas.daos.shape.id,
  runtime: NativeAccountSchema,
  owner: NativeAccountSchema,
  chain_id: ChainIdSchema,
  interface_version: z.literal(1),
  code_hash: ChainIdSchema,
  abi_hash: ChainIdSchema,
  metadata: z.string().max(4096),
  listed: RuntimeTableSchemas.members.shape.active,
});
export const DirectoryEntrySchema = z.strictObject({
  reference: DaoRefSchema,
  title: z.string(),
  description: z.string(),
  purpose: DaoPurposeSchema,
  privacy: PrivacySchema,
  operator: z.string(),
  codeHash: ChainIdSchema,
  abiHash: ChainIdSchema,
  portal: HubDaoMetadataSchema.shape.portal,
  source: z.literal('hub-registry'),
  verification: z.literal('owner-registered'),
});
export const HubDirectorySchema = z.strictObject({
  entries: z.array(DirectoryEntrySchema),
  skipped: z.int().nonnegative(),
  next: Uint64Schema.nullable().default(null),
});
export const DirectoryRoutes = {
  hubDirectory: {
    method: 'GET',
    path: '/v1/hub/directory',
    query: z.strictObject({ after: Uint64Schema.optional() }),
    response: HubDirectorySchema,
    helpTopic: 'independent-operators',
  },
} as const;
export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;
export function registryDirectory(rows: unknown, chainId: string) {
  const parsed = z.array(HubDeploymentRowSchema).parse(rows);
  const entries: DirectoryEntry[] = [];
  let skipped = 0;
  for (const row of parsed) {
    if (!row.listed || row.chain_id !== chainId) continue;
    let input: unknown;
    try {
      input = JSON.parse(row.metadata);
    } catch {
      skipped++;
      continue;
    }
    const metadata = HubMetadataSchema.safeParse(input);
    if (!metadata.success) {
      skipped++;
      continue;
    }
    for (const dao of metadata.data.daos)
      entries.push({
        reference: {
          chainId: row.chain_id,
          contract: row.runtime,
          daoId: dao.daoId,
          interfaceVersion: 1,
        },
        title: dao.title,
        description: dao.description,
        purpose: dao.purpose,
        privacy: dao.privacy,
        operator: metadata.data.operator,
        codeHash: row.code_hash,
        abiHash: row.abi_hash,
        portal: dao.portal,
        source: 'hub-registry',
        verification: 'owner-registered',
      });
  }
  return { entries, skipped };
}
