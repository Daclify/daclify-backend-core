import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { insertAccountSession, uniqueViolation, withTransaction } from './account-session.js';
import { verifyPasskeyAssertion, verifyPasskeyRegistration } from './passkey-proof.js';
import type { Account } from '../../../../protocol/api.js';

const digest = (value: Uint8Array): Buffer => createHash('sha256').update(value).digest();

function encoded(value: string, max = 16384): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > max)
    throw new ApiError('PASSKEY_INVALID', 401);
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length === 0) throw new ApiError('PASSKEY_INVALID', 401);
  return bytes;
}

function challengeOf(clientDataJSON: Uint8Array): Buffer {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(clientDataJSON).toString('utf8'));
    return encoded(z.object({ challenge: z.string() }).parse(parsed).challenge, 256);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('PASSKEY_INVALID', 401);
  }
}

async function limited(
  pool: Pool,
  purpose: string,
  accountId: string | null,
  max: number,
): Promise<void> {
  const count = await pool.query<{ count: string }>(
    `SELECT count(*) FROM signin_challenges
     WHERE purpose=$1 AND account_id IS NOT DISTINCT FROM $2 AND created_at>now()-interval '10 minutes'`,
    [purpose, accountId],
  );
  if (Number(count.rows[0]?.count ?? 0) >= max) throw new ApiError('RATE_LIMIT', 429);
}

async function consume(
  pool: Pool,
  purpose: 'passkey-register' | 'passkey-login',
  challenge: Uint8Array,
  accountId: string | null,
): Promise<void> {
  const consumed = await pool.query(
    `UPDATE signin_challenges SET consumed_at=now()
     WHERE id=(SELECT id FROM signin_challenges
       WHERE purpose=$1 AND secret_hash=$2 AND consumed_at IS NULL AND expires_at>now()
         AND account_id IS NOT DISTINCT FROM $3
       ORDER BY created_at LIMIT 1)
     RETURNING id`,
    [purpose, digest(challenge), accountId],
  );
  if (consumed.rowCount !== 1) throw new ApiError('PASSKEY_INVALID', 401);
}

export async function beginPasskeyRegistration(pool: Pool, accountId: string, origin: string) {
  await limited(pool, 'passkey-register', accountId, 8);
  const challenge = randomBytes(32);
  await pool.query(
    `INSERT INTO signin_challenges(id,purpose,account_id,secret_hash,expires_at)
     VALUES($1,'passkey-register',$2,$3,now()+interval '5 minutes')`,
    [randomUUID(), accountId, digest(challenge)],
  );
  const existing = await pool.query<{ credential_id: Buffer }>(
    'SELECT credential_id FROM passkeys WHERE account_id=$1 ORDER BY created_at',
    [accountId],
  );
  return {
    challenge: challenge.toString('base64url'),
    rp: { name: 'Daclify', id: new URL(origin).hostname },
    user: {
      id: Buffer.from(accountId).toString('base64url'),
      name: 'Daclify account',
      displayName: 'Daclify account',
    },
    pubKeyCredParams: [{ type: 'public-key' as const, alg: -7 }],
    timeout: 60000,
    attestation: 'none' as const,
    authenticatorSelection: {
      residentKey: 'required' as const,
      requireResidentKey: true,
      userVerification: 'required' as const,
    },
    excludeCredentials: existing.rows.map((row) => ({
      type: 'public-key' as const,
      id: row.credential_id.toString('base64url'),
    })),
  };
}

export async function finishPasskeyRegistration(
  pool: Pool,
  accountId: string,
  origin: string,
  input: { clientDataJSON: string; attestationObject: string },
): Promise<{ id: string }> {
  const clientDataJSON = encoded(input.clientDataJSON);
  const attestationObject = encoded(input.attestationObject);
  const challenge = challengeOf(clientDataJSON);
  await consume(pool, 'passkey-register', challenge, accountId);
  let verified: ReturnType<typeof verifyPasskeyRegistration>;
  try {
    verified = verifyPasskeyRegistration({ origin, challenge, clientDataJSON, attestationObject });
  } catch {
    throw new ApiError('PASSKEY_INVALID', 401);
  }
  const count = await pool.query<{ count: string }>(
    'SELECT count(*) FROM passkeys WHERE account_id=$1',
    [accountId],
  );
  if (Number(count.rows[0]?.count ?? 0) >= 8) throw new ApiError('PASSKEY_LIMIT', 409);
  try {
    await pool.query(
      'INSERT INTO passkeys(credential_id,account_id,public_key,sign_count) VALUES($1,$2,$3,$4)',
      [
        Buffer.from(verified.credentialId),
        accountId,
        Buffer.from(verified.publicKey),
        verified.signCount,
      ],
    );
  } catch (error) {
    if (uniqueViolation(error)) throw new ApiError('PASSKEY_LINKED', 409);
    throw error;
  }
  return { id: Buffer.from(verified.credentialId).toString('base64url') };
}

export async function beginPasskeyLogin(pool: Pool, origin: string) {
  await limited(pool, 'passkey-login', null, 100);
  const challenge = randomBytes(32);
  await pool.query(
    `INSERT INTO signin_challenges(id,purpose,secret_hash,expires_at)
     VALUES($1,'passkey-login',$2,now()+interval '5 minutes')`,
    [randomUUID(), digest(challenge)],
  );
  return {
    challenge: challenge.toString('base64url'),
    timeout: 60000,
    rpId: new URL(origin).hostname,
    userVerification: 'required' as const,
  };
}

export async function finishPasskeyLogin(
  pool: Pool,
  origin: string,
  input: {
    credentialId: string;
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  },
): Promise<{ account: Account; token: string; csrfToken: string }> {
  const credentialId = encoded(input.credentialId, 2048);
  const clientDataJSON = encoded(input.clientDataJSON);
  const authenticatorData = encoded(input.authenticatorData, 2048);
  const signature = encoded(input.signature, 512);
  const challenge = challengeOf(clientDataJSON);
  await consume(pool, 'passkey-login', challenge, null);
  const found = (
    await pool.query<{ account_id: string; public_key: Buffer; sign_count: string }>(
      'SELECT account_id,public_key,sign_count::text FROM passkeys WHERE credential_id=$1',
      [credentialId],
    )
  ).rows[0];
  if (!found) throw new ApiError('PASSKEY_INVALID', 401);
  let checked: { signCount: number };
  try {
    checked = verifyPasskeyAssertion({
      origin,
      challenge,
      clientDataJSON,
      authenticatorData,
      signature,
      publicKey: found.public_key,
      storedSignCount: Number(found.sign_count),
    });
  } catch {
    throw new ApiError('PASSKEY_INVALID', 401);
  }
  return withTransaction(pool, async (client) => {
    const updated = await client.query(
      'UPDATE passkeys SET sign_count=$1 WHERE credential_id=$2 AND sign_count=$3',
      [checked.signCount, credentialId, found.sign_count],
    );
    if (updated.rowCount !== 1) throw new ApiError('PASSKEY_INVALID', 401);
    return insertAccountSession(client, found.account_id);
  });
}

export async function removePasskey(
  pool: Pool,
  accountId: string,
  credentialId: string,
): Promise<void> {
  let id: Buffer;
  try {
    id = encoded(credentialId, 2048);
  } catch {
    throw new ApiError('CREDENTIAL_UNKNOWN', 404);
  }
  const deleted = await pool.query(
    'DELETE FROM passkeys WHERE credential_id=$1 AND account_id=$2',
    [id, accountId],
  );
  if (deleted.rowCount !== 1) throw new ApiError('CREDENTIAL_UNKNOWN', 404);
}

export async function listPasskeys(pool: Pool, accountId: string): Promise<{ id: string }[]> {
  const rows = await pool.query<{ credential_id: Buffer }>(
    'SELECT credential_id FROM passkeys WHERE account_id=$1 ORDER BY created_at',
    [accountId],
  );
  return rows.rows.map((row) => ({ id: row.credential_id.toString('base64url') }));
}
