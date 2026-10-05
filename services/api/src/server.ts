import { ApiRoutes } from '../../../protocol/routes.js';
import { ModuleApiRoutes } from '@daclify/modules';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { z, ZodError } from 'zod';
import type { Pool } from 'pg';
import type { ChainGateway } from './chain.js';
import {
  ChallengeRequestSchema,
  LoginRequestSchema,
  CreateDaoSchema,
} from '../../../protocol/api.js';
import { RuntimeActionSchemas } from '../../../sdk/index.js';
import { createChallenge, authenticate, readSession, revokeSession, checkCsrf } from './auth.js';
import { IdSchema } from '../../../protocol/base.js';
import { ApiError } from './errors.js';
import type { ContentService } from './content/service.js';
import { MAX_HOSTED_CONTENT_BYTES } from '../../../protocol/storage.js';
export async function createServer(
  pool: Pool,
  chain: ChainGateway,
  origin: string,
  options: { content?: ContentService } = {},
) {
  const secure = new URL(origin).protocol === 'https:';
  const cookieName = secure ? '__Host-daclify_session' : 'daclify_session';
  const app = Fastify({ logger: false, bodyLimit: 65536, requestTimeout: 15000 });
  await app.register(cookie);
  await app.register(cors, {
    origin,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['content-type', 'x-csrf-token'],
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError)
      return reply.code(error.statusCode).send({ code: error.code, message: error.code });
    if (error instanceof ZodError)
      return reply.code(400).send({ code: 'INPUT_INVALID', message: 'Check the supplied fields.' });
    return reply.code(500).send({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service could not complete the request.',
    });
  });
  app.addHook('onRequest', async (request) => {
    if (request.method === 'POST' && request.headers.origin !== origin)
      throw new ApiError('ORIGIN_REJECTED', 403);
  });
  async function session(token: string | undefined, csrf?: string) {
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    const account = await readSession(pool, token);
    if (!account) throw new ApiError('AUTH_REQUIRED', 401);
    if (csrf !== undefined && !(await checkCsrf(pool, token, csrf)))
      throw new ApiError('CSRF_REQUIRED', 403);
    return account;
  }
  app.get('/health', async () => ({ status: 'ok' }));
  app.get(ApiRoutes.network.path, async () => chain.network());
  app.get(ApiRoutes.daos.path, async () => ({ daos: await chain.listDaos() }));
  app.get<{ Params: { id: string } }>(ApiRoutes.dao.path, async (request) =>
    chain.dao(IdSchema.parse(request.params.id)),
  );
  app.get<{ Params: { id: string } }>(ApiRoutes.treasury.path, async (request) =>
    chain.treasury(IdSchema.parse(request.params.id)),
  );
  app.post(ApiRoutes.settle.path, async (request) => {
    await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    return chain.settle(ApiRoutes.settle.input.parse(request.body));
  });
  app.get<{ Params: { id: string } }>(ApiRoutes.content.path, async (request) =>
    chain.content(IdSchema.parse(request.params.id)),
  );
  app.get<{ Params: { id: string } }>(ModuleApiRoutes.state.path, async (request) =>
    chain.moduleState(IdSchema.parse(request.params.id)),
  );
  app.post(ModuleApiRoutes.finalize.path, async (request) => {
    await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    return chain.finalize(ModuleApiRoutes.finalize.input.parse(request.body));
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
  app.post(ApiRoutes.login.path, async (request, reply) => {
    const input = LoginRequestSchema.parse(request.body);
    const result = await authenticate(
      pool,
      input.challengeId,
      input.signature,
      input.encryptionKey,
    );
    reply.setCookie(cookieName, result.token, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 43200,
    });
    return { account: result.account, csrfToken: result.csrfToken };
  });
  app.get(ApiRoutes.me.path, async (request) => ({
    account: await session(request.cookies[cookieName]),
  }));
  app.get(ApiRoutes.memberships.path, async (request) => ({
    memberships: await chain.memberships(await session(request.cookies[cookieName])),
  }));
  app.post(ApiRoutes.logout.path, async (request, reply) => {
    ApiRoutes.logout.input.parse(request.body);
    const token = request.cookies[cookieName];
    await session(
      token,
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (token) await revokeSession(pool, token);
    reply.clearCookie(cookieName, { path: '/', secure, sameSite: 'strict' });
    return reply.code(204).send();
  });
  app.post(ApiRoutes.createDao.path, async (request, reply) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = CreateDaoSchema.parse(request.body);
    return reply.code(201).send(await chain.createDao(account, input));
  });
  app.post(ApiRoutes.relay.path, async (request) => {
    const account = await session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    const input = RuntimeActionSchemas.submit.parse(request.body);
    return chain.relay(account, input.request, input.sig);
  });
  return app;
}
