import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { SignupRoutes } from '../../../../protocol/signup.js';
import type { ProviderPrincipal } from '../providers/proofs.js';
import { verifyTelegram } from '../providers/proofs.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import {
  consumeProviderProof,
  providerCredentialKey,
  type ProviderConfiguration,
} from './linking.js';
import { startEmailLogin, verifyEmailSignup } from './email.js';
import type { SignInConfiguration } from './sign-in-routes.js';
import type { SignupService } from './signup.js';

export interface TelegramSignupIntegration {
  begin(request: FastifyRequest, reply: FastifyReply): void;
  verify(
    principal: ProviderPrincipal,
    request: FastifyRequest,
    reply: FastifyReply,
    origin: string,
  ): ReturnType<SignupService['verify']>;
}
export function registerSignupRoutes(
  app: FastifyInstance,
  pool: Pool,
  origin: string,
  providers: ProviderConfiguration | undefined,
  signIn: SignInConfiguration | undefined,
  service: SignupService,
  sessionCookie: (reply: FastifyReply, token: string, site?: string) => Promise<void>,
  sharedProxyIps: readonly string[] = [],
): TelegramSignupIntegration {
  const secure = new URL(origin).protocol === 'https:',
    cookie = secure ? '__Host-daclify_signup_attempt' : 'daclify_signup_attempt';
  function browser(request: FastifyRequest, reply?: FastifyReply): Buffer {
    let value = request.cookies[cookie];
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
      if (!reply) throw new ApiError('SIGNUP_ATTEMPT_INVALID', 401);
      value = randomBytes(32).toString('base64url');
      reply.setCookie(cookie, value, {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        maxAge: 600,
      });
    }
    return createHash('sha256').update(value).digest();
  }
  const admit = createWindowLimiter(20, 600000, 2000, sharedProxyIps),
    confirm = createWindowLimiter(60, 600000, 6000, sharedProxyIps);
  app.addHook('preHandler', async (request) => {
    const path = request.routeOptions.url ?? '';
    if (!path.startsWith('/v1/sign-up/')) return;
    const limiter = path.endsWith('/start') ? admit : confirm;
    if (!limiter(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
  });
  function site(request: FastifyRequest): string {
    return request.headers.origin ?? origin;
  }
  async function verified(
    credential: string,
    request: FastifyRequest,
    reply: FastifyReply,
    sourceOrigin = site(request),
  ) {
    const result = await service.verify(credential, browser(request, reply), sourceOrigin);
    if (result.status === 'existing') {
      await sessionCookie(reply, result.token, sourceOrigin);
      return { status: result.status, account: result.account, csrfToken: result.csrfToken };
    }
    return result;
  }
  app.get(SignupRoutes.signupOptions.path, async () => {
    const telegram = providers?.telegram;
    return {
      telegram: {
        configured: Boolean(telegram?.oidc || telegram?.botToken),
        username: telegram?.botUsername ?? null,
        oidc: Boolean(telegram?.oidc),
        miniApp: Boolean(telegram?.botToken),
      },
      email: { delivery: signIn?.deliverEmail ? 'mail' : 'unavailable' },
      assisted: {
        available: service.available(),
        reason: service.notice(),
      },
    };
  });
  app.post(SignupRoutes.signupEmailStart.path, async (request, reply) => {
    const input = SignupRoutes.signupEmailStart.input.parse(request.body);
    if (!signIn?.deliverEmail) throw new ApiError('EMAIL_UNAVAILABLE', 503);
    return startEmailLogin(
      pool,
      input.email,
      signIn.deliverEmail,
      browser(request, reply),
      'email-signup',
    );
  });
  app.post(SignupRoutes.signupEmailVerify.path, async (request, reply) => {
    const input = SignupRoutes.signupEmailVerify.input.parse(request.body);
    const credential = await verifyEmailSignup(pool, input.email, input.code, browser(request));
    return verified(credential, request, reply);
  });
  app.post(SignupRoutes.signupTelegramVerify.path, async (request, reply) => {
    if (!providers?.telegram?.botToken) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    const input = SignupRoutes.signupTelegramVerify.input.parse(request.body),
      principal = verifyTelegram(input.proof, providers.telegram.botToken);
    await consumeProviderProof(pool, principal);
    return verified(providerCredentialKey(principal), request, reply);
  });
  app.get(SignupRoutes.signupPending.path, async (request) => {
    const { id } = z.strictObject({ id: z.uuid() }).parse(request.params);
    return service.pending(id, browser(request), site(request));
  });
  app.post(SignupRoutes.signupPrepare.path, (request) =>
    service.prepare(request.body, browser(request), site(request)),
  );
  app.post(SignupRoutes.signupAuthorize.path, (request) =>
    service.authorize(request.body, browser(request), site(request)),
  );
  app.post(SignupRoutes.signupFinish.path, async (request, reply) => {
    const result = await service.finish(request.body, browser(request), site(request));
    await sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  return {
    begin(request, reply) {
      browser(request, reply);
    },
    async verify(principal, request, reply, sourceOrigin) {
      await consumeProviderProof(pool, principal);
      const result = await service.verify(
        providerCredentialKey(principal),
        browser(request),
        sourceOrigin,
      );
      if (result.status === 'existing') await sessionCookie(reply, result.token, sourceOrigin);
      return result;
    },
  };
}
