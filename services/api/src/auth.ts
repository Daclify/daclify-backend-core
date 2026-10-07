import type { Pool } from 'pg';
import { createHash, randomBytes, randomUUID, ECDH, timingSafeEqual } from 'node:crypto';
import { PublicKey, Signature } from '@wharfkit/antelope';
import { AccountSchema, SigningPublicKeySchema, type Account } from '../../../protocol/api.js';
import { EncryptionPublicKeySchema } from '../../../protocol/crypto.js';
import type { Challenge } from './store.js';
import { ApiError } from './errors.js';

const hash = (value: string): Buffer => createHash('sha256').update(value).digest();
export function validEncryptionKey(
  value: unknown,
): ReturnType<typeof EncryptionPublicKeySchema.parse> {
  const key = EncryptionPublicKeySchema.parse(value);
  try {
    ECDH.convertKey(
      Buffer.concat([
        Buffer.from([4]),
        Buffer.from(key.x, 'base64url'),
        Buffer.from(key.y, 'base64url'),
      ]),
      'prime256v1',
    );
  } catch {
    throw new ApiError('ENCRYPTION_KEY_INVALID');
  }
  return key;
}
interface AccountRow {
  id: string;
  signing_key: string;
  custody: string;
  encryption_key: unknown;
}
const accountFromRow = (row: AccountRow): Account =>
  AccountSchema.parse({
    id: row.id,
    signingKey: row.signing_key,
    custody: row.custody,
    encryptionKey: row.encryption_key,
  });
export async function createChallenge(
  pool: Pool,
  key: string,
  origin: string,
): Promise<{ id: string; message: string; expires: string }> {
  SigningPublicKeySchema.parse(key);
  const id = randomUUID();
  const expires = new Date(Date.now() + 300_000).toISOString();
  const message = JSON.stringify({
    domain: 'daclify.login.v1',
    origin,
    challenge: id,
    signingKey: key,
    expires,
  });
  await pool.query(
    'INSERT INTO challenges(id,signing_key,message,expires_at) VALUES($1,$2,$3,$4)',
    [id, key, message, expires],
  );
  return { id, message, expires };
}
export async function authenticate(
  pool: Pool,
  id: string,
  signature: string,
  encryptionKey: unknown,
): Promise<{ account: Account; token: string; csrfToken: string }> {
  const encryption = validEncryptionKey(encryptionKey);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const challenge = (
      await client.query<Challenge>(
        'SELECT id,signing_key,message,expires_at FROM challenges WHERE id=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
        [id],
      )
    ).rows[0];
    let valid = false;
    if (challenge) {
      try {
        valid = Signature.from(signature).verifyMessage(
          new TextEncoder().encode(challenge.message),
          PublicKey.from(challenge.signing_key),
        );
      } catch {
        valid = false;
      }
    }
    if (!challenge || !valid) throw new ApiError('AUTH_INVALID', 401);
    await client.query(
      "INSERT INTO accounts(signing_key,custody,encryption_key) VALUES($1,'user-controlled',$2) ON CONFLICT(signing_key) DO NOTHING",
      [challenge.signing_key, encryption],
    );
    const row = (
      await client.query<AccountRow>(
        'SELECT id,signing_key,custody,encryption_key FROM accounts WHERE signing_key=$1 FOR UPDATE',
        [challenge.signing_key],
      )
    ).rows[0];
    if (!row) throw new ApiError('AUTH_INVALID', 401);
    const account = accountFromRow(row);
    if (JSON.stringify(account.encryptionKey) !== JSON.stringify(encryption))
      throw new ApiError('KEY_CHANGE_REQUIRED', 409);
    // Managed identities use a provider ceremony; public key login cannot convert custody.
    if (account.custody !== 'user-controlled') throw new ApiError('ACCOUNT_MODE_MISMATCH', 403);
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    await client.query(
      "INSERT INTO sessions(token_hash,account_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
      [hash(token), account.id, hash(csrfToken)],
    );
    await client.query('UPDATE challenges SET consumed_at=now() WHERE id=$1', [id]);
    await client.query('COMMIT');
    return { account, token, csrfToken };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function readSession(pool: Pool, token: string): Promise<Account | undefined> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
  const row = (
    await pool.query<AccountRow>(
      'SELECT a.id,a.signing_key,a.custody,a.encryption_key FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()',
      [hash(token)],
    )
  ).rows[0];
  return row ? accountFromRow(row) : undefined;
}
export async function checkCsrf(pool: Pool, token: string, csrf: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) return false;
  const row = (
    await pool.query<{ csrf_hash: Buffer }>(
      'SELECT csrf_hash FROM sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',
      [hash(token)],
    )
  ).rows[0];
  return !!row && row.csrf_hash.length === 32 && timingSafeEqual(row.csrf_hash, hash(csrf));
}
export async function revokeSession(pool: Pool, token: string): Promise<void> {
  await pool.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [hash(token)]);
}
