import { createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AccountSchema, type Account } from '../../../../protocol/api.js';
import { ApiError } from '../errors.js';

interface AccountRow {
  id: string;
  signing_key: string;
  custody: string;
  encryption_key: unknown;
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

function accountFromRow(row: AccountRow): Account {
  return AccountSchema.parse({
    id: row.id,
    signingKey: row.signing_key,
    custody: row.custody,
    encryptionKey: row.encryption_key,
  });
}

export function uniqueViolation(error: unknown): boolean {
  return z.object({ code: z.literal('23505') }).safeParse(error).success;
}

export async function withTransaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function insertAccountSession(
  client: PoolClient,
  accountId: string,
  credentialKey: string | null = null,
): Promise<{ account: Account; token: string; csrfToken: string }> {
  const row = (
    await client.query<AccountRow>(
      'SELECT id,signing_key,custody,encryption_key FROM accounts WHERE id=$1',
      [accountId],
    )
  ).rows[0];
  if (!row) throw new ApiError('AUTH_REQUIRED', 401);
  const account = accountFromRow(row);
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  await client.query(
    "INSERT INTO sessions(token_hash,account_id,csrf_hash,expires_at,credential_key) VALUES($1,$2,$3,now()+interval '12 hours',$4)",
    [digest(token), account.id, digest(csrfToken), credentialKey],
  );
  return { account, token, csrfToken };
}

export async function openAccountSession(
  pool: Pool,
  accountId: string,
  credentialKey: string | null = null,
): Promise<{ account: Account; token: string; csrfToken: string }> {
  return withTransaction(pool, async (client) => {
    if (credentialKey !== null) {
      const credential = await client.query(
        'SELECT account_id FROM credentials WHERE provider_key=$1 AND account_id=$2 FOR SHARE',
        [credentialKey, accountId],
      );
      if (credential.rowCount !== 1) throw new ApiError('AUTH_INVALID', 401);
    }
    return insertAccountSession(client, accountId, credentialKey);
  });
}
