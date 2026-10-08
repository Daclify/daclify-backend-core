import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
import { processStorageJob } from '../../services/api/src/billing/storage-jobs.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
beforeEach(() => pool.query("DELETE FROM jobs WHERE module_id='core-storage'"));
afterAll(() => pool.end());
async function enqueue(payload: unknown = { subscriptionId: randomUUID() }) {
  const result = await pool.query<{ id: string }>(
    "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-storage','refresh',$1,$2,now()) RETURNING id",
    [randomUUID(), payload],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Missing fixture');
  return id;
}
it('leases provider verification to one worker and preserves recurring checks', async () => {
  const id = await enqueue(),
    refresh = vi.fn(async () => 'retry' as const);
  const results = await Promise.all([
    processStorageJob(pool, { refresh }, randomUUID()),
    processStorageJob(pool, { refresh }, randomUUID()),
  ]);
  expect(results.sort()).toEqual(['idle', 'retry']);
  expect(refresh).toHaveBeenCalledOnce();
  expect(
    (await pool.query('SELECT state,due_at>now() AS future FROM jobs WHERE id=$1', [id])).rows[0],
  ).toEqual({ state: 'pending', future: true });
});
it('redacts provider failures and never completes a lease owned by another worker', async () => {
  const id = await enqueue();
  expect(
    await processStorageJob(
      pool,
      {
        refresh: async () => {
          throw new Error('secret provider detail');
        },
      },
      randomUUID(),
    ),
  ).toBe('retry');
  expect(
    (await pool.query('SELECT last_error_code FROM jobs WHERE id=$1', [id])).rows[0]
      ?.last_error_code,
  ).toBe('STORAGE_RECONCILE_PENDING');
  await pool.query('UPDATE jobs SET due_at=now() WHERE id=$1', [id]);
  expect(
    await processStorageJob(
      pool,
      {
        refresh: async () => {
          await pool.query('UPDATE jobs SET lease_owner=$1 WHERE id=$2', [randomUUID(), id]);
          return 'completed';
        },
      },
      randomUUID(),
    ),
  ).toBe('lost');
});
it('holds invalid payloads and explicit review states without invoking further work', async () => {
  await enqueue({ subscriptionId: 'invalid' });
  const refresh = vi.fn(async () => 'manual' as const);
  expect(await processStorageJob(pool, { refresh }, randomUUID())).toBe('manual');
  expect(refresh).not.toHaveBeenCalled();
  const id = await enqueue();
  expect(await processStorageJob(pool, { refresh }, randomUUID())).toBe('manual');
  expect(
    (await pool.query('SELECT state,last_error_code FROM jobs WHERE id=$1', [id])).rows[0],
  ).toEqual({ state: 'failed', last_error_code: 'STORAGE_REVIEW_REQUIRED' });
});
