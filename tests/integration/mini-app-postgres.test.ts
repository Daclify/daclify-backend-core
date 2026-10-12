import { afterAll, beforeAll, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { miniAppConformance, miniBinding } from '../helpers/mini-app-store.js';
import { createPostgresStore } from '../../examples/community-mini-app/postgres-store.js';
import { appBindingHash } from '@daclify/core-protocol';
import { TaskSchema } from '../../examples/community-mini-app/store.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test database required');
const database = 'daclify_mini_' + randomBytes(6).toString('hex') + '_test';
const target = new URL(url);
target.pathname = '/' + database;
const owner = new Pool({ connectionString: url });
const pool = new Pool({ connectionString: target.toString() });
beforeAll(async () => {
  await owner.query(`CREATE DATABASE ${database}`);
});
afterAll(async () => {
  await pool.end();
  await owner.query(`DROP DATABASE ${database}`);
  await owner.end();
});
miniAppConformance('PostgreSQL', async () => {
  await pool.query('DROP SCHEMA IF EXISTS mini_app CASCADE');
  const store = await createPostgresStore(pool, miniBinding);
  const namespace = appBindingHash(miniBinding);
  return {
    store,
    open: (binding) => createPostgresStore(pool, binding),
    async edit(details) {
      const row = z
        .object({ value: TaskSchema })
        .parse(
          (
            await pool.query('SELECT value FROM mini_app.tasks WHERE namespace=$1 AND id=$2', [
              namespace,
              'chillies',
            ])
          ).rows[0],
        );
      await pool.query('UPDATE mini_app.tasks SET value=$3 WHERE namespace=$1 AND id=$2', [
        namespace,
        'chillies',
        { ...row.value, details },
      ]);
    },
    async breakOutbox() {
      await pool.query(
        "CREATE FUNCTION mini_app.fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture outbox failure'; END $$; CREATE TRIGGER fail_outbox BEFORE INSERT ON mini_app.outbox FOR EACH ROW EXECUTE FUNCTION mini_app.fail_outbox()",
      );
    },
    async outboxCount() {
      return Number(
        z
          .object({ total: z.string() })
          .parse(
            (
              await pool.query('SELECT count(*) AS total FROM mini_app.outbox WHERE namespace=$1', [
                namespace,
              ])
            ).rows[0],
          ).total,
      );
    },
    async backupAndRestore() {
      const binary = process.env.MINI_APP_PG_DUMP ?? 'pg_dump';
      const { stdout } = await promisify(execFile)(
        binary,
        [
          '--dbname',
          target.toString(),
          '--schema=mini_app',
          '--inserts',
          '--no-owner',
          '--no-privileges',
        ],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      await pool.query('DROP SCHEMA mini_app CASCADE');
      await pool.query(
        stdout
          .split('\n')
          .filter((line) => !line.startsWith('\\'))
          .join('\n'),
      );
      return createPostgresStore(pool, miniBinding);
    },
    async cleanup() {
      await store.close();
    },
  };
});

it('initializes simultaneous cold starts without duplicating namespace metadata or seed tasks', async () => {
  await pool.query('DROP SCHEMA IF EXISTS mini_app CASCADE');
  const stores = await Promise.all(
    Array.from({ length: 4 }, () => createPostgresStore(pool, miniBinding)),
  );
  expect(
    (await pool.query('SELECT count(*)::text AS total FROM mini_app.bindings')).rows[0],
  ).toEqual({ total: '1' });
  expect((await pool.query('SELECT count(*)::text AS total FROM mini_app.tasks')).rows[0]).toEqual({
    total: '1',
  });
  for (const store of stores) await store.close();
});
