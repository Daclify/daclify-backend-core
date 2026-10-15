import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
import { quickBallotWork } from '../../services/api/src/quick-ballots/jobs.js';
import type { QuickGateway } from '../../services/api/src/quick-ballots/service.js';
import { QuickAuthCodeHash } from '../../sdk/quick-accounts.js';
import { QuickBallotRowSchema } from '@daclify/modules';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
function fixture(prepared = false, closedAt = 2) {
  const config = {
    chainId: randomBytes(32).toString('hex'),
    runtime: 'daclifycore1',
    authority: 'quickauth',
    authorityCodeHash: QuickAuthCodeHash,
    source: 'quickvote',
    sourceCodeHash: '22'.repeat(32),
    gateway: { actor: 'gateway', permission: 'active' },
  };
  let calls = 0;
  const row = QuickBallotRowSchema.parse({
    id: '1',
    dao_id: '1',
    creator_id: '1',
    opened_at: 1,
    definition: {
      protocol: 1,
      question: 'Test?',
      explanation: '',
      all_accounts: true,
      audience: [],
      closes: 2,
      readers: [{ member_id: '1', encryption_key: 'fixture' }],
    },
    definition_hash: '11'.repeat(32),
    key: '00'.repeat(96),
    key_proof: '00'.repeat(64),
    aggregate: '00'.repeat(192),
    count: 0,
    identities: 0,
    closed_at: closedAt,
    scan_cursor: '0',
    scan_rows: 0,
    scan_count: 0,
    scan_aggregate: '00'.repeat(192),
    response_root: '22'.repeat(32),
    prepared,
    up: 0,
    final_proof: '00'.repeat(64),
    verified: false,
    pruned: false,
  });
  const unused = async () => {
    throw Error('unused');
  };
  const chain: QuickGateway = {
    pruneInactiveAccounts: unused,
    validatePreparation: unused,
    configuration: async () => config,
    account: unused,
    defaultOwner: unused,
    prepareSubmission: unused,
    submit: unused,
    reconcile: unused,
    detail: unused,
    responses: unused,
    ownResponse: unused,
    readers: unused,
    finalize: unused,
    dueBallots: async () => ['1'],
    needsAdvance: async () => true,
    list: async () => ({
      available: true,
      experimental: true,
      domain: { chainId: config.chainId, runtime: config.runtime, source: config.source },
      ballots: [row],
      next: null,
    }),
    advance: async () => {
      calls++;
      return { transactionId: '33'.repeat(32), prepared: calls >= 2 };
    },
  };
  return { config, chain, calls: () => calls };
}
it('discovers and leases bounded snapshot work, resuming the same ballot until preparation finishes', async () => {
  const f = fixture();
  expect(await quickBallotWork(pool, f.chain)).toBe('progress');
  expect(f.calls()).toBe(0);
  expect(await quickBallotWork(pool, f.chain)).toBe('progress');
  expect(f.calls()).toBe(1);
  expect(await quickBallotWork(pool, f.chain)).toBe('progress');
  expect(f.calls()).toBe(2);
  const rows = await pool.query<{ state: string; attempts: number }>(
    "SELECT state,attempts FROM jobs WHERE module_id='core-quick-ballots' AND payload->>'ballotId'='1' AND job_key LIKE $1",
    ['quick:' + f.config.chainId + ':%'],
  );
  expect(rows.rows).toEqual([{ state: 'completed', attempts: 0 }]);
});
it('retains a failed snapshot job with bounded backoff instead of dropping its ballot', async () => {
  const f = fixture();
  await quickBallotWork(pool, f.chain);
  f.chain.advance = async () => {
    throw Error('NODE_UNAVAILABLE');
  };
  await expect(quickBallotWork(pool, f.chain)).rejects.toThrow('NODE_UNAVAILABLE');
  const rows = await pool.query<{ state: string; last_error_code: string }>(
    "SELECT state,last_error_code FROM jobs WHERE module_id='core-quick-ballots' AND payload->>'ballotId'='1' AND job_key LIKE $1",
    ['quick:' + f.config.chainId + ':%'],
  );
  expect(rows.rows).toEqual([
    { state: 'pending', last_error_code: 'QUICK_MAINTENANCE_UNAVAILABLE' },
  ]);
});
it('archives prepared untallied ballots after thirty days and resumes pruning in bounded steps', async () => {
  const f = fixture(true, Math.floor(Date.now() / 1000) - 30 * 86400);
  f.chain.dueBallots = async () => [];
  let staged = 0,
    exports = 0,
    prunes = 0;
  const archives = {
    stage: async () => {
      staged++;
      return ['ed069b99-16de-4b55-8a55-05ee2505a619'];
    },
    exportStep: async () => {
      exports++;
      return 'complete' as const;
    },
    pruneStep: async () => (++prunes >= 2 ? ('complete' as const) : ('progress' as const)),
  };
  await quickBallotWork(pool, f.chain, archives);
  expect(staged).toBe(0);
  await quickBallotWork(pool, f.chain, archives);
  expect(prunes).toBe(1);
  await quickBallotWork(pool, f.chain, archives);
  expect({ staged, exports, prunes }).toEqual({ staged: 2, exports: 2, prunes: 2 });
  const rows = await pool.query<{ state: string }>('SELECT state FROM jobs WHERE job_key=$1', [
    `quick:${f.config.chainId}:${f.config.runtime}:${f.config.source}:archive:1`,
  ]);
  expect(rows.rows).toEqual([{ state: 'completed' }]);
});
it('does not schedule archive cleanup before thirty days even when no tally keys remain', async () => {
  const f = fixture(true, Math.floor(Date.now() / 1000) - 30 * 86400 + 120);
  f.chain.dueBallots = async () => [];
  const archives = {
    stage: async () => {
      throw Error('EARLY_CLEANUP');
    },
    exportStep: async () => 'complete' as const,
    pruneStep: async () => 'complete' as const,
  };
  await quickBallotWork(pool, f.chain, archives);
  const rows = await pool.query('SELECT id FROM jobs WHERE job_key=$1', [
    `quick:${f.config.chainId}:${f.config.runtime}:${f.config.source}:archive:1`,
  ]);
  expect(rows.rows).toEqual([]);
});
it('persists a bounded inactive-account scan cursor and starts a new cycle after exhaustion', async () => {
  const f = fixture();
  f.chain.dueBallots = async () => [];
  f.chain.list = async () => ({
    available: true,
    experimental: true,
    domain: { chainId: f.config.chainId, runtime: f.config.runtime, source: f.config.source },
    ballots: [],
    next: null,
  });
  const visited: string[] = [];
  f.chain.pruneInactiveAccounts = async (after) => {
    visited.push(after);
    return { next: after === '0' ? '25' : null, removed: 0 };
  };
  await quickBallotWork(pool, f.chain);
  const key = `quick:${f.config.chainId}:${f.config.runtime}:${f.config.source}:accounts`;
  for (let n = 0; n < 2; n++) {
    await pool.query('UPDATE jobs SET due_at=now() WHERE job_key=$1', [key]);
    await quickBallotWork(pool, f.chain);
  }
  expect(visited).toEqual(['0', '25']);
  const saved = await pool.query<{ payload: { after: string }; state: string }>(
    'SELECT payload,state FROM jobs WHERE job_key=$1',
    [key],
  );
  expect(saved.rows).toEqual([{ payload: { after: '0' }, state: 'pending' }]);
});
