import type { PoolClient } from 'pg';
import { z } from 'zod';
import { CidSchema, Uint64Schema } from '../../../../protocol/base.js';
import {
  HostedObjectDescriptorSchema,
  HostedReferenceSchema,
  type HostedObjectDescriptor,
  type HostedReference,
  type HostedDocument,
} from '../../../../protocol/storage.js';
import { ApiError } from '../errors.js';
import type { PinnedFile } from './provider.js';

export const CONTENT_IMPORT_PROFILE = 'public-cidv1-file-v1';
export const ProviderScopeSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const ObjectSchema = z.object({
  id: z.uuid(),
  provider_id: z.uuid(),
  cid: CidSchema,
  verified_bytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
});
export type ReusableObject = z.infer<typeof ObjectSchema>;
export function contentDaoKey(dao: HostedDocument['dao']): string {
  return JSON.stringify([dao.chainId, dao.contract, dao.daoId]);
}
export async function reusableObject(
  client: PoolClient,
  scope: string,
  commitment: string,
  bytes: number,
): Promise<ReusableObject | undefined> {
  const result = await client.query<Record<string, unknown>>(
    `SELECT o.id,o.cid,o.verified_bytes,p.provider_id FROM hosted_objects o
     JOIN hosted_pins p ON p.object_id=o.id AND p.state='pinned'
     WHERE o.provider_scope=$1 AND o.import_profile=$2 AND o.commitment=$3
       AND o.verified_bytes=$4 AND o.state='pinned' ORDER BY o.id,p.provider_id LIMIT 1`,
    [scope, CONTENT_IMPORT_PROFILE, commitment, bytes],
  );
  return result.rows[0] ? ObjectSchema.parse(result.rows[0]) : undefined;
}
export async function storageUsed(client: PoolClient, daoKey: string): Promise<bigint> {
  // Unknown results remain separate holds. Known objects count once, including unfinished reuse attempts.
  const result = await client.query<{ used: string }>(
    `WITH objects AS (
       SELECT object_id AS id FROM hosted_references WHERE dao_key=$1
       UNION SELECT storage_object_id FROM uploads WHERE dao_key=$1 AND storage_object_id IS NOT NULL
         AND (state<>'failed' OR provider_id IS NOT NULL)
       UNION SELECT storage_object_id FROM asset_uploads WHERE dao_key=$1 AND storage_object_id IS NOT NULL
     ) SELECT (
       COALESCE((SELECT sum(verified_bytes) FROM hosted_objects WHERE id IN (SELECT id FROM objects)),0)
       + COALESCE((SELECT sum(expected_size) FROM uploads WHERE dao_key=$1 AND storage_object_id IS NULL
         AND (state<>'failed' OR provider_id IS NOT NULL)),0)
       + COALESCE((SELECT sum(expected_bytes) FROM asset_uploads WHERE dao_key=$1 AND storage_object_id IS NULL),0)
       + COALESCE((SELECT sum(remaining_bytes) FROM archive_storage_holds WHERE dao_key=$1 AND state='held'),0)
     )::text AS used`,
    [daoKey],
  );
  return BigInt(Uint64Schema.parse(result.rows[0]?.used));
}
export async function objectCharged(
  client: PoolClient,
  daoKey: string,
  objectId: string,
): Promise<boolean> {
  const result = await client.query<{ charged: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM hosted_references WHERE dao_key=$1 AND object_id=$2
       UNION ALL SELECT 1 FROM uploads WHERE dao_key=$1 AND storage_object_id=$2
         AND (state<>'failed' OR provider_id IS NOT NULL)
       UNION ALL SELECT 1 FROM asset_uploads WHERE dao_key=$1 AND storage_object_id=$2) AS charged`,
    [daoKey, objectId],
  );
  return z.boolean().parse(result.rows[0]?.charged);
}
export async function recordVerifiedObject(
  client: PoolClient,
  scope: string,
  uploadId: string,
  document: HostedDocument,
  pin: PinnedFile,
): Promise<void> {
  const objectId = await recordVerifiedPin(
    client,
    scope,
    {
      kind: 'document-version',
      referenceKey: `${document.documentId}:${document.version}:${uploadId}`,
      uploadId,
    },
    {
      dao: document.dao,
      cid: document.cid,
      bytes: document.bytes,
      commitment: document.commitment,
    },
    pin,
  );
  const updated = await client.query(
    `UPDATE uploads SET storage_object_id=$1 WHERE id=$2 AND provider_scope=$3 AND import_profile=$4
       AND (storage_object_id IS NULL OR storage_object_id=$1) RETURNING id`,
    [objectId, uploadId, scope, CONTENT_IMPORT_PROFILE],
  );
  if (updated.rowCount !== 1) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
}
// Trusted workers must reserve capacity before pinning, then retrieve and verify bytes before calling.
export async function recordVerifiedPin(
  client: PoolClient,
  scope: string,
  value: HostedReference,
  descriptor: HostedObjectDescriptor,
  file: PinnedFile,
): Promise<string> {
  scope = ProviderScopeSchema.parse(scope);
  const reference = HostedReferenceSchema.parse(value),
    document = HostedObjectDescriptorSchema.parse(descriptor);
  const pin = z
    .strictObject({ id: z.uuid(), cid: CidSchema, size: HostedObjectDescriptorSchema.shape.bytes })
    .parse(file);
  if (pin.cid !== document.cid || pin.size !== document.bytes)
    throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
  const daoKey = contentDaoKey(document.dao);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${daoKey}`]);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `hosted-object:${scope}:${CONTENT_IMPORT_PROFILE}:${document.cid}`,
  ]);
  const object = await client.query<{ id: string }>(
    `INSERT INTO hosted_objects(provider_scope,import_profile,cid,verified_bytes,commitment)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_scope,import_profile,cid)
     DO UPDATE SET verified_at=now() WHERE hosted_objects.verified_bytes=EXCLUDED.verified_bytes
       AND hosted_objects.commitment=EXCLUDED.commitment AND hosted_objects.state='pinned' RETURNING id`,
    [scope, CONTENT_IMPORT_PROFILE, document.cid, document.bytes, document.commitment],
  );
  const objectId = z.uuid().safeParse(object.rows[0]?.id);
  if (!objectId.success) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
  const ownership = await client.query(
    `INSERT INTO hosted_pins(provider_scope,provider_id,object_id) VALUES($1,$2,$3)
     ON CONFLICT(provider_scope,provider_id) DO UPDATE SET object_id=hosted_pins.object_id
     WHERE hosted_pins.object_id=EXCLUDED.object_id AND hosted_pins.state='pinned' RETURNING provider_id`,
    [scope, pin.id, objectId.data],
  );
  if (ownership.rowCount !== 1) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
  await client.query(
    `INSERT INTO hosted_references(object_id,dao_key,kind,reference_key,upload_id)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [objectId.data, daoKey, reference.kind, reference.referenceKey, reference.uploadId ?? null],
  );
  const retained = await client.query(
    `SELECT id FROM hosted_references WHERE object_id=$1 AND dao_key=$2 AND kind=$3 AND reference_key=$4
       AND upload_id IS NOT DISTINCT FROM $5::uuid`,
    [objectId.data, daoKey, reference.kind, reference.referenceKey, reference.uploadId ?? null],
  );
  if (retained.rowCount !== 1) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
  return objectId.data;
}
