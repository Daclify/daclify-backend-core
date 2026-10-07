import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../errors.js';
import { openAccountSession, withTransaction } from './account-session.js';
import { revokeCredentialSessions } from './intent.js';
import type { Account } from '../../../../protocol/api.js';

export interface EmailDelivery {
  deliver?: (to: string, code: string) => Promise<void>;
  revealCode: boolean;
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

export function normalizeMailbox(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 254) {
    throw new ApiError('EMAIL_INVALID', 400);
  }
  return email;
}

async function limited(pool: Pool | PoolClient, purpose: string, subject: string): Promise<void> {
  const count = await pool.query<{ count: string }>(
    `SELECT count(*) FROM signin_challenges WHERE purpose=$1 AND subject=$2 AND created_at>now()-interval '10 minutes'`,
    [purpose, subject],
  );
  if (Number(count.rows[0]?.count ?? 0) >= 5) throw new ApiError('RATE_LIMIT', 429);
}

async function storeCode(
  pool: Pool,
  purpose: 'email-link' | 'email-login',
  accountId: string | null,
  email: string,
  code: string,
  context: Uint8Array,
): Promise<string> {
  const id = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${purpose}:${email}`,
    ]);
    await limited(client, purpose, email);
    await client.query(
      'UPDATE signin_challenges SET consumed_at=now() WHERE purpose=$1 AND subject=$2 AND account_id IS NOT DISTINCT FROM $3 AND consumed_at IS NULL',
      [purpose, email, accountId],
    );
    await client.query(
      `INSERT INTO signin_challenges(id,purpose,account_id,subject,secret_hash,context_hash,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,
      [id, purpose, accountId, email, digest(code), context],
    );
  });
  return id;
}

async function consumeCode(
  pool: Pool,
  purpose: 'email-link' | 'email-login',
  accountId: string | null,
  email: string,
  code: string,
  context: Uint8Array,
): Promise<void> {
  const consumed = await pool.query<{ accepted: boolean }>(
    `UPDATE signin_challenges SET attempts=attempts+1,
       consumed_at=CASE WHEN secret_hash=$3 THEN now() ELSE consumed_at END
     WHERE consumed_at IS NULL AND expires_at>now() AND attempts<5
       AND id=(SELECT id FROM signin_challenges
         WHERE purpose=$1 AND subject=$2 AND consumed_at IS NULL AND expires_at>now()
           AND account_id IS NOT DISTINCT FROM $4 AND context_hash=$5
         ORDER BY created_at DESC,id DESC LIMIT 1)
     RETURNING secret_hash=$3 AS accepted`,
    [purpose, email, digest(code), accountId, context],
  );
  if (consumed.rowCount !== 1 || !consumed.rows[0]?.accepted)
    throw new ApiError('EMAIL_INVALID', 401);
}

function freshCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

export async function startEmailLink(
  pool: Pool,
  accountId: string,
  value: string,
  delivery: EmailDelivery,
  context: Uint8Array,
): Promise<{ delivery: 'local'; code: string } | { delivery: 'sent' }> {
  const email = normalizeMailbox(value);
  if (!delivery.revealCode && !delivery.deliver) throw new ApiError('EMAIL_UNAVAILABLE', 503);
  const code = freshCode();
  const id = await storeCode(pool, 'email-link', accountId, email, code, context);
  if (delivery.deliver) {
    try {
      await delivery.deliver(email, code);
    } catch {
      await pool.query('UPDATE signin_challenges SET consumed_at=now() WHERE id=$1', [id]);
      throw new ApiError('EMAIL_DELIVERY_FAILED', 503);
    }
    return { delivery: 'sent' };
  }
  return { delivery: 'local', code };
}

export async function confirmEmailLink(
  pool: Pool,
  accountId: string,
  value: string,
  code: string,
  context: Uint8Array,
): Promise<{ subject: string }> {
  const email = normalizeMailbox(value);
  await consumeCode(pool, 'email-link', accountId, email, code, context);
  const providerKey = `email:${email}`;
  const inserted = await pool.query<{ account_id: string }>(
    'INSERT INTO credentials(provider_key,account_id) VALUES($1,$2) ON CONFLICT(provider_key) DO NOTHING RETURNING account_id',
    [providerKey, accountId],
  );
  const owner =
    inserted.rows[0]?.account_id ??
    (
      await pool.query<{ account_id: string }>(
        'SELECT account_id FROM credentials WHERE provider_key=$1',
        [providerKey],
      )
    ).rows[0]?.account_id;
  if (owner !== accountId) throw new ApiError('CREDENTIAL_LINKED', 409);
  return { subject: email };
}

export async function startEmailLogin(
  pool: Pool,
  value: string,
  deliver: (to: string, code: string) => Promise<void>,
  context: Uint8Array,
): Promise<{ delivery: 'sent' }> {
  const email = normalizeMailbox(value);
  // Issue/deliver the same bounded attempt whether paired or not. SMTP timing and
  // the per-mailbox resend limit must not disclose the credential directory.
  const code = freshCode();
  const id = await storeCode(pool, 'email-login', null, email, code, context);
  try {
    await deliver(email, code);
  } catch {
    await pool.query('UPDATE signin_challenges SET consumed_at=now() WHERE id=$1', [id]);
  }
  return { delivery: 'sent' };
}

export async function confirmEmailLogin(
  pool: Pool,
  value: string,
  code: string,
  context: Uint8Array,
): Promise<{ account: Account; token: string; csrfToken: string }> {
  const email = normalizeMailbox(value);
  await consumeCode(pool, 'email-login', null, email, code, context);
  const row = (
    await pool.query<{ account_id: string }>(
      'SELECT account_id FROM credentials WHERE provider_key=$1',
      [`email:${email}`],
    )
  ).rows[0];
  if (!row) throw new ApiError('PROVIDER_UNKNOWN', 401);
  return openAccountSession(pool, row.account_id, `email:${email}`);
}

export async function removeEmail(pool: Pool, accountId: string, value: string): Promise<void> {
  await withTransaction(pool, async (client) => {
    const deleted = await client.query(
      'DELETE FROM credentials WHERE provider_key=$1 AND account_id=$2',
      [`email:${normalizeMailbox(value)}`, accountId],
    );
    if (deleted.rowCount !== 1) throw new ApiError('CREDENTIAL_UNKNOWN', 404);
    await revokeCredentialSessions(client, accountId, `email:${normalizeMailbox(value)}`);
  });
}
