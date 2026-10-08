import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import type { HostedStorage } from './storage.js';
export async function processStorageJob(
  pool: Pool,
  service: Pick<HostedStorage, 'refresh'>,
  owner: string,
) {
  z.uuid().parse(owner);
  const job = await leaseJob(pool, owner, { moduleId: 'core-storage', kind: 'refresh' });
  if (!job) return 'idle';
  const payload = z.strictObject({ subscriptionId: z.uuid() }).safeParse(job.payload);
  let outcome: 'retry' | 'completed' | 'manual' = 'manual',
    error: string | null = 'STORAGE_JOB_PAYLOAD_INVALID';
  if (payload.success) {
    try {
      outcome = await service.refresh(payload.data.subscriptionId);
      error = outcome === 'manual' ? 'STORAGE_REVIEW_REQUIRED' : null;
    } catch {
      outcome = 'retry';
      error = 'STORAGE_RECONCILE_PENDING';
    }
  }
  const updated = await pool.query(
    `UPDATE jobs SET state=$1,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second')
    WHERE id=$4 AND state='running' AND lease_owner=$5 AND lease_until>now()`,
    [
      outcome === 'manual' ? 'failed' : outcome === 'completed' ? 'completed' : 'pending',
      error,
      Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)),
      job.id,
      owner,
    ],
  );
  return updated.rowCount === 1 ? outcome : 'lost';
}
export function startStorageWorker(pool: Pool, service: Pick<HostedStorage, 'refresh'>) {
  const owner = randomUUID();
  return startPollingWorker(
    () => processStorageJob(pool, service, owner),
    'STORAGE_JOB_STORE_UNAVAILABLE',
  );
}
