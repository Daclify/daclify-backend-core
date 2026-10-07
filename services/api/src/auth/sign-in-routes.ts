import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
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

const ProofSchema = z.strictObject({ proof: z.string().min(1).max(16384) });
const EmailSchema = z.strictObject({ email: z.string().min(3).max(254) });
const EmailCodeSchema = EmailSchema.extend({ code: z.string().regex(/^\d{8}$/) });
const EncodedSchema = z.string().regex(/^[A-Za-z0-9_-]{1,16384}$/);
const PasskeyRegisterSchema = z.strictObject({
  clientDataJSON: EncodedSchema,
  attestationObject: EncodedSchema,
});
const PasskeyLoginSchema = z.strictObject({
  credentialId: z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/),
  clientDataJSON: EncodedSchema,
  authenticatorData: EncodedSchema,
  signature: EncodedSchema,
});
const RemoveSchema = z.strictObject({
  method: z.enum(['telegram', 'email', 'passkey']),
  subject: z.string().min(1).max(2048),
});

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
  function csrf(header: string | string[] | undefined): string {
    return typeof header === 'string' ? header : '';
  }
  function account(request: FastifyRequest) {
    return session(request.cookies[cookieName], csrf(request.headers['x-csrf-token']));
  }
  app.get('/v1/sign-in/options', async () => ({
    telegram: {
      configured: Boolean(telegram?.botToken && telegram.botUsername),
      username: telegram?.botUsername ?? null,
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
        configured: Boolean(telegram?.botToken && telegram.botUsername),
        username: telegram?.botUsername ?? null,
        subjects: subjects('telegram:'),
      },
      email: { delivery, subjects: subjects('email:') },
      passkeys: await listPasskeys(pool, current.id),
    };
  });
  app.post('/v1/sign-in/telegram', async (request) => {
    const current = await account(request);
    if (!telegram) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    const input = ProofSchema.parse(request.body);
    return linkProvider(pool, current.id, verifyTelegram(input.proof, telegram.botToken));
  });
  app.post('/v1/sign-in/telegram/login', async (request, reply) => {
    if (!telegram) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    const input = ProofSchema.parse(request.body);
    const result = await openLinkedSession(pool, verifyTelegram(input.proof, telegram.botToken));
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  app.post('/v1/sign-in/email/start', async (request) => {
    const current = await account(request);
    const input = EmailSchema.parse(request.body);
    if (signIn?.deliverEmail) {
      return startEmailLink(pool, current.id, input.email, {
        revealCode: false,
        deliver: signIn.deliverEmail,
      });
    }
    if (signIn?.environment === 'local') {
      return startEmailLink(pool, current.id, input.email, { revealCode: true });
    }
    throw new ApiError('EMAIL_UNAVAILABLE', 503);
  });
  app.post('/v1/sign-in/email/confirm', async (request) => {
    const current = await account(request);
    const input = EmailCodeSchema.parse(request.body);
    return confirmEmailLink(pool, current.id, input.email, input.code);
  });
  app.post('/v1/sign-in/email/login/start', async (request) => {
    const input = EmailSchema.parse(request.body);
    if (!signIn?.deliverEmail) throw new ApiError('EMAIL_UNAVAILABLE', 503);
    return startEmailLogin(pool, input.email, signIn.deliverEmail);
  });
  app.post('/v1/sign-in/email/login', async (request, reply) => {
    const input = EmailCodeSchema.parse(request.body);
    const result = await confirmEmailLogin(pool, input.email, input.code);
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  function site(request: FastifyRequest): string {
    return typeof request.headers.origin === 'string' ? request.headers.origin : origin;
  }
  app.post('/v1/sign-in/passkey/register/options', async (request) => {
    const current = await account(request);
    return beginPasskeyRegistration(pool, current.id, site(request));
  });
  app.post('/v1/sign-in/passkey/register', async (request) => {
    const current = await account(request);
    return finishPasskeyRegistration(
      pool,
      current.id,
      site(request),
      PasskeyRegisterSchema.parse(request.body),
    );
  });
  app.post('/v1/sign-in/passkey/login/options', async (request) =>
    beginPasskeyLogin(pool, site(request)),
  );
  app.post('/v1/sign-in/passkey/login', async (request, reply) => {
    const result = await finishPasskeyLogin(
      pool,
      site(request),
      PasskeyLoginSchema.parse(request.body),
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
