import { Pool } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { migrate } from '../../services/api/src/store.js';
import { claimTelegramUpdate } from '../../services/api/src/docs/telegram.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const botId = 765432123;
beforeAll(async () => {
  await migrate(pool);
  await pool.query('DELETE FROM telegram_docs_receipts WHERE bot_id=$1', [botId]);
});
afterAll(async () => {
  await pool.query('DELETE FROM telegram_docs_receipts WHERE bot_id=$1', [botId]);
  await pool.end();
});

it('claims a retried update once across concurrent requests and a new database connection', async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () => claimTelegramUpdate(pool, botId, 90)),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const restarted = new Pool({ connectionString: url });
  try {
    expect(await claimTelegramUpdate(restarted, botId, 90)).toBe(false);
  } finally {
    await restarted.end();
  }
});

it('expires old receipt IDs without erasing current markers or persisting conversations', async () => {
  await pool.query(
    "INSERT INTO telegram_docs_receipts(bot_id,update_id,received_at) VALUES($1,80,now()-interval '3 days')",
    [botId],
  );
  await claimTelegramUpdate(pool, botId, 91);
  const rows = await pool.query<{ update_id: string }>(
    'SELECT update_id FROM telegram_docs_receipts WHERE bot_id=$1 ORDER BY update_id',
    [botId],
  );
  expect(rows.rows.map((row) => row.update_id)).toEqual(['90', '91']);
  await expect(
    pool.query('INSERT INTO telegram_docs_receipts(bot_id,update_id) VALUES($1,-1)', [botId]),
  ).rejects.toThrow();
});
