import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { ContentService } from './service.js';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
const PayloadSchema = z.strictObject({ uploadId: z.uuid() });
export type ContentJobResult = 'idle' | 'completed' | 'retry' | 'manual' | 'lost';
export async function processContentJob(
  pool: Pool,
  service: Pick<ContentService, 'reconcile'>,
  owner: string,
  moduleId: 'core-content' | 'core-assets' = 'core-content',
): Promise<ContentJobResult> {
  z.uuid().parse(owner);
  const job = await leaseJob(pool, owner, { moduleId, kind: 'reconcile' });
  if (!job) return 'idle';
  let outcome: ContentJobResult = 'manual';
  let error: string | null = 'JOB_PAYLOAD_INVALID';
  const payload = PayloadSchema.safeParse(job.payload);
  if (payload.success) {
    try {
      outcome = await service.reconcile(payload.data.uploadId);
      error = outcome === 'manual' ? 'UPLOAD_REVIEW_REQUIRED' : null;
    } catch {
      outcome = 'retry';
      error = 'CONTENT_RECONCILE_PENDING';
    }
  }
  const delay = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
  const updated = await pool.query(
    "UPDATE jobs SET state=$1,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second') WHERE id=$4 AND state='running' AND lease_owner=$5 AND lease_until>now()",
    [
      outcome === 'completed' ? 'completed' : outcome === 'manual' ? 'failed' : 'pending',
      error,
      delay,
      job.id,
      owner,
    ],
  );
  return updated.rowCount === 1 ? outcome : 'lost';
}
export function startContentWorker(
  pool: Pool,
  service: Pick<ContentService, 'reconcile'> & {
    assets: Pick<ContentService['assets'], 'reconcile'>;
  },
): { stop: () => Promise<void> } {
  const owner = randomUUID();
  return startPollingWorker(async () => {
    const documents = await processContentJob(pool, service, owner);
    const assets = await processContentJob(pool, service.assets, owner, 'core-assets');
    return assets === 'idle' ? documents : assets;
  }, 'CONTENT_JOB_STORE_UNAVAILABLE');
}
