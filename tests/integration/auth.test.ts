import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { LoginMessageSchema } from '../../protocol/api.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { migrate } from '../../services/api/src/store.js';
import {
  createChallenge,
  authenticate,
  readSession,
  revokeSession,
} from '../../services/api/src/auth.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const publicKey = EncryptionPublicKeySchema.parse({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
describe('real key-based walletless sessions', () => {
  it('rejects a substituted first-registration encryption key without creating an account or consuming the valid challenge', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    const signature = key.signMessage(new TextEncoder().encode(challenge.message)).toString();
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    });
    await expect(
      authenticate(pool, challenge.id, signature, {
        kty: 'EC',
        crv: 'P-256',
        x: other.x,
        y: other.y,
      }),
    ).rejects.toThrow('AUTH_INVALID');
    expect(
      (
        await pool.query('SELECT id FROM accounts WHERE signing_key=$1', [
          key.toPublic().toString(),
        ])
      ).rowCount,
    ).toBe(0);
    const result = await authenticate(pool, challenge.id, signature, publicKey);
    expect(result.account.encryptionKey).toEqual(publicKey);
    await expect(authenticate(pool, challenge.id, signature, publicKey)).rejects.toThrow(
      'AUTH_INVALID',
    );
  });
  it.each([false, true])(
    'rejects an unused v2 challenge with request-context verification %s',
    async (withContext) => {
      const key = PrivateKey.generate('K1'),
        id = randomUUID(),
        expires = new Date(Date.now() + 300000).toISOString();
      const message = JSON.stringify({
        domain: 'daclify.login.v2',
        origin,
        audience: origin,
        challenge: id,
        signingKey: key.toPublic().toString(),
        expires,
      });
      await pool.query(
        'INSERT INTO challenges(id,signing_key,message,expires_at) VALUES($1,$2,$3,$4)',
        [id, key.toPublic().toString(), message, expires],
      );
      await expect(
        authenticate(
          pool,
          id,
          key.signMessage(new TextEncoder().encode(message)).toString(),
          publicKey,
          withContext ? { origin, audience: origin } : undefined,
        ),
      ).rejects.toThrow('AUTH_INVALID');
      expect(
        (
          await pool.query('SELECT id FROM accounts WHERE signing_key=$1', [
            key.toPublic().toString(),
          ])
        ).rowCount,
      ).toBe(0);
    },
  );
  it('binds the signed message to both keys, challenge ID and expiry', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    expect(LoginMessageSchema.parse(JSON.parse(challenge.message))).toEqual({
      domain: 'daclify.login.v3',
      origin,
      audience: origin,
      challenge: challenge.id,
      expires: challenge.expires,
      signingKey: key.toPublic().toString(),
      encryptionKey: publicKey,
    });
  });
  it.each(['challenge', 'expires', 'signingKey'] as const)(
    'rejects a signed message whose %s disagrees with its stored challenge',
    async (field) => {
      const key = PrivateKey.generate('K1');
      const challenge = await createChallenge(
        pool,
        { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
        origin,
      );
      const message = LoginMessageSchema.parse(JSON.parse(challenge.message));
      const changed = JSON.stringify({
        ...message,
        [field]:
          field === 'challenge'
            ? randomUUID()
            : field === 'expires'
              ? new Date(Date.parse(challenge.expires) + 1000).toISOString()
              : PrivateKey.generate('K1').toPublic().toString(),
      });
      await pool.query('UPDATE challenges SET message=$2 WHERE id=$1', [challenge.id, changed]);
      await expect(
        authenticate(
          pool,
          challenge.id,
          key.signMessage(new TextEncoder().encode(changed)).toString(),
          publicKey,
        ),
      ).rejects.toThrow('AUTH_INVALID');
      expect(
        (
          await pool.query('SELECT id FROM accounts WHERE signing_key=$1', [
            key.toPublic().toString(),
          ])
        ).rowCount,
      ).toBe(0);
    },
  );
  it('rejects invalid encryption curve points before persisting a challenge', async () => {
    const key = PrivateKey.generate('K1');
    await expect(
      createChallenge(
        pool,
        {
          signingKey: key.toPublic().toString(),
          encryptionKey: { kty: 'EC', crv: 'P-256', x: 'A'.repeat(43), y: 'B'.repeat(43) },
        },
        origin,
      ),
    ).rejects.toThrow('ENCRYPTION_KEY_INVALID');
    expect(
      (
        await pool.query('SELECT id FROM challenges WHERE signing_key=$1', [
          key.toPublic().toString(),
        ])
      ).rowCount,
    ).toBe(0);
  });
  it('preserves a pre-upgrade account, keys and existing session when logging in with v3', async () => {
    const key = PrivateKey.generate('K1'),
      accountId = randomUUID(),
      token = randomBytes(32).toString('base64url');
    await pool.query(
      "INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,'user-controlled',$3)",
      [accountId, key.toPublic().toString(), publicKey],
    );
    await pool.query(
      "INSERT INTO sessions(token_hash,account_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [
        createHash('sha256').update(token).digest(),
        accountId,
        createHash('sha256').update('fixture-csrf').digest(),
      ],
    );
    const before = await readSession(pool, token);
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    const result = await authenticate(
      pool,
      challenge.id,
      key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      publicKey,
    );
    expect(result.account.id).toBe(accountId);
    expect(result.account.encryptionKey).toEqual(publicKey);
    expect(await readSession(pool, token)).toEqual(before);
    expect(
      (
        await pool.query('SELECT id FROM accounts WHERE signing_key=$1', [
          key.toPublic().toString(),
        ])
      ).rowCount,
    ).toBe(1);
  });
  it('creates only one session when the same signed challenge is submitted concurrently', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    const signature = key.signMessage(new TextEncoder().encode(challenge.message)).toString();
    const outcomes = await Promise.allSettled([
      authenticate(pool, challenge.id, signature, publicKey),
      authenticate(pool, challenge.id, signature, publicKey),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    const count = await pool.query<{ count: string }>(
      'SELECT count(*)::text FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE a.signing_key=$1',
      [key.toPublic().toString()],
    );
    expect(count.rows[0]?.count).toBe('1');
  });
  it('rejects an expired challenge even with the correct signature and creates no account', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    await pool.query("UPDATE challenges SET expires_at=now()-interval '1 second' WHERE id=$1", [
      challenge.id,
    ]);
    await expect(
      authenticate(
        pool,
        challenge.id,
        key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        publicKey,
      ),
    ).rejects.toThrow('AUTH_INVALID');
    expect(
      (
        await pool.query('SELECT id FROM accounts WHERE signing_key=$1', [
          key.toPublic().toString(),
        ])
      ).rowCount,
    ).toBe(0);
  });
  it('rejects an encryption key that is not on the curve', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    await expect(
      authenticate(
        pool,
        challenge.id,
        key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        { kty: 'EC', crv: 'P-256', x: 'A'.repeat(43), y: 'B'.repeat(43) },
      ),
    ).rejects.toThrow('ENCRYPTION_KEY_INVALID');
  });
  it('authenticates key possession and persists an opaque session', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    const result = await authenticate(
      pool,
      challenge.id,
      key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      publicKey,
    );
    expect(result.account.custody).toBe('user-controlled');
    expect((await readSession(pool, result.token))?.id).toBe(result.account.id);
    expect(result.token).not.toContain('PVT_');
  });
  it('rejects a signature by another key', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    await expect(
      authenticate(
        pool,
        challenge.id,
        PrivateKey.generate('K1')
          .signMessage(new TextEncoder().encode(challenge.message))
          .toString(),
        publicKey,
      ),
    ).rejects.toThrow('AUTH_INVALID');
  });
  it('rejects a consumed challenge', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    const signature = key.signMessage(new TextEncoder().encode(challenge.message)).toString();
    await authenticate(pool, challenge.id, signature, publicKey);
    await expect(authenticate(pool, challenge.id, signature, publicKey)).rejects.toThrow(
      'AUTH_INVALID',
    );
  });
  it('cannot alter account encryption identity during login', async () => {
    const key = PrivateKey.generate('K1');
    const first = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    await authenticate(
      pool,
      first.id,
      key.signMessage(new TextEncoder().encode(first.message)).toString(),
      publicKey,
    );
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    });
    const replacement = EncryptionPublicKeySchema.parse({
      kty: 'EC',
      crv: 'P-256',
      x: other.x,
      y: other.y,
    });
    const second = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: replacement },
      origin,
    );
    await expect(
      authenticate(
        pool,
        second.id,
        key.signMessage(new TextEncoder().encode(second.message)).toString(),
        replacement,
      ),
    ).rejects.toThrow('KEY_CHANGE_REQUIRED');
    const account = await pool.query<{ encryption_key: unknown }>(
      'SELECT encryption_key FROM accounts WHERE signing_key=$1',
      [key.toPublic().toString()],
    );
    expect(account.rows[0]?.encryption_key).toEqual(publicKey);
  });
  it('revokes session access without deleting identity', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(
      pool,
      { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
      origin,
    );
    const result = await authenticate(
      pool,
      challenge.id,
      key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      publicKey,
    );
    await revokeSession(pool, result.token);
    expect(await readSession(pool, result.token)).toBeUndefined();
    const account = await pool.query<{ id: string }>('SELECT id FROM accounts WHERE id=$1', [
      result.account.id,
    ]);
    expect(z.string().parse(account.rows[0]?.id)).toBe(result.account.id);
  });
});

it('rejects a valid login signature at a different API issuer without consuming the original challenge', async () => {
  const key = PrivateKey.generate('K1'),
    audience = 'https://api.example';
  const challenge = await createChallenge(
    pool,
    { signingKey: key.toPublic().toString(), encryptionKey: publicKey },
    origin,
    audience,
  );
  const signature = key.signMessage(new TextEncoder().encode(challenge.message)).toString();
  await expect(
    authenticate(pool, challenge.id, signature, publicKey, {
      origin,
      audience: 'https://operator.example',
    }),
  ).rejects.toThrow('AUTH_INVALID');
  const result = await authenticate(pool, challenge.id, signature, publicKey, { origin, audience });
  expect(result.account.signingKey).toBe(key.toPublic().toString());
});
