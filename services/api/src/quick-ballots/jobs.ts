import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { IdSchema, Uint64Schema } from '../../../../protocol/base.js';
import { startPollingWorker } from '../jobs.js';
import { withTransaction } from '../auth/account-session.js';
import type { QuickGateway } from './service.js';

const jobSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.uuid(),
    kind: z.literal('discover'),
    payload: z.strictObject({ after: Uint64Schema }),
  }),
  z.object({
    id: z.uuid(),
    kind: z.literal('advance'),
    payload: z.strictObject({ ballotId: IdSchema }),
  }),
]);
export async function quickBallotWork(pool: Pool, chain: QuickGateway): Promise<string> {
  const config = await chain.configuration(),
    prefix = `quick:${config.chainId}:${config.runtime}:${config.source}:`,
    owner = randomUUID();
  await pool.query(
    "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-quick-ballots','discover',$1,$2,now()) ON CONFLICT(job_key) DO NOTHING",
    [prefix + 'discover', { after: '0' }],
  );
  const leased = await pool.query(
    "UPDATE jobs SET state='running',lease_owner=$1,lease_until=now()+interval '60 seconds',attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE module_id='core-quick-ballots' AND job_key LIKE $2 AND due_at<=now() AND (state='pending' OR (state='running' AND lease_until<now())) ORDER BY (kind='advance') DESC,due_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,kind,payload",
    [owner, prefix + '%'],
  );
  await pool.query(
    "DELETE FROM quick_account_preparations WHERE ctid IN(SELECT ctid FROM quick_account_preparations WHERE expires_at<now()-interval '3 days' OR (packet IS NULL AND expires_at<now()) ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)",
  );
  await pool.query(
    "DELETE FROM jobs WHERE id IN(SELECT id FROM jobs WHERE module_id='core-quick-ballots' AND kind='advance' AND state='completed' AND due_at<now()-interval '1 day' LIMIT 100 FOR UPDATE SKIP LOCKED)",
  );
  if (!leased.rows[0]) return 'idle';
  const job = jobSchema.parse(leased.rows[0]);
  try {
    if (job.kind === 'discover') {
      const [due, page] = await Promise.all([
        chain.dueBallots(),
        chain.list({ after: job.payload.after }),
      ]);
      const candidates = new Set(due);
      for (const ballot of page.ballots)
        if (!ballot.prepared && (ballot.closed_at || (await chain.needsAdvance(ballot))))
          candidates.add(ballot.id);
      await withTransaction(pool, async (db) => {
        for (const ballotId of candidates)
          await db.query(
            "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-quick-ballots','advance',$1,$2,now()) ON CONFLICT(job_key) DO UPDATE SET state='pending',due_at=now() WHERE jobs.state='completed'",
            [prefix + 'advance:' + ballotId, { ballotId }],
          );
        await db.query(
          "UPDATE jobs SET payload=$3,state='pending',attempts=0,lease_owner=NULL,lease_until=NULL,last_error_code=NULL,due_at=now()+interval '5 seconds' WHERE id=$1 AND lease_owner=$2",
          [job.id, owner, { after: page.next ?? '0' }],
        );
      });
      return candidates.size ? 'progress' : 'idle';
    }
    const result = await chain.advance(job.payload.ballotId);
    await pool.query(
      'UPDATE jobs SET state=$3,attempts=0,lease_owner=NULL,lease_until=NULL,last_error_code=NULL,due_at=now() WHERE id=$1 AND lease_owner=$2',
      [job.id, owner, result.prepared || !result.transactionId ? 'completed' : 'pending'],
    );
    return 'progress';
  } catch (error) {
    await pool.query(
      "UPDATE jobs SET state='pending',lease_owner=NULL,lease_until=NULL,last_error_code='QUICK_MAINTENANCE_UNAVAILABLE',due_at=now()+interval '15 seconds' WHERE id=$1 AND lease_owner=$2",
      [job.id, owner],
    );
    throw error;
  }
}
export function startQuickBallotWorker(pool: Pool, chain: QuickGateway) {
  return startPollingWorker(() => quickBallotWork(pool, chain), 'QUICK_MAINTENANCE_UNAVAILABLE');
}
