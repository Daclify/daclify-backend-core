import { createHash, randomUUID } from 'node:crypto';
import { PublicKey, Signature } from '@wharfkit/antelope';
import type { Pool } from 'pg';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiRoutes, VaultAttachMessageSchema, type Account } from '../../../../protocol/index.js';
import { validEncryptionKey } from '../auth.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import { insertAccountSession, uniqueViolation, withTransaction } from './account-session.js';

export function registerVaultAttachRoutes(
  app: FastifyInstance,
  pool: Pool,
  origin: string,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sessionCookie: (reply: FastifyReply, token: string) => void,
  audience: string = origin,
): void {
  const limit = createWindowLimiter(20, 600000, 2000);
  const hash = (value: string) => createHash('sha256').update(value).digest();
  async function account(request: FastifyRequest) {
    const current = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (current.signingKey !== null) throw new ApiError('VAULT_ALREADY_CONFIGURED', 409);
    return current;
  }
  app.post(ApiRoutes.vaultAttachChallenge.path, async (request) => {
    const current = await account(request);
    if (!limit(current.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const input = ApiRoutes.vaultAttachChallenge.input.parse(request.body);
    const encryption = validEncryptionKey(input.encryptionKey);
    const token = request.cookies[cookieName];
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    const id = randomUUID(),
      expires = new Date(Date.now() + 300000).toISOString();
    const message = JSON.stringify(
      VaultAttachMessageSchema.parse({
        domain: 'daclify.vault-attach.v2',
        audience,
        origin: request.headers.origin ?? origin,
        accountId: current.id,
        signingKey: input.signingKey,
        encryptionKey: encryption,
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
  // The common preHandler requires a separate fresh wallet account-control proof.
  app.post(ApiRoutes.vaultAttach.path, async (request, reply) => {
    const current = await account(request),
      input = ApiRoutes.vaultAttach.input.parse(request.body);
    const token = request.cookies[cookieName];
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    const intent = (
      await pool.query<{ signing_key: string; encryption_key: unknown; message: string }>(
        'UPDATE vault_attach_intents SET consumed_at=now() WHERE id=$1 AND account_id=$2 AND session_hash=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING signing_key,encryption_key,message',
        [input.id, current.id, hash(token)],
      )
    ).rows[0];
    let valid = false;
    if (intent) {
      try {
        valid =
          VaultAttachMessageSchema.parse(JSON.parse(intent.message)).audience === audience &&
          VaultAttachMessageSchema.parse(JSON.parse(intent.message)).origin ===
            (request.headers.origin ?? origin) &&
          Signature.from(input.signature).verifyMessage(
            new TextEncoder().encode(intent.message),
            PublicKey.from(intent.signing_key),
          );
      } catch {
        /* consumed invalid proof; no raw crypto error */
      }
    }
    if (!intent || !valid) throw new ApiError('VAULT_PROOF_INVALID', 401);
    let opened: Awaited<ReturnType<typeof insertAccountSession>>;
    try {
      opened = await withTransaction(pool, async (client) => {
        const updated = await client.query(
          'UPDATE accounts SET signing_key=$2,encryption_key=$3 WHERE id=$1 AND signing_key IS NULL RETURNING id',
          [current.id, intent.signing_key, validEncryptionKey(intent.encryption_key)],
        );
        if (updated.rowCount !== 1) throw new ApiError('VAULT_ALREADY_CONFIGURED', 409);
        await client.query(
          'INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,$2,$3)',
          [current.id, 'account.vault-attached', { signingKey: intent.signing_key }],
        );
        return insertAccountSession(client, current.id);
      });
    } catch (error) {
      if (uniqueViolation(error)) throw new ApiError('VAULT_ALREADY_REGISTERED', 409);
      throw error;
    }
    sessionCookie(reply, opened.token);
    return { account: opened.account, csrfToken: opened.csrfToken };
  });
}
