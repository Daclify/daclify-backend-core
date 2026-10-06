import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import { openAccountSession } from './account-session.js';
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

async function limited(pool: Pool, purpose: string, subject: string): Promise<void> {
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
): Promise<void> {
  await pool.query(
    `INSERT INTO signin_challenges(id,purpose,account_id,subject,secret_hash,expires_at)
     VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')`,
    [randomUUID(), purpose, accountId, email, digest(code)],
  );
}

async function consumeCode(
  pool: Pool,
  purpose: 'email-link' | 'email-login',
  accountId: string | null,
  email: string,
  code: string,
): Promise<void> {
  const consumed = await pool.query(
    `UPDATE signin_challenges SET consumed_at=now()
     WHERE id=(SELECT id FROM signin_challenges
       WHERE purpose=$1 AND subject=$2 AND secret_hash=$3 AND consumed_at IS NULL AND expires_at>now()
         AND account_id IS NOT DISTINCT FROM $4
       ORDER BY created_at LIMIT 1)
     RETURNING id`,
    [purpose, email, digest(code), accountId],
  );
  if (consumed.rowCount !== 1) throw new ApiError('EMAIL_INVALID', 401);
}

function freshCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

export async function startEmailLink(
  pool: Pool,
  accountId: string,
  value: string,
  delivery: EmailDelivery,
): Promise<{ delivery: 'local'; code: string } | { delivery: 'sent' }> {
  const email = normalizeMailbox(value);
  if (!delivery.revealCode && !delivery.deliver) throw new ApiError('EMAIL_UNAVAILABLE', 503);
  await limited(pool, 'email-link', email);
  const code = freshCode();
  await storeCode(pool, 'email-link', accountId, email, code);
  if (delivery.deliver) {
    await delivery.deliver(email, code);
    return { delivery: 'sent' };
  }
  return { delivery: 'local', code };
}

export async function confirmEmailLink(
  pool: Pool,
  accountId: string,
  value: string,
  code: string,
): Promise<{ subject: string }> {
  const email = normalizeMailbox(value);
  await consumeCode(pool, 'email-link', accountId, email, code);
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
): Promise<{ delivery: 'sent' }> {
  const email = normalizeMailbox(value);
  const linked = await pool.query('SELECT account_id FROM credentials WHERE provider_key=$1', [
    `email:${email}`,
  ]);
  if ((linked.rowCount ?? 0) > 0) {
    await limited(pool, 'email-login', email);
    const code = freshCode();
    await storeCode(pool, 'email-login', null, email, code);
    await deliver(email, code);
  }
  return { delivery: 'sent' };
}

export async function confirmEmailLogin(
  pool: Pool,
  value: string,
  code: string,
): Promise<{ account: Account; token: string; csrfToken: string }> {
  const email = normalizeMailbox(value);
  await consumeCode(pool, 'email-login', null, email, code);
  const row = (
    await pool.query<{ account_id: string }>(
      'SELECT account_id FROM credentials WHERE provider_key=$1',
      [`email:${email}`],
    )
  ).rows[0];
  if (!row) throw new ApiError('PROVIDER_UNKNOWN', 401);
  return openAccountSession(pool, row.account_id);
}

export async function removeEmail(pool: Pool, accountId: string, value: string): Promise<void> {
  const deleted = await pool.query(
    'DELETE FROM credentials WHERE provider_key=$1 AND account_id=$2',
    [`email:${normalizeMailbox(value)}`, accountId],
  );
  if (deleted.rowCount !== 1) throw new ApiError('CREDENTIAL_UNKNOWN', 404);
}
