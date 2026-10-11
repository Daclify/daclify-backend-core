import { afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { withTransaction } from '../../services/api/src/auth/account-session.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local test database required');
const pool = new Pool({ connectionString: url, max: 2 });
afterAll(() => pool.end());

it('preserves the operation failure after a real connection loss and keeps the pool usable', async () => {
  const original = new Error('OPERATION_FAILED');
  await expect(
    withTransaction(pool, async (client) => {
      // Kill only this leased test connection; pg emits an error when its socket closes.
      client.on('error', () => {});
      await client.query('SELECT pg_terminate_backend(pg_backend_pid())').catch(() => {});
      throw original;
    }),
  ).rejects.toBe(original);
  expect((await pool.query('SELECT 42 AS answer')).rows).toEqual([{ answer: 42 }]);
});
