import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import type { AccountExit } from './service.js';
export async function processAccountExitJob(pool: Pool, service: AccountExit, owner: string) {
  const job =
    (await leaseJob(pool, z.uuid().parse(owner), {
      moduleId: 'core-account-exit',
      kind: 'close-hosted',
    })) ??
    (await leaseJob(pool, owner, { moduleId: 'core-account-exit', kind: 'erase' })) ??
    (await leaseJob(pool, owner, { moduleId: 'core-account-exit', kind: 'app-cleanup' }));
  if (!job) return 'idle';
  const payload = z.strictObject({ operationId: z.uuid() }).safeParse(job.payload);
  let outcome = 'retry';
  if (!payload.success) outcome = 'failed';
  else
    try {
      outcome =
        job.kind === 'close-hosted'
          ? await service.reconcileClosures(payload.data.operationId)
          : job.kind === 'app-cleanup'
            ? await service.processApps(payload.data.operationId)
            : await service.eraseHosted(payload.data.operationId);
    } catch {
      /* Keep the leased operation recoverable; ordinary logs carry no identity or provider material. */
    }
  const saved = await pool.query(
    "UPDATE jobs SET state=$1,attempts=CASE WHEN $3=0 THEN 0 ELSE attempts END,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second') WHERE id=$4 AND state='running' AND lease_owner=$5 AND lease_until>now()",
    [
      outcome === 'completed' ? 'completed' : outcome === 'failed' ? 'failed' : 'pending',
      outcome === 'retry'
        ? 'EXIT_CLEANUP_PENDING'
        : outcome === 'failed'
          ? 'EXIT_JOB_INVALID'
          : null,
      outcome === 'progress' ? 0 : Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)),
      job.id,
      owner,
    ],
  );
  return saved.rowCount === 1 ? outcome : 'lost';
}
export function startAccountExitWorker(pool: Pool, service: AccountExit) {
  const owner = randomUUID();
  return startPollingWorker(async () => {
    const result = await processAccountExitJob(pool, service, owner);
    await service.cleanup();
    return result;
  }, 'ACCOUNT_EXIT_WORKER_UNAVAILABLE');
}
