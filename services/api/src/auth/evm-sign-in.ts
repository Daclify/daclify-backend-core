import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { EvmFinishSchema, EvmIntentSchema } from '../../../../protocol/evm-wallet.js';
import { checksumAddress } from './evm-proof.js';
import { siweMessage, verifySiweSignature } from './siwe.js';
import { insertAccountSession, withTransaction, uniqueViolation } from './account-session.js';
import { revokeCredentialSessions } from './intent.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
const hash = (text: string) => createHash('sha256').update(text).digest();
interface Intent {
  id: string;
  purpose: 'login' | 'pair';
  account_id: string | null;
  chain_id: string;
  address: string;
  message: string;
  expires_at: Date;
}
export function registerEvmSignInRoutes(
  app: FastifyInstance,
  pool: Pool,
  origin: string,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sessionCookie: (reply: FastifyReply, token: string) => void,
): void {
  const secure = new URL(origin).protocol === 'https:',
    attemptCookie = secure ? '__Host-daclify_evm_attempt' : 'daclify_evm_attempt',
    limit = createWindowLimiter(20, 600000, 2000);
  function control(request: FastifyRequest) {
    return session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
  }
  app.post('/v1/account/evm/sign-in/challenge', async (request, reply) => {
    const input = EvmIntentSchema.parse(request.body);
    if (!limit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const current = input.purpose === 'pair' ? await control(request) : null,
      token = current ? request.cookies[cookieName] : null;
    const id = randomUUID(),
      attempt = randomBytes(32).toString('base64url'),
      issued = new Date().toISOString(),
      expires = new Date(Date.now() + 300000).toISOString();
    const message = siweMessage({
      origin: request.headers.origin ?? origin,
      address: input.address,
      chainId: input.chainId,
      nonce: randomBytes(16).toString('hex'),
      id,
      issued,
      expires,
      purpose: input.purpose,
      accountId: current?.id ?? null,
    });
    await pool.query("DELETE FROM evm_signin_intents WHERE expires_at<now()-interval '1 day'");
    await pool.query(
      'INSERT INTO evm_signin_intents(id,purpose,account_id,session_hash,browser_hash,chain_id,address,message,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        id,
        input.purpose,
        current?.id ?? null,
        token ? hash(token) : null,
        hash(attempt),
        input.chainId,
        input.address.toLowerCase(),
        message,
        expires,
      ],
    );
    reply.setCookie(attemptCookie, attempt, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 300,
    });
    return {
      id,
      message,
      expires,
      chainId: input.chainId,
      address: checksumAddress(input.address),
    };
  });
  async function finish(request: FastifyRequest, purpose: 'login' | 'pair') {
    const input = EvmFinishSchema.parse(request.body),
      current = purpose === 'pair' ? await control(request) : null,
      token = current ? request.cookies[cookieName] : null,
      browser = request.cookies[attemptCookie];
    if (!browser || !/^[A-Za-z0-9_-]{43}$/.test(browser))
      throw new ApiError('EVM_CHALLENGE_INVALID', 401);
    const row = (
      await pool.query<Intent>(
        'UPDATE evm_signin_intents SET consumed_at=now() WHERE id=$1 AND purpose=$2 AND account_id IS NOT DISTINCT FROM $3 AND session_hash IS NOT DISTINCT FROM $4 AND browser_hash=$5 AND expires_at>now() AND consumed_at IS NULL RETURNING *',
        [input.id, purpose, current?.id ?? null, token ? hash(token) : null, hash(browser)],
      )
    ).rows[0];
    if (!row) throw new ApiError('EVM_CHALLENGE_INVALID', 401);
    verifySiweSignature(row.message, row.address, input.signature);
    const chainId = Number(row.chain_id);
    if (chainId !== 40 && chainId !== 41) throw new ApiError('EVM_CHAIN_INVALID', 400);
    return { row, chainId, current };
  }
  app.post('/v1/account/evm/sign-in/link', async (request) => {
    const { row, chainId, current } = await finish(request, 'pair');
    if (!current) throw new ApiError('AUTH_REQUIRED', 401);
    try {
      await withTransaction(pool, async (client) => {
        await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [current.id]);
        const previous = (
          await client.query<{ address: string }>(
            'SELECT address FROM evm_links WHERE account_id=$1 AND chain_id=$2 FOR UPDATE',
            [current.id, chainId],
          )
        ).rows[0];
        await client.query(
          'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,$2,$3,now()) ON CONFLICT(account_id,chain_id) DO UPDATE SET address=EXCLUDED.address,control_verified_at=now(),created_at=now()',
          [current.id, chainId, row.address],
        );
        if (previous && previous.address !== row.address)
          await revokeCredentialSessions(client, current.id, `evm:${chainId}:${previous.address}`);
      });
    } catch (cause) {
      if (uniqueViolation(cause)) throw new ApiError('EVM_LINKED', 409);
      throw cause;
    }
    return { chainId, address: checksumAddress(row.address) };
  });
  app.post('/v1/sign-in/evm', async (request, reply) => {
    const { row, chainId } = await finish(request, 'login');
    const result = await withTransaction(pool, async (client) => {
      const link = (
        await client.query<{ account_id: string }>(
          'SELECT account_id FROM evm_links WHERE chain_id=$1 AND address=$2 AND control_verified_at IS NOT NULL FOR SHARE',
          [chainId, row.address],
        )
      ).rows[0];
      if (!link) throw new ApiError('PROVIDER_UNKNOWN', 401);
      return insertAccountSession(client, link.account_id, `evm:${chainId}:${row.address}`);
    });
    sessionCookie(reply, result.token);
    reply.clearCookie(attemptCookie, { path: '/' });
    return { account: result.account, csrfToken: result.csrfToken };
  });
}
