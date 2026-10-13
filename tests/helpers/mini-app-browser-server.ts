import { CreationService } from '../../services/api/src/creation.js';
import { DirectoryService } from '../../services/api/src/mini-apps/directory.js';
import { governedDirectoryModeration } from '../../services/api/src/mini-apps/directory-moderation.js';
import { MiniAppOriginProofSchema } from '../../protocol/mini-apps.js';
import { AccountExit } from '../../services/api/src/account-exit/service.js';
import { McpOAuth } from '../../services/api/src/mcp/oauth.js';
import { McpPairings } from '../../services/api/src/mcp/pairing.js';
import { McpArtifacts } from '../../services/api/src/mcp/artifacts.js';
import { AccountErasureExclusions } from '../../services/api/src/account-exit/exclusions.js';
import { startAccountExitWorker } from '../../services/api/src/account-exit/jobs.js';
// Owned disposable native/SQL fixture; never part of the API server or public package.
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileProfileExclusions } from '../../services/api/src/profiles/exclusions.js';
import { ProfileKeys } from '../../services/api/src/profiles/keys.js';
import { startProfileWorker } from '../../services/api/src/profiles/jobs.js';
import { Pool } from 'pg';
import { ABI, Authority, PublicKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { ModulePermissions } from '@daclify/modules';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { nativeContracts, nativeModules } from './native-contracts.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import { ConnectedApps } from '../../services/api/src/connected-apps/service.js';
import { AppIssuerKeySchema } from '../../services/api/src/connected-apps/config.js';
import { MiniAppConnections } from '../../services/api/src/mini-apps/connections.js';
import { MiniAppArtifacts } from '../../services/api/src/mini-apps/artifacts.js';
import { AccountSchema, CreateDaoSchema } from '../../protocol/api.js';
import { EncryptionPublicKeySchema, SigningPublicKeySchema } from '../../protocol/crypto.js';
import { defaultDaoSetup } from '../../protocol/dao.js';
import { RuntimeCodeHash } from '../../sdk/index.js';
const source = z.url().parse(process.env.DATABASE_URL);
if (
  !new URL(source).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(source).hostname)
)
  throw new Error('OWNED_TEST_DATABASE_REQUIRED');
const name = 'daclify_browser_' + randomBytes(6).toString('hex') + '_test',
  database = new URL(source);
database.pathname = '/' + name;
const owner = new Pool({ connectionString: source }),
  pool = new Pool({ connectionString: database.toString() });
const f = await nativeContracts();
let server: Awaited<ReturnType<typeof createServer>> | undefined;
const profileDirectory = await mkdtemp(join(tmpdir(), 'daclify-browser-profile-exclusions-'));
const profileExclusions = new FileProfileExclusions(profileDirectory);
let exitWorker: ReturnType<typeof startAccountExitWorker> | undefined;
let profileWorker: ReturnType<typeof startProfileWorker> | undefined;
await owner.query(`CREATE DATABASE ${name}`);
try {
  await migrate(pool);
  await f.create('activity');
  const activityAbi: ABI = await f.deploy(
    'activity',
    '../daclify-backend-modules/.artifacts/contracts/activity',
  );
  if (
    (await f.api.v1.chain.get_raw_abi('activity')).code_hash.toString() !==
    ModuleCodeHashes.activity
  )
    throw new Error('FIXTURE_MODULE_RELEASE_MISMATCH');
  await f.update(
    'activity',
    'active',
    'owner',
    Authority.from({
      threshold: 1,
      keys: [{ key: f.key('activity').toPublic(), weight: 1 }],
      accounts: [{ permission: { actor: 'activity', permission: 'eosio.code' }, weight: 1 }],
      waits: [],
    }),
  );
  await f.push(
    [
      f.action(
        'activity',
        'bindrampool',
        { runtime: 'daclifycore' },
        [{ actor: 'activity', permission: 'active' }],
        activityAbi,
      ),
    ],
    [f.key('activity')],
  );
  await f.push(
    ModulePermissions.activity.actions.map((action) =>
      f.system(
        'linkauth',
        { account: 'daclifycore', code: 'activity', type: action, requirement: 'execctx' },
        'daclifycore',
        'owner',
      ),
    ),
    [f.key('daclifycore')],
  );
  await f.call('daclifycore', 'listmod', {
    account: 'activity',
    publisher: 'alice',
    party: 0,
    accepts_fee_rule: 1,
    price: '0.0000 TLOS',
    code_hash: ModuleCodeHashes.activity,
    title: 'Community Activity',
  });
  await f.call('daclifycore', 'sethosted', { free_members: 3, settler: 'relay' });
  await f.call('daclifycore', 'setcreate', {
    shared_usd: 2000,
    independent_usd: 5000,
    premium_bps: 2000,
    settler: 'relay',
  });
  await f.call('daclifycore', 'setcrrate', {
    median: '10000',
    precision: 4,
    observed_at: Math.floor(Date.now() / 1000),
  });
  const gateway = new NativeChainGateway(
    {
      rpcUrl: f.url,
      chainId: f.chainId,
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      relayActor: 'relay',
      relayKey: f.key('relay'),
      bootstrap: { owner: 'alice', key: f.key('alice') },
      modules: [...nativeModules, { id: 'activity', account: 'activity' }],
    },
    pool,
  );
  const uiPort = z.coerce
      .number()
      .int()
      .min(1024)
      .max(65535)
      .parse(process.env.DACLIFY_TEST_UI_PORT ?? 5178),
    apiPort = z.coerce
      .number()
      .int()
      .min(1024)
      .max(65535)
      .parse(process.env.DACLIFY_TEST_API_PORT ?? 3008),
    origin = `http://127.0.0.1:${uiPort}`,
    issuer = 'https://mini-app-api.example';
  const apps = await ConnectedApps.create(pool, gateway.connectedApps, {
    issuer,
    frontendOrigin: origin,
    signingKey: AppIssuerKeySchema.parse({
      ...generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
        format: 'jwk',
      }),
      kid: randomBytes(16).toString('hex'),
    }),
  });
  const artifactRoot =
    process.env.MINI_APP_TEST_RELEASE_DIRECTORY ??
    '.artifacts/mini-apps/eb6e4433379827b8f570d2dfae6c77cbeca5b33b5a0072b3914bb64eddb5a5f6';
  const artifacts = await MiniAppArtifacts.load(artifactRoot);
  const profileKeys = { backupRetentionSeconds: 86400, exclusions: profileExclusions };
  const accountExit = new AccountExit(pool, gateway, {
    backupRetentionSeconds: 86400,
    profileExclusions,
    exclusions: new AccountErasureExclusions(join(profileDirectory, 'accounts')),
  });
  let directoryProof: unknown;
  const miniAppDirectory = new DirectoryService(pool, governedDirectoryModeration(pool, gateway), {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async () => ({ status: 200, bytes: Buffer.from(JSON.stringify(directoryProof)) }),
  });
  const mcpPairings = new McpPairings(pool, gateway, 'http://127.0.0.1:' + apiPort, origin, apps);
  server = await createServer(pool, gateway, origin, {
    accountExit,
    creation: new CreationService(pool,gateway),
    mcpPairings,
    miniAppDirectory,
    ...(process.env.MCP_TEST_RELEASE_DIRECTORY
      ? { mcpArtifacts: await McpArtifacts.load(process.env.MCP_TEST_RELEASE_DIRECTORY) }
      : {}),
    mcpOAuth: new McpOAuth(mcpPairings, [
      { clientId: 'browser-fixture', redirectUris: ['https://client.example/callback'] },
    ]),
    connectedApps: apps,
    miniApps: new MiniAppConnections(apps, artifacts),
    profileKeys,
    apiOrigin: origin,
    trustedProxyIps: [],
    sharedProxyIps: ['127.0.0.1'],
  });
  exitWorker = startAccountExitWorker(pool, accountExit);
  profileWorker = startProfileWorker(pool, new ProfileKeys(pool, gateway, profileKeys));
  const token = randomBytes(32).toString('hex');
  server.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/fixture/') && request.headers['x-fixture-token'] !== token)
      await reply.code(403).send({ code: 'FIXTURE_OWNER_REQUIRED' });
  });
  server.get('/fixture/native-check', async () => {
    // An actual signed native transaction proves this fixture still controls its disposable signers.
    await f.update(
      'relay',
      'active',
      'owner',
      Authority.from({
        threshold: 1,
        keys: [{ key: f.key('relay').toPublic(), weight: 1 }],
        accounts: [],
        waits: [],
      }),
    );
    return {
      chainId: f.chainId,
      runtimeCodeHash: RuntimeCodeHash,
      activityCodeHash: ModuleCodeHashes.activity,
      paidCreation: true,
    };
  });
  let sequence = 990000;
  const profileDaos = new Set<string>();
  server.post('/fixture/dao', async (request) => {
    const input = z
      .strictObject({
        signingKey: SigningPublicKeySchema,
        encryptionKey: EncryptionPublicKeySchema,
        admin: z.boolean().default(true),
        platform: z.boolean().default(false),
      })
      .parse(request.body);
    const reference = randomBytes(32).toString('hex'),
      daoId = String(++sequence);
    const signingKey = input.admin ? input.signingKey : f.key('alice').toPublic().toString();
    const account = AccountSchema.parse({
      id: crypto.randomUUID(),
      signingKey,
      encryptionKey: input.encryptionKey,
      custody: 'user-controlled',
    });
    await gateway.orderCreation(reference, signingKey, 'card');
    // Synthetic card attestation is explicit; only native payment/creation, not a live provider, is qualified.
    await gateway.attestCreation(
      reference,
      randomBytes(32).toString('hex'),
      2000,
      Math.floor(Date.now() / 1000),
    );
    const result = await gateway.createDao(
      account,
      CreateDaoSchema.parse({
        metadata: {
          schemaVersion: 1,
          title: 'Mini app browser community',
          description: 'Owned paid native fixture',
        },
        privacy: 'public',
        setup: defaultDaoSetup('custom'),
        token: { chainId: f.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      }),
      { reference, daoId },
    );
    if (input.platform) await f.call('daclifycore', 'setgov', { dao_id: daoId });
    if (!input.admin)
      await f.call(
        'daclifycore',
        'enroll',
        {
          dao_id: daoId,
          member_id: '2',
          native_account: '',
          signing_key: PublicKey.from(input.signingKey),
          encryption_key: JSON.stringify(input.encryptionKey),
          custody: 0,
        },
        'alice',
      );
    await f.call(
      'daclifycore',
      'setmodule',
      {
        dao_id: daoId,
        account: 'activity',
        version: 1,
        actions: ModulePermissions.activity.actions,
        grants: ModulePermissions.activity.grants,
        code_hash: ModuleCodeHashes.activity,
      },
      'alice',
    );
    profileDaos.add(daoId);
    return { dao: result.reference, memberId: input.admin ? '1' : '2' };
  });
  server.post('/fixture/profile-member', async (request) => {
    const input = z
      .strictObject({
        daoId: z.string().regex(/^[1-9][0-9]*$/),
        signingKey: SigningPublicKeySchema,
        encryptionKey: EncryptionPublicKeySchema,
      })
      .parse(request.body);
    if (!profileDaos.has(input.daoId)) throw new Error('FIXTURE_DAO_REQUIRED');
    const page = await gateway.tablePage('daos', 'daclifycore', input.daoId, 1);
    const dao = page.rows.find((row) => row.id === input.daoId);
    if (!dao) throw new Error('FIXTURE_DAO_REQUIRED');
    const memberId = String(BigInt(dao.max_member) + 1n);
    await f.call(
      'daclifycore',
      'enroll',
      {
        dao_id: input.daoId,
        member_id: memberId,
        native_account: '',
        signing_key: input.signingKey,
        encryption_key: JSON.stringify(input.encryptionKey),
        custody: 0,
      },
      'alice',
    );
    return { memberId };
  });
  server.post('/fixture/expire-consent', async (request) => {
    const { id } = z.strictObject({ id: z.uuid() }).parse(request.body);
    const result = await pool.query(
      "UPDATE connected_app_requests SET expires_at=now()-interval '1 second' WHERE id=$1 AND consumed_at IS NULL RETURNING id",
      [id],
    );
    if (result.rowCount !== 1) throw new Error('FIXTURE_CONSENT_REQUIRED');
    return { expired: true };
  });
  server.post('/fixture/directory-proof', async (request) => {
    directoryProof = MiniAppOriginProofSchema.parse(request.body);
    return { stored: true };
  });
  await server.listen({ host: '127.0.0.1', port: apiPort });
  await mkdir('.artifacts/native', { recursive: true });
  // The private ownership token is never included in release evidence or screenshots.
  await writeFile('.artifacts/native/browser-owner.json', JSON.stringify({ token }), {
    mode: 0o600,
  });
  await writeFile(
    '.artifacts/native/network.json',
    JSON.stringify({
      container: 'daclify-research-paid-native',
      mode: 'portable',
      url: f.url,
      chainId: f.chainId,
      runtimeCodeHash: RuntimeCodeHash,
      activityCodeHash: ModuleCodeHashes.activity,
    }),
    { mode: 0o600 },
  );
  console.log('Owned paid native mini-app browser fixture ready on loopback.');
  await new Promise<void>((resolve) => {
    process.once('SIGTERM', resolve);
    process.once('SIGINT', resolve);
  });
} finally {
  await exitWorker?.stop();
  await profileWorker?.stop();
  await server?.close();
  await profileExclusions.close();
  await rm(profileDirectory, { recursive: true, force: true });
  await f.stop();
  await pool.end();
  await owner.query(`DROP DATABASE ${name}`);
  await owner.end();
  await rm('.artifacts/native/browser-owner.json', { force: true });
  await rm('.artifacts/native/network.json', { force: true });
}
