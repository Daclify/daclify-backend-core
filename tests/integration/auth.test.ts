import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { generateKeyPairSync } from 'node:crypto';
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
const publicKey = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
describe('real key-based walletless sessions', () => {
  it('rejects an encryption key that is not on the curve', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(pool, key.toPublic().toString(), origin);
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
    const challenge = await createChallenge(pool, key.toPublic().toString(), origin);
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
    const challenge = await createChallenge(pool, key.toPublic().toString(), origin);
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
    const challenge = await createChallenge(pool, key.toPublic().toString(), origin);
    const signature = key.signMessage(new TextEncoder().encode(challenge.message)).toString();
    await authenticate(pool, challenge.id, signature, publicKey);
    await expect(authenticate(pool, challenge.id, signature, publicKey)).rejects.toThrow(
      'AUTH_INVALID',
    );
  });
  it('cannot alter account encryption identity during login', async () => {
    const key = PrivateKey.generate('K1');
    const first = await createChallenge(pool, key.toPublic().toString(), origin);
    await authenticate(
      pool,
      first.id,
      key.signMessage(new TextEncoder().encode(first.message)).toString(),
      publicKey,
    );
    const second = await createChallenge(pool, key.toPublic().toString(), origin);
    await expect(
      authenticate(
        pool,
        second.id,
        key.signMessage(new TextEncoder().encode(second.message)).toString(),
        (() => {
          const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
            format: 'jwk',
          });
          return { kty: 'EC', crv: 'P-256', x: other.x, y: other.y };
        })(),
      ),
    ).rejects.toThrow('KEY_CHANGE_REQUIRED');
  });
  it('revokes session access without deleting identity', async () => {
    const key = PrivateKey.generate('K1');
    const challenge = await createChallenge(pool, key.toPublic().toString(), origin);
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
