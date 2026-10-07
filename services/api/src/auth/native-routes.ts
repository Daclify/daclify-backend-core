import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { APIClient } from '@wharfkit/antelope';
import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { Account, Network, WalletIdentity, UserMembership } from '../../../../protocol/api.js';
import {
  NativeFinishSchema,
  NativeUnlinkSchema,
  NativeIdentitySchema,
  NativeIntentSchema,
} from '../../../../protocol/native-wallet.js';
import { verifyNativeProof } from './native-proof.js';
import { insertAccountSession, uniqueViolation, withTransaction } from './account-session.js';
import { revokeCredentialSessions } from './intent.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import { walletAccount } from './wallet-recovery.js';
const hash = (text: string) => createHash('sha256').update(text).digest();
const credential = (chain: string, account: string) => `native:${chain}:${account}`;
interface Intent {
  id: string;
  purpose: 'login' | 'pair';
  account_id: string | null;
  session_hash: Buffer | null;
  chain_id: string;
  native_account: string;
  permission: 'active';
  runtime: string;
  message: string;
  expires_at: Date;
}
export function registerNativeRoutes(
  app: FastifyInstance,
  pool: Pool,
  origin: string,
  cookieName: string,
  network: () => Promise<Network>,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sessionCookie: (reply: FastifyReply, token: string) => void,
  discover?: (wallet: WalletIdentity) => Promise<UserMembership[]>,
): void {
  const secure = new URL(origin).protocol === 'https:',
    attemptCookie = secure ? '__Host-daclify_native_attempt' : 'daclify_native_attempt';
  const limit = createWindowLimiter(20, 600000, 2000);
  function control(request: FastifyRequest) {
    return session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
  }
  function browser(request: FastifyRequest): Buffer {
    const value = request.cookies[attemptCookie];
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value))
      throw new ApiError('NATIVE_PROOF_INVALID', 401);
    return hash(value);
  }
  app.get('/v1/account/native', async (request) => {
    const current = await session(request.cookies[cookieName]);
    const rows = await pool.query<{ chain_id: string; native_account: string; permission: string }>(
      'SELECT chain_id,native_account,permission FROM native_links WHERE account_id=$1 ORDER BY chain_id',
      [current.id],
    );
    return {
      links: rows.rows.map((row) =>
        NativeIdentitySchema.parse({
          chainId: row.chain_id,
          account: row.native_account,
          permission: row.permission,
        }),
      ),
    };
  });
  app.post('/v1/account/native/challenge', async (request, reply) => {
    const input = NativeIntentSchema.parse(request.body);
    if (!limit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const site = typeof request.headers.origin === 'string' ? request.headers.origin : origin;
    const info = await network();
    const current = input.purpose === 'pair' ? await control(request) : null;
    const token = current ? request.cookies[cookieName] : null;
    const attempt = randomBytes(32).toString('base64url'),
      id = randomUUID(),
      expires = new Date(Date.now() + 300000);
    const identity = NativeIdentitySchema.parse({
      chainId: info.chainId,
      account: input.account,
      permission: input.permission,
    });
    const message = JSON.stringify({
      domain: 'daclify.native-sign-in.v1',
      purpose: input.purpose,
      origin: site,
      accountId: current?.id ?? null,
      identity,
      runtime: info.runtime,
      id,
      expires: expires.toISOString(),
    });
    await pool.query("DELETE FROM native_login_intents WHERE expires_at<now()-interval '1 day'");
    await pool.query(
      'INSERT INTO native_login_intents(id,purpose,account_id,session_hash,browser_hash,chain_id,native_account,permission,runtime,message,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        id,
        input.purpose,
        current?.id ?? null,
        token ? hash(token) : null,
        hash(attempt),
        identity.chainId,
        identity.account,
        identity.permission,
        info.runtime,
        message,
        expires,
      ],
    );
    reply.setCookie(attemptCookie, attempt, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'strict',
      maxAge: 300,
    });
    return { id, message, expires: expires.toISOString(), identity, runtime: info.runtime };
  });
  async function finish(request: FastifyRequest, purpose: 'login' | 'pair') {
    const input = NativeFinishSchema.parse(request.body);
    const current = purpose === 'pair' ? await control(request) : null;
    const token = current ? request.cookies[cookieName] : null;
    const row = (
      await pool.query<Intent>(
        'UPDATE native_login_intents SET consumed_at=now() WHERE id=$1 AND purpose=$2 AND account_id IS NOT DISTINCT FROM $3 AND session_hash IS NOT DISTINCT FROM $4 AND browser_hash=$5 AND expires_at>now() AND consumed_at IS NULL RETURNING *',
        [input.id, purpose, current?.id ?? null, token ? hash(token) : null, browser(request)],
      )
    ).rows[0];
    if (!row) throw new ApiError('NATIVE_PROOF_INVALID', 401);
    const site = z.object({ origin: z.string() }).parse(JSON.parse(row.message)).origin;
    if (site !== (request.headers.origin ?? origin))
      throw new ApiError('NATIVE_PROOF_INVALID', 401);
    const info = await network();
    if (info.chainId !== row.chain_id || info.runtime !== row.runtime)
      throw new ApiError('NATIVE_PROOF_INVALID', 401);
    const identity = NativeIdentitySchema.parse({
      chainId: row.chain_id,
      account: row.native_account,
      permission: row.permission,
    });
    await verifyNativeProof(
      input.proof,
      identity,
      row.runtime,
      row.message,
      row.expires_at,
      new APIClient({ url: info.rpcUrl }),
    );
    return { current, identity };
  }
  app.post('/v1/account/native/link', async (request) => {
    const { current, identity } = await finish(request, 'pair');
    if (!current) throw new ApiError('AUTH_REQUIRED', 401);
    try {
      await withTransaction(pool, async (client) => {
        await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [current.id]);
        const previous = (
          await client.query<{ native_account: string }>(
            'SELECT native_account FROM native_links WHERE account_id=$1 AND chain_id=$2 FOR UPDATE',
            [current.id, identity.chainId],
          )
        ).rows[0];
        await client.query(
          'INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,chain_id) DO UPDATE SET native_account=EXCLUDED.native_account,permission=EXCLUDED.permission,created_at=now()',
          [current.id, identity.chainId, identity.account, identity.permission],
        );
        if (previous && previous.native_account !== identity.account)
          await revokeCredentialSessions(
            client,
            current.id,
            credential(identity.chainId, previous.native_account),
          );
      });
    } catch (error) {
      if (uniqueViolation(error)) throw new ApiError('NATIVE_LINKED', 409);
      throw error;
    }
    return identity;
  });
  app.post('/v1/sign-in/native', async (request, reply) => {
    const { identity } = await finish(request, 'login');
    const opened = await withTransaction(pool, async (client) => {
      const accountId = await walletAccount(
        client,
        { kind: 'native', chainId: identity.chainId, account: identity.account },
        discover,
      );
      return insertAccountSession(
        client,
        accountId,
        credential(identity.chainId, identity.account),
      );
    });
    sessionCookie(reply, opened.token);
    reply.clearCookie(attemptCookie, { path: '/' });
    return { account: opened.account, csrfToken: opened.csrfToken };
  });
  app.post('/v1/account/native/unlink', async (request, reply) => {
    const current = await control(request),
      input = NativeUnlinkSchema.parse(request.body);
    await withTransaction(pool, async (client) => {
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [current.id]);
      const removed = (
        await client.query<{ native_account: string }>(
          'DELETE FROM native_links WHERE account_id=$1 AND chain_id=$2 RETURNING native_account',
          [current.id, input.chainId],
        )
      ).rows[0];
      if (!removed) throw new ApiError('CREDENTIAL_UNKNOWN', 404);
      await revokeCredentialSessions(
        client,
        current.id,
        credential(input.chainId, removed.native_account),
      );
    });
    return reply.code(204).send();
  });
}
