import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import { createServer as createPortServer } from 'node:net';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdtemp, copyFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import { ApiRoutes } from '../../protocol/routes.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
} from '../../sdk/index.js';
import { publishAgent } from '../../examples/agent-publish.js';
import { AgentPublishResultSchema } from '../../examples/agent-publish-config.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test database required');
const database = 'daclify_agent_' + randomBytes(6).toString('hex') + '_test';
const target = new URL(url);
target.pathname = '/' + database;
const owner = new Pool({ connectionString: url }),
  pool = new Pool({ connectionString: target.toString() });
let f: NativeContracts;
let app: Awaited<ReturnType<typeof createServer>>;
const origin = 'http://localhost:5173';
let apiOrigin: string;
const root = PrivateKey.generate('K1'),
  delegate = PrivateKey.generate('K1');
const encryptionKey = EncryptionPublicKeySchema.parse(
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
);
let sequence = 980000;
let daoId: string;
const actor = () => ({ runtime: 'daclifycore', dao_id: daoId, member_id: '1' });
const domain = () => ({
  chainId: f.chainId,
  contract: 'daclifycore',
  daoId,
  interfaceVersion: 1 as const,
});
async function member() {
  const rows = await f.api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: daoId,
    table: 'members',
    limit: 1,
  });
  return RuntimeTableSchemas.members.parse(rows.rows[0]);
}
async function rootAction(name: string, data: Uint8Array, signer = root) {
  const request = makeInstruction(
    domain(),
    '1',
    (await member()).nonce,
    Math.floor(Date.now() / 1000) + 300,
    'daclifycore',
    name,
    data,
  );
  return f.call(
    'daclifycore',
    'submit',
    { request, sig: signer.signDigest(instructionDigest(request)).toString() },
    'relay',
  );
}
async function grant(seconds = 600, action = 'putjson') {
  await rootAction(
    'addsession',
    encodeAction('addsession', {
      ...actor(),
      session_id: '1',
      signing_key: delegate.toPublic().toString(),
      expires: Math.floor(Date.now() / 1000) + seconds,
      permissions: [{ target: 'daclifycore', action, code_hash: '00'.repeat(32) }],
    }),
  );
}
async function login(signer = root) {
  const response = await app.inject({
    method: 'POST',
    url: ApiRoutes.challenge.path,
    headers: { origin },
    payload: { signingKey: signer.toPublic().toString(), encryptionKey },
  });
  expect(response.statusCode, response.body).toBe(200);
  const challenge = ApiRoutes.challenge.response.parse(response.json());
  const signed = await app.inject({
    method: 'POST',
    url: ApiRoutes.login.path,
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: signer.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
    },
  });
  expect(signed.statusCode, signed.body).toBe(200);
  const session = ApiRoutes.login.response.parse(signed.json());
  return {
    session,
    headers: {
      origin,
      cookie: signed.cookies.map((cookie) => cookie.name + '=' + cookie.value).join('; '),
      'x-csrf-token': session.csrfToken,
    },
  };
}
async function publish(headers: Record<string, string>, signer = delegate, sessionId = '1') {
  const request = makeInstruction(
    domain(),
    '1',
    (await member()).nonce,
    Math.floor(Date.now() / 1000) + 300,
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 1,
      value: '{"decision":"Fixture public decision"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  return app.inject({
    method: 'POST',
    url: ApiRoutes.relay.path,
    headers,
    payload: {
      request,
      session_id: sessionId,
      sig: signer.signDigest(instructionDigest(request)).toString(),
    },
  });
}
beforeAll(async () => {
  await owner.query(`CREATE DATABASE ${database}`);
  await migrate(pool);
  f = await nativeContracts();
  const gateway = new NativeChainGateway(
    {
      rpcUrl: f.url,
      chainId: f.chainId,
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      relayActor: 'relay',
      relayKey: f.key('relay'),
      modules: nativeModules,
    },
    pool,
  );
  const port = createPortServer();
  port.listen(0, '127.0.0.1');
  await once(port, 'listening');
  const address = port.address();
  if (!address || typeof address === 'string') throw new Error('FIXTURE_LOCAL_PORT');
  await new Promise<void>((resolve, reject) =>
    port.close((error) => (error ? reject(error) : resolve())),
  );
  apiOrigin = 'http://127.0.0.1:' + address.port;
  app = await createServer(pool, gateway, origin, { apiOrigin });
  await app.listen({ host: '127.0.0.1', port: address.port });
}, 90000);
async function createAgentDao(participantMode = 2) {
  daoId = String(++sequence);
  await f.call(
    'daclifycore',
    'createdao',
    {
      dao_id: daoId,
      owner: 'alice',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  await f.call(
    'daclifycore',
    'initgov',
    {
      dao_id: daoId,
      settings: {
        participant_mode: participantMode,
        decide: 'decide',
        guardian: 'alice',
        kind: 0,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        governed_works: true,
        max_commitment: '10000',
        daily_commitment: '20000',
      },
    },
    'alice',
  );
  await f.call(
    'daclifycore',
    'enrollagent',
    {
      dao_id: daoId,
      member_id: '1',
      native_account: '',
      signing_key: root.toPublic().toString(),
      encryption_key: JSON.stringify(encryptionKey),
      custody: 0,
      operator_label: 'Synthetic fixture operator',
    },
    'alice',
  );
}
beforeEach(async () => createAgentDao(), 20000);
afterAll(async () => {
  await app?.close();
  await f?.stop();
  await pool.end();
  await owner.query(`DROP DATABASE ${database}`);
  await owner.end();
});

it('publishes with a scoped delegate while authenticating only the enrolled root identity', async () => {
  await grant();
  const { session, headers } = await login();
  expect(session.account.signingKey).toBe(root.toPublic().toString());
  const response = await publish(headers);
  expect(response.statusCode, response.body).toBe(200);
  expect(ApiRoutes.relay.response.parse(response.json()).transactionId).toMatch(/^[a-f0-9]{64}$/);
  expect((await member()).signing_key).toBe(root.toPublic().toString());
  expect(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: daoId,
        table: 'members',
        limit: 10,
      })
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await pool.query('SELECT count(*)::text AS total FROM accounts WHERE signing_key=$1', [
        delegate.toPublic().toString(),
      ])
    ).rows[0],
  ).toEqual({ total: '0' });
});

it('preserves the original account root after a proved DAO signing-key rotation', async () => {
  const { session, headers } = await login();
  const memberships = await app.inject({ method: 'GET', url: ApiRoutes.memberships.path, headers });
  expect(memberships.statusCode).toBe(200);
  expect(ApiRoutes.memberships.response.parse(memberships.json()).memberships).toContainEqual(
    expect.objectContaining({ dao: domain(), memberId: '1' }),
  );
  const successor = PrivateKey.generate('K1');
  await rootAction(
    'rotatekey',
    encodeAction('rotatekey', { ...actor(), signing_key: successor.toPublic().toString() }),
  );
  await rootAction(
    'addsession',
    encodeAction('addsession', {
      ...actor(),
      session_id: '1',
      signing_key: delegate.toPublic().toString(),
      expires: Math.floor(Date.now() / 1000) + 600,
      permissions: [{ target: 'daclifycore', action: 'putjson', code_hash: '00'.repeat(32) }],
    }),
    successor,
  );
  const result = await publishAgent({
    api: apiOrigin,
    origin,
    dao: domain(),
    documentId: '1',
    documentVersion: 1,
    accountAuthentication: { signingKey: root.toString(), encryptionKey },
    scopedSigner: { signingKey: delegate.toString(), memberId: '1', sessionId: '1' },
    visibility: 'public',
    publicJson: { decision: 'Original account with rotated DAO signer' },
  });
  expect(result.accountId).toBe(session.account.id);
  expect(result.memberId).toBe('1');
  expect((await member()).signing_key).toBe(successor.toPublic().toString());
  expect(
    (await pool.query('SELECT signing_key FROM accounts WHERE id=$1', [session.account.id]))
      .rows[0],
  ).toEqual({ signing_key: root.toPublic().toString() });
  const request = makeInstruction(
    domain(),
    '1',
    (await member()).nonce,
    Math.floor(Date.now() / 1000) + 300,
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 2,
      value: '{"decision":"Current DAO signer"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  const refused = await app.inject({
    method: 'POST',
    url: ApiRoutes.relay.path,
    headers,
    payload: { request, sig: root.signDigest(instructionDigest(request)).toString() },
  });
  expect(refused.statusCode).toBe(403);
  expect(refused.json()).toMatchObject({ code: 'SIGNATURE_INVALID' });
  const current = await app.inject({
    method: 'POST',
    url: ApiRoutes.relay.path,
    headers,
    payload: { request, sig: successor.signDigest(instructionDigest(request)).toString() },
  });
  expect(current.statusCode, current.body).toBe(200);
});

it('does not let another authenticated root use the enrolled member delegate', async () => {
  await grant();
  const { headers } = await login(PrivateKey.generate('K1'));
  const response = await publish(headers);
  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
  expect((await member()).nonce).toBe('1');
});

it('verifies the actual scoped key rather than accepting the root signature for a delegate', async () => {
  await grant();
  const { headers } = await login();
  const response = await publish(headers, root);
  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ code: 'SIGNATURE_INVALID' });
  expect((await member()).nonce).toBe('1');
});

it.each(['revoked', 'paused', 'expired', 'scope', 'guardian'] as const)(
  'denies publication after the native credential is %s without changing the nonce',
  async (state) => {
    await grant(state === 'expired' ? 4 : 600, state === 'scope' ? 'putdoc' : 'putjson');
    const { headers } = await login();
    if (state === 'revoked')
      await rootAction('delsession', encodeAction('delsession', { ...actor(), session_id: '1' }));
    if (state === 'paused')
      await f.call(
        'daclifycore',
        'guardpause',
        { dao_id: daoId, until: Math.floor(Date.now() / 1000) + 60, reason: 'ab'.repeat(32) },
        'alice',
      );
    if (state === 'guardian')
      await f.call('daclifycore', 'guardrevoke', { dao_id: daoId, member_id: '1' }, 'alice');
    if (state === 'expired') await new Promise((resolve) => setTimeout(resolve, 5100));
    const before = (await member()).nonce;
    const response = await publish(headers);
    expect(response.statusCode, response.body).toBeGreaterThanOrEqual(400);
    expect((await member()).nonce).toBe(before);
    expect(
      (
        await f.api.v1.chain.get_table_rows({
          code: 'daclifycore',
          scope: daoId,
          table: 'docheads',
          limit: 10,
        })
      ).rows,
    ).toHaveLength(0);
  },
);

it('runs the public publishing helper with root login and delegate publication in a mixed DAO', async () => {
  await createAgentDao(1);
  await f.call(
    'daclifycore',
    'enroll',
    {
      dao_id: daoId,
      member_id: '2',
      native_account: '',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      encryption_key: JSON.stringify(encryptionKey),
      custody: 0,
    },
    'alice',
  );
  await grant();
  const result = await publishAgent({
    api: apiOrigin,
    origin,
    dao: domain(),
    documentId: '1',
    documentVersion: 1,
    accountAuthentication: { signingKey: root.toString(), encryptionKey },
    scopedSigner: { signingKey: delegate.toString(), memberId: '1', sessionId: '1' },
    visibility: 'public',
    publicJson: { decision: 'Mixed DAO fixture' },
  });
  expect(result.memberId).toBe('1');
  expect((await member()).signing_key).toBe(root.toPublic().toString());
  expect(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: daoId,
        table: 'members',
        limit: 10,
      })
    ).rows,
  ).toHaveLength(2);
});

it('installs exact public packages and runs the protected CLI from a clean temporary directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daclify-agent-install-'));
  try {
    await grant();
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    for (const name of ['agent-publish.ts', 'agent-publish-config.ts'])
      await copyFile(resolve('examples', name), join(directory, name));
    const archive = resolve('.artifacts/daclify-core-protocol-0.14.0-alpha.8.tgz');
    await promisify(execFile)(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        archive,
        'tsx@4.23.15',
        '@wharfkit/antelope@4.0.2',
        'zod@4.6.5',
      ],
      { cwd: directory, timeout: 60000, maxBuffer: 1024 * 1024 },
    );
    await writeFile(
      join(directory, 'account.json'),
      JSON.stringify({ signingKey: root.toString(), encryptionKey }),
      { mode: 0o600 },
    );
    await writeFile(
      join(directory, 'delegate.json'),
      JSON.stringify({ signingKey: delegate.toString(), memberId: '1', sessionId: '1' }),
      { mode: 0o600 },
    );
    await writeFile(
      join(directory, 'public.json'),
      JSON.stringify({ decision: 'Disposable clean install fixture' }),
    );
    const env = {
      ...process.env,
      DACLIFY_AGENT_API: apiOrigin,
      DACLIFY_AGENT_ORIGIN: origin,
      DACLIFY_AGENT_CHAIN_ID: f.chainId,
      DACLIFY_AGENT_RUNTIME: 'daclifycore',
      DACLIFY_AGENT_DAO: daoId,
      DACLIFY_AGENT_DOCUMENT: '1',
      DACLIFY_AGENT_DOCUMENT_VERSION: '1',
      DACLIFY_AGENT_ACCOUNT_FILE: join(directory, 'account.json'),
      DACLIFY_AGENT_SIGNER_FILE: join(directory, 'delegate.json'),
      DACLIFY_AGENT_PUBLIC_JSON_FILE: join(directory, 'public.json'),
    };
    const result = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', 'agent-publish.ts'],
      { cwd: directory, env, timeout: 30000, maxBuffer: 65536 },
    );
    expect(AgentPublishResultSchema.parse(JSON.parse(result.stdout))).toMatchObject({
      dao: domain(),
      memberId: '1',
      documentId: '1',
    });
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain(root.toString());
    expect(result.stdout).not.toContain(delegate.toString());
    await chmod(join(directory, 'account.json'), 0o644);
    const refused = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', 'agent-publish.ts'],
      { cwd: directory, env, timeout: 30000, maxBuffer: 65536 },
    ).then(
      () => {
        throw new Error('FIXTURE_EXPECTED_REFUSAL');
      },
      (error) => {
        if (
          typeof error !== 'object' ||
          error === null ||
          !('stdout' in error) ||
          !('stderr' in error)
        )
          throw error;
        return { stdout: String(error.stdout), stderr: String(error.stderr) };
      },
    );
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain('Agent request failed');
    expect(refused.stderr).not.toContain(root.toString());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 90000);
