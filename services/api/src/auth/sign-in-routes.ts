import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import type { Account } from '../../../../protocol/api.js';
import {
  CredentialHistoryQuerySchema,
  CredentialHistorySchema,
  SignInProofSchema as ProofSchema,
  SignInEmailSchema as EmailSchema,
  SignInEmailCodeSchema as EmailCodeSchema,
  SignInPasskeyRegisterSchema as PasskeyRegisterSchema,
  SignInPasskeyLoginSchema as PasskeyLoginSchema,
  SignInRemoveSchema as RemoveSchema,
} from '../../../../protocol/sign-in.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import {
  linkProvider,
  openLinkedSession,
  unlinkProvider,
  type ProviderConfiguration,
} from './linking.js';
import {
  confirmEmailLink,
  confirmEmailLogin,
  removeEmail,
  startEmailLink,
  startEmailLogin,
} from './email.js';
import {
  beginPasskeyLogin,
  beginPasskeyRegistration,
  finishPasskeyLogin,
  finishPasskeyRegistration,
  listPasskeys,
  removePasskey,
} from './passkey.js';
import { verifyTelegram } from '../providers/proofs.js';

export interface SignInConfiguration {
  environment: 'local' | 'testnet' | 'mainnet';
  deliverEmail?: (to: string, code: string) => Promise<void>;
}

function emailDelivery(signIn: SignInConfiguration | undefined): 'local' | 'mail' | 'unavailable' {
  if (signIn?.deliverEmail) return 'mail';
  if (signIn?.environment === 'local') return 'local';
  return 'unavailable';
}

export function registerSignInRoutes(
  app: FastifyInstance,
  pool: Pool,
  origin: string,
  cookieName: string,
  providers: ProviderConfiguration | undefined,
  signIn: SignInConfiguration | undefined,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sessionCookie: (reply: FastifyReply, token: string) => void,
): void {
  const admit = createWindowLimiter(20, 10 * 60_000, 2000);
  const confirm = createWindowLimiter(60, 10 * 60_000, 6000);
  app.addHook('preHandler', async (request) => {
    const path = request.routeOptions.url ?? '';
    if (request.method !== 'POST' || !path.startsWith('/v1/sign-in/')) return;
    const limiter = path.endsWith('/options') || path.endsWith('/start') ? admit : confirm;
    if (!limiter(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
  });
  const delivery = emailDelivery(signIn);
  const telegram = providers?.telegram;
  const secure = new URL(origin).protocol === 'https:';
  const attemptCookie = secure ? '__Host-daclify_signin_attempt' : 'daclify_signin_attempt';
  function context(request: FastifyRequest, reply?: FastifyReply): Buffer {
    let value = request.cookies[attemptCookie];
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
      if (!reply) throw new ApiError('SIGNIN_ATTEMPT_INVALID', 401);
      value = randomBytes(32).toString('base64url');
      reply.setCookie(attemptCookie, value, {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: 'strict',
        maxAge: 600,
      });
    }
    return createHash('sha256').update(value).digest();
  }
  function pairingContext(request: FastifyRequest): Buffer {
    return createHash('sha256')
      .update(request.cookies[cookieName] ?? '')
      .digest();
  }
  function csrf(header: string | string[] | undefined): string {
    return typeof header === 'string' ? header : '';
  }
  function account(request: FastifyRequest) {
    return session(request.cookies[cookieName], csrf(request.headers['x-csrf-token']));
  }
  app.get('/v1/account/history', async (request) => {
    const current = await session(request.cookies[cookieName]);
    const query = CredentialHistoryQuerySchema.parse(request.query);
    const result = await pool.query<{ id: string; public_reference: unknown; created_at: Date }>(
      "SELECT id::text,public_reference,created_at FROM audit_events WHERE account_id=$1 AND kind='credential.change' AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT 51",
      [current.id, query.before ?? null],
    );
    const entries = result.rows.slice(0, 50).map((row) => ({
      ...CredentialHistorySchema.shape.entries.element
        .omit({ id: true, at: true })
        .parse(row.public_reference),
      id: row.id,
      at: row.created_at.toISOString(),
    }));
    return { entries, next: result.rows.length > 50 ? (entries.at(-1)?.id ?? null) : null };
  });
  app.post('/v1/sign-in/session', async (request) => {
    z.strictObject({}).parse(request.body);
    const token = request.cookies[cookieName];
    const current = await session(token);
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    const csrfToken = randomBytes(32).toString('base64url');
    const changed = await pool.query(
      'UPDATE sessions SET csrf_hash=$2 WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',
      [
        createHash('sha256').update(token).digest(),
        createHash('sha256').update(csrfToken).digest(),
      ],
    );
    if (changed.rowCount !== 1) throw new ApiError('AUTH_REQUIRED', 401);
    return { account: current, csrfToken };
  });
  app.get('/v1/sign-in/options', async () => ({
    telegram: {
      configured: Boolean(telegram?.oidc || (telegram?.botToken && telegram.botUsername)),
      username: telegram?.botUsername ?? null,
      oidc: Boolean(telegram?.oidc),
      miniApp: Boolean(telegram?.botToken),
    },
    email: { delivery },
    passkey: { rpId: new URL(origin).hostname },
  }));
  app.get('/v1/sign-in/methods', async (request) => {
    const current = await session(request.cookies[cookieName]);
    const credentials = await pool.query<{ provider_key: string }>(
      'SELECT provider_key FROM credentials WHERE account_id=$1 ORDER BY provider_key',
      [current.id],
    );
    const subjects = (prefix: string) =>
      credentials.rows
        .filter((row) => row.provider_key.startsWith(prefix))
        .map((row) => row.provider_key.slice(prefix.length));
    return {
      telegram: {
        configured: Boolean(telegram?.oidc || (telegram?.botToken && telegram.botUsername)),
        username: telegram?.botUsername ?? null,
        subjects: subjects('telegram:'),
        oidc: Boolean(telegram?.oidc),
        miniApp: Boolean(telegram?.botToken),
      },
      email: { delivery, subjects: subjects('email:') },
      passkeys: await listPasskeys(pool, current.id),
    };
  });
  app.post('/v1/sign-in/telegram', async (request) => {
    const current = await account(request);
    if (!telegram?.botToken) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    const input = ProofSchema.parse(request.body);
    return linkProvider(pool, current.id, verifyTelegram(input.proof, telegram.botToken));
  });
  app.post('/v1/sign-in/telegram/login', async (request, reply) => {
    if (!telegram?.botToken) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    const input = ProofSchema.parse(request.body);
    const result = await openLinkedSession(pool, verifyTelegram(input.proof, telegram.botToken));
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  app.post('/v1/sign-in/email/start', async (request) => {
    const current = await account(request);
    const input = EmailSchema.parse(request.body);
    if (signIn?.deliverEmail) {
      return startEmailLink(
        pool,
        current.id,
        input.email,
        {
          revealCode: false,
          deliver: signIn.deliverEmail,
        },
        pairingContext(request),
      );
    }
    if (signIn?.environment === 'local') {
      return startEmailLink(
        pool,
        current.id,
        input.email,
        { revealCode: true },
        pairingContext(request),
      );
    }
    throw new ApiError('EMAIL_UNAVAILABLE', 503);
  });
  app.post('/v1/sign-in/email/confirm', async (request) => {
    const current = await account(request);
    const input = EmailCodeSchema.parse(request.body);
    return confirmEmailLink(pool, current.id, input.email, input.code, pairingContext(request));
  });
  app.post('/v1/sign-in/email/login/start', async (request, reply) => {
    const input = EmailSchema.parse(request.body);
    if (!signIn?.deliverEmail) throw new ApiError('EMAIL_UNAVAILABLE', 503);
    return startEmailLogin(pool, input.email, signIn.deliverEmail, context(request, reply));
  });
  app.post('/v1/sign-in/email/login', async (request, reply) => {
    const input = EmailCodeSchema.parse(request.body);
    const result = await confirmEmailLogin(pool, input.email, input.code, context(request));
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  function site(request: FastifyRequest): string {
    return typeof request.headers.origin === 'string' ? request.headers.origin : origin;
  }
  app.post('/v1/sign-in/passkey/register/options', async (request) => {
    z.strictObject({}).parse(request.body);
    const current = await account(request);
    return beginPasskeyRegistration(pool, current.id, site(request), pairingContext(request));
  });
  app.post('/v1/sign-in/passkey/register', async (request) => {
    const current = await account(request);
    return finishPasskeyRegistration(
      pool,
      current.id,
      site(request),
      PasskeyRegisterSchema.parse(request.body),
      pairingContext(request),
    );
  });
  app.post('/v1/sign-in/passkey/login/options', async (request, reply) => {
    z.strictObject({}).parse(request.body);
    return beginPasskeyLogin(pool, site(request), context(request, reply));
  });
  app.post('/v1/sign-in/passkey/login', async (request, reply) => {
    const result = await finishPasskeyLogin(
      pool,
      site(request),
      PasskeyLoginSchema.parse(request.body),
      context(request),
    );
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  app.post('/v1/sign-in/remove', async (request, reply) => {
    const current = await account(request);
    const input = RemoveSchema.parse(request.body);
    if (input.method === 'telegram')
      await unlinkProvider(pool, current.id, 'telegram', input.subject);
    else if (input.method === 'email') await removeEmail(pool, current.id, input.subject);
    else await removePasskey(pool, current.id, input.subject);
    return reply.code(204).send();
  });
}
