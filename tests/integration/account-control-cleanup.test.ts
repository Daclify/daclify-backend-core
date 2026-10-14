import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { AccountSchema } from '../../protocol/api.js';
import * as auth from '../../services/api/src/auth.js';
import { beginAccountControl, consumeAccountControl } from '../../services/api/src/auth/intent.js';
import {
  insertAccountSession,
  withTransaction,
} from '../../services/api/src/auth/account-session.js';
import { migrate } from '../../services/api/src/store.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local test database required');
const pool = new Pool({ connectionString: url, max: 4, statement_timeout: 2000 });
const accounts: string[] = [];
const origin = 'http://localhost:5178';
const path = '/v1/profiles/keys/share';
const body = Buffer.from('{"fixture":true}');
beforeAll(() => migrate(pool));
afterEach(async () => {
  await pool.query('DELETE FROM account_control_intents WHERE account_id=ANY($1::uuid[])', [
    accounts,
  ]);
  await pool.query('DELETE FROM sessions WHERE account_id=ANY($1::uuid[])', [accounts]);
  await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])', [accounts.splice(0)]);
});
afterAll(() => pool.end());

async function fixture(count: number) {
  const key = PrivateKey.generate('K1');
  const account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: key.toPublic().toString(),
    custody: 'user-controlled',
    encryptionKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    }),
  });
  accounts.push(account.id);
  await pool.query(
    "INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,'user-controlled',$3)",
    [account.id, account.signingKey, account.encryptionKey],
  );
  const session = await withTransaction(pool, (client) => insertAccountSession(client, account.id));
  const intents = [];
  for (let i = 0; i < count; i++)
    intents.push(
      await beginAccountControl(pool, account, session.token, origin, {
        path,
        bodyHash: createHash('sha256').update(body).digest('hex'),
      }),
    );
  return { key, account, session, intents };
}

async function expire(ids: string[]) {
  await pool.query(
    "UPDATE account_control_intents SET expires_at=now()-interval '1 minute' WHERE id=ANY($1::uuid[])",
    [ids],
  );
}

it('removes expired account controls in bounded batches and preserves a usable live proof', async () => {
  const f = await fixture(5);
  const expired = f.intents.slice(0, 3).map((value) => value.id);
  const live = f.intents[3];
  const consumed = f.intents[4];
  if (!live || !consumed) throw Error('FIXTURE_INTENTS');
  await expire(expired);
  await pool.query(
    'UPDATE account_control_intents SET consumed_at=now() WHERE id=ANY($1::uuid[])',
    [[expired[0], consumed.id]],
  );
  expect(await auth.cleanupExpiredAccountControls(pool, 2)).toBe(2);
  expect(
    (await pool.query('SELECT id FROM account_control_intents WHERE id=ANY($1::uuid[])', [expired]))
      .rowCount,
  ).toBe(1);
  expect(await auth.cleanupExpiredAccountControls(pool, 2)).toBe(1);
  expect(
    (
      await pool.query('SELECT id FROM account_control_intents WHERE id=ANY($1::uuid[])', [
        [live.id, consumed.id],
      ])
    ).rowCount,
  ).toBe(2);
  await expect(
    consumeAccountControl(
      pool,
      f.account,
      f.session.token,
      path,
      body,
      live.id,
      {
        kind: 'root',
        signature: f.key.signMessage(new TextEncoder().encode(live.message)).toString(),
      },
      async () => {
        throw Error('ROOT_PROOF_MUST_NOT_READ_CHAIN');
      },
      origin,
      origin,
    ),
  ).resolves.toBeUndefined();
});

it('skips a leased expired control so concurrent maintenance can make progress', async () => {
  const f = await fixture(3);
  const first = f.intents[0];
  if (!first) throw Error('FIXTURE_INTENTS');
  await expire(f.intents.map((value) => value.id));
  const lease = await pool.connect();
  try {
    await lease.query('BEGIN');
    await lease.query('SELECT id FROM account_control_intents WHERE id=$1 FOR UPDATE', [first.id]);
    expect(await auth.cleanupExpiredAccountControls(pool, 2)).toBe(2);
    expect(
      (await lease.query('SELECT id FROM account_control_intents WHERE id=$1', [first.id]))
        .rowCount,
    ).toBe(1);
  } finally {
    await lease.query('ROLLBACK');
    lease.release();
  }
  expect(await auth.cleanupExpiredAccountControls(pool, 2)).toBe(1);
});

it.each([0, -1, 501, 1.5])('rejects the invalid cleanup batch limit %s', async (limit) => {
  await expect(auth.cleanupExpiredAccountControls(pool, limit)).rejects.toThrow(
    'AUTH_CLEANUP_LIMIT',
  );
});

it('runs account-control expiry cleanup through the ordinary auth maintenance worker', async () => {
  const f = await fixture(1);
  await expire(f.intents.map((value) => value.id));
  const worker = auth.startAuthMaintenance(pool);
  try {
    await expect
      .poll(
        async () =>
          (
            await pool.query('SELECT id FROM account_control_intents WHERE account_id=$1', [
              f.account.id,
            ])
          ).rowCount,
      )
      .toBe(0);
  } finally {
    await worker.stop();
  }
});
