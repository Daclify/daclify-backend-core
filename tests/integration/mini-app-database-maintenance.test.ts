import { it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { Store } from '../../examples/community-mini-app/store.js';
import { createPostgresStore } from '../../examples/community-mini-app/postgres-store.js';
import { miniBinding } from '../helpers/mini-app-store.js';
import { appBindingHash } from '@daclify/core-protocol';

it('measures finite personal-row cleanup separately from engine disk reclamation', async () => {
  const url = process.env.DATABASE_URL;
  if (
    !url ||
    !new URL(url).pathname.endsWith('_test') ||
    !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
  )
    throw new Error('Owned local test database required');
  const database = 'daclify_storage_' + randomBytes(6).toString('hex') + '_test';
  const target = new URL(url);
  target.pathname = '/' + database;
  const owner = new Pool({ connectionString: url });
  await owner.query(`CREATE DATABASE ${database}`);
  const pool = new Pool({ connectionString: target.toString() });
  const dir = mkdtempSync(join(tmpdir(), 'mini-storage-'));
  const path = join(dir, 'personal.sqlite'),
    sqlite = new Store(path, miniBinding);
  const namespace = appBindingHash(miniBinding);
  const rows = 256,
    payloadBytes = 16384;
  try {
    await createPostgresStore(pool, miniBinding);
    sqlite.db.exec(
      'CREATE TABLE personal_fixture(id INTEGER PRIMARY KEY,namespace TEXT NOT NULL,data TEXT NOT NULL)',
    );
    await pool.query(
      'CREATE TABLE mini_app.personal_fixture(id integer PRIMARY KEY,namespace text NOT NULL,data text NOT NULL) WITH(autovacuum_enabled=false)',
    );
    const sqliteBytes = () => {
      sqlite.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      return statSync(path).size;
    };
    const pgBytes = async () =>
      Number(
        z
          .object({ bytes: z.string() })
          .parse(
            (
              await pool.query(
                "SELECT pg_total_relation_size('mini_app.personal_fixture')::text AS bytes",
              )
            ).rows[0],
          ).bytes,
      );
    const before = { sqlite: sqliteBytes(), postgres: await pgBytes() };
    sqlite.db.exec('BEGIN IMMEDIATE');
    await pool.query('BEGIN');
    for (let id = 1; id <= rows; id++) {
      const data = randomBytes(payloadBytes / 2).toString('hex');
      sqlite.db.prepare('INSERT INTO personal_fixture VALUES(?,?,?)').run(id, namespace, data);
      await pool.query('INSERT INTO mini_app.personal_fixture VALUES($1,$2,$3)', [
        id,
        namespace,
        data,
      ]);
    }
    sqlite.db.exec('COMMIT');
    await pool.query('COMMIT');
    const filled = { sqlite: sqliteBytes(), postgres: await pgBytes() };
    sqlite.db.prepare('DELETE FROM personal_fixture WHERE namespace=?').run(namespace);
    await pool.query('DELETE FROM mini_app.personal_fixture WHERE namespace=$1', [namespace]);
    expect(sqlite.db.prepare('SELECT count(*) AS total FROM personal_fixture').get()).toEqual({
      total: 0,
    });
    expect(
      (await pool.query('SELECT count(*)::text AS total FROM mini_app.personal_fixture')).rows[0],
    ).toEqual({ total: '0' });
    const deleted = { sqlite: sqliteBytes(), postgres: await pgBytes() };
    sqlite.db.exec('VACUUM');
    await pool.query('VACUUM (ANALYZE) mini_app.personal_fixture');
    const vacuumed = { sqlite: sqliteBytes(), postgres: await pgBytes() };
    expect(filled.sqlite).toBeGreaterThan(before.sqlite);
    expect(deleted.sqlite).toBe(filled.sqlite);
    expect(vacuumed.sqlite).toBeLessThan(deleted.sqlite);
    expect(deleted.postgres).toBe(filled.postgres);
    const sqliteVersion = z
      .object({ version: z.string() })
      .parse(sqlite.db.prepare('SELECT sqlite_version() AS version').get()).version;
    const postgresVersion = z
      .object({ server_version: z.string() })
      .parse((await pool.query('SHOW server_version')).rows[0]).server_version;
    if (['1', 'q2'].includes(process.env.RECORD_MINI_APP_STORAGE ?? ''))
      writeFileSync(
        new URL(
          process.env.RECORD_MINI_APP_STORAGE === 'q2'
            ? '../../.artifacts/mini-app-database-storage-q2.json'
            : '../../docs/evidence/2026-10-12-mini-app-database-storage.json',
          import.meta.url,
        ),
        JSON.stringify(
          {
            schemaVersion: 1,
            recordedAt: new Date().toISOString(),
            node: process.versions.node,
            sqlite: sqliteVersion,
            postgres: postgresVersion,
            appBindingFormat: 1,
            rows,
            payloadBytes,
            before,
            filled,
            deleted,
            vacuumed,
            remainingPersonalRows: 0,
            scope:
              'Disposable synthetic personal payload table. Logical deletion and disk reuse/reclamation only; no historical, backup or universal GDPR erasure claim.',
            command:
              'RECORD_MINI_APP_STORAGE=1 DATABASE_URL=<owned-loopback-_test-db> npm run test:integration -- tests/integration/mini-app-database-maintenance.test.ts',
          },
          null,
          2,
        ) + '\n',
      );
  } finally {
    sqlite.close();
    rmSync(dir, { recursive: true });
    await pool.end();
    await owner.query(`DROP DATABASE ${database}`);
    await owner.end();
  }
}, 20000);
