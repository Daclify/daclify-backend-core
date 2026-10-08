import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import { ArchiveMigrations } from '@daclify/modules/archive/migrations';
import { migrate } from '../../services/api/src/store.js';
import { DaoRefSchema } from '../../protocol/base.js';
import { contentDaoKey } from '../../services/api/src/content/ledger.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
it('applies installed producer SQL once in its own namespace and rejects a changed recorded hash', async () => {
  await migrate(pool);
  for (const file of ArchiveMigrations) {
    const hash = createHash('sha256')
      .update(await readFile(file.url))
      .digest('hex');
    const row = (
      await pool.query<{ hash: string }>(
        'SELECT hash FROM schema_migrations WHERE namespace=$1 AND name=$2',
        [file.namespace, file.name],
      )
    ).rows[0];
    expect(row?.hash).toBe(hash);
    await pool.query('UPDATE schema_migrations SET hash=$3 WHERE namespace=$1 AND name=$2', [
      file.namespace,
      file.name,
      '00'.repeat(32),
    ]);
    try {
      await expect(migrate(pool)).rejects.toThrow('Published migration hash changed');
    } finally {
      await pool.query('UPDATE schema_migrations SET hash=$3 WHERE namespace=$1 AND name=$2', [
        file.namespace,
        file.name,
        hash,
      ]);
    }
  }
});
it('freezes export domains and requires manifest, verification and backup/anchor metadata for advanced phases', async () => {
  const account = randomUUID(),
    job = randomUUID(),
    request = randomUUID();
  const dao = DaoRefSchema.parse({
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '9',
    interfaceVersion: 1,
  });
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
    [account, PrivateKey.generate('K1').toPublic().toString(), 'user-controlled', {}],
  );
  await pool.query(
    `INSERT INTO archive_exports(id,request_id,requested_by,request_hash,dao_key,dao,source,source_code_hash,source_abi_hash,snapshot_number,snapshot_id,snapshot_time,plan) VALUES($1,$2,$3,$4,$5,$6,'decide',$7,$8,100,$9,'2026-10-08T10:00:00Z',$10)`,
    [
      job,
      request,
      account,
      Buffer.alloc(32, 1),
      contentDaoKey(dao),
      dao,
      '11'.repeat(32),
      '22'.repeat(32),
      '00000064' + 'ab'.repeat(28),
      [],
    ],
  );
  await expect(
    pool.query("UPDATE archive_exports SET state='approved' WHERE id=$1", [job]),
  ).rejects.toThrow();
  await expect(
    pool.query('UPDATE archive_exports SET snapshot_number=101 WHERE id=$1', [job]),
  ).rejects.toThrow('ARCHIVE_DOMAIN_IMMUTABLE');
  await pool.query(
    `UPDATE archive_exports SET manifest=$2,manifest_cid=$3,manifest_bytes=188,manifest_commitment=$4,descriptor_commitment=$5,state='pinned' WHERE id=$1`,
    [job, {}, 'fixture-cid-for-sql-only', '33'.repeat(32), '44'.repeat(32)],
  );
  await expect(
    pool.query('UPDATE archive_exports SET manifest_bytes=189 WHERE id=$1', [job]),
  ).rejects.toThrow('ARCHIVE_MANIFEST_IMMUTABLE');
  await expect(
    pool.query("UPDATE archive_exports SET state='verified' WHERE id=$1", [job]),
  ).rejects.toThrow();
  await pool.query("UPDATE archive_exports SET state='verified',verified_at=now() WHERE id=$1", [
    job,
  ]);
  await expect(
    pool.query("UPDATE archive_exports SET state='pruning' WHERE id=$1", [job]),
  ).rejects.toThrow();
});
