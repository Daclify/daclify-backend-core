import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { generateKeyPairSync } from 'node:crypto';
import { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import { ApiRoutes } from '../../protocol/routes.js';
import { ModuleApiRoutes } from '@daclify/modules';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { NetworkSchema, SessionSchema, ChallengeSchema } from '../../protocol/api.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const chain: ChainGateway = {
  governance: async () => {
    throw new Error('Not part of this fixture');
  },
  execute: async () => {
    throw new Error('Not part of this fixture');
  },
  finalize: async () => ({ state: 'already-finalized' }),
  treasury: async () => {
    throw new Error('Not part of this fixture');
  },
  settle: async () => ({ state: 'already-settled' }),
  async dao() {
    throw new Error('not deployed');
  },
  async content() {
    throw new Error('not deployed');
  },
  async moduleState() {
    throw new Error('not deployed');
  },
  async network() {
    return NetworkSchema.parse({
      chainId: 'ab'.repeat(32),
      rpcUrl: 'http://localhost:18888',
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      interfaceVersion: 1,
      coreVersion: '0.1.0-alpha.1',
      capabilities: [],
    });
  },
  async listDaos() {
    return [];
  },
  async memberships() {
    return [];
  },
  async memberProfile() {
    return { accountName: null, profile: null };
  },
  async createDao() {
    throw new Error('private key provider detail');
  },
  async relay() {
    throw new Error('private rpc detail');
  },
};
const app = await createServer(pool, chain, origin);
beforeAll(() => migrate(pool));
afterAll(async () => {
  await app.close();
  await pool.end();
});
async function login() {
  const key = PrivateKey.generate('K1');
  const challengeResponse = await app.inject({
    method: 'POST',
    url: '/v1/auth/challenge',
    headers: { origin },
    payload: { signingKey: key.toPublic().toString() },
  });
  const challenge = ChallengeSchema.parse(challengeResponse.json());
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    },
  });
  const session = SessionSchema.parse(response.json());
  return {
    session,
    cookie: response.cookies.map((c) => `${c.name}=${c.value}`).join(';'),
    response,
  };
}
describe('HTTP session boundary', () => {
  it.each([
    ['{', 'application/json', 400, 'INPUT_INVALID'],
    ['', 'application/json', 400, 'INPUT_INVALID'],
    ['x'.repeat(65537), 'application/json', 413, 'CONTENT_SIZE'],
    ['payload', 'application/x-unsupported', 415, 'INPUT_INVALID'],
  ])(
    'classifies rejected request bodies without exposing parser details',
    async (body, mediaType, status, code) => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/challenge',
        headers: { origin, 'content-type': mediaType },
        payload: body,
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({
        code,
        message:
          code === 'CONTENT_SIZE' ? 'The request body is too large.' : 'Check the supplied fields.',
      });
      expect(response.body).not.toMatch(/SyntaxError|FST_ERR|stack/);
    },
  );
  it('routes typed settlement and finalization requests through the authenticated service', async () => {
    const { cookie, session } = await login();
    const headers = { origin, cookie, 'x-csrf-token': session.csrfToken };
    const dao = {
      chainId: 'ab'.repeat(32),
      contract: 'daclifycore',
      daoId: '1',
      interfaceVersion: 1,
    };
    const settled = await app.inject({
      method: 'POST',
      url: ApiRoutes.settle.path,
      headers,
      payload: { dao, source: 'works', sourceId: '1' },
    });
    expect(settled.statusCode).toBe(200);
    expect(ApiRoutes.settle.response.parse(settled.json()).state).toBe('already-settled');
    const finalized = await app.inject({
      method: 'POST',
      url: ModuleApiRoutes.finalize.path,
      headers,
      payload: { dao, ballotId: '1' },
    });
    expect(finalized.statusCode).toBe(200);
    expect(ModuleApiRoutes.finalize.response.parse(finalized.json()).state).toBe(
      'already-finalized',
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: ApiRoutes.settle.path,
          headers,
          payload: { dao, source: 'works', sourceId: '1', destination: 'bob' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: ModuleApiRoutes.finalize.path,
          headers: { origin },
          payload: { dao, ballotId: '1' },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('reports unconfigured storage and keeps hosted uploads behind session authentication', async () => {
    const response = await app.inject(ApiRoutes.storage.path);
    expect(response.statusCode).toBe(200);
    expect(ApiRoutes.storage.response.parse(response.json()).configured).toBe(false);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: ApiRoutes.upload.path,
          headers: { origin },
          payload: {},
        })
      ).statusCode,
    ).toBe(401);
  });
  it('rejects unexpected logout fields while allowing an omitted body', async () => {
    const { cookie, session } = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { origin, cookie, 'x-csrf-token': session.csrfToken },
      payload: { unexpected: true },
    });
    expect(response.statusCode).toBe(400);
    expect((await app.inject({ url: '/v1/me', headers: { cookie } })).statusCode).toBe(200);
  });
  it('returns public network capabilities', async () => {
    const response = await app.inject('/v1/network');
    expect(response.statusCode).toBe(200);
    expect(NetworkSchema.parse(response.json()).environment).toBe('local');
  });
  it('validates strict input and sanitizes errors', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/challenge',
      headers: { origin },
      payload: { signingKey: 'invalid', admin: true },
    });
    expect(response.statusCode).toBe(400);
    expect(z.object({ code: z.string() }).parse(response.json()).code).toBe('INPUT_INVALID');
    expect(response.body).not.toContain('stack');
  });
  it('rejects login mutations from another origin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/challenge',
      headers: { origin: 'https://evil.example' },
      payload: { signingKey: PrivateKey.generate('K1').toPublic().toString() },
    });
    expect(response.statusCode).toBe(403);
  });
  it('uses HttpOnly same-site session cookies and identifies the session', async () => {
    const { session, cookie, response } = await login();
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Strict');
    const me = await app.inject({ url: '/v1/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(z.object({ account: z.object({ id: z.string() }) }).parse(me.json()).account.id).toBe(
      session.account.id,
    );
  });
  it('requires authentication for DAO creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/daos',
      headers: { origin },
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });
  it('requires CSRF proof for authenticated mutations', async () => {
    const { cookie } = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { origin, cookie },
    });
    expect(response.statusCode).toBe(403);
  });
  it('reports card checkout as unconfigured when Stripe is absent', async () => {
    const { cookie, session } = await login();
    const checkout = await app.inject({
      method: 'POST',
      url: '/v1/billing/checkout',
      headers: { origin, cookie, 'x-csrf-token': session.csrfToken },
      payload: {},
    });
    expect(checkout.statusCode).toBe(503);
    expect(checkout.json()).toMatchObject({ code: 'STRIPE_NOT_CONFIGURED' });
    const receipts = await app.inject({
      method: 'GET',
      url: '/v1/billing/receipts',
      headers: { cookie },
    });
    expect(receipts.statusCode).toBe(503);
    expect(receipts.json()).toMatchObject({ code: 'STRIPE_NOT_CONFIGURED' });
  });
  it('revokes an authenticated session with valid CSRF proof', async () => {
    const { cookie, session } = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { origin, cookie, 'x-csrf-token': session.csrfToken },
    });
    expect(response.statusCode).toBe(204);
    expect((await app.inject({ url: '/v1/me', headers: { cookie } })).statusCode).toBe(401);
  });
  it('reports safe unconfigured platform status without secrets or raw errors', async () => {
    const response = await app.inject(ApiRoutes.status.path);
    expect(response.statusCode).toBe(200);
    const status = ApiRoutes.status.response.parse(response.json());
    expect(status.rpc).toBe('unconfigured');
    expect(status.chain).toBeNull();
    expect(status.database.state).toBe('reachable');
    expect(status.services.every((s) => !s.configured)).toBe(true);
    expect(response.body).not.toMatch(/postgres:\/\/|PVT_|whsec_|private key provider detail/);
  });
  it('rejects unpaid creation and forged order prices through authenticated HTTP', async () => {
    const { cookie, session } = await login();
    const headers = { origin, cookie, 'x-csrf-token': session.csrfToken };
    const input = {
      metadata: { schemaVersion: 1, title: 'Unpaid DAO', description: '' },
      privacy: 'public',
      token: { chainId: 'ab'.repeat(32), contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
    };
    const response = await app.inject({
      method: 'POST',
      url: ApiRoutes.createDao.path,
      headers,
      payload: input,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'CREATION_PAYMENT_REQUIRED' });
    const forged = await app.inject({
      method: 'POST',
      url: ApiRoutes.creationOrder.path,
      headers,
      payload: {
        requestId: crypto.randomUUID(),
        deployment: 'shared',
        method: 'tlos',
        request: input,
        usdCents: 1,
      },
    });
    expect(forged.statusCode).toBe(400);
    const noCsrf = await app.inject({
      method: 'POST',
      url: ApiRoutes.creationOrder.path,
      headers: { origin, cookie },
      payload: {},
    });
    expect(noCsrf.statusCode).toBe(403);
  });
});
