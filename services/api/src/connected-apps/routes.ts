import type { FastifyInstance } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import {
  ConnectedAppsRoutes,
  AppTokenRequestSchema,
  AppActivityQuerySchema,
} from '../../../../protocol/connected-apps.js';
import { ActivityActionSchemas, activityAbi } from '@daclify/modules/sdk';
import { ModuleApiRoutes } from '@daclify/modules';
import { ABI, Serializer } from '@wharfkit/antelope';
import { z, ZodError } from 'zod';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import type { ConnectedApps } from './service.js';
import { AppAdmissions } from './admission.js';
export const APP_BEARER_PATHS = [
  '/v1/connected-apps/token',
  '/v1/connected-apps/userinfo',
  '/v1/connected-apps/relay',
  '/v1/connected-apps/logout',
  '/v1/connected-apps/activities',
  '/v1/connected-apps/invitations',
  '/v1/connected-apps/invitation-status',
  '/v1/connected-apps/member-access',
];
export const APP_METADATA_PATHS = ['/.well-known/openid-configuration', '/v1/connected-apps/jwks'];
export function registerConnectedAppsRoutes(
  app: FastifyInstance,
  service: ConnectedApps,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  spend: (accountId: string) => void,
) {
  const admission = new AppAdmissions(service);
  app.get(ConnectedAppsRoutes.appAdmission.path, async (request) => admission.status(
    await session(request.cookies[cookieName]), z.object({ id: z.uuid() }).parse(request.params).id,
  ));
  app.post(ConnectedAppsRoutes.joinApp.path, async (request) => admission.join(
    await session(request.cookies[cookieName], request.headers['x-csrf-token']?.toString() ?? ''),
    z.object({id:z.uuid()}).parse(request.params).id, request.body,
  ));
  app.post(ConnectedAppsRoutes.appJoinPreview.path, async (request) => admission.preview(
    await session(request.cookies[cookieName], request.headers['x-csrf-token']?.toString() ?? ''), z.object({id:z.uuid()}).parse(request.params).id, request.body,
  ));
  app.get(ConnectedAppsRoutes.appJoinConfiguration.path, async (request) => {
    const account=await session(request.cookies[cookieName]),status=await admission.configuration(account,z.object({id:z.uuid()}).parse(request.params).id);
    if(!status.member?.admin)throw new ApiError('ADMIN_REQUIRED',403);
    return status;
  });
  app.get(ConnectedAppsRoutes.appMemberAccess.path, async (request) => {
    if(!request.headers.authorization?.startsWith('Bearer '))throw new ApiError('APP_TOKEN_REQUIRED',401);
    const access=await service.access(request.headers.authorization.slice(7),request.headers.origin);
    const member=await service.chain.admission?.member(access.account,access.app.config.dao.daoId);
    if(!member)throw new ApiError('APP_JOIN_UNAVAILABLE',503);
    const query=ConnectedAppsRoutes.appMemberAccess.query.parse(request.query);
    if(query.invitationId){
      const invitation=await service.chain.admission?.invitation(access.app.config.dao.daoId,query.invitationId);
      if(!invitation||invitation.token_hash!==query.tokenHash||invitation.app_id!==access.app.config.appId||invitation.app_revision!==access.app.config.revision||invitation.member_id!==member.memberId)throw new ApiError('APP_INVITE_PROOF',403);
    }

    return {...member,membersUrl:service.config.frontendOrigin+'/dao/'+access.app.config.dao.daoId+'/members'};
  });
  app.post(ConnectedAppsRoutes.stageAppInvitation.path, async (request) => {
    if (!request.headers.authorization?.startsWith('Bearer ')) throw new ApiError('APP_TOKEN_REQUIRED', 401);
    return admission.stage(request.headers.authorization.slice(7), request.headers.origin, request.body);
  });
  app.get(ConnectedAppsRoutes.appInvitation.path, async (request) => admission.details(
    await session(request.cookies[cookieName]), z.object({id:z.uuid()}).parse(request.params).id,
  ));
  app.post(ConnectedAppsRoutes.appInvitationStatus.path, async (request) => {
    if (!request.headers.authorization?.startsWith('Bearer ')) throw new ApiError('APP_TOKEN_REQUIRED', 401);
    const access = await service.access(request.headers.authorization.slice(7), request.headers.origin);
    const input = ConnectedAppsRoutes.appInvitationStatus.input.parse(request.body);
    return admission.details(access.account, input.requestId, access.app.clientId);
  });
  app.get(ModuleApiRoutes.appKeys.path, async (request) => {
    const params = z
        .object({
          id: z.string().regex(/^[1-9][0-9]{0,19}$/),
          appId: z.string().regex(/^[1-9][0-9]{0,19}$/),
        })
        .parse(request.params),
      account = await session(request.cookies[cookieName]),
      member = await service.chain.membership(account, params.id);
    if (!member?.active) throw new ApiError('MEMBERSHIP_REQUIRED', 403);
    const apps = await service.list(account, params.id),
      registered = apps.find((app) => app.config.appId === params.appId);
    if (!registered?.native) throw new ApiError('APP_UNKNOWN', 404);
    return service.chain.keys(registered.config, member.memberId);
  });
  const admit = createWindowLimiter(40, 300000, 4000);
  const id = (params: unknown) => z.object({ id: z.uuid() }).parse(params).id;
  const bearer = (value: string | undefined) => {
    if (!value?.startsWith('Bearer ')) throw new ApiError('APP_TOKEN_REQUIRED', 401);
    return value.slice(7);
  };
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      if (typeof body !== 'string') {
        done(new ApiError('INPUT_INVALID'), undefined);
        return;
      }
      const pairs = new URLSearchParams(body);
      if (new Set(pairs.keys()).size !== Array.from(pairs.keys()).length) {
        done(new ApiError('INPUT_INVALID'), undefined);
        return;
      }
      done(null, Object.fromEntries(pairs));
    },
  );
  app.addHook('onSend', async (request, reply) => {
    if (
      request.url.startsWith('/v1/connected-apps/') ||
      request.routeOptions.url === ConnectedAppsRoutes.connectedApps.path ||
      request.routeOptions.url === ModuleApiRoutes.appKeys.path
    ) {
      reply.header('cache-control', 'no-store');
      reply.header('referrer-policy', 'no-referrer');
    }
  });
  app.get('/.well-known/openid-configuration', async () => service.discovery());
  app.get('/v1/connected-apps/jwks', async () => service.jwks());
  app.get('/v1/connected-apps/authorize', async (request, reply) => {
    if (!admit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return reply.redirect(await service.authorize(request.query));
  });
  app.post('/v1/connected-apps/token', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (!admit(request.ip, Date.now()))
      return reply.code(429).send({ error: 'temporarily_unavailable' });
    try {
      const input = AppTokenRequestSchema.parse(request.body),
        client = await service.client(input.client_id);
      if (request.headers.origin && !client.config.origins.includes(request.headers.origin))
        throw new ApiError('APP_ORIGIN', 403);
      return await service.token(input);
    } catch (error) {
      if (error instanceof ApiError || error instanceof ZodError)
        return reply
          .code(error instanceof ApiError && error.statusCode === 403 ? 403 : 400)
          .send({ error: error instanceof ZodError ? 'invalid_request' : 'invalid_grant' });
      throw error;
    }
  });
  app.get(ConnectedAppsRoutes.connectedApps.path, async (request) =>
    service.list(
      await session(request.cookies[cookieName]),
      z.object({ id: z.string().regex(/^[1-9][0-9]{0,19}$/) }).parse(request.params).id,
    ),
  );
  app.post(ConnectedAppsRoutes.stageConnectedApp.path, async (request) =>
    service.stage(
      await session(request.cookies[cookieName], request.headers['x-csrf-token']?.toString() ?? ''),
      request.body,
    ),
  );
  app.post(ConnectedAppsRoutes.appSourceAccess.path, async (request) => {
    ConnectedAppsRoutes.appSourceAccess.input.parse(request.body);
    return service.sourceAccess(
      await session(request.cookies[cookieName], request.headers['x-csrf-token']?.toString() ?? ''),
      id(request.params),
    );
  });
  app.get(ConnectedAppsRoutes.appConsent.path, async (request) =>
    service.consent(await session(request.cookies[cookieName]), id(request.params)),
  );
  app.post(ConnectedAppsRoutes.approveApp.path, async (request) =>
    service.approve(
      await session(request.cookies[cookieName], request.headers['x-csrf-token']?.toString() ?? ''),
      id(request.params),
      ConnectedAppsRoutes.approveApp.input.parse(request.body).sessionId,
    ),
  );
  app.post(ConnectedAppsRoutes.rejectApp.path, async (request) => {
    ConnectedAppsRoutes.rejectApp.input.parse(request.body);
    return service.reject(
      await session(request.cookies[cookieName], request.headers['x-csrf-token']?.toString() ?? ''),
      id(request.params),
    );
  });
  app.get(ConnectedAppsRoutes.appMembership.path, async (request, reply) => {
    const query = ConnectedAppsRoutes.appMembership.query.parse(request.query),
      access = await service.access(bearer(request.headers.authorization), request.headers.origin);
    if (query.clientId && query.clientId !== access.app.clientId)
      throw new ApiError('APP_SCOPE', 403);
    reply.header(ConnectedAppsRoutes.appMembership.clientHeader, access.app.clientId);
    return access.claims;
  });
  app.get(ConnectedAppsRoutes.appActivities.path, async (request) => {
    const access = await service.access(
      bearer(request.headers.authorization),
      request.headers.origin,
    );
    return service.chain.activity(access.app.config, AppActivityQuerySchema.parse(request.query));
  });
  app.post(ConnectedAppsRoutes.appLogout.path, async (request) => {
    ConnectedAppsRoutes.appLogout.input.parse(request.body);
    const token = bearer(request.headers.authorization);
    await service.access(token, request.headers.origin);
    return service.revoke(token);
  });
  app.post(ConnectedAppsRoutes.appRelay.path, async (request) => {
    const input = ConnectedAppsRoutes.appRelay.input.parse(request.body),
      access = await service.access(bearer(request.headers.authorization), request.headers.origin),
      instruction = input.request;
    if (!access.claims.sessionId) throw new ApiError('APP_GRANT_REQUIRED', 403);
    if (
      !['recordact', 'askreview'].includes(instruction.action) ||
      instruction.target !== access.app.config.activityAccount ||
      instruction.dao_id !== access.claims.dao.daoId ||
      instruction.member_id !== access.claims.memberId ||
      instruction.deployment !== access.claims.dao.contract ||
      instruction.chain_id !== access.claims.dao.chainId
    )
      throw new ApiError('APP_SCOPE', 403);
    const schema =
      instruction.action === 'recordact'
        ? ActivityActionSchemas.recordact
        : ActivityActionSchemas.askreview;
    const fields = z.record(z.string(), z.unknown()).parse(
      Serializer.objectify(
        Serializer.decode({
          abi: ABI.from(activityAbi),
          type: instruction.action,
          data: instruction.data,
        }),
      ),
    );
    // Wharfkit emits safe uint64 values as numbers; action schemas require decimal strings.
    for (const field of ['dao_id', 'member_id', 'app_id', 'key_epoch']) {
      const value = fields[field];
      if (typeof value === 'number') fields[field] = String(value);
    }
    const data = schema.parse(fields);
    if (
      data.app_id !== access.claims.appId ||
      data.member_id !== access.claims.memberId ||
      data.dao_id !== access.claims.dao.daoId ||
      data.runtime !== access.claims.dao.contract ||
      Serializer.encode({ abi: ABI.from(activityAbi), type: instruction.action, object: data })
        .hexString !== instruction.data
    )
      throw new ApiError('APP_SCOPE', 403);
    spend(access.account.id);
    const db = await service.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'app-relay:' +
          instruction.chain_id +
          ':' +
          instruction.deployment +
          ':' +
          instruction.dao_id +
          ':' +
          instruction.member_id,
      ]);
      const current = await service.access(
        bearer(request.headers.authorization),
        request.headers.origin,
      );
      if (current.claims.nonce !== instruction.nonce) throw new ApiError('APP_NONCE_CHANGED', 409);
      const result = await service.chain.relay(
        current.account,
        instruction,
        input.signature,
        access.claims.sessionId,
        access.claims.appId,
      );
      await db.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      db.release(discard);
    }
  });
}
