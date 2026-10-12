import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ProfileContextSchema } from '../../../../protocol/profiles.js';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import type { ProfileKeys } from './keys.js';
export async function processProfileJob(pool: Pool, service: ProfileKeys, owner: string) {
  const job = await leaseJob(pool, z.uuid().parse(owner), {
    moduleId: 'core-profiles',
    kind: 'reconcile',
  });
  if (!job) return 'idle';
  const parsed = z.strictObject({ context: ProfileContextSchema }).safeParse(job.payload);
  let outcome = 'retry';
  if (!parsed.success) outcome = 'failed';
  else {
    try {
      outcome = await service.reconcile(parsed.data.context);
    } catch {
      /* Retain staged keys while confirmation is unavailable. */
    }
  }
  const saved = await pool.query(
    "UPDATE jobs SET state=$1,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second') WHERE id=$4 AND state='running' AND lease_owner=$5 AND lease_until>now()",
    [
      outcome === 'completed' ? 'completed' : outcome === 'failed' ? 'failed' : 'pending',
      outcome === 'retry'
        ? 'PROFILE_CONFIRMATION_PENDING'
        : outcome === 'failed'
          ? 'JOB_PAYLOAD_INVALID'
          : null,
      Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)),
      job.id,
      owner,
    ],
  );
  return saved.rowCount === 1 ? outcome : 'lost';
}
export function startProfileWorker(pool: Pool, service: ProfileKeys) {
  const owner = randomUUID();
  return startPollingWorker(async () => {
    const outcome = await processProfileJob(pool, service, owner);
    await service.cleanup();
    await pool.query(
      "DELETE FROM jobs WHERE id IN (SELECT id FROM jobs WHERE module_id='core-profiles' AND state IN ('completed','failed') AND due_at<now()-interval '1 day' LIMIT 25)",
    );
    return outcome;
  }, 'PROFILE_KEY_JOB_UNAVAILABLE');
}
