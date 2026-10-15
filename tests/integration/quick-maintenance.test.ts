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
function fixture() {
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
    closed_at: 2,
    scan_cursor: '0',
    scan_rows: 0,
    scan_count: 0,
    scan_aggregate: '00'.repeat(192),
    response_root: '22'.repeat(32),
    prepared: false,
    up: 0,
    final_proof: '00'.repeat(64),
    verified: false,
    pruned: false,
  });
  const unused = async () => {
    throw Error('unused');
  };
  const chain: QuickGateway = {
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
