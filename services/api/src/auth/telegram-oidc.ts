import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { linkProvider, openLinkedSession } from './linking.js';
import type { ProviderPrincipal } from '../providers/proofs.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import { readBoundedResponse } from '../http.js';
import {
  TelegramStartSchema,
  TelegramPairConfirmSchema as IdInput,
} from '../../../../protocol/sign-in.js';

export interface TelegramOidcConfiguration {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  key?: JWTVerifyGetKey | CryptoKey | Uint8Array;
  fetch?: typeof fetch;
}
const callbackPath = '/v1/sign-in/telegram/oidc/callback';
const hash = (value: string) => createHash('sha256').update(value).digest();
const secret = () => randomBytes(32).toString('base64url');
const CallbackInput = z.object({
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code: z.string().min(1).max(2048),
});
export async function verifyTelegramOidcToken(
  token: string,
  clientId: string,
  nonce: string,
  key: JWTVerifyGetKey | CryptoKey | Uint8Array,
): Promise<ProviderPrincipal> {
  try {
    if (token.length > 16384) throw new Error('Token limit');
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'],
      issuer: 'https://oauth.telegram.org',
      audience: clientId,
      requiredClaims: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce'],
      maxTokenAge: '5m',
      clockTolerance: 30,
    });
    const claims = z
      .object({
        sub: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        nonce: z.literal(nonce),
        iat: z.number().int(),
        exp: z.number().int(),
        azp: z.string().optional(),
        aud: z.union([z.string(), z.array(z.string())]),
      })
      .parse(payload);
    if (
      claims.iat > Math.floor(Date.now() / 1000) + 30 ||
      (claims.azp !== undefined && claims.azp !== clientId) ||
      (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId)
    )
      throw new Error('Invalid audience');
    return {
      provider: 'telegram',
      subject: `oidc:${claims.sub}`,
      proofHash: hash(token),
      expires: new Date(claims.exp * 1000),
    };
  } catch {
    throw new ApiError('PROVIDER_INVALID', 401);
  }
}
export function readTelegramOidc(
  input: Record<string, string | undefined>,
): TelegramOidcConfiguration | undefined {
  if (
    !['TELEGRAM_OIDC_CLIENT_ID', 'TELEGRAM_OIDC_CLIENT_SECRET', 'TELEGRAM_OIDC_REDIRECT_URI'].some(
      (name) => input[name] !== undefined,
    )
  )
    return undefined;
  const result = z
    .object({
      TELEGRAM_OIDC_CLIENT_ID: z.string().regex(/^\d+$/),
      TELEGRAM_OIDC_CLIENT_SECRET: z.string().min(1).max(4096),
      TELEGRAM_OIDC_REDIRECT_URI: z.url(),
    })
    .safeParse(input);
  if (!result.success) throw new Error('TELEGRAM_OIDC_CONFIGURATION_INVALID');
  const uri = new URL(result.data.TELEGRAM_OIDC_REDIRECT_URI);
  if (
    uri.pathname !== callbackPath ||
    uri.search ||
    uri.hash ||
    uri.username ||
    uri.password ||
    (uri.protocol !== 'https:' &&
      !(
        input.NETWORK_ENVIRONMENT === 'local' &&
        uri.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(uri.hostname)
      ))
  )
    throw new Error('TELEGRAM_OIDC_CONFIGURATION_INVALID');
  return {
    clientId: result.data.TELEGRAM_OIDC_CLIENT_ID,
    clientSecret: result.data.TELEGRAM_OIDC_CLIENT_SECRET,
    redirectUri: uri.href,
  };
}
interface Attempt {
  id: string;
  purpose: 'login' | 'pair';
  account_id: string | null;
  session_hash: Buffer | null;
  verifier: string;
  nonce: string;
  verified_subject: string | null;
  proof_hash: Buffer | null;
  proof_expires_at: Date | null;
  expires_at: Date;
  frontend_origin: string | null;
  return_to: string | null;
}
export function registerTelegramOidcRoutes(
  app: FastifyInstance,
  pool: Pool,
  origin: string,
  cookieName: string,
  configuration: TelegramOidcConfiguration | undefined,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  sessionCookie: (reply: FastifyReply, token: string, site?: string) => Promise<void>,
  sharedProxyIps: readonly string[] = [],
): void {
  const secure = new URL(origin).protocol === 'https:';
  const browserCookie = secure ? '__Host-daclify_telegram_attempt' : 'daclify_telegram_attempt';
  const admit = createWindowLimiter(20, 600_000, 2000, sharedProxyIps);
  const key =
    configuration?.key ??
    createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'));
  function configured() {
    if (!configuration) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    return configuration;
  }
  function context(request: FastifyRequest) {
    const browser = request.cookies[browserCookie];
    if (!browser || !/^[A-Za-z0-9_-]{43}$/.test(browser))
      throw new ApiError('PROVIDER_INVALID', 401);
    return hash(browser);
  }
  function csrf(request: FastifyRequest) {
    return typeof request.headers['x-csrf-token'] === 'string'
      ? request.headers['x-csrf-token']
      : '';
  }
  async function begin(purpose: 'login' | 'pair', request: FastifyRequest, reply: FastifyReply) {
    const config = configured();
    const input = TelegramStartSchema.parse(request.body);
    const site = typeof request.headers.origin === 'string' ? request.headers.origin : origin;
    let destination: string | null = null;
    if (input.returnTo) {
      const target = new URL(input.returnTo, site);
      if (
        !input.returnTo.startsWith('/') ||
        input.returnTo.startsWith('//') ||
        /[\\\u0000-\u0020]/.test(input.returnTo) ||
        target.origin !== site ||
        target.pathname === '/account'
      )
        throw new ApiError('INPUT_INVALID', 400);
      destination = target.pathname + target.search + target.hash;
    }
    if (!admit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    const current =
      purpose === 'pair' ? await session(request.cookies[cookieName], csrf(request)) : null;
    const id = randomUUID(),
      state = secret(),
      browser = secret(),
      verifier = secret(),
      nonce = secret();
    await pool.query("DELETE FROM telegram_oidc_attempts WHERE expires_at<now()-interval '1 day'");
    await pool.query(
      "INSERT INTO telegram_oidc_attempts(id,purpose,state_hash,browser_hash,account_id,session_hash,verifier,nonce,expires_at,frontend_origin,return_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '5 minutes',$9,$10)",
      [
        id,
        purpose,
        hash(state),
        hash(browser),
        current?.id ?? null,
        current ? hash(request.cookies[cookieName] ?? '') : null,
        verifier,
        nonce,
        site,
        destination,
      ],
    );
    reply.setCookie(browserCookie, browser, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      maxAge: 300,
    });
    const authorization = new URL('https://oauth.telegram.org/auth');
    authorization.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid',
      state,
      nonce,
      code_challenge: hash(verifier).toString('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { authorizationUrl: authorization.href };
  }
  app.post('/v1/sign-in/telegram/oidc/login/start', (request, reply) =>
    begin('login', request, reply),
  );
  app.post('/v1/sign-in/telegram/oidc/pair/start', (request, reply) =>
    begin('pair', request, reply),
  );
  app.get(callbackPath, async (request, reply) => {
    const config = configured(),
      input = CallbackInput.parse(request.query),
      browser = context(request);
    const attempt = (
      await pool.query<Attempt>(
        'UPDATE telegram_oidc_attempts SET consumed_at=now() WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() AND consumed_at IS NULL RETURNING *',
        [hash(input.state), browser],
      )
    ).rows[0];
    if (!attempt) throw new ApiError('PROVIDER_INVALID', 401);
    try {
      if (attempt.purpose === 'pair') {
        const current = await session(request.cookies[cookieName]);
        if (
          current.id !== attempt.account_id ||
          !attempt.session_hash?.equals(hash(request.cookies[cookieName] ?? ''))
        )
          throw new ApiError('PROVIDER_INVALID', 401);
      }
      let principal: ProviderPrincipal;
      try {
        const response = await (config.fetch ?? fetch)('https://oauth.telegram.org/token', {
          method: 'POST',
          signal: AbortSignal.timeout(10000),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: input.code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
            code_verifier: attempt.verifier,
          }),
        });
        if (!response.ok) throw new Error('Token exchange failed');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(
          await readBoundedResponse(response, 32768),
        );
        const token = z
          .object({ id_token: z.string().min(1).max(16384) })
          .parse(JSON.parse(text)).id_token;
        principal = await verifyTelegramOidcToken(token, config.clientId, attempt.nonce, key);
      } catch {
        throw new ApiError('PROVIDER_INVALID', 401);
      } finally {
        await pool.query("UPDATE telegram_oidc_attempts SET verifier='' WHERE id=$1", [attempt.id]);
      }
      const target = new URL('/account', attempt.frontend_origin ?? origin);
      if (attempt.return_to) target.searchParams.set('returnTo', attempt.return_to);
      if (attempt.purpose === 'login') {
        const opened = await openLinkedSession(pool, principal);
        await sessionCookie(reply, opened.token, attempt.frontend_origin ?? undefined);
        target.searchParams.set('telegram', 'complete');
        reply.clearCookie(browserCookie, { path: '/', secure, sameSite: secure ? 'none' : 'lax' });
      } else {
        await pool.query(
          "UPDATE telegram_oidc_attempts SET verified_subject=$2,proof_hash=$3,proof_expires_at=$4,verifier='' WHERE id=$1",
          [attempt.id, principal.subject, Buffer.from(principal.proofHash), principal.expires],
        );
        target.searchParams.set('telegramPair', attempt.id);
      }
      return reply.code(302).header('location', target.href).send();
    } catch {
      await pool.query("UPDATE telegram_oidc_attempts SET verifier='' WHERE id=$1", [attempt.id]);
      reply.clearCookie(browserCookie, { path: '/', secure, sameSite: secure ? 'none' : 'lax' });
      const failed = new URL('/account', attempt.frontend_origin ?? origin);
      failed.searchParams.set('telegram', 'failed');
      if (attempt.return_to) failed.searchParams.set('returnTo', attempt.return_to);
      return reply.code(302).header('location', failed.href).send();
    }
  });
  app.get('/v1/sign-in/telegram/oidc/pair/:id', async (request) => {
    const current = await session(request.cookies[cookieName]),
      { id } = IdInput.parse(request.params);
    const row = (
      await pool.query<Attempt>(
        "SELECT * FROM telegram_oidc_attempts WHERE id=$1 AND purpose='pair' AND account_id=$2 AND browser_hash=$3 AND expires_at>now() AND confirmed_at IS NULL",
        [id, current.id, context(request)],
      )
    ).rows[0];
    if (!row) throw new ApiError('PROVIDER_INVALID', 401);
    return { id: row.id, subject: row.verified_subject, expires: row.expires_at.toISOString() };
  });
  app.post('/v1/sign-in/telegram/oidc/pair/confirm', async (request, reply) => {
    const current = await session(request.cookies[cookieName], csrf(request)),
      { id } = IdInput.parse(request.body);
    const row = (
      await pool.query<Attempt>(
        "UPDATE telegram_oidc_attempts SET confirmed_at=now() WHERE id=$1 AND purpose='pair' AND account_id=$2 AND browser_hash=$3 AND expires_at>now() AND proof_expires_at>now() AND verified_subject IS NOT NULL AND confirmed_at IS NULL RETURNING *",
        [id, current.id, context(request)],
      )
    ).rows[0];
    if (!row?.verified_subject || !row.proof_hash || !row.proof_expires_at)
      throw new ApiError('PROVIDER_INVALID', 401);
    const linked = await linkProvider(pool, current.id, {
      provider: 'telegram',
      subject: row.verified_subject,
      proofHash: row.proof_hash,
      expires: row.proof_expires_at,
    });
    reply.clearCookie(browserCookie, { path: '/', secure, sameSite: secure ? 'none' : 'lax' });
    return linked;
  });
}
