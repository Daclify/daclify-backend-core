import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PublicKey, Signature } from '@wharfkit/antelope';
import type { Pool } from 'pg';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AccountReconnectMessageSchema,
  ApiRoutes,
  daoPaymentKey,
  type Account,
} from '../../../../protocol/index.js';
import type { NativeIdentity } from '../../../../protocol/native-wallet.js';
import type { ChainGateway } from '../chain.js';
import { validEncryptionKey } from '../auth.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import {
  insertAccountSession,
  readAccount,
  uniqueViolation,
  withTransaction,
} from './account-session.js';
const hash = (value: string) => createHash('sha256').update(value).digest();

export function registerAccountReconnectRoutes(
  app: FastifyInstance,
  pool: Pool,
  chain: ChainGateway,
  origin: string,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sessionCookie: (reply: FastifyReply, token: string, site?: string) => Promise<void>,
  audience: string,
): void {
  const limit = createWindowLimiter(20, 600000, 2000);
  async function currentAccount(request: FastifyRequest) {
    const current = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (current.signingKey !== null) throw new ApiError('VAULT_ALREADY_CONFIGURED', 409);
    return current;
  }
  app.post(ApiRoutes.accountReconnectChallenge.path, async (request) => {
    const current = await currentAccount(request),
      token = request.cookies[cookieName];
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    if (!limit(current.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const input = ApiRoutes.accountReconnectChallenge.input.parse(request.body);
    const target = (
      await pool.query<{ id: string; encryption_key: unknown; custody: string }>(
        'SELECT id,encryption_key,custody FROM accounts WHERE signing_key=$1 AND merged_into IS NULL',
        [input.signingKey],
      )
    ).rows[0];
    const encryption = validEncryptionKey(input.encryptionKey);
    if (
      !target ||
      target.custody !== 'user-controlled' ||
      !isDeepStrictEqual(encryption, validEncryptionKey(target.encryption_key))
    )
      throw new ApiError('ACCOUNT_RECONNECT_IDENTITY', 409);
    const id = randomUUID(),
      expires = new Date(Date.now() + 300000).toISOString();
    const message = JSON.stringify(
      AccountReconnectMessageSchema.parse({
        ...input,
        encryptionKey: encryption,
        domain: 'daclify.account-reconnect.v1',
        origin: request.headers.origin ?? origin,
        audience,
        accountId: current.id,
        targetAccountId: target.id,
        id,
        expires,
      }),
    );
    await pool.query("DELETE FROM vault_attach_intents WHERE expires_at<now()-interval '1 day'");
    await pool.query(
      'INSERT INTO vault_attach_intents(id,account_id,session_hash,signing_key,encryption_key,message,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, current.id, hash(token), input.signingKey, encryption, message, expires],
    );
    return { id, message, expires };
  });
  // The shared preHandler verifies a separate fresh wallet proof over this exact body.
  app.post(ApiRoutes.accountReconnect.path, async (request, reply) => {
    const current = await currentAccount(request),
      token = request.cookies[cookieName],
      input = ApiRoutes.accountReconnect.input.parse(request.body);
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    const intent = (
      await pool.query<{ message: string }>(
        'UPDATE vault_attach_intents SET consumed_at=now() WHERE id=$1 AND account_id=$2 AND session_hash=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING message',
        [input.id, current.id, hash(token)],
      )
    ).rows[0];
    let decoded: unknown;
    try {
      decoded = intent ? JSON.parse(intent.message) : undefined;
    } catch {
      /* reject corrupted stored intent */
    }
    const parsed = AccountReconnectMessageSchema.safeParse(decoded);
    if (
      !parsed.success ||
      parsed.data.origin !== (request.headers.origin ?? origin) ||
      parsed.data.audience !== audience ||
      parsed.data.accountId !== current.id ||
      parsed.data.id !== input.id
    )
      throw new ApiError('VAULT_PROOF_INVALID', 401);
    const message = parsed.data;
    let verified = false;
    try {
      verified =
        !!intent &&
        Signature.from(input.signature).verifyMessage(
          new TextEncoder().encode(intent.message),
          PublicKey.from(message.signingKey),
        );
    } catch {
      /* redact malformed crypto input */
    }
    if (!verified) throw new ApiError('VAULT_PROOF_INVALID', 401);
    const target = await readAccount(pool, message.targetAccountId);
    if (
      !target ||
      target.signingKey !== message.signingKey ||
      !isDeepStrictEqual(target.encryptionKey, message.encryptionKey) ||
      target.custody !== 'user-controlled'
    )
      throw new ApiError('ACCOUNT_RECONNECT_IDENTITY', 409);
    const opened = await reconnectAccounts(pool, chain, current, target, current.id, token);
    await sessionCookie(reply, opened.token);
    return { account: opened.account, csrfToken: opened.csrfToken };
  });
}

export async function reconnectAccounts(
  pool: Pool,
  chain: ChainGateway,
  current: Account,
  target: Account,
  sessionAccountId: string,
  token: string,
  sourceWallet?: NativeIdentity,
) {
  if (current.id === target.id) throw new ApiError('ACCOUNT_RECONNECT_NOT_NEEDED', 409);
  if (
    current.signingKey !== null ||
    target.signingKey === null ||
    target.custody !== 'user-controlled'
  )
    throw new ApiError('ACCOUNT_RECONNECT_REGISTERED', 409);
  const memberships = await Promise.all([chain.memberships(current), chain.memberships(target)]);
  for (const member of memberships[0]) {
    if (
      member.signingKey !== target.signingKey &&
      !memberships[1].some(
        (known) =>
          daoPaymentKey(known.dao) === daoPaymentKey(member.dao) &&
          known.memberId === member.memberId,
      )
    )
      throw new ApiError('ACCOUNT_RECONNECT_IDENTITY', 409);
  }
  const identities = new Map<string, string>();
  for (const member of memberships.flat()) {
    const key = daoPaymentKey(member.dao),
      previous = identities.get(key);
    if (previous && previous !== member.memberId)
      throw new ApiError('WALLET_MEMBERSHIP_CONFLICT', 409);
    identities.set(key, member.memberId);
  }
  let requiresIndependentKeys = false;
  for (const member of memberships.flat()) {
    const dao = await chain.dao(member.dao.daoId);
    if (daoPaymentKey(dao.reference) !== daoPaymentKey(member.dao))
      throw new ApiError('RECOVERY_POLICY_UNAVAILABLE', 503);
    if (dao.privacy === 'encrypted-user-controlled') requiresIndependentKeys = true;
  }
  const ids = [current.id, target.id];
  let opened: Awaited<ReturnType<typeof insertAccountSession>>;
  try {
    opened = await withTransaction(pool, async (db) => {
      await db.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
        ids,
      ]);
      const source = await readAccount(db, current.id),
        registered = await readAccount(db, target.id);
      if (
        !source ||
        source.signingKey !== null ||
        !registered ||
        registered.custody !== 'user-controlled' ||
        registered.signingKey !== target.signingKey ||
        !isDeepStrictEqual(registered.encryptionKey, target.encryptionKey)
      )
        throw new ApiError('ACCOUNT_RECONNECT_CHANGED', 409);
      if (
        !(
          await db.query(
            'SELECT 1 FROM sessions WHERE token_hash=$1 AND account_id=$2 AND revoked_at IS NULL AND expires_at>now()',
            [hash(token), sessionAccountId],
          )
        ).rowCount
      )
        throw new ApiError('AUTH_REQUIRED', 401);
      if (
        sourceWallet &&
        !(
          await db.query(
            'SELECT 1 FROM native_links WHERE account_id=$1 AND chain_id=$2 AND native_account=$3 AND permission=$4',
            [current.id, sourceWallet.chainId, sourceWallet.account, sourceWallet.permission],
          )
        ).rowCount
      )
        throw new ApiError('ACCOUNT_RECONNECT_CHANGED', 409);
      if (
        requiresIndependentKeys &&
        (
          await db.query(
            'SELECT 1 FROM vault_recovery_state WHERE account_id=$1 AND assisted_ever FOR SHARE',
            [target.id],
          )
        ).rowCount
      )
        throw new ApiError('CUSTODY_POLICY', 403);
      const passkeys = await db.query<{ count: string }>(
        'SELECT count(*) FROM passkeys WHERE account_id=ANY($1::uuid[])',
        [ids],
      );
      if (Number(passkeys.rows[0]?.count ?? 0) > 8)
        throw new ApiError('ACCOUNT_RECONNECT_CONFLICT', 409);
      const conflict = await db.query(
        `SELECT 1 FROM native_links s JOIN native_links t ON s.chain_id=t.chain_id WHERE s.account_id=$1 AND t.account_id=$2
        UNION ALL SELECT 1 FROM evm_links s JOIN evm_links t ON s.chain_id=t.chain_id WHERE s.account_id=$1 AND t.account_id=$2
        UNION ALL SELECT 1 FROM memberships s JOIN memberships t USING(chain_id,contract,dao_id) WHERE s.account_id=$1 AND t.account_id=$2 AND s.member_id<>t.member_id
        UNION ALL SELECT 1 FROM connected_app_subjects s JOIN connected_app_subjects t USING(client_id) WHERE s.account_id=$1 AND t.account_id=$2
        UNION ALL SELECT 1 FROM uploads s JOIN uploads t ON s.request_id=t.request_id WHERE s.account_id=$1 AND t.account_id IN (SELECT account_scope($2))
        UNION ALL SELECT 1 FROM asset_uploads s JOIN asset_uploads t ON s.request_id=t.request_id WHERE s.account_id=$1 AND t.account_id IN (SELECT account_scope($2))
        UNION ALL SELECT 1 FROM archive_exports s JOIN archive_exports t ON s.request_id=t.request_id WHERE s.requested_by=$1 AND t.requested_by IN (SELECT account_scope($2))
        UNION ALL SELECT 1 FROM vault_recovery_methods WHERE account_id=$1
        UNION ALL SELECT 1 FROM quick_signup_pending_accounts WHERE account_id=ANY($3::uuid[])`,
        [current.id, target.id, ids],
      );
      if (conflict.rowCount) throw new ApiError('ACCOUNT_RECONNECT_CONFLICT', 409);
      for (const table of [
        'credentials',
        'passkeys',
        'native_links',
        'evm_links',
        'memberships',
        'connected_app_subjects',
      ])
        await db.query(`UPDATE ${table} SET account_id=$2 WHERE account_id=$1`, [
          current.id,
          target.id,
        ]);
      await db.query(
        'UPDATE challenges SET consumed_at=now() WHERE signing_key=$1 AND consumed_at IS NULL',
        [target.signingKey],
      );
      await db.query(
        'UPDATE sessions SET revoked_at=now() WHERE account_id=ANY($1::uuid[]) AND revoked_at IS NULL',
        [ids],
      );
      for (const table of [
        'account_control_intents',
        'vault_attach_intents',
        'signin_challenges',
        'native_login_intents',
        'evm_signin_intents',
        'telegram_oidc_attempts',
      ])
        await db.query(
          `UPDATE ${table} SET consumed_at=now() WHERE account_id=ANY($1::uuid[]) AND consumed_at IS NULL`,
          [ids],
        );
      await db.query('DELETE FROM vault_recovery_devices WHERE account_id=ANY($1::uuid[])', [ids]);
      await db.query('DELETE FROM vault_recovery_handoffs WHERE account_id=ANY($1::uuid[])', [ids]);
      await db.query('DELETE FROM vault_recovery_grants WHERE account_id=ANY($1::uuid[])', [ids]);
      await db.query(
        'UPDATE connected_app_tokens SET revoked_at=now() WHERE account_id=ANY($1::uuid[]) AND revoked_at IS NULL',
        [ids],
      );
      await db.query(
        'UPDATE connected_app_refresh_families SET revoked_at=now() WHERE account_id=ANY($1::uuid[]) AND revoked_at IS NULL',
        [ids],
      );
      await db.query('DELETE FROM connected_app_codes WHERE account_id=ANY($1::uuid[])', [ids]);
      await db.query(
        'UPDATE dao_merchants SET broker_hash=NULL,broker_admin=NULL WHERE broker_admin=ANY($1::uuid[])',
        [ids],
      );
      await db.query('UPDATE accounts SET merged_into=$2 WHERE id=$1 AND merged_into IS NULL', [
        current.id,
        target.id,
      ]);
      await db.query(
        'INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,$3,$4),($2,$3,$4)',
        [
          current.id,
          target.id,
          'account.reconnected',
          { sourceAccountId: current.id, accountId: target.id },
        ],
      );
      return insertAccountSession(db, target.id);
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ApiError('ACCOUNT_RECONNECT_CONFLICT', 409);
    throw error;
  }
  return opened;
}
