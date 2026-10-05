import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { ContentService } from './service.js';
import { leaseJob } from '../store.js';
const PayloadSchema = z.strictObject({ uploadId: z.uuid() });
export type ContentJobResult = 'idle' | 'completed' | 'retry' | 'manual' | 'lost';
export async function processContentJob(
  pool: Pool,
  service: Pick<ContentService, 'reconcile'>,
  owner: string,
): Promise<ContentJobResult> {
  z.uuid().parse(owner);
  const job = await leaseJob(pool, owner, { moduleId: 'core-content', kind: 'reconcile' });
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
  service: Pick<ContentService, 'reconcile'>,
): { stop: () => Promise<void> } {
  const owner = randomUUID();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<ContentJobResult> | undefined;
  async function tick() {
    if (stopped) return;
    let result: ContentJobResult = 'idle';
    running = processContentJob(pool, service, owner);
    try {
      result = await running;
    } catch {
      console.error('CONTENT_JOB_STORE_UNAVAILABLE');
    } finally {
      running = undefined;
    }
    if (!stopped)
      timer = setTimeout(
        () => {
          void tick();
        },
        result === 'idle' ? 5000 : 250,
      );
  }
  void tick();
  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await running?.catch(() => undefined);
    },
  };
}
