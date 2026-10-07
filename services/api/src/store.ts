import type { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export interface Challenge {
  id: string;
  signing_key: string;
  message: string;
  expires_at: Date;
}
export interface Job {
  id: string;
  module_id: string;
  kind: string;
  job_key: string;
  payload: unknown;
  attempts: number;
}
export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('daclify-migrations'))");
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(namespace text NOT NULL,name text NOT NULL,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,name))',
    );
    const files = (await readdir('migrations'))
      .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
      .sort();
    if (!files.length) throw new Error('No migrations found');
    for (const name of files) {
      const sql = await readFile(`migrations/${name}`, 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query<{ hash: string }>(
        'SELECT hash FROM schema_migrations WHERE namespace=$1 AND name=$2',
        ['core', name],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].hash !== hash) throw new Error('Published migration hash changed');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(namespace,name,hash) VALUES($1,$2,$3)', [
        'core',
        name,
        hash,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function leaseJob(
  pool: Pool,
  owner: string,
  filter?: { moduleId: string; kind: string },
): Promise<Job | undefined> {
  const result = await pool.query<Job>(
    `UPDATE jobs SET state='running',lease_owner=$1,lease_until=now()+interval '60 seconds',attempts=attempts+1
    WHERE id=(SELECT id FROM jobs WHERE due_at<=now() AND (state='pending' OR (state='running' AND lease_until<now())) ${filter ? 'AND module_id=$2 AND kind=$3' : ''} ORDER BY due_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,module_id,kind,job_key,payload,attempts`,
    filter ? [owner, filter.moduleId, filter.kind] : [owner],
  );
  return result.rows[0];
}
