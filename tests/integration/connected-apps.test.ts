import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { generateKeyPairSync, randomUUID, createHash } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { importJWK, jwtVerify } from 'jose';
import { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { createChallenge, authenticate } from '../../services/api/src/auth.js';
import { ConnectedApps } from '../../services/api/src/connected-apps/service.js';
import type { ConnectedAppsChain } from '../../services/api/src/connected-apps/chain.js';
import { AppIssuerKeySchema } from '../../services/api/src/connected-apps/config.js';
import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import {
  AccountSchema,
  NetworkSchema,
  UserMembershipSchema,
  type Account,
  type UserMembership,
} from '../../protocol/api.js';
import {
  ConnectedAppConfigSchema,
  AppTokenSchema,
  AppClaimsSchema,
} from '../../protocol/connected-apps.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { encodeActivity } from '@daclify/modules/sdk';
import { ModuleApiRoutes } from '@daclify/modules';
import { makeInstruction, instructionDigest } from '../../sdk/index.js';
import { DaoRefSchema } from '../../protocol/base.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const issuer = 'https://api.daclify.example',
  frontend = 'https://daclify.example';
const dao = DaoRefSchema.parse({
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
});
const network = NetworkSchema.parse({
  chainId: dao.chainId,
  runtime: dao.contract,
  rpcUrl: 'http://127.0.0.1:18888',
  hub: null,
  environment: 'local',
  interfaceVersion: 1,
  coreVersion: '0.13.0-alpha.4',
  capabilities: [],
});
const issuerKey = AppIssuerKeySchema.parse({
  ...generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }),
  kid: 'connected-app-fixture-key',
});
let service: ConnectedApps,
  registry: z.infer<typeof RuntimeTableSchemas.appregs>[],
  members: Map<string, UserMembership>,
  accounts: Account[],
  sessions: Map<string, Awaited<ReturnType<ConnectedAppsChain['session']>>>,
  apps: Awaited<ReturnType<ConnectedApps['stage']>>[];
let login: { token: string; csrfToken: string }, server: Awaited<ReturnType<typeof createServer>>;
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
beforeEach(async () => {
  if (server) await server.close();
  await pool.query('TRUNCATE connected_apps CASCADE');
  registry = [];
  members = new Map();
  sessions = new Map();
  accounts = [];
  apps = [];
  for (let index = 0; index < 7; index++) {
    const signing = PrivateKey.generate('K1'),
      encryption = EncryptionPublicKeySchema.parse(
        generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
      );
    const challenge = await createChallenge(
      pool,
      {
        signingKey: signing.toPublic().toString(),
        encryptionKey: encryption,
      },
      frontend,
      issuer,
    );
    const session = await authenticate(
      pool,
      challenge.id,
      signing.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryption,
      { origin: frontend, audience: issuer },
    );
    if (index === 2) login = session;
    accounts.push(session.account);
    members.set(
      session.account.id,
      UserMembershipSchema.parse({
        dao,
        memberId: String(index + 1),
        nonce: '0',
        active: true,
        admin: index < 2,
        reviewer: index < 2,
        credits: '0',
        claim: '0',
        stake: '0',
        nativeAccount: '',
        custody: 'user-controlled',
        signingKey: session.account.signingKey,
      }),
    );
  }
  const native: ConnectedAppsChain = {
    keys: async (config) => ({
      dao: config.dao,
      appId: config.appId,
      currentEpoch: '0',
      keys: [],
      grants: [],
    }),
    network: async () => network,
    registry: async () => registry,
    membership: async (account) => members.get(account.id) ?? null,
    session: async (_dao, id) => sessions.get(id) ?? null,
    activity: async () => ({ receipts: [], next: null }),
    relay: async () => ({ transactionId: 'cc'.repeat(32) }),
  };
  service = await ConnectedApps.create(pool, native, {
    issuer,
    frontendOrigin: frontend,
    signingKey: issuerKey,
  });
  for (let index = 0; index < 2; index++) {
    const config = ConnectedAppConfigSchema.parse({
      dao,
      appId: String(index + 1),
      revision: '1',
      name: index === 0 ? 'Garden' : 'Equipment',
      origins: [`https://app${index + 1}.example`],
      redirectUris: [`https://app${index + 1}.example/callback`],
      activityAccount: 'activity',
      sourceApiBase: `https://app${index + 1}.example`,
      enabled: true,
    });
    const staged = await service.stage(account(0), config);
    registry.push(
      RuntimeTableSchemas.appregs.parse({
        id: config.appId,
        target: 'activity',
        revision: '1',
        config_hash: staged.configHash,
        enabled: true,
        security_epoch: '1',
      }),
    );
    apps.push(staged);
  }
  const gateway: ChainGateway = {
    connectedApps: native,
    network: native.network,
    memberships: async (account) => {
      const member = members.get(account.id);
      return member ? [member] : [];
    },
    listDaos: async () => [],
    memberProfile: async () => ({ accountName: null, profile: null }),
    finalize: async () => ({ state: 'already-finalized' }),
    execute: async () => ({ state: 'already-executed' }),
    settle: async () => ({ state: 'already-settled' }),
    dao: async () => {
      throw new Error('Fixture DAO unavailable');
    },
    governance: async () => {
      throw new Error('Fixture governance unavailable');
    },
    treasury: async () => {
      throw new Error('Fixture treasury unavailable');
    },
    content: async () => {
      throw new Error('Fixture content unavailable');
    },
    moduleState: async () => {
      throw new Error('Fixture modules unavailable');
    },
    createDao: async () => {
      throw new Error('Fixture creation unavailable');
    },
    relay: async () => {
      throw new Error('Fixture root relay unavailable');
    },
  };
  server = await createServer(pool, gateway, frontend, {
    apiOrigin: issuer,
    connectedApps: service,
  });
});
afterAll(async () => {
  if (server) await server.close();
});
function account(index: number) {
  const value = accounts[index];
  if (!value) throw new Error('Fixture account');
  return value;
}
function app(index = 0) {
  const value = apps[index];
  if (!value) throw new Error('Fixture app');
  return value;
}
const verifier = 'pkce-verifier-with-at-least-43-characters-123456789';
function authRequest(index = 0) {
  return {
    client_id: app(index).clientId,
    redirect_uri: app(index).config.redirectUris[0],
    response_type: 'code',
    scope: 'openid membership',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: 'state-with-sufficient-entropy',
    nonce: 'nonce-with-sufficient-entropy',
  };
}
async function request(index = 0, grant = false) {
  const input = {
    ...authRequest(index),
    ...(grant
      ? { signing_key: PrivateKey.generate('K1').toPublic().toString(), grant_seconds: 600 }
      : {}),
  };
  const redirect = await service.authorize(input),
    id = new URL(redirect).searchParams.get('request');
  if (!id) throw new Error('Fixture request');
  return { id, input };
}
async function code(index = 0, member = 2) {
  const login = await request(index);
  return new URL((await service.approve(account(member), login.id)).redirect).searchParams.get(
    'code',
  );
}
async function token(index = 0, member = 2) {
  return AppTokenSchema.parse(
    await service.token({
      grant_type: 'authorization_code',
      client_id: app(index).clientId,
      redirect_uri: app(index).config.redirectUris[0],
      code: await code(index, member),
      code_verifier: verifier,
    }),
  );
}
it('uses one membership for seven people and distinct app subjects across two apps', async () => {
  for (let index = 0; index < 7; index++) {
    const first = await token(0, index),
      second = await token(1, index),
      a = (await service.access(first.access_token)).claims,
      b = (await service.access(second.access_token)).claims;
    expect(a.memberId).toBe(String(index + 1));
    expect(b.memberId).toBe(a.memberId);
    expect(a.sub).not.toBe(b.sub);
    expect((await service.access(first.access_token)).claims.sub).toBe(a.sub);
    expect(a.admin).toBe(index < 2);
  }
});
it('rejects nonmembers and nonadministrator registrations', async () => {
  await expect(service.stage(account(2), { ...app().config, revision: '2' })).rejects.toThrow(
    'ADMIN_REQUIRED',
  );
  members.delete(account(2).id);
  const login = await request();
  await expect(service.consent(account(2), login.id)).rejects.toThrow('MEMBERSHIP_REQUIRED');
  await expect(service.approve(account(2), login.id)).rejects.toThrow('MEMBERSHIP_REQUIRED');
});
it('accepts only exact callbacks committed to the current native registration', async () => {
  await expect(
    service.authorize({ ...authRequest(), redirect_uri: 'https://app1.example/callback/other' }),
  ).rejects.toThrow('APP_CALLBACK');
  const altered = app().config;
  await pool.query('UPDATE connected_app_configs SET config=$1 WHERE client_id=$2', [
    JSON.stringify({ ...altered, redirectUris: ['https://evil.example/callback'] }),
    app().clientId,
  ]);
  await expect(service.authorize(authRequest())).rejects.toThrow('APP_REVISED');
});
it('keeps a staged new configuration from disabling the current registration', async () => {
  await service.stage(account(0), { ...app().config, revision: '2', name: 'Renamed' });
  expect((await service.client(app().clientId)).config.name).toBe('Garden');
});
it('requires PKCE and consumes a code only once under concurrent redemption', async () => {
  const authorization = await code(),
    input = {
      grant_type: 'authorization_code',
      client_id: app().clientId,
      redirect_uri: app().config.redirectUris[0],
      code: authorization,
      code_verifier: verifier,
    };
  await expect(service.token({ ...input, code_verifier: 'x'.repeat(43) })).rejects.toThrow(
    'APP_INVALID_GRANT',
  );
  const results = await Promise.allSettled([service.token(input), service.token(input)]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
});
it('issues verifiable minimal OIDC claims with exact issuer, audience and nonce', async () => {
  const issued = await token(),
    key = service.jwks().keys[0];
  if (!key) throw new Error('Fixture key');
  expect(key).not.toHaveProperty('d');
  const verified = await jwtVerify(issued.id_token, await importJWK(key), {
    issuer,
    audience: app().clientId,
    algorithms: ['ES256'],
  });
  expect(verified.payload.nonce).toBe(authRequest().nonce);
  const claims = AppClaimsSchema.parse(verified.payload.daclify);
  expect(claims.memberId).toBe('3');
  expect(verified.payload).not.toHaveProperty('email');
  expect(verified.payload).not.toHaveProperty('telegram');
  expect(verified.payload).not.toHaveProperty('account_id');
  await expect(
    jwtVerify(issued.id_token, await importJWK(key), {
      issuer: 'https://evil.example',
      audience: app().clientId,
    }),
  ).rejects.toThrow();
});
it('rechecks removal, suspension and configuration revision on existing tokens', async () => {
  const first = await token(),
    second = await token(1);
  const member = members.get(account(2).id);
  if (!member) throw new Error('Fixture member');
  members.set(account(2).id, { ...member, active: false });
  await expect(service.access(first.access_token)).rejects.toThrow('MEMBERSHIP_REQUIRED');
  members.set(account(2).id, member);
  const native = registry[0];
  if (!native) throw new Error('Fixture registration');
  native.enabled = false;
  await expect(service.access(first.access_token)).rejects.toThrow('APP_DISABLED');
  expect((await service.access(second.access_token)).claims.appId).toBe('2');
  native.enabled = true;
  const changed = await service.stage(account(0), {
    ...app().config,
    revision: '2',
    name: 'Updated',
  });
  native.revision = '2';
  native.config_hash = changed.configHash;
  await expect(service.access(first.access_token)).rejects.toThrow('APP_REVISED');
});
it('separates login consent from cryptographically authorised recording', async () => {
  const login = await request(0, true);
  await expect(service.approve(account(2), login.id)).rejects.toThrow('APP_GRANT_REQUIRED');
  const consent = await service.consent(account(2), login.id);
  sessions.set('101', {
    credential: RuntimeTableSchemas.sessions.parse({
      id: '101',
      member_id: '3',
      signing_key: consent.signingKey,
      expires: consent.grantExpires,
      credential_epoch: '1',
      permissions: [],
    }),
    scope: RuntimeTableSchemas.appscopes.parse({ id: '101', app_id: '2', revision: '1' }),
  });
  await expect(service.approve(account(2), login.id, '101')).rejects.toThrow('APP_GRANT_REQUIRED');
  const native = sessions.get('101');
  if (!native) throw new Error('Fixture session');
  native.scope.app_id = '1';
  const authorized = await service.approve(account(2), login.id, '101'),
    issued = AppTokenSchema.parse(
      await service.token({
        grant_type: 'authorization_code',
        client_id: app().clientId,
        redirect_uri: app().config.redirectUris[0],
        code: new URL(authorized.redirect).searchParams.get('code'),
        code_verifier: verifier,
      }),
    );
  expect((await service.access(issued.access_token)).claims.sessionId).toBe('101');
  sessions.delete('101');
  await expect(service.access(issued.access_token)).rejects.toThrow('APP_GRANT_REVOKED');
});
it('protects consent with frontend Origin and CSRF while app CORS grants no cookie access', async () => {
  const pending = await request();
  const denied = await server.inject({
    method: 'POST',
    url: `/v1/connected-apps/requests/${pending.id}/approve`,
    headers: { origin: frontend, cookie: '__Host-daclify_session=' + login.token },
    payload: {},
  });
  expect(denied.statusCode).toBe(403);
  const accepted = await server.inject({
    method: 'POST',
    url: `/v1/connected-apps/requests/${pending.id}/approve`,
    headers: {
      origin: frontend,
      cookie: '__Host-daclify_session=' + login.token,
      'x-csrf-token': login.csrfToken,
    },
    payload: {},
  });
  expect(accepted.statusCode).toBe(200);
  const preflight = await server.inject({
    method: 'OPTIONS',
    url: '/v1/connected-apps/token',
    headers: {
      origin: 'https://app1.example',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  expect(preflight.headers['access-control-allow-origin']).toBe('https://app1.example');
  expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
  const root = await server.inject({
    method: 'POST',
    url: '/v1/relay',
    headers: {
      origin: 'https://app1.example',
      cookie: '__Host-daclify_session=' + login.token,
      'x-csrf-token': login.csrfToken,
    },
    payload: {},
  });
  expect(root.statusCode).toBe(403);
});
it.each(['recordact', 'askreview'] as const)(
  'relays canonical %s ABI bytes over HTTP and rejects another app payload',
  async (action) => {
    const delegate = PrivateKey.generate('K1');
    const redirect = await service.authorize({
      ...authRequest(),
      signing_key: delegate.toPublic().toString(),
      grant_seconds: 600,
    });
    const id = new URL(redirect).searchParams.get('request');
    if (!id) throw new Error('Fixture request');
    const consent = await service.consent(account(2), id);
    sessions.set('101', {
      credential: RuntimeTableSchemas.sessions.parse({
        id: '101',
        member_id: '3',
        signing_key: delegate.toPublic().toString(),
        expires: consent.grantExpires,
        credential_epoch: '1',
        permissions: [],
      }),
      scope: RuntimeTableSchemas.appscopes.parse({ id: '101', app_id: '1', revision: '1' }),
    });
    const approved = await service.approve(account(2), id, '101');
    const issued = AppTokenSchema.parse(
      await service.token({
        grant_type: 'authorization_code',
        client_id: app().clientId,
        redirect_uri: app().config.redirectUris[0],
        code: new URL(approved.redirect).searchParams.get('code'),
        code_verifier: verifier,
      }),
    );
    const relay = vi.spyOn(service.chain, 'relay');
    const submit = async (appId: string) => {
      const instruction = makeInstruction(
        dao,
        '3',
        '0',
        Math.floor(Date.now() / 1000) + 120,
        'activity',
        action,
        encodeActivity(action, {
          runtime: dao.contract,
          dao_id: dao.daoId,
          member_id: '3',
          app_id: appId,
          source_id: '11'.repeat(32),
          source_revision: '22'.repeat(32),
          event_id: '33'.repeat(32),
          evidence_cid: '',
          evidence_hash: '00'.repeat(32),
          key_epoch: '0',
        }),
      );
      const signature = delegate.signDigest(instructionDigest(instruction)).toString();
      const response = await server.inject({
        method: 'POST',
        url: '/v1/connected-apps/relay',
        headers: { origin: 'https://app1.example', authorization: 'Bearer ' + issued.access_token },
        payload: { request: instruction, signature },
      });
      return { response, instruction, signature };
    };
    const accepted = await submit('1');
    expect(accepted.response.statusCode).toBe(200);
    expect(accepted.response.json()).toEqual({ transactionId: 'cc'.repeat(32) });
    expect(relay).toHaveBeenCalledWith(
      account(2),
      accepted.instruction,
      accepted.signature,
      '101',
      '1',
    );
    const denied = await submit('2');
    expect(denied.response.statusCode).toBe(403);
    expect(denied.response.json()).toMatchObject({ code: 'APP_SCOPE' });
    expect(relay).toHaveBeenCalledTimes(1);
  },
);
it('shares sponsored admission across portal writes and freshly issued app tokens', async () => {
  const delegate = PrivateKey.generate('K1');
  const redirect = await service.authorize({
    ...authRequest(),
    signing_key: delegate.toPublic().toString(),
    grant_seconds: 600,
  });
  const id = new URL(redirect).searchParams.get('request');
  if (!id) throw new Error('Fixture request');
  const consent = await service.consent(account(2), id);
  sessions.set('101', {
    credential: RuntimeTableSchemas.sessions.parse({
      id: '101',
      member_id: '3',
      signing_key: delegate.toPublic().toString(),
      expires: consent.grantExpires,
      credential_epoch: '1',
      permissions: [],
    }),
    scope: RuntimeTableSchemas.appscopes.parse({ id: '101', app_id: '1', revision: '1' }),
  });
  const approved = await service.approve(account(2), id, '101');
  const issued = AppTokenSchema.parse(
    await service.token({
      grant_type: 'authorization_code',
      client_id: app().clientId,
      redirect_uri: app().config.redirectUris[0],
      code: new URL(approved.redirect).searchParams.get('code'),
      code_verifier: verifier,
    }),
  );
  const request = makeInstruction(
    dao,
    '3',
    '0',
    Math.floor(Date.now() / 1000) + 120,
    'activity',
    'recordact',
    encodeActivity('recordact', {
      runtime: dao.contract,
      dao_id: dao.daoId,
      member_id: '3',
      app_id: '1',
      source_id: '11'.repeat(32),
      source_revision: '22'.repeat(32),
      event_id: '33'.repeat(32),
      evidence_cid: '',
      evidence_hash: '00'.repeat(32),
      key_epoch: '0',
    }),
  );
  const relay = (token: string) =>
    server.inject({
      method: 'POST',
      url: '/v1/connected-apps/relay',
      headers: { origin: 'https://app1.example', authorization: 'Bearer ' + token },
      payload: { request, signature: delegate.signDigest(instructionDigest(request)).toString() },
    });
  expect((await relay(issued.access_token)).statusCode).toBe(200);
  const finalize = () =>
    server.inject({
      method: 'POST',
      url: ModuleApiRoutes.finalize.path,
      headers: {
        origin: frontend,
        cookie: '__Host-daclify_session=' + login.token,
        'x-csrf-token': login.csrfToken,
      },
      payload: { dao, ballotId: '1' },
    });
  for (let index = 0; index < 59; index++) expect((await finalize()).statusCode).toBe(200);
  const renewed = await service.token({
    grant_type: 'refresh_token',
    client_id: app().clientId,
    refresh_token: issued.refresh_token,
  });
  const denied = await relay(renewed.access_token);
  expect(denied.statusCode).toBe(429);
  expect(denied.json()).toMatchObject({ code: 'RATE_LIMIT' });
  expect((await finalize()).statusCode).toBe(429);
});
it('supports standard form token exchange, restricts token audience and revokes logout', async () => {
  const codeValue = await code(),
    body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: app().clientId,
      redirect_uri: app().config.redirectUris[0] ?? '',
      code: codeValue ?? '',
      code_verifier: verifier,
    });
  const response = await server.inject({
    method: 'POST',
    url: '/v1/connected-apps/token',
    headers: {
      origin: 'https://app1.example',
      'content-type': 'application/x-www-form-urlencoded',
    },
    payload: body.toString(),
  });
  expect(response.statusCode).toBe(200);
  const issued = AppTokenSchema.parse(response.json());
  const forbidden = await server.inject({
    method: 'GET',
    url: '/v1/connected-apps/userinfo',
    headers: { origin: 'https://app2.example', authorization: 'Bearer ' + issued.access_token },
  });
  expect(forbidden.statusCode).toBe(403);
  const info = await server.inject({
    method: 'GET',
    url: '/v1/connected-apps/userinfo',
    headers: { origin: 'https://app1.example', authorization: 'Bearer ' + issued.access_token },
  });
  expect(info.statusCode).toBe(200);
  expect(info.headers['cache-control']).toBe('no-store');
  await service.revoke(issued.access_token);
  await expect(service.access(issued.access_token)).rejects.toThrow('APP_TOKEN_REQUIRED');
});
it('expires attempts and codes and bounds expired cleanup', async () => {
  const pending = await request();
  await pool.query(
    "UPDATE connected_app_requests SET expires_at=now()-interval '1 second' WHERE id=$1",
    [pending.id],
  );
  await expect(service.consent(account(2), pending.id)).rejects.toThrow('APP_REQUEST_EXPIRED');
  const authorization = await code();
  await pool.query("UPDATE connected_app_codes SET expires_at=now()-interval '1 second'");
  await expect(
    service.token({
      grant_type: 'authorization_code',
      client_id: app().clientId,
      redirect_uri: app().config.redirectUris[0],
      code: authorization,
      code_verifier: verifier,
    }),
  ).rejects.toThrow('APP_INVALID_GRANT');
  await service.cleanup(1);
  await expect(service.cleanup(501)).rejects.toThrow('APP_CLEANUP_LIMIT');
});
it('does not use an attacker-selected member identity', async () => {
  const missing = AccountSchema.parse({ ...account(2), id: randomUUID() });
  const pending = await request();
  await expect(service.approve(missing, pending.id)).rejects.toThrow('MEMBERSHIP_REQUIRED');
});
it('rotates refresh tokens and revokes the token family on replay', async () => {
  const first = await token();
  expect(first.refresh_token).toBeDefined();
  const input = {
    grant_type: 'refresh_token',
    client_id: app().clientId,
    refresh_token: first.refresh_token,
  };
  await expect(service.token({ ...input, client_id: app(1).clientId })).rejects.toThrow(
    'APP_INVALID_GRANT',
  );
  const renewed = AppTokenSchema.parse(await service.token(input));
  expect(renewed.refresh_token).not.toBe(first.refresh_token);
  expect((await service.access(renewed.access_token)).claims.memberId).toBe('3');
  await expect(service.token(input)).rejects.toThrow('APP_INVALID_GRANT');
  await expect(service.access(renewed.access_token)).rejects.toThrow('APP_TOKEN_REQUIRED');
});

it('issues short-lived source access without signing authority or private pairings', async () => {
  const access = await service.sourceAccess(account(2), apps[0]?.clientId ?? '');
  expect(access.apiBase).toBe('https://app1.example');
  const identity = await service.access(access.accessToken);
  expect(identity.claims).toMatchObject({
    memberId: '3',
    appId: '1',
    sessionId: null,
    sessionExpires: null,
  });
  expect(JSON.stringify(identity.claims)).not.toContain('signingKey');
  members.delete(account(2).id);
  await expect(service.access(access.accessToken)).rejects.toThrow();
});
