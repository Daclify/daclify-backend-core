import { readdirSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate, consumeChallenge, leaseJob } from '../../services/api/src/store.js';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required; integration tests cannot silently skip');
const parsedUrl = new URL(url);
if (
  !['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) ||
  !parsedUrl.pathname.endsWith('_test')
)
  throw new Error('Integration tests require an isolated local *_test database');
const pool = new Pool({ connectionString: url });
beforeAll(async () => {
  await migrate(pool);
});
beforeEach(async () => {
  await pool.query('DELETE FROM jobs');
});
afterAll(async () => {
  await pool.end();
});
describe('actual PostgreSQL transactions and constraints', () => {
  it('applies migrations once with unchanged source hashes', async () => {
    await migrate(pool);
    const files = readdirSync('migrations').filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name));
    const rows = await pool.query<{ count: string }>(
      'SELECT count(*)::text FROM schema_migrations',
    );
    expect(files).toContain('003_service_payments.sql');
    expect(rows.rows[0]?.count).toBe(String(files.length));
  });
  it('consumes an authentication challenge once under concurrent requests', async () => {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO challenges(id,signing_key,message,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",
      [id, 'public-key', 'message'],
    );
    const results = await Promise.all([consumeChallenge(pool, id), consumeChallenge(pool, id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('rejects expired challenges', async () => {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO challenges(id,signing_key,message,expires_at) VALUES($1,$2,$3,now()-interval '1 second')",
      [id, 'public-key', 'expired'],
    );
    expect(await consumeChallenge(pool, id)).toBeUndefined();
  });
  it('leases a due job to one worker despite concurrency', async () => {
    const key = randomUUID();
    await pool.query(
      'INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES($1,$2,$3,$4,now())',
      ['works', 'settle', key, {}],
    );
    const results = await Promise.all([leaseJob(pool, randomUUID()), leaseJob(pool, randomUUID())]);
    expect(results.filter((value) => value?.job_key === key)).toHaveLength(1);
  });
  it('enforces duplicate job idempotency at the database boundary', async () => {
    const key = randomUUID();
    await pool.query(
      'INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES($1,$2,$3,$4,now())',
      ['payroll', 'settle', key, {}],
    );
    await expect(
      pool.query(
        'INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES($1,$2,$3,$4,now())',
        ['payroll', 'settle', key, {}],
      ),
    ).rejects.toThrow();
  });
  it('rejects a negative entitlement storage allowance', async () => {
    await expect(
      pool.query(
        'INSERT INTO entitlements(dao_key,tier,storage_limit,relay_limit) VALUES($1,$2,$3,$4)',
        [randomUUID(), 'free', -1, 0],
      ),
    ).rejects.toThrow();
  });
});
