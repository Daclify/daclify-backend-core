import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { storageUsed } from '../../services/api/src/content/ledger.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url }),
  accountId = randomUUID(),
  daoKey = randomUUID(),
  scope = randomUUID();
beforeAll(async () => {
  await migrate(pool);
  const encryption = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
    [accountId, PrivateKey.generate('K1').toPublic().toString(), 'user-controlled', encryption],
  );
});
afterAll(() => pool.end());
it('counts all unresolved asset bytes and preserves immutable request/ownership domains', async () => {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO asset_uploads(id,account_id,dao_key,provider_scope,import_profile,request_id,kind,reference_key,expected_bytes,commitment,request_hash) VALUES($1,$2,$3,$4,'public-cidv1-file-v1',$5,'archive',$6,23,$7,$7)`,
    [id, accountId, daoKey, scope, randomUUID(), randomUUID(), 'ab'.repeat(32)],
  );
  const client = await pool.connect();
  try {
    expect(await storageUsed(client, daoKey)).toBe(23n);
    await pool.query(
      "UPDATE asset_uploads SET expires_at=now()-interval '1 day',state='review' WHERE id=$1",
      [id],
    );
    expect(await storageUsed(client, daoKey)).toBe(23n);
    await expect(
      pool.query('UPDATE asset_uploads SET expected_bytes=24 WHERE id=$1', [id]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('UPDATE asset_uploads SET provider_scope=$2 WHERE id=$1', [id, randomUUID()]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('DELETE FROM asset_uploads WHERE id=$1', [id])).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      pool.query("UPDATE asset_uploads SET state='verified' WHERE id=$1", [id]),
    ).rejects.toMatchObject({ code: '23514' });
  } finally {
    client.release();
  }
});
