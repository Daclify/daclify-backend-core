import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { IdSchema, Uint64Schema } from '../../../../protocol/base.js';
import { startPollingWorker } from '../jobs.js';
import { withTransaction } from '../auth/account-session.js';
import type { QuickGateway } from './service.js';
import type { QuickBallotArchives } from './archives.js';
type ArchiveWork = Pick<QuickBallotArchives, 'stage' | 'exportStep' | 'pruneStep'>;

const jobSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.uuid(),
    kind: z.literal('discover'),
    payload: z.strictObject({ after: Uint64Schema }),
  }),
  z.object({
    id: z.uuid(),
    kind: z.literal('accounts'),
    payload: z.strictObject({ after: Uint64Schema }),
  }),
  z.object({
    id: z.uuid(),
    kind: z.enum(['advance', 'archive']),
    payload: z.strictObject({ ballotId: IdSchema }),
  }),
]);
export async function quickBallotWork(
  pool: Pool,
  chain: QuickGateway,
  archives?: ArchiveWork,
  signal?: AbortSignal,
): Promise<string> {
  const config = await chain.configuration(),
    prefix = `quick:${config.chainId}:${config.runtime}:${config.source}:`,
    owner = randomUUID();
  await pool.query(
    "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-quick-ballots','discover',$1,$2,now()) ON CONFLICT(job_key) DO NOTHING",
    [prefix + 'discover', { after: '0' }],
  );
  await pool.query(
    "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-quick-ballots','accounts',$1,$2,now()+interval '10 seconds') ON CONFLICT(job_key) DO NOTHING",
    [prefix + 'accounts', { after: '0' }],
  );
  const leased = await pool.query(
    "UPDATE jobs SET state='running',lease_owner=$1,lease_until=now()+interval '60 seconds',attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE module_id='core-quick-ballots' AND job_key LIKE $2 AND due_at<=now() AND (state='pending' OR (state='running' AND lease_until<now())) ORDER BY (kind='advance') DESC,due_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,kind,payload",
    [owner, prefix + '%'],
  );
  await pool.query(
    "DELETE FROM quick_account_preparations WHERE ctid IN(SELECT ctid FROM quick_account_preparations WHERE expires_at<now()-interval '3 days' OR (packet IS NULL AND expires_at<now()) ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)",
  );
  await pool.query(
    "DELETE FROM jobs WHERE id IN(SELECT id FROM jobs WHERE module_id='core-quick-ballots' AND kind IN ('advance','archive') AND state='completed' AND due_at<now()-interval '1 day' LIMIT 100 FOR UPDATE SKIP LOCKED)",
  );
  if (!leased.rows[0]) return 'idle';
  const job = jobSchema.parse(leased.rows[0]);
  const lease = new AbortController(),
    activeSignal = signal ? AbortSignal.any([signal, lease.signal]) : lease.signal;
  let extending = false;
  const heartbeat = setInterval(() => {
    if (extending) return;
    extending = true;
    void pool
      .query(
        "UPDATE jobs SET lease_until=now()+interval '60 seconds' WHERE id=$1 AND lease_owner=$2 AND state='running'",
        [job.id, owner],
      )
      .then(
        (result) => {
          if (result.rowCount !== 1) lease.abort();
        },
        () => lease.abort(),
      )
      .finally(() => {
        extending = false;
      });
  }, 20_000);
  heartbeat.unref();
  try {
    if (job.kind === 'accounts') {
      const page = await chain.pruneInactiveAccounts(job.payload.after);
      await pool.query(
        "UPDATE jobs SET payload=$3,state='pending',attempts=0,lease_owner=NULL,lease_until=NULL,last_error_code=NULL,due_at=now()+interval '5 seconds' WHERE id=$1 AND lease_owner=$2",
        [job.id, owner, { after: page.next ?? '0' }],
      );
      return page.removed ? 'progress' : 'idle';
    }
    if (job.kind === 'discover') {
      const [due, page] = await Promise.all([
        chain.dueBallots(),
        chain.list({ after: job.payload.after }),
      ]);
      const candidates = new Set(due);
      for (const ballot of page.ballots)
        if (!ballot.prepared && (ballot.closed_at || (await chain.needsAdvance(ballot))))
          candidates.add(ballot.id);
      const archiveCandidates = archives
        ? page.ballots.filter(
            (ballot) =>
              ballot.prepared &&
              !ballot.pruned &&
              ballot.closed_at &&
              Date.now() / 1000 - ballot.closed_at >= 30 * 86400,
          )
        : [];
      await withTransaction(pool, async (db) => {
        for (const ballotId of candidates)
          await db.query(
            "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-quick-ballots','advance',$1,$2,now()) ON CONFLICT(job_key) DO UPDATE SET state='pending',due_at=now() WHERE jobs.state='completed'",
            [prefix + 'advance:' + ballotId, { ballotId }],
          );
        for (const ballot of archiveCandidates)
          await db.query(
            "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-quick-ballots','archive',$1,$2,now()) ON CONFLICT(job_key) DO UPDATE SET state='pending',due_at=now() WHERE jobs.state='completed'",
            [prefix + 'archive:' + ballot.id, { ballotId: ballot.id }],
          );
        await db.query(
          "UPDATE jobs SET payload=$3,state='pending',attempts=0,lease_owner=NULL,lease_until=NULL,last_error_code=NULL,due_at=now()+interval '5 seconds' WHERE id=$1 AND lease_owner=$2",
          [job.id, owner, { after: page.next ?? '0' }],
        );
      });
      return candidates.size || archiveCandidates.length ? 'progress' : 'idle';
    }
    if (job.kind === 'archive') {
      if (!archives) throw Error('QUICK_ARCHIVE_UNAVAILABLE');
      const ids = await archives.stage(job.payload.ballotId, activeSignal);
      let exported = true;
      for (const id of ids) {
        activeSignal.throwIfAborted();
        if ((await archives.exportStep(id)) !== 'complete') {
          exported = false;
          break;
        }
      }
      activeSignal.throwIfAborted();
      const complete = exported && (await archives.pruneStep(job.payload.ballotId)) === 'complete';
      await pool.query(
        'UPDATE jobs SET state=$3,attempts=0,lease_owner=NULL,lease_until=NULL,last_error_code=NULL,due_at=now() WHERE id=$1 AND lease_owner=$2',
        [job.id, owner, complete ? 'completed' : 'pending'],
      );
      return 'progress';
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
  } finally {
    clearInterval(heartbeat);
    lease.abort();
  }
}
export function startQuickBallotWorker(pool: Pool, chain: QuickGateway, archives?: ArchiveWork) {
  const controller = new AbortController();
  const worker = startPollingWorker(
    () => quickBallotWork(pool, chain, archives, controller.signal),
    'QUICK_MAINTENANCE_UNAVAILABLE',
  );
  return {
    async stop() {
      controller.abort();
      await worker.stop();
    },
  };
}
