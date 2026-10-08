import type { Pool } from 'pg';
import type { ContentProvider } from './provider.js';

export async function releaseAbsentUpload(
  pool: Pool,
  provider: ContentProvider,
  table: 'uploads' | 'asset_uploads',
  row: {
    id: string;
    provider_id: string | null;
    provider_scope: string | null;
    storage_object_id: string | null;
    storage_released_at: Date | null;
    expires_at: Date;
  },
  daoKey: string,
): Promise<boolean> {
  if (
    !provider.file ||
    !row.provider_id ||
    row.storage_object_id ||
    row.storage_released_at ||
    row.expires_at.getTime() > Date.now()
  )
    return false;
  // Empty inventory pages cannot release budget; this checks the recorded ID on its configured provider.
  if (await provider.file(row.provider_id)) return false;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${daoKey}`]);
    const result = await db.query<{ id: string }>(
      `UPDATE ${table} SET storage_released_at=now(),last_error_code='UPLOAD_PROVIDER_ABSENT',state=$5
       WHERE id=$1 AND dao_key=$2 AND provider_scope=$3 AND provider_id=$4 AND expires_at<=now()
         AND storage_object_id IS NULL AND storage_released_at IS NULL AND state IN ('reserved','uploaded','review')
         ${table === 'asset_uploads' ? 'AND archive_hold_id IS NULL' : ''} RETURNING id`,
      [
        row.id,
        daoKey,
        row.provider_scope,
        row.provider_id,
        table === 'uploads' ? 'failed' : 'review',
      ],
    );
    await db.query('COMMIT');
    return result.rowCount === 1;
  } catch (cause) {
    await db.query('ROLLBACK');
    throw cause;
  } finally {
    db.release();
  }
}
