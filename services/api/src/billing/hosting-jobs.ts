import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import { ApiError } from '../errors.js';
import type { HostedSubscriptions } from './hosting.js';
export async function processHostingJob(
  pool: Pool,
  service: Pick<HostedSubscriptions, 'attest'>,
  owner: string,
) {
  const job = await leaseJob(pool, z.uuid().parse(owner), {
    moduleId: 'core-hosting',
    kind: 'attest',
  });
  if (!job) return 'idle';
  const payload = z
    .strictObject({ invoiceId: z.string().regex(/^in_[A-Za-z0-9]+$/) })
    .safeParse(job.payload);
  let state = 'failed',
    error: string | null = 'HOSTING_JOB_PAYLOAD_INVALID';
  if (payload.success) {
    try {
      await service.attest(payload.data.invoiceId);
      state = 'completed';
      error = null;
    } catch (failure) {
      state = failure instanceof ApiError && failure.statusCode === 409 ? 'failed' : 'pending';
      error = state === 'failed' ? 'HOSTING_REVIEW_REQUIRED' : 'HOSTING_RECONCILE_PENDING';
    }
  }
  const result = await pool.query(
    "UPDATE jobs SET state=$1,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second')WHERE id=$4 AND state='running'AND lease_owner=$5 AND lease_until>now()",
    [state, error, Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)), job.id, owner],
  );
  return result.rowCount === 1 ? state : 'lost';
}
export function startHostingWorker(pool: Pool, service: HostedSubscriptions) {
  const owner = randomUUID();
  return startPollingWorker(
    () => processHostingJob(pool, service, owner),
    'HOSTING_JOB_STORE_UNAVAILABLE',
  );
}
