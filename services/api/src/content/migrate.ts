import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { HostedIntentSchema, HostedDocumentSchema } from '../../../../protocol/storage.js';
import { ApiError } from '../errors.js';
import type { ContentProvider } from './provider.js';
import {
  CONTENT_IMPORT_PROFILE,
  ProviderScopeSchema,
  contentDaoKey,
  recordVerifiedObject,
} from './ledger.js';

const LegacyUploadSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  dao_key: z.string(),
  request_hash: z.string().regex(/^[0-9a-f]{64}$/),
  intent: HostedIntentSchema,
  expected_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
  state: z.enum(['reserved', 'uploaded', 'verified', 'published']),
  provider_id: z.uuid().nullable(),
  cid: z.string().nullable(),
  provider_scope: z.string().nullable(),
});
// Operator-only, one explicitly selected legacy upload. Never called by the ordinary reconciliation worker.
export async function claimLegacyUpload(
  pool: Pool,
  provider: ContentProvider,
  scope: string,
  uploadId: string,
): Promise<void> {
  ProviderScopeSchema.parse(scope);
  z.uuid().parse(uploadId);
  const result = await pool.query<Record<string, unknown>>('SELECT * FROM uploads WHERE id=$1', [
    uploadId,
  ]);
  const parsed = LegacyUploadSchema.safeParse(result.rows[0]);
  if (!parsed.success) throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
  const row = parsed.data;
  if (row.provider_scope !== null && row.provider_scope !== scope)
    throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
  const files = await provider.find(row.id);
  const file = files[0];
  if (
    files.length !== 1 ||
    !file ||
    (row.provider_id && row.provider_id !== file.id) ||
    (row.cid && row.cid !== file.cid)
  )
    throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
  z.uuid().parse(file.id);
  const document = HostedDocumentSchema.parse({ ...row.intent, cid: file.cid });
  if (
    row.dao_key !== contentDaoKey(document.dao) ||
    file.size !== document.bytes ||
    row.expected_size !== document.bytes
  )
    throw new ApiError('CONTENT_SIZE', 502);
  const bytes = await provider.retrieve(file.cid, document.bytes);
  if (
    bytes.length !== document.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== document.commitment
  )
    throw new ApiError('DOCUMENT_INTEGRITY', 502);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${row.dao_key}`]);
    const current = await client.query<Record<string, unknown>>(
      'SELECT * FROM uploads WHERE id=$1 FOR UPDATE',
      [row.id],
    );
    const snapshot = LegacyUploadSchema.parse(current.rows[0]);
    if (
      snapshot.request_hash !== row.request_hash ||
      JSON.stringify(snapshot.intent) !== JSON.stringify(row.intent) ||
      (snapshot.provider_scope !== null && snapshot.provider_scope !== scope) ||
      (snapshot.provider_id && snapshot.provider_id !== file.id) ||
      (snapshot.cid && snapshot.cid !== file.cid)
    )
      throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
    await client.query(
      `UPDATE uploads SET provider_scope=$1,import_profile=$2,provider_id=$3,cid=$4,
       state=CASE WHEN state='published' THEN state ELSE 'verified' END,last_error_code=NULL WHERE id=$5`,
      [scope, CONTENT_IMPORT_PROFILE, file.id, file.cid, row.id],
    );
    await recordVerifiedObject(client, scope, row.id, document, file);
    await client.query(
      'INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,$2,$3)',
      [row.account_id, 'content.ownership-verified', { uploadId: row.id, providerScope: scope }],
    );
    await client.query('COMMIT');
  } catch (cause) {
    await client.query('ROLLBACK');
    throw cause;
  } finally {
    client.release();
  }
}
