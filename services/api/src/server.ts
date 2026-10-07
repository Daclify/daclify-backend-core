import type { CreationService } from './creation.js';
import { PlatformStatusSchema } from '../../../protocol/platform.js';
import { VERSION } from '../../../protocol/base.js';
import { VERSION as MODULE_VERSION } from '@daclify/modules';
import { ServiceResponseRoutes } from '../../../protocol/service-api.js';
import { ApiRoutes } from '../../../protocol/routes.js';
import { ModuleApiRoutes } from '@daclify/modules';
import Fastify, { type FastifyReply, errorCodes } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { z, ZodError } from 'zod';
import type { Pool } from 'pg';
import type { ChainGateway } from './chain.js';
import {
  ChallengeRequestSchema,
  LoginRequestSchema,
  ProviderProofSchema,
  ProviderUnlinkSchema,
} from '../../../protocol/api.js';
import { createChallenge, authenticate, readSession, revokeSession, checkCsrf } from './auth.js';
import {
  linkProvider,
  openLinkedSession,
  unlinkProvider,
  type ProviderConfiguration,
} from './auth/linking.js';
import { verifyGoogle, verifyTelegram } from './providers/proofs.js';
import { registerSignInRoutes, type SignInConfiguration } from './auth/sign-in-routes.js';
import { registerEvmRoutes } from './auth/evm-routes.js';
import { registerNativeRoutes } from './auth/native-routes.js';
import { registerVaultAttachRoutes } from './auth/vault-attach.js';
import { registerEvmSignInRoutes } from './auth/evm-sign-in.js';
import { EvmRelaySchema } from '../../../protocol/evm-wallet.js';
import { beginAccountControl, consumeAccountControl } from './auth/intent.js';
import { registerTelegramOidcRoutes } from './auth/telegram-oidc.js';
import { AccountControlPaths } from '../../../protocol/sign-in.js';
import { registerDocsRoutes } from './docs/routes.js';
import type { DocsAgentConfiguration } from './docs/config.js';
import { IdSchema } from '../../../protocol/base.js';
import { spendingReport, spendingCsv } from './reporting/spending.js';
import { ApiError } from './errors.js';
import { parseFrontendOrigins } from './deployment-config.js';
import { DaoPresets } from '../../../protocol/dao.js';
import type { ContentService } from './content/service.js';
import { StripeBilling } from './billing/service.js';
import { registerMarketRoutes } from './market/routes.js';
import { MAX_HOSTED_CONTENT_BYTES } from '../../../protocol/storage.js';
import {
  createWindowLimiter,
  SPONSORED_GLOBAL_PER_WINDOW,
  SPONSORED_WINDOW_MS,
  SPONSORED_WRITES_PER_WINDOW,
} from './limits.js';

const webhookPath = '/v1/billing/stripe/webhook';
const rawJsonBodies = new WeakMap<object, Buffer>();

export async function createServer(
  pool: Pool,
  chain: ChainGateway,
  origin: string,
  options: {
    content?: ContentService;
    providers?: ProviderConfiguration;
    billing?: StripeBilling;
    signIn?: SignInConfiguration;
    origins?: string[];
    docs?: DocsAgentConfiguration;
    creation?: CreationService;
  } = {},
) {
  const admitCheckout = createWindowLimiter(8, 3_600_000, 80);
  const admitAccountControl = createWindowLimiter(40, 600_000, 4000);
  const admitSponsored = createWindowLimiter(
    SPONSORED_WRITES_PER_WINDOW,
    SPONSORED_WINDOW_MS,
    SPONSORED_GLOBAL_PER_WINDOW,
  );
  function spend(accountId: string): void {
    if (!admitSponsored(accountId, Date.now())) throw new ApiError('RATE_LIMIT', 429);
  }
  const origins = parseFrontendOrigins(origin, JSON.stringify(options.origins ?? []));
  const secure = new URL(origin).protocol === 'https:';
  const sameSite = secure ? 'none' : 'strict';
  const cookieName = secure ? '__Host-daclify_session' : 'daclify_session';
  const app = Fastify({ logger: false, bodyLimit: 65536, requestTimeout: 15000 });
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(body);
    rawJsonBodies.set(request, raw);
    if (raw.length === 0) {
      done(new errorCodes.FST_ERR_CTP_EMPTY_JSON_BODY(), undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw.toString('utf8'));
      done(null, parsed);
    } catch {
      done(new errorCodes.FST_ERR_CTP_INVALID_JSON_BODY(), undefined);
    }
  });
  app.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode >= 400) return payload;
    const route = ServiceResponseRoutes.find(
      (route) => route.method === request.method && route.path === request.routeOptions.url,
    );
    if (!route) return payload;
    const response = route.response.safeParse(payload);
    if (!response.success) throw new ApiError('RESPONSE_INVALID', 503);
    return response.data;
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: [
      'content-type',
      'x-csrf-token',
      'x-account-intent-id',
      'x-account-signature',
      'x-account-proof',
    ],
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError)
      return reply.code(error.statusCode).send({ code: error.code, message: error.code });
    if (error instanceof ZodError)
      return reply.code(400).send({ code: 'INPUT_INVALID', message: 'Check the supplied fields.' });
    if (error instanceof errorCodes.FST_ERR_CTP_BODY_TOO_LARGE)
      return reply
        .code(413)
        .send({ code: 'CONTENT_SIZE', message: 'The request body is too large.' });
    if (
      error instanceof errorCodes.FST_ERR_CTP_EMPTY_JSON_BODY ||
      error instanceof errorCodes.FST_ERR_CTP_INVALID_JSON_BODY ||
      error instanceof errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE
    )
      return reply
        .code(error instanceof errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE ? 415 : 400)
        .send({ code: 'INPUT_INVALID', message: 'Check the supplied fields.' });
    return reply.code(500).send({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service could not complete the request.',
    });
  });
  app.addHook('onRequest', async (request) => {
    if (request.method !== 'POST') return;
    if (request.url.split('?')[0] === webhookPath) return;
    if (!origins.includes(request.headers.origin ?? '')) throw new ApiError('ORIGIN_REJECTED', 403);
  });
  async function session(token: string | undefined, csrf?: string) {
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    const account = await readSession(pool, token);
    if (!account) throw new ApiError('AUTH_REQUIRED', 401);
    if (csrf !== undefined && !(await checkCsrf(pool, token, csrf)))
      throw new ApiError('CSRF_REQUIRED', 403);
    return account;
  }
  app.post('/v1/account/control', async (request) => {
    const token = request.cookies[cookieName];
    const account = await session(
      token,
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    if (!admitAccountControl(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return beginAccountControl(
      pool,
      account,
      token,
      request.headers.origin ?? origin,
      request.body,
    );
  });
  app.addHook('preHandler', async (request) => {
    const path = request.routeOptions.url ?? '';
    if (request.method !== 'POST' || !AccountControlPaths.some((route) => route === path)) return;
    const token = request.cookies[cookieName];
    const account = await session(
      token,
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const id = request.headers['x-account-intent-id'];
    const signature = request.headers['x-account-signature'];
    const supplied = request.headers['x-account-proof'];
    const raw = rawJsonBodies.get(request);
    if (
      !token ||
      !raw ||
      typeof id !== 'string' ||
      (typeof signature !== 'string' && typeof supplied !== 'string')
    )
      throw new ApiError('ACCOUNT_CONTROL_REQUIRED', 403);
    let proof: unknown = { kind: 'root', signature };
    if (typeof supplied === 'string') {
      try {
        if (supplied.length > 12000) throw new Error('Proof size');
        proof = JSON.parse(supplied);
      } catch {
        throw new ApiError('ACCOUNT_CONTROL_REQUIRED', 403);
      }
    }
    await consumeAccountControl(
      pool,
      account,
      token,
      path,
      raw,
      id,
      proof,
      () => chain.network(),
      request.headers.origin ?? origin,
    );
  });
  app.get('/health', async () => ({ status: 'ok' }));
  registerTelegramOidcRoutes(
    app,
    pool,
    origin,
    cookieName,
    options.providers?.telegram?.oidc,
    session,
    sessionCookie,
  );
  function creationService() {
    if (!options.creation) throw new ApiError('DAO_CREATION_UNAVAILABLE', 503);
    return options.creation;
  }
  app.get(ApiRoutes.status.path, async () => {
    let chainStatus = null;
    try {
      chainStatus = (await options.creation?.chain.platform()) ?? null;
    } catch {
      /* status reports failure without internal errors */
    }
    const database: {
      state: 'reachable' | 'unavailable';
      migrations: Array<{ namespace: string; name: string; appliedAt: string }>;
    } = { state: 'unavailable', migrations: [] };
    try {
      const rows = await pool.query<{ namespace: string; name: string; applied_at: Date }>(
        'SELECT namespace,name,applied_at FROM schema_migrations ORDER BY namespace,name',
      );
      database.state = 'reachable';
      database.migrations = rows.rows.map((r) => ({
        namespace: r.namespace,
        name: r.name,
        appliedAt: r.applied_at.toISOString(),
      }));
    } catch {
      /* no connection strings or raw database failures in public status */
    }
    const services = [
      [
        'storage',
        'Pinata / hosted storage',
        !!options.content,
        'Configured storage does not prove Pinata credentials or availability.',
      ],
      [
        'card',
        'Card payments',
        !!options.billing,
        'Verified Stripe webhooks attest card settlement; the configured settler is trusted.',
      ],
      [
        'google',
        'Google sign-in',
        !!options.providers?.google,
        'Provider configuration only; live qualification is separate.',
      ],
      [
        'telegram',
        'Telegram sign-in',
        !!options.providers?.telegram,
        'Provider configuration only; live qualification is separate.',
      ],
      [
        'docs',
        'Documentation assistant',
        !!options.docs,
        'Optional assistant; generated documentation is always available.',
      ],
      [
        'managed',
        'Managed signing and recovery',
        false,
        'OpenBao remains a candidate. Production managed custody is not qualified.',
      ],
    ] as const;
    return PlatformStatusSchema.parse({
      checkedAt: new Date().toISOString(),
      apiVersion: VERSION,
      moduleVersion: MODULE_VERSION,
      chain: chainStatus,
      rpc: chainStatus ? 'reachable' : options.creation ? 'unavailable' : 'unconfigured',
      database,
      limits: {
        sponsoredWritesPerAccount: SPONSORED_WRITES_PER_WINDOW,
        sponsoredWritesGlobal: SPONSORED_GLOBAL_PER_WINDOW,
        windowMs: SPONSORED_WINDOW_MS,
        uploadBytes: options.content?.configuration().uploadLimit ?? 0,
      },
      services: services.map(([id, name, configured, detail]) => ({
        id,
        name,
        configured,
        detail,
        qualification:
          id === 'storage' && options.content?.providerName === 'local-fixture'
            ? 'local-fixture'
            : 'not-qualified',
      })),
      defaults: { sharedUsdCents: 2000, independentUsdCents: 5000, tlosPremiumBps: 2000 },
    });
  });
  app.post(ApiRoutes.creationOrder.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    const input = ApiRoutes.creationOrder.input.parse(request.body);
    if (input.method === 'card' && !options.billing)
      throw new ApiError('STRIPE_NOT_CONFIGURED', 503);
    return creationService().prepare(account, input);
  });
  app.get<{ Params: { id: string } }>(ApiRoutes.creationOrderStatus.path, async (request) =>
    creationService().status((await session(request.cookies[cookieName])).id, request.params.id),
  );
  app.post<{ Params: { id: string } }>(ApiRoutes.creationCheckout.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    ApiRoutes.creationCheckout.input.parse(request.body);
    if (!admitCheckout(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    if (!options.billing) throw new ApiError('STRIPE_NOT_CONFIGURED', 503);
    return creationService().checkout(account.id, request.params.id, options.billing);
  });
  app.post<{ Params: { id: string } }>(ApiRoutes.creationFulfill.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    ApiRoutes.creationFulfill.input.parse(request.body);
    return creationService().fulfill(account, request.params.id);
  });

  app.get(ApiRoutes.presets.path, async () => ({ presets: DaoPresets }));
  app.get<{ Params: { id: string } }>(ApiRoutes.governance.path, async (request) =>
    chain.governance(IdSchema.parse(request.params.id)),
  );
  app.get(ApiRoutes.network.path, async () => chain.network());
  app.get(ApiRoutes.daos.path, async (request) => {
    const query = ApiRoutes.daos.query.parse(request.query);
    return chain.listDaosPage
      ? chain.listDaosPage(query.after)
      : { daos: await chain.listDaos(), next: null };
  });
  app.get<{ Params: { id: string } }>(ApiRoutes.dao.path, async (request) =>
    chain.dao(IdSchema.parse(request.params.id)),
  );
  app.get<{ Params: { id: string } }>(ApiRoutes.treasury.path, async (request) =>
    chain.treasury(IdSchema.parse(request.params.id)),
  );
  app.post(ApiRoutes.settle.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    return chain.settle(ApiRoutes.settle.input.parse(request.body));
  });
  app.get<{ Params: { id: string } }>(ApiRoutes.content.path, async (request) =>
    chain.content(IdSchema.parse(request.params.id), ApiRoutes.content.query.parse(request.query)),
  );
  app.get<{ Params: { id: string } }>(ModuleApiRoutes.state.path, async (request) =>
    chain.moduleState(
      IdSchema.parse(request.params.id),
      ModuleApiRoutes.state.query.parse(request.query),
    ),
  );
  app.post(ModuleApiRoutes.finalize.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    return chain.finalize(ModuleApiRoutes.finalize.input.parse(request.body));
  });
  app.post(ModuleApiRoutes.execute.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    return chain.execute(ModuleApiRoutes.execute.input.parse(request.body));
  });
  app.get(
    ApiRoutes.storage.path,
    async () =>
      options.content?.configuration() ?? {
        provider: 'pinata',
        configured: false,
        uploadLimit: MAX_HOSTED_CONTENT_BYTES,
      },
  );
  function contentService(): ContentService {
    if (!options.content) throw new ApiError('STORAGE_UNCONFIGURED', 503);
    return options.content;
  }
  const reports = createWindowLimiter(20, 60_000, 2000);
  app.get<{ Params: { id: string } }>(ApiRoutes.spendingReport.path, async (request) => {
    if (!reports(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return spendingReport(chain, IdSchema.parse(request.params.id));
  });
  app.get<{ Params: { id: string } }>(ApiRoutes.spendingCsv.path, async (request) => {
    if (!reports(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return {
      format: 'csv',
      content: spendingCsv(await spendingReport(chain, IdSchema.parse(request.params.id))),
    };
  });
  const images = createWindowLimiter(100, 60_000, 4000);
  app.get<{ Params: { id: string; slot: string } }>(ApiRoutes.branding.path, async (request) => {
    if (!images(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return contentService().brandingBytes(
      IdSchema.parse(request.params.id),
      z.enum(['logo', 'cover']).parse(request.params.slot),
    );
  });
  app.post(ApiRoutes.upload.path, { bodyLimit: 8 * 1024 * 1024 }, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    return contentService().upload(account, ApiRoutes.upload.input.parse(request.body));
  });
  app.get<{ Params: { requestId: string } }>(ApiRoutes.uploadStatus.path, async (request) =>
    contentService().status(
      await session(request.cookies[cookieName]),
      z.uuid().parse(request.params.requestId),
    ),
  );
  app.post<{ Params: { requestId: string } }>(ApiRoutes.uploadReconcile.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    ApiRoutes.uploadReconcile.input.parse(request.body);
    return contentService().refreshStatus(account, z.uuid().parse(request.params.requestId));
  });
  app.get<{ Params: { id: string; documentId: string; version: string } }>(
    ApiRoutes.documentBytes.path,
    async (request) => {
      const daoId = IdSchema.parse(request.params.id);
      const documentId = IdSchema.parse(request.params.documentId);
      const version = z
        .string()
        .regex(/^[1-9][0-9]{0,9}$/)
        .transform(Number)
        .pipe(z.int().min(1).max(4294967295))
        .parse(request.params.version);
      const bytes = await contentService().retrieve(daoId, documentId, version);
      return { content: Buffer.from(bytes).toString('base64') };
    },
  );
  app.post(ApiRoutes.challenge.path, async (request) => {
    const input = ChallengeRequestSchema.parse(request.body);
    return createChallenge(pool, input.signingKey, origin);
  });
  function sessionCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(cookieName, token, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 43200,
    });
  }
  async function providerPrincipal(input: z.infer<typeof ProviderProofSchema>) {
    if (input.provider === 'google') {
      const google = options.providers?.google;
      if (!google) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
      if (input.nonce === undefined) throw new ApiError('PROVIDER_INVALID', 401);
      return verifyGoogle(input.proof, google.clientId, input.nonce, google.key);
    }
    const telegram = options.providers?.telegram;
    if (!telegram?.botToken) throw new ApiError('PROVIDER_UNCONFIGURED', 503);
    return verifyTelegram(input.proof, telegram.botToken);
  }
  app.post(ApiRoutes.login.path, async (request, reply) => {
    const input = LoginRequestSchema.parse(request.body);
    const result = await authenticate(
      pool,
      input.challengeId,
      input.signature,
      input.encryptionKey,
    );
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  app.post(ApiRoutes.providerLink.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = ProviderProofSchema.parse(request.body);
    return linkProvider(pool, account.id, await providerPrincipal(input));
  });
  app.post(ApiRoutes.providerLogin.path, async (request, reply) => {
    const input = ProviderProofSchema.parse(request.body);
    const result = await openLinkedSession(pool, await providerPrincipal(input));
    sessionCookie(reply, result.token);
    return { account: result.account, csrfToken: result.csrfToken };
  });
  app.post(ApiRoutes.providerUnlink.path, async (request, reply) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = ProviderUnlinkSchema.parse(request.body);
    await unlinkProvider(pool, account.id, input.provider, input.subject);
    return reply.code(204).send();
  });
  app.get(ApiRoutes.me.path, async (request) => ({
    account: await session(request.cookies[cookieName]),
  }));
  app.get(ApiRoutes.memberships.path, async (request) => ({
    memberships: await chain.memberships(await session(request.cookies[cookieName])),
  }));
  app.get('/v1/profile', async (request) => {
    await session(request.cookies[cookieName]);
    const query = z.strictObject({ daoId: IdSchema, memberId: IdSchema }).parse(request.query);
    return chain.memberProfile(query.daoId, query.memberId);
  });
  app.post(ApiRoutes.logout.path, async (request, reply) => {
    ApiRoutes.logout.input.parse(request.body);
    const token = request.cookies[cookieName];
    await session(
      token,
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (token) await revokeSession(pool, token);
    reply.clearCookie(cookieName, { path: '/', secure, sameSite });
    return reply.code(204).send();
  });
  app.post(ApiRoutes.createDao.path, async (request, reply) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    spend(account.id);
    ApiRoutes.createDao.input.parse(request.body);
    return reply.code(409).send({
      code: 'CREATION_PAYMENT_REQUIRED',
      message: 'Prepare and pay a DAO creation order first.',
    });
  });
  app.post(ApiRoutes.relay.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = ApiRoutes.relay.input.parse(request.body);
    spend(account.id);
    return chain.relay(
      account,
      input.request,
      input.sig,
      'session_id' in input ? input.session_id : undefined,
    );
  });
  app.get('/v1/daos/:id/evm/:member', async (request) => {
    const params = z.strictObject({ id: IdSchema, member: IdSchema }).parse(request.params);
    if (!chain.evmBinding) throw new ApiError('EVM_GOVERNANCE_UNAVAILABLE', 503);
    return { binding: await chain.evmBinding(params.id, params.member) };
  });
  app.post('/v1/relay/evm', async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = EvmRelaySchema.parse(request.body);
    spend(account.id);
    if (!chain.relayEvm) throw new ApiError('EVM_GOVERNANCE_UNAVAILABLE', 503);
    const chainId = Number(input.evm_chain_id);
    const paired = await pool.query(
      'SELECT 1 FROM evm_links WHERE account_id=$1 AND chain_id=$2 AND address=$3 AND control_verified_at IS NOT NULL',
      [account.id, chainId, `0x${input.address}`],
    );
    if (paired.rowCount !== 1) throw new ApiError('EVM_LINKED_REQUIRED', 403);
    return chain.relayEvm(account, input);
  });
  function billingService(): StripeBilling {
    if (!options.billing) throw new ApiError('STRIPE_NOT_CONFIGURED', 503);
    return options.billing;
  }
  app.post('/v1/billing/checkout', async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (!admitCheckout(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return billingService().startCheckout(account.id);
  });
  app.get('/v1/billing/receipts', async (request) => ({
    receipts: await billingService().receipts((await session(request.cookies[cookieName])).id),
  }));
  app.post(webhookPath, { bodyLimit: 1024 * 1024 }, async (request) => {
    const signature = request.headers['stripe-signature'];
    const rawBody = rawJsonBodies.get(request);
    if (typeof signature !== 'string' || signature.length === 0 || !rawBody) {
      throw new ApiError('SIGNATURE_INVALID', 400);
    }
    try {
      await billingService().receiveWebhook(rawBody, signature);
    } catch (error) {
      if (error instanceof Error && error.message === 'SIGNATURE_INVALID') {
        throw new ApiError('SIGNATURE_INVALID', 400);
      }
      throw error;
    }
    return { received: true };
  });
  registerMarketRoutes(app, chain, options.billing, session, admitCheckout, cookieName);
  registerSignInRoutes(
    app,
    pool,
    origin,
    cookieName,
    options.providers,
    options.signIn,
    session,
    sessionCookie,
  );
  registerEvmRoutes(app, pool, cookieName, session);
  registerVaultAttachRoutes(app, pool, origin, cookieName, session, sessionCookie);
  registerEvmSignInRoutes(
    app,
    pool,
    origin,
    cookieName,
    session,
    sessionCookie,
    chain.walletMemberships?.bind(chain),
  );
  registerNativeRoutes(
    app,
    pool,
    origin,
    cookieName,
    () => chain.network(),
    session,
    sessionCookie,
    chain.walletMemberships?.bind(chain),
  );
  registerDocsRoutes(app, options.docs);
  return app;
}
