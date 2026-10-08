import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import type { CardRam } from './card.js';
export async function processRamJob(
  pool: Pool,
  service: Pick<CardRam, 'reconcile'>,
  owner: string,
) {
  z.uuid().parse(owner);
  const job = await leaseJob(pool, owner, { moduleId: 'core-ram', kind: 'reconcile' });
  if (!job) return 'idle';
  const payload = z
    .strictObject({ orderId: z.uuid(), generation: z.int().positive() })
    .safeParse(job.payload);
  let outcome: 'completed' | 'retry' | 'manual' = 'manual';
  if (payload.success) {
    try {
      outcome = await service.reconcile(payload.data.orderId);
    } catch {
      outcome = 'retry';
    }
  }
  if (outcome === 'retry' && job.attempts >= 5) outcome = 'manual';
  const changed = await pool.query(
    `UPDATE jobs SET state=CASE WHEN payload=$5::jsonb THEN $1 ELSE 'pending' END,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+interval '30 seconds' WHERE id=$3 AND state='running' AND lease_owner=$4 AND lease_until>now()`,
    [
      outcome === 'completed' ? 'completed' : outcome === 'retry' ? 'pending' : 'failed',
      outcome === 'completed'
        ? null
        : outcome === 'retry'
          ? 'RAM_PROVISIONING_PENDING'
          : 'RAM_REVIEW_REQUIRED',
      job.id,
      owner,
      job.payload,
    ],
  );
  if (changed.rowCount === 1 && outcome === 'manual' && payload.success)
    await pool.query(
      "UPDATE ram_card_orders SET state='review' WHERE id=$1 AND settled_at IS NULL",
      [payload.data.orderId],
    );
  return changed.rowCount === 1 ? outcome : 'lost';
}
export function startRamWorker(pool: Pool, service: CardRam) {
  const owner = randomUUID();
  return startPollingWorker(() => processRamJob(pool, service, owner), 'RAM_JOB_STORE_UNAVAILABLE');
}
