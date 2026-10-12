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
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { miniActor } from '../helpers/mini-app-store.js';
import { CleanupNoticeSchema } from '../../protocol/account-exit.js';
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

it('keeps other tenant rows byte-identical and reapplies cleanup before a SQL restore serves old identity links', async () => {
  await pool.query('DROP SCHEMA IF EXISTS mini_app CASCADE');
  const dir = await mkdtemp('/tmp/daclify-mini-app-exclusions-'),
    options = { exclusionsDirectory: dir, maxBackupAgeSeconds: 86400 };
  try {
    const store = await createPostgresStore(pool, miniBinding, options),
      otherBinding = { ...miniBinding, appId: '2', clientId: randomUUID() },
      other = await createPostgresStore(pool, otherBinding, options),
      otherActor = { ...miniActor, binding: otherBinding };
    await store.complete('chillies', miniActor, {});
    await other.complete('chillies', otherActor, {});
    const otherNamespace = appBindingHash(otherBinding),
      readOther = async () => ({
        actors: (
          await pool.query('SELECT * FROM mini_app.actors WHERE namespace=$1', [otherNamespace])
        ).rows,
        outbox: (
          await pool.query('SELECT * FROM mini_app.outbox WHERE namespace=$1', [otherNamespace])
        ).rows,
        tasks: (
          await pool.query('SELECT * FROM mini_app.tasks WHERE namespace=$1', [otherNamespace])
        ).rows,
      }),
      before = await readOther();
    const { stdout } = await promisify(execFile)(
      process.env.MINI_APP_PG_DUMP ?? 'pg_dump',
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
    const notice = CleanupNoticeSchema.parse({
      version: 1,
      eventId: randomUUID(),
      binding: miniBinding,
      subject: miniActor.subject,
      memberId: miniActor.memberId,
      kind: 'account-erased',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });
    expect(await store.cleanup(notice)).toMatchObject({
      state: 'retained',
      retentionCodes: ['DAO_COMPLETION_EVIDENCE'],
    });
    const otherTenantRows = await readOther();
    expect(otherTenantRows).toEqual(before);
    await expect(store.tasks(miniActor)).rejects.toThrow('APP_ACTOR_ERASED');
    expect(await store.cleanup(notice)).toMatchObject({ state: 'retained' });
    await pool.query('DROP SCHEMA mini_app CASCADE');
    await pool.query(
      stdout
        .split('\n')
        .filter((line) => !line.startsWith('\\'))
        .join('\n'),
    );
    const restored = await createPostgresStore(pool, miniBinding, options);
    await expect(restored.tasks(miniActor)).rejects.toThrow('APP_ACTOR_ERASED');
    expect(
      (
        await pool.query('SELECT subject FROM mini_app.outbox WHERE namespace=$1', [
          appBindingHash(miniBinding),
        ])
      ).rows,
    ).toEqual([{ subject: null }]);
    expect(await readOther()).toEqual(before);
  } finally {
    await rm(dir, { recursive: true });
  }
});
