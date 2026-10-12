import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomBytes, generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { createChallenge, authenticate } from '../../services/api/src/auth.js';
import { ConnectedApps } from '../../services/api/src/connected-apps/service.js';
import type { ConnectedAppsChain } from '../../services/api/src/connected-apps/chain.js';
import { AppIssuerKeySchema } from '../../services/api/src/connected-apps/config.js';
import { ConnectedAppConfigSchema } from '../../protocol/connected-apps.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { UserMembershipSchema, type Account } from '../../protocol/api.js';
import { RuntimeTableSchemas } from '../../sdk/index.js';
import { VERSION } from '../../protocol/base.js';
import { VERSION as MODULES_VERSION } from '@daclify/modules';
import { MiniAppArtifacts, miniAppReleaseId } from '../../services/api/src/mini-apps/artifacts.js';
import { MiniAppConnections } from '../../services/api/src/mini-apps/connections.js';
import { MiniAppConnectionSchema } from '../../protocol/mini-apps.js';
import { createServer } from '../../services/api/src/server.js';
import { authChain } from '../helpers/auth-chain.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test database required');
const database = 'daclify_connections_' + randomBytes(6).toString('hex') + '_test';
const target = new URL(url);
target.pathname = '/' + database;
const owner = new Pool({ connectionString: url }),
  pool = new Pool({ connectionString: target.toString() });
const issuer = 'https://issuer.example',
  frontend = 'https://daclify.example';
const dao = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1 as const,
};
let service: ConnectedApps, connections: MiniAppConnections, artifact: MiniAppArtifacts;
let admin: Account, member: Account, foreign: Account;
let clientId: string, directory: string;
let adminEnabled = true,
  networkOffline = false;
let adminLogin: { token: string; csrfToken: string },
  server: Awaited<ReturnType<typeof createServer>>;
beforeAll(async () => {
  await owner.query(`CREATE DATABASE ${database}`);
  await migrate(pool);
  const registrations: z.infer<typeof RuntimeTableSchemas.appregs>[] = [];
  const chain: ConnectedAppsChain = {
    network: authChain.network,
    registry: async () => registrations,
    membership: async (account) =>
      UserMembershipSchema.parse({
        dao: account.id === foreign.id ? { ...dao, daoId: '2' } : dao,
        memberId: account.id === admin.id ? '1' : '2',
        active: true,
        admin: account.id === admin.id ? adminEnabled : account.id === foreign.id,
        reviewer: false,
        nonce: '0',
        credits: '0',
        claim: '0',
        stake: '0',
        nativeAccount: '',
        custody: 'user-controlled',
      }),
    session: async () => null,
    activity: async () => ({ receipts: [], next: null }),
    relay: async () => ({ transactionId: 'cc'.repeat(32) }),
    keys: async (config) => ({
      dao: config.dao,
      appId: config.appId,
      currentEpoch: '0',
      keys: [],
      grants: [],
    }),
  };
  const accounts: Account[] = [];
  for (let i = 0; i < 3; i++) {
    const signing = PrivateKey.generate('K1');
    const encryptionKey = EncryptionPublicKeySchema.parse(
      generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
    );
    const challenge = await createChallenge(
      pool,
      { signingKey: signing.toPublic().toString(), encryptionKey },
      frontend,
      issuer,
    );
    const session = await authenticate(
      pool,
      challenge.id,
      signing.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
      { origin: frontend, audience: issuer },
    );
    accounts.push(session.account);
    if (i === 0) adminLogin = session;
  }
  const [first, second, third] = accounts;
  if (!first || !second || !third) throw new Error('FIXTURE_ACCOUNTS');
  admin = first;
  member = second;
  foreign = third;
  service = await ConnectedApps.create(pool, chain, {
    issuer,
    frontendOrigin: frontend,
    signingKey: AppIssuerKeySchema.parse({
      ...generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
        format: 'jwk',
      }),
      kid: 'mini-app-connections-fixture',
    }),
  });
  const config = ConnectedAppConfigSchema.parse({
    dao,
    appId: '1',
    revision: '1',
    name: 'Fixture',
    origins: ['https://app.example'],
    redirectUris: ['https://app.example/callback'],
    sourceApiBase: 'https://app.example',
    activityAccount: 'activity',
    enabled: true,
  });
  const staged = await service.stage(admin, config);
  clientId = staged.clientId;
  registrations.push(
    RuntimeTableSchemas.appregs.parse({
      id: '1',
      target: 'activity',
      revision: '1',
      config_hash: staged.configHash,
      enabled: true,
      security_epoch: '1',
    }),
  );
  directory = await mkdtemp(join(tmpdir(), 'mini-connections-'));
  const bytes = Buffer.from('synthetic artifact fixture');
  const manifest = {
    version: 1,
    releaseId: '00'.repeat(32),
    coreVersion: VERSION,
    modulesVersion: MODULES_VERSION,
    packageLockHash: 'cd'.repeat(32),
    files: ['core.tgz', 'modules.tgz', 'starter.tgz'].map((name) => ({
      name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })),
  };
  manifest.releaseId = miniAppReleaseId(manifest);
  for (const file of manifest.files) await writeFile(join(directory, file.name), bytes);
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  artifact = await MiniAppArtifacts.load(directory);
  connections = new MiniAppConnections(service, artifact, {
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    request: async () => {
      if (networkOffline) throw new Error('fixture offline');
      return {
        status: 200,
        bytes: new TextEncoder().encode(
          JSON.stringify({
            version: 1,
            binding: (await connections.buildConnection('1', '1', admin.id)).binding,
          }),
        ),
      };
    },
  });
  server = await createServer(pool, authChain, frontend, {
    apiOrigin: issuer,
    connectedApps: service,
    miniApps: connections,
  });
});
afterAll(async () => {
  await server?.close();
  await pool.end();
  await owner.query(`DROP DATABASE ${database}`);
  await owner.end();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('derives full config from the registered app and refuses nonadmin or foreign DAO access', async () => {
  const bundle = await connections.buildConnection('1', '1', admin.id);
  expect(bundle.binding).toEqual({
    schemaVersion: 1,
    chainId: dao.chainId,
    runtime: dao.contract,
    daoId: '1',
    appId: '1',
    issuer,
    clientId,
  });
  expect(bundle.callbackUrl).toBe('https://app.example/callback');
  expect(bundle).not.toHaveProperty('signingKey');
  for (const account of [member, foreign])
    await expect(connections.buildConnection('1', '1', account.id)).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED',
    });
  adminEnabled = false;
  await expect(connections.buildConnection('1', '1', admin.id)).rejects.toMatchObject({
    code: 'ADMIN_REQUIRED',
  });
  adminEnabled = true;
});
it('reports network failure separately and does not claim an app login or event was verified', async () => {
  const bundle = await connections.buildConnection('1', '1', admin.id);
  const good = await connections.checkConnection(bundle.binding);
  expect(good.checks.find((check) => check.stage === 'readiness')?.status).toBe('passed');
  expect(
    good.checks
      .filter((check) => ['identity', 'event'].includes(check.stage))
      .map((check) => check.status),
  ).toEqual(['not-run', 'not-run']);
  networkOffline = true;
  const failed = await connections.checkConnection(bundle.binding);
  networkOffline = false;
  expect(failed.checks.find((check) => check.stage === 'configuration')?.status).toBe('passed');
  expect(failed.checks.find((check) => check.stage === 'readiness')?.codes).toEqual([
    'APP_ENDPOINT_UNAVAILABLE',
  ]);
  await expect(
    connections.checkConnection({ ...bundle.binding, issuer: 'https://other.example' }),
  ).rejects.toMatchObject({ code: 'APP_ACTOR_BINDING' });
});
it('serves the exact immutable manifest bytes and rejects changed files at download time', async () => {
  const path = '/v1/mini-apps/releases/' + artifact.manifest.releaseId;
  const result = await server.inject({ method: 'GET', url: path });
  expect(result.statusCode, result.body).toBe(200);
  expect(createHash('sha256').update(result.rawPayload).digest('hex')).toBe(artifact.manifestHash);
  const download = await server.inject({ method: 'GET', url: path + '/files/starter.tgz' });
  expect(download.statusCode).toBe(200);
  expect(download.headers['cache-control']).toContain('immutable');
  await writeFile(join(directory, 'starter.tgz'), 'tampered');
  expect(
    (await server.inject({ method: 'GET', url: path + '/files/starter.tgz' })).statusCode,
  ).toBe(503);
});
it('requires an account session and CSRF for checks and returns the canonical bundle', async () => {
  const path = '/v1/mini-apps/connections/1/1';
  expect((await server.inject({ method: 'GET', url: path })).statusCode).toBe(401);
  const headers = { origin: frontend, cookie: '__Host-daclify_session=' + adminLogin.token };
  const result = await server.inject({ method: 'GET', url: path, headers });
  expect(result.statusCode, result.body).toBe(200);
  expect(MiniAppConnectionSchema.parse(result.json()).binding.daoId).toBe('1');
  expect(
    (await server.inject({ method: 'POST', url: path + '/check', headers, payload: {} }))
      .statusCode,
  ).toBe(403);
  expect(
    (
      await server.inject({
        method: 'POST',
        url: path + '/check',
        headers: { ...headers, 'x-csrf-token': adminLogin.csrfToken },
        payload: {},
      })
    ).statusCode,
  ).toBe(200);
});
