import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { freezeQuickAccount } from '../../services/api/src/quick-ballots/accounts.js';
import { insertAccountSession, readAccount } from '../../services/api/src/auth/account-session.js';
import { reconnectAccounts } from '../../services/api/src/auth/account-reconnect.js';
import { authChain } from '../helpers/auth-chain.js';
import { quickAccountIdentity } from '../../sdk/quick-accounts.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
const domain = { chainId: '11'.repeat(32), runtime: 'daclifycore1' };
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryption = EncryptionPublicKeySchema.parse({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y });
async function fullAccount() {
  const id = randomUUID(),
    key = PrivateKey.generate('K1').toPublic().toString();
  await pool.query(
    "INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,$2,$3,'user-controlled')",
    [id, key, encryption],
  );
  return { id, key };
}
async function walletAccount(chain = domain.chainId) {
  const id = randomUUID(),
    wallet =
      'q' +
      randomBytes(5)
        .toString('hex')
        .replace(/[0-9]/g, (n) => String.fromCharCode(97 + Number(n)));
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,NULL,NULL,'user-controlled')",
      [id],
    );
    await db.query(
      "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,$3,'active')",
      [id, chain, wallet],
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
  return { id, wallet };
}

it('enforces immutable domain/anchor identity and prevents a second account owning the same voting identity', async () => {
  const present = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quick_account_anchors'",
  );
  expect(present.rowCount).toBe(1);
  const owner = randomUUID(),
    other = randomUUID(),
    key = PrivateKey.generate('K1').toPublic().toString(),
    identity = randomBytes(32),
    chain = '11'.repeat(32);
  for (const id of [owner, other])
    await pool.query(
      "INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,$2,$3,'user-controlled')",
      [id, id === owner ? key : PrivateKey.generate('K1').toPublic().toString(), {}],
    );
  const anchor = { kind: 'key', publicKey: key };
  await pool.query(
    'INSERT INTO quick_account_anchors(account_id,chain_id,runtime,anchor,identity) VALUES($1,$2,$3,$4,$5)',
    [owner, chain, 'daclifycore1', anchor, identity],
  );
  await expect(
    pool.query('UPDATE quick_account_anchors SET anchor=$2 WHERE account_id=$1', [
      owner,
      { kind: 'key', publicKey: PrivateKey.generate('K1').toPublic().toString() },
    ]),
  ).rejects.toMatchObject({ code: '23514', constraint: 'quick_anchor_immutable' });
  await expect(
    pool.query('UPDATE quick_account_anchors SET identity=$2 WHERE account_id=$1', [
      owner,
      randomBytes(32),
    ]),
  ).rejects.toMatchObject({ code: '23514', constraint: 'quick_anchor_immutable' });
  await expect(
    pool.query(
      'INSERT INTO quick_account_anchors(account_id,chain_id,runtime,anchor,identity) VALUES($1,$2,$3,$4,$5)',
      [other, chain, 'daclifycore1', anchor, identity],
    ),
  ).rejects.toMatchObject({ code: '23505' });
  expect(
    (
      await pool.query<{ anchor: unknown }>(
        'SELECT anchor FROM quick_account_anchors WHERE account_id=$1',
        [owner],
      )
    ).rows[0]?.anchor,
  ).toEqual(anchor);
});

it('freezes the canonical account key or original wallet and preserves it through vault attachment', async () => {
  const full = await fullAccount(),
    wallet = await walletAccount();
  const root = await freezeQuickAccount(pool, full.id, domain, 41);
  expect(root.anchor).toEqual({ kind: 'key', publicKey: full.key });
  expect(root.identity).toBe(quickAccountIdentity(domain.chainId, domain.runtime, root.anchor));
  const before = await freezeQuickAccount(pool, wallet.id, domain, 41);
  expect(before.anchor).toEqual({ kind: 'native', account: wallet.wallet, permission: 'active' });
  await pool.query('UPDATE accounts SET signing_key=$2,encryption_key=$3 WHERE id=$1', [
    wallet.id,
    PrivateKey.generate('K1').toPublic().toString(),
    encryption,
  ]);
  expect(await freezeQuickAccount(pool, wallet.id, domain, 41)).toEqual(before);
  const wrongChain = await walletAccount('22'.repeat(32));
  await expect(freezeQuickAccount(pool, wrongChain.id, domain, 41)).rejects.toThrow(
    'QUICK_ANCHOR_REQUIRED',
  );
});

it('moves the same frozen wallet identity during a proved account reconnect', async () => {
  const source = await walletAccount(),
    target = await fullAccount();
  const frozen = await freezeQuickAccount(pool, source.id, domain, 41);
  const current = await readAccount(pool, source.id),
    registered = await readAccount(pool, target.id);
  if (!current || !registered) throw Error('FIXTURE_ACCOUNT');
  const db = await pool.connect();
  let session: Awaited<ReturnType<typeof insertAccountSession>>;
  try {
    session = await insertAccountSession(db, source.id);
  } finally {
    db.release();
  }
  await reconnectAccounts(pool, authChain, current, registered, source.id, session.token);
  expect(await freezeQuickAccount(pool, target.id, domain, 41)).toEqual(frozen);
  expect(
    (await pool.query('SELECT 1 FROM quick_account_anchors WHERE account_id=$1', [source.id]))
      .rowCount,
  ).toBe(0);
});

it('rejects reconnecting two already distinct on-chain voting identities before moving credentials', async () => {
  const source = await walletAccount(),
    target = await fullAccount();
  await freezeQuickAccount(pool, source.id, domain, 41);
  await freezeQuickAccount(pool, target.id, domain, 41);
  const current = await readAccount(pool, source.id),
    registered = await readAccount(pool, target.id);
  if (!current || !registered) throw Error('FIXTURE_ACCOUNT');
  const db = await pool.connect();
  let session: Awaited<ReturnType<typeof insertAccountSession>>;
  try {
    session = await insertAccountSession(db, source.id);
  } finally {
    db.release();
  }
  await expect(
    reconnectAccounts(pool, authChain, current, registered, source.id, session.token),
  ).rejects.toThrow('ACCOUNT_RECONNECT_CONFLICT');
  expect(
    (
      await pool.query<{ merged_into: string | null }>(
        'SELECT merged_into FROM accounts WHERE id=$1',
        [source.id],
      )
    ).rows[0]?.merged_into,
  ).toBeNull();
});
