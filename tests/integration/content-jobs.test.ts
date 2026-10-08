import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
import { processContentJob, startContentWorker } from '../../services/api/src/content/jobs.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Isolated local test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
beforeEach(() => pool.query('DELETE FROM jobs'));
afterAll(() => pool.end());
async function enqueue(payload: unknown = { uploadId: randomUUID() }, module = 'core-content') {
  const row = await pool.query<{ id: string }>(
    'INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES($1,$2,$3,$4,now()) RETURNING id',
    [module, 'reconcile', randomUUID(), payload],
  );
  const id = row.rows[0]?.id;
  if (!id) throw new Error('Job fixture missing');
  return id;
}
describe('bounded hosted-content jobs on PostgreSQL', () => {
  it('drains asset jobs through the existing stoppable host loop', async () => {
    await enqueue(undefined, 'core-assets');
    const documents = vi.fn(async () => 'completed' as const),
      assets = vi.fn(async () => 'completed' as const);
    const worker = startContentWorker(pool, {
      reconcile: documents,
      assets: { reconcile: assets },
    });
    await worker.stop();
    expect(documents).not.toHaveBeenCalled();
    expect(assets).toHaveBeenCalledOnce();
  });
  it('keeps document and asset reconciliation namespaces separate under the same host', async () => {
    const id = await enqueue(undefined, 'core-assets'),
      reconcile = vi.fn(async () => 'completed' as const);
    expect(await processContentJob(pool, { reconcile }, randomUUID())).toBe('idle');
    expect(await processContentJob(pool, { reconcile }, randomUUID(), 'core-assets')).toBe(
      'completed',
    );
    expect(reconcile).toHaveBeenCalledOnce();
    expect(
      (await pool.query<{ state: string }>('SELECT state FROM jobs WHERE id=$1', [id])).rows[0]
        ?.state,
    ).toBe('completed');
  });
  it('leases a reconciliation to one worker under concurrency', async () => {
    await enqueue();
    const reconcile = vi.fn(async () => 'completed' as const);
    const results = await Promise.all([
      processContentJob(pool, { reconcile }, randomUUID()),
      processContentJob(pool, { reconcile }, randomUUID()),
    ]);
    expect(results.sort()).toEqual(['completed', 'idle']);
    expect(reconcile).toHaveBeenCalledOnce();
  });
  it('keeps other module jobs available to their own handlers', async () => {
    const id = await enqueue(undefined, 'works');
    expect(
      await processContentJob(pool, { reconcile: async () => 'completed' }, randomUUID()),
    ).toBe('idle');
    expect(
      (await pool.query<{ state: string }>('SELECT state FROM jobs WHERE id=$1', [id])).rows[0]
        ?.state,
    ).toBe('pending');
  });
  it('reschedules an uncertain provider result with a redacted error', async () => {
    const id = await enqueue();
    expect(
      await processContentJob(
        pool,
        {
          reconcile: async () => {
            throw new Error('private provider detail');
          },
        },
        randomUUID(),
      ),
    ).toBe('retry');
    const row = (
      await pool.query<{ state: string; last_error_code: string; future: boolean }>(
        'SELECT state,last_error_code,due_at>now() AS future FROM jobs WHERE id=$1',
        [id],
      )
    ).rows[0];
    expect(row).toEqual({
      state: 'pending',
      last_error_code: 'CONTENT_RECONCILE_PENDING',
      future: true,
    });
  });
  it('records a manual-review hold instead of releasing its upload budget', async () => {
    const id = await enqueue();
    expect(await processContentJob(pool, { reconcile: async () => 'manual' }, randomUUID())).toBe(
      'manual',
    );
    expect(
      (
        await pool.query<{ state: string; last_error_code: string }>(
          'SELECT state,last_error_code FROM jobs WHERE id=$1',
          [id],
        )
      ).rows[0],
    ).toEqual({ state: 'failed', last_error_code: 'UPLOAD_REVIEW_REQUIRED' });
  });
  it('does not complete a job after its lease ownership changes', async () => {
    const id = await enqueue();
    const reconcile = async () => {
      await pool.query('UPDATE jobs SET lease_owner=$1 WHERE id=$2', [randomUUID(), id]);
      return 'completed' as const;
    };
    expect(await processContentJob(pool, { reconcile }, randomUUID())).toBe('lost');
    expect(
      (await pool.query<{ state: string }>('SELECT state FROM jobs WHERE id=$1', [id])).rows[0]
        ?.state,
    ).toBe('running');
  });
  it('rejects malformed queued input without running the provider', async () => {
    await enqueue({ uploadId: 'invalid', providerToken: 'not a supported field' });
    const reconcile = vi.fn(async () => 'completed' as const);
    expect(await processContentJob(pool, { reconcile }, randomUUID())).toBe('manual');
    expect(reconcile).not.toHaveBeenCalled();
  });
});
