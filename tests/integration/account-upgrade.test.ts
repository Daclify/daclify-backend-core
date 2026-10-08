import { expect, it } from 'vitest';
import { Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local *_test database required');
it('upgrades the actual seven-migration schema, preserving identities and forcing fresh proven sessions and EVM pairing', async () => {
  const name = 'daclify_upgrade_' + Date.now() + '_' + randomBytes(4).toString('hex') + '_test';
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error('FIXTURE_DATABASE_NAME');
  const owner = new Pool({ connectionString: url }),
    target = new URL(url);
  target.pathname = '/' + name;
  let pool: Pool | undefined,
    created = false;
  try {
    await owner.query(`CREATE DATABASE ${name}`);
    created = true;
    pool = new Pool({ connectionString: target.toString() });
    await pool.query(
      'CREATE TABLE schema_migrations(namespace text NOT NULL,name text NOT NULL,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(namespace,name))',
    );
    const files = (await readdir('migrations'))
      .filter((f) => /^00[1-7]_[a-z_]+\.sql$/.test(f))
      .sort();
    expect(files).toHaveLength(7);
    for (const file of files) {
      const sql = await readFile('migrations/' + file, 'utf8');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(namespace,name,hash) VALUES($1,$2,$3)', [
        'core',
        file,
        createHash('sha256').update(sql).digest('hex'),
      ]);
    }
    const account = randomUUID(),
      challenge = randomUUID(),
      key = PrivateKey.generate('K1').toPublic().toString();
    await pool.query(
      'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
      [account, key, 'user-controlled', {}],
    );
    await pool.query(
      "INSERT INTO sessions(token_hash,account_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [randomBytes(32), account, randomBytes(32)],
    );
    await pool.query(
      "INSERT INTO signin_challenges(id,purpose,account_id,subject,secret_hash,expires_at) VALUES($1,'email-link',$2,'upgrade@example.test',$3,now()+interval '5 minutes')",
      [challenge, account, randomBytes(32)],
    );
    await pool.query('INSERT INTO evm_links(account_id,chain_id,address) VALUES($1,41,$2)', [
      account,
      '0x' + '11'.repeat(20),
    ]);
    const oldUpload = randomUUID(),
      providerId = randomUUID();
    await pool.query(
      `INSERT INTO uploads(id,account_id,dao_key,expected_size,privacy,state,provider_id,cid,commitment,expires_at)
      VALUES($1,$2,$3,42,'encrypted','verified',$4,'legacy-cid',$5,now())`,
      [
        oldUpload,
        account,
        JSON.stringify(['22'.repeat(32), 'daclifycore', '1']),
        providerId,
        '33'.repeat(32),
      ],
    );
    await migrate(pool);
    await migrate(pool);
    expect(
      (await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM schema_migrations'))
        .rows[0]?.count,
    ).toBe(
      String(
        (await readdir('migrations')).filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name)).length,
      ),
    );
    expect(
      (
        await pool.query<{
          provider_id: string;
          expected_size: string;
          provider_scope: string | null;
          storage_object_id: string | null;
        }>(
          'SELECT provider_id,expected_size::text,provider_scope,storage_object_id FROM uploads WHERE id=$1',
          [oldUpload],
        )
      ).rows[0],
    ).toEqual({
      provider_id: providerId,
      expected_size: '42',
      provider_scope: null,
      storage_object_id: null,
    });
    expect(
      (await pool.query<{ count: string }>('SELECT count(*)::text FROM hosted_objects')).rows[0]
        ?.count,
    ).toBe('0');
    expect(
      (
        await pool.query<{ signing_key: string }>('SELECT signing_key FROM accounts WHERE id=$1', [
          account,
        ])
      ).rows[0]?.signing_key,
    ).toBe(key);
    expect(
      (
        await pool.query<{ revoked: boolean; credential_key: string | null }>(
          'SELECT revoked_at IS NOT NULL AS revoked,credential_key FROM sessions WHERE account_id=$1',
          [account],
        )
      ).rows[0],
    ).toEqual({ revoked: true, credential_key: null });
    expect(
      (
        await pool.query<{ consumed: boolean }>(
          'SELECT consumed_at IS NOT NULL AS consumed FROM signin_challenges WHERE id=$1',
          [challenge],
        )
      ).rows[0]?.consumed,
    ).toBe(true);
    expect(
      (
        await pool.query<{ control_verified_at: Date | null }>(
          'SELECT control_verified_at FROM evm_links WHERE account_id=$1',
          [account],
        )
      ).rows[0]?.control_verified_at,
    ).toBeNull();
  } finally {
    try {
      await pool?.end();
      if (created) await owner.query(`DROP DATABASE ${name}`);
    } finally {
      await owner.end();
    }
  }
});
