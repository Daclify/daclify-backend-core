import { createHash, randomBytes, generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { z } from 'zod';
import { Action, PrivateKey, Serializer, Transaction } from '@wharfkit/antelope';
import { privateKeyToAccount } from 'viem/accounts';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import { withTransaction } from '../../services/api/src/auth/account-session.js';
import { authenticate, createChallenge } from '../../services/api/src/auth.js';
import { NativeChallengeSchema } from '../../protocol/native-wallet.js';
import { EvmSignInChallengeSchema } from '../../protocol/evm-wallet.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { SessionSchema } from '../../protocol/api.js';
import { encodeAction, runtimeAbi } from '../../sdk/index.js';
import { ConnectedApps } from '../../services/api/src/connected-apps/service.js';
import { AppIssuerKeySchema } from '../../services/api/src/connected-apps/config.js';
import { ConnectedAppConfigSchema } from '../../protocol/connected-apps.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { actorFromVerifiedClaims } from '../../protocol/mini-app-database.js';
import { Store } from '../../examples/community-mini-app/store.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test database required');
const database = 'daclify_wallet_' + randomBytes(6).toString('hex') + '_test';
const target = new URL(url);
target.pathname = '/' + database;
const owner = new Pool({ connectionString: url }),
  pool = new Pool({ connectionString: target.toString() });
const chainId = 'ab'.repeat(32),
  origin = 'http://localhost:5178',
  runtime = 'daclifycore';
const native = PrivateKey.generate('K1'),
  root = PrivateKey.generate('K1');
const evm = privateKeyToAccount(
  '0x1717171717171717171717171717171717171717171717171717171717171717',
);
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryptionKey = EncryptionPublicKeySchema.parse({
  kty: jwk.kty,
  crv: jwk.crv,
  x: jwk.x,
  y: jwk.y,
});
let nativeAddress = 1;
let memberRoot = root,
  linkedNative = 'alice';
let daoPrivacy = 0;
let beforeMembershipRead: (() => Promise<void>) | undefined;
let bound = true,
  evmActive = true,
  chainMismatch = false,
  rpcUnavailable = false;
const member = (dao: string) => ({
  id: '1',
  native_account: dao === '1' && bound ? linkedNative : '',
  signing_key: memberRoot.toPublic().toString(),
  encryption_key: JSON.stringify(encryptionKey),
  custody: 0,
  nonce: '3',
  credits: '42',
  active: true,
  admin: true,
  reviewer: false,
  stake: '0',
  claim: '0',
  join_epoch: '1',
});
const dao = (id: string) => ({
  id,
  owner: 'operator',
  metadata: '{}',
  privacy: daoPrivacy,
  token_contract: 'eosio.token',
  token_symbol: '4,TLOS',
  available: '0',
  reserved: '0',
  claims: '0',
  key_epoch: '1',
  history_policy: 0,
  admin_count: 1,
  credit_supply: '42',
  staked: '0',
  eligible_credits: '42',
  eligible_stake: '0',
  member_count: '1',
  max_member: '1',
  active_ballots: 0,
});
let app: Awaited<ReturnType<typeof createServer>>;
let gateway: NativeChainGateway;
beforeAll(async () => {
  await owner.query(`CREATE DATABASE ${database}`);
  await migrate(pool);
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (rpcUnavailable) return Response.json({}, { status: 503 });
    const body = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));
    const path = String(input),
      time = new Date().toISOString().replace('Z', '');
    if (path.endsWith('get_info'))
      return Response.json({
        server_version: 'fixture',
        chain_id: chainMismatch ? 'cd'.repeat(32) : chainId,
        head_block_num: 10,
        last_irreversible_block_num: 8,
        last_irreversible_block_id: '00'.repeat(32),
        head_block_id: '00'.repeat(32),
        head_block_time: time,
        head_block_producer: 'producer',
        virtual_block_cpu_limit: 1000000,
        virtual_block_net_limit: 1000000,
        block_cpu_limit: 100000,
        block_net_limit: 100000,
      });
    if (path.endsWith('get_account'))
      return Response.json({
        account_name: body.account_name,
        head_block_num: 10,
        head_block_time: time,
        privileged: false,
        last_code_update: time,
        created: time,
        ram_quota: 100000,
        net_weight: 100000,
        cpu_weight: 100000,
        net_limit: { used: 0, available: 100000, max: 100000 },
        cpu_limit: { used: 0, available: 100000, max: 100000 },
        ram_usage: 0,
        permissions: [
          {
            perm_name: 'active',
            parent: 'owner',
            required_auth: {
              threshold: 1,
              keys: [{ key: native.toPublic().toString(), weight: 1 }],
              accounts: [],
              waits: [],
            },
          },
        ],
      });
    if (path.endsWith('get_abi')) return Response.json({ account_name: runtime, abi: runtimeAbi });
    if (!path.endsWith('get_table_rows')) throw new Error('Unexpected RPC fixture path');
    const pending = beforeMembershipRead;
    beforeMembershipRead = undefined;
    await pending?.();
    return Response.json({
      rows:
        body.table === 'daos'
          ? [dao('1'), dao('2')]
              .filter((row) => BigInt(row.id) >= BigInt(String(body.lower_bound ?? '0')))
              .slice(0, Number(body.limit ?? 100))
          : body.table === 'members'
            ? [member(String(body.scope))]
            : body.table === 'evmbindings' && body.scope === '1'
              ? [
                  {
                    member_id: '1',
                    chain_id: '41',
                    address: evm.address.slice(2).toLowerCase(),
                    epoch: '1',
                    active: evmActive,
                  },
                ]
              : [],
      more: false,
    });
  });
  gateway = new NativeChainGateway(
    {
      rpcUrl: 'http://127.0.0.1:19888',
      chainId,
      runtime,
      hub: null,
      environment: 'local',
      relayActor: 'relay',
      relayKey: PrivateKey.generate('K1'),
    },
    pool,
  );
  app = await createServer(pool, gateway, origin, { origins: ['http://localhost:5198'] });
});
beforeEach(() => {
  beforeMembershipRead = undefined;
  ++nativeAddress;
  bound = true;
  evmActive = true;
  chainMismatch = false;
  rpcUnavailable = false;
  memberRoot = root;
  linkedNative = 'alice';
  daoPrivacy = 0;
});
afterAll(async () => {
  await app?.close();
  await pool.end();
  await owner.query(`DROP DATABASE ${database}`);
  await owner.end();
  vi.unstubAllGlobals();
});
const cookies = (response: { cookies: { name: string; value: string }[] }) =>
  response.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
async function nativeAttempt(
  account = 'alice',
  signer = native,
  purpose: 'login' | 'signup' = 'login',
) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/account/native/challenge',
    remoteAddress: '127.0.1.' + nativeAddress,
    headers: { origin },
    payload: { purpose, account, permission: 'active' },
  });
  expect(response.statusCode).toBe(200);
  const challenge = NativeChallengeSchema.parse(response.json());
  const action = Action.from({
    account: runtime,
    name: 'authproof',
    authorization: [{ actor: account, permission: 'active' }],
    data: encodeAction('authproof', {
      account,
      intent: createHash('sha256').update(challenge.message).digest('hex'),
    }),
  });
  const transaction = Transaction.from({
    expiration: new Date(Date.now() + 60000),
    ref_block_num: 1,
    ref_block_prefix: 2,
    actions: [action],
  });
  return {
    method: 'POST' as const,
    url: purpose === 'signup' ? '/v1/sign-up/native' : '/v1/sign-in/native',
    remoteAddress: '127.0.1.' + nativeAddress,
    headers: { origin, cookie: cookies(response) },
    payload: {
      id: challenge.id,
      proof: {
        packedTransaction: Serializer.encode({ object: transaction }).hexString,
        signatures: [signer.signDigest(transaction.signingDigest(chainId)).toString()],
      },
    },
  };
}
async function nativeLogin() {
  return app.inject(await nativeAttempt());
}
it('recovers an existing admin into an empty database without claiming its signing/decryption keys or another DAO sharing those keys', async () => {
  expect((await pool.query('SELECT id FROM accounts')).rowCount).toBe(0);
  const logged = await nativeLogin();
  expect(logged.statusCode, logged.body).toBe(200);
  const session = SessionSchema.parse(logged.json());
  expect(session.account).toMatchObject({
    signingKey: null,
    encryptionKey: null,
    custody: 'user-controlled',
  });
  const result = await app.inject({
    method: 'GET',
    url: '/v1/me/memberships',
    headers: { cookie: cookies(logged) },
  });
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json()).toMatchObject({
    memberships: [{ dao: { daoId: '1' }, memberId: '1', admin: true, credits: '42', nonce: '3' }],
  });
  expect(
    z.object({ memberships: z.array(z.unknown()) }).parse(result.json()).memberships,
  ).toHaveLength(1);
  expect((await pool.query('SELECT * FROM memberships')).rowCount).toBe(0);
});
it('keeps the recovered service identity across concurrent valid logins and consumes each proof once', async () => {
  const requests = await Promise.all([nativeAttempt(), nativeAttempt()]);
  const results = await Promise.all(requests.map((request) => app.inject(request)));
  for (const result of results) expect(result.statusCode, result.body).toBe(200);
  expect(SessionSchema.parse(results[0]?.json()).account.id).toBe(
    SessionSchema.parse(results[1]?.json()).account.id,
  );
  const request = requests[0];
  if (!request) throw new Error('Missing fixture request');
  const replay = await app.inject(request);
  expect(replay.statusCode).toBe(401);
  expect((await pool.query('SELECT id FROM accounts')).rowCount).toBe(1);
});
it('fails closed for unknown wallets, invalid signatures, wrong chains and RPC failure', async () => {
  expect((await app.inject(await nativeAttempt('bob'))).statusCode).toBe(401);
  expect(
    (await app.inject(await nativeAttempt('alice', PrivateKey.generate('K1')))).statusCode,
  ).toBe(401);
  const mismatch = await nativeAttempt();
  chainMismatch = true;
  expect((await app.inject(mismatch)).statusCode).toBe(503);
  chainMismatch = false;
  const outage = await nativeAttempt();
  rpcUnavailable = true;
  expect((await app.inject(outage)).statusCode).toBe(503);
});
it('removes access after on-chain unlinking even while the session and database pairing survive', async () => {
  const logged = await nativeLogin();
  expect(logged.statusCode).toBe(200);
  bound = false;
  const result = await app.inject({
    method: 'GET',
    url: '/v1/me/memberships',
    headers: { cookie: cookies(logged) },
  });
  expect(result.json()).toEqual({ memberships: [] });
  expect((await nativeLogin()).statusCode).toBe(401);
  expect((await app.inject(await nativeAttempt('alice', native, 'signup'))).statusCode).toBe(401);
});
it('recovers a Telos EVM EOA only through its current on-chain binding', async () => {
  const challenge = await app.inject({
    method: 'POST',
    url: '/v1/account/evm/sign-in/challenge',
    headers: { origin },
    payload: { purpose: 'login', chainId: 41, address: evm.address },
  });
  const parsed = EvmSignInChallengeSchema.parse(challenge.json());
  const logged = await app.inject({
    method: 'POST',
    url: '/v1/sign-in/evm',
    headers: { origin, cookie: cookies(challenge) },
    payload: { id: parsed.id, signature: await evm.signMessage({ message: parsed.message }) },
  });
  expect(logged.statusCode, logged.body).toBe(200);
  expect(SessionSchema.parse(logged.json()).account.signingKey).toBeNull();
  expect(
    (
      await app.inject({
        method: 'GET',
        url: '/v1/me/memberships',
        headers: { cookie: cookies(logged) },
      })
    ).json(),
  ).toMatchObject({ memberships: [{ dao: { daoId: '1' }, memberId: '1' }] });
  evmActive = false;
  expect(
    (
      await app.inject({
        method: 'GET',
        url: '/v1/me/memberships',
        headers: { cookie: cookies(logged) },
      })
    ).json(),
  ).toEqual({ memberships: [] });
});
it('still reconstructs root membership independently when the original vault keys survive', async () => {
  const challenge = await createChallenge(
    pool,
    { signingKey: root.toPublic().toString(), encryptionKey },
    origin,
  );
  const logged = await authenticate(
    pool,
    challenge.id,
    root.signMessage(new TextEncoder().encode(challenge.message)).toString(),
    encryptionKey,
  );
  expect(logged.account.signingKey).toBe(root.toPublic().toString());
  const memberships = await app.inject({
    method: 'GET',
    url: '/v1/me/memberships',
    headers: { cookie: 'daclify_session=' + logged.token },
  });
  expect(memberships.statusCode, memberships.body).toBe(200);
  expect(
    z.object({ memberships: z.array(z.unknown()) }).parse(memberships.json()).memberships,
  ).toHaveLength(2);
});
it('rejects removal of the last wallet control credential without revoking the working session', async () => {
  const logged = await nativeLogin();
  expect(logged.statusCode).toBe(200);
  const session = SessionSchema.parse(logged.json()),
    payload = { chainId },
    path = '/v1/account/native/unlink';
  const headers = { origin, cookie: cookies(logged), 'x-csrf-token': session.csrfToken };
  const intentResponse = await app.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers,
    payload: { path, bodyHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex') },
  });
  expect(intentResponse.statusCode, intentResponse.body).toBe(200);
  const intent = z.object({ id: z.uuid(), message: z.string() }).parse(intentResponse.json());
  const action = Action.from({
    account: runtime,
    name: 'authproof',
    authorization: [{ actor: 'alice', permission: 'active' }],
    data: encodeAction('authproof', {
      account: 'alice',
      intent: createHash('sha256').update(intent.message).digest('hex'),
    }),
  });
  const transaction = Transaction.from({
    expiration: new Date(Date.now() + 60000),
    ref_block_num: 1,
    ref_block_prefix: 2,
    actions: [action],
  });
  const result = await app.inject({
    method: 'POST',
    url: path,
    headers: {
      ...headers,
      'x-account-intent-id': intent.id,
      'x-account-proof': JSON.stringify({
        kind: 'native',
        chainId,
        account: 'alice',
        proof: {
          packedTransaction: Serializer.encode({ object: transaction }).hexString,
          signatures: [native.signDigest(transaction.signingDigest(chainId)).toString()],
        },
      }),
    },
    payload,
  });
  expect(result.statusCode, result.body).toBe(409);
  expect(result.json()).toMatchObject({ code: 'LAST_CONTROL_CREDENTIAL' });
  expect(
    (await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookies(logged) } }))
      .statusCode,
  ).toBe(200);
});
it('requires fresh wallet and incoming key proofs to attach vault keys to the recovered profile', async () => {
  const logged = await nativeLogin();
  expect(logged.statusCode).toBe(200);
  const session = SessionSchema.parse(logged.json());
  const signing = PrivateKey.generate('K1');
  const headers = { origin, cookie: cookies(logged), 'x-csrf-token': session.csrfToken };
  const started = await app.inject({
    method: 'POST',
    url: '/v1/account/vault/challenge',
    headers,
    payload: { signingKey: signing.toPublic().toString(), encryptionKey },
  });
  expect(started.statusCode, started.body).toBe(200);
  const intent = z.object({ id: z.uuid(), message: z.string() }).parse(started.json());
  const payload = {
    id: intent.id,
    signature: signing.signMessage(new TextEncoder().encode(intent.message)).toString(),
  };
  expect(
    (await app.inject({ method: 'POST', url: '/v1/account/vault', headers, payload })).statusCode,
  ).toBe(403);
  const controlled = await app.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers,
    payload: {
      path: '/v1/account/vault',
      bodyHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    },
  });
  const control = z.object({ id: z.uuid(), message: z.string() }).parse(controlled.json());
  const action = Action.from({
    account: runtime,
    name: 'authproof',
    authorization: [{ actor: 'alice', permission: 'active' }],
    data: encodeAction('authproof', {
      account: 'alice',
      intent: createHash('sha256').update(control.message).digest('hex'),
    }),
  });
  const transaction = Transaction.from({
    expiration: new Date(Date.now() + 60000),
    ref_block_num: 1,
    ref_block_prefix: 2,
    actions: [action],
  });
  const attached = await app.inject({
    method: 'POST',
    url: '/v1/account/vault',
    headers: {
      ...headers,
      'x-account-intent-id': control.id,
      'x-account-proof': JSON.stringify({
        kind: 'native',
        chainId,
        account: 'alice',
        proof: {
          packedTransaction: Serializer.encode({ object: transaction }).hexString,
          signatures: [native.signDigest(transaction.signingDigest(chainId)).toString()],
        },
      }),
    },
    payload,
  });
  expect(attached.statusCode, attached.body).toBe(200);
  const upgraded = SessionSchema.parse(attached.json());
  const reopened = await app.inject(await nativeAttempt('alice', native, 'signup'));
  expect(reopened.statusCode, reopened.body).toBe(200);
  expect(SessionSchema.parse(reopened.json()).account).toEqual(upgraded.account);
  expect(upgraded.account).toMatchObject({
    id: session.account.id,
    signingKey: signing.toPublic().toString(),
    encryptionKey,
  });
  expect(
    (
      await app.inject({
        method: 'GET',
        url: '/v1/me/memberships',
        headers: { cookie: cookies(attached) },
      })
    ).json(),
  ).toMatchObject({ memberships: [{ dao: { daoId: '1' }, memberId: '1', admin: true }] });
  expect(
    (
      await pool.query('SELECT account_id FROM native_links WHERE account_id=$1', [
        session.account.id,
      ])
    ).rowCount,
  ).toBe(1);
});

it.each(['native', 'evm'] as const)(
  'rejects a %s login proof completed from a different allowed frontend origin',
  async (kind) => {
    if (kind === 'native') {
      const request = await nativeAttempt();
      request.headers.origin = 'http://localhost:5198';
      expect((await app.inject(request)).statusCode).toBe(401);
    } else {
      const started = await app.inject({
        method: 'POST',
        url: '/v1/account/evm/sign-in/challenge',
        headers: { origin },
        payload: { purpose: 'login', chainId: 41, address: evm.address },
      });
      const challenge = EvmSignInChallengeSchema.parse(started.json());
      const result = await app.inject({
        method: 'POST',
        url: '/v1/sign-in/evm',
        headers: { origin: 'http://localhost:5198', cookie: cookies(started) },
        payload: {
          id: challenge.id,
          signature: await evm.signMessage({ message: challenge.message }),
        },
      });
      expect(result.statusCode).toBe(401);
    }
  },
);

it('serializes concurrent removal of different last control methods at the database boundary', async () => {
  const row = (
    await pool.query<{ account_id: string }>(
      'SELECT account_id FROM evm_links WHERE chain_id=41 AND address=$1',
      [evm.address.toLowerCase()],
    )
  ).rows[0];
  if (!row) throw new Error('Missing recovered EVM fixture');
  await pool.query(
    "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,'bob','active')",
    [row.account_id, chainId],
  );
  const outcomes = await Promise.allSettled([
    withTransaction(pool, (client) =>
      client.query('DELETE FROM native_links WHERE account_id=$1', [row.account_id]),
    ),
    withTransaction(pool, (client) =>
      client.query('DELETE FROM evm_links WHERE account_id=$1', [row.account_id]),
    ),
  ]);
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  const failure = outcomes.find((outcome) => outcome.status === 'rejected');
  expect(failure).toMatchObject({
    status: 'rejected',
    reason: { code: 'LAST_CONTROL_CREDENTIAL' },
  });
  const count = (
    await pool.query<{ count: string }>(
      'SELECT ((SELECT count(*) FROM native_links WHERE account_id=$1)+(SELECT count(*) FROM evm_links WHERE account_id=$1))::text AS count',
      [row.account_id],
    )
  ).rows[0];
  expect(count?.count).toBe('1');
});
it('invalidates restored sessions and pending login proofs while retaining account and provider pairing records', async () => {
  const logged = await nativeLogin();
  expect(logged.statusCode).toBe(200);
  const current = SessionSchema.parse(logged.json()).account;
  await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
    'email:restore-fixture@example.test',
    current.id,
  ]);
  const pending = await nativeAttempt();
  const { readFile } = await import('node:fs/promises');
  await pool.query(await readFile('tools/recovery/revoke-restored-sessions.sql', 'utf8'));
  expect(
    (await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookies(logged) } }))
      .statusCode,
  ).toBe(401);
  expect((await app.inject(pending)).statusCode).toBe(401);
  expect(
    (
      await pool.query('SELECT account_id FROM credentials WHERE provider_key=$1', [
        'email:restore-fixture@example.test',
      ])
    ).rows[0],
  ).toEqual({ account_id: current.id });
  expect(SessionSchema.parse((await nativeLogin()).json()).account.id).toBe(current.id);
});
it('provisions a new native holder without membership and reopens the same wallet-only account on later login', async () => {
  const request = await nativeAttempt('newvoter', native, 'signup');
  const response = await app.inject(request);
  expect(response.statusCode, response.body).toBe(200);
  const created = SessionSchema.parse(response.json()).account;
  expect(created).toMatchObject({ signingKey: null, encryptionKey: null, walletOrigin: 'signup' });
  const logged = await app.inject(await nativeAttempt('newvoter'));
  expect(logged.statusCode, logged.body).toBe(200);
  expect(SessionSchema.parse(logged.json()).account.id).toBe(created.id);
  expect((await app.inject(request)).statusCode).toBe(401);
});
it('serializes concurrent native signup and refuses signup proofs used as login', async () => {
  const requests = await Promise.all([
    nativeAttempt('another', native, 'signup'),
    nativeAttempt('another', native, 'signup'),
  ]);
  const responses = await Promise.all(requests.map((request) => app.inject(request)));
  for (const response of responses) expect(response.statusCode, response.body).toBe(200);
  expect(SessionSchema.parse(responses[0]?.json()).account.id).toBe(
    SessionSchema.parse(responses[1]?.json()).account.id,
  );
  const swapped = await nativeAttempt('outsider', native, 'signup');
  expect((await app.inject({ ...swapped, url: '/v1/sign-in/native' })).statusCode).toBe(401);
  expect(
    (await pool.query("SELECT 1 FROM native_links WHERE native_account='outsider'")).rowCount,
  ).toBe(0);
});

it('does not provision accounts for forged or changed-origin native signup proofs', async () => {
  const before = (await pool.query('SELECT count(*) FROM accounts')).rows[0];
  const forged = await nativeAttempt('forgednew', PrivateKey.generate('K1'), 'signup');
  expect((await app.inject(forged)).statusCode).toBe(401);
  const moved = await nativeAttempt('movednew', native, 'signup');
  moved.headers.origin = 'http://localhost:5198';
  expect((await app.inject(moved)).statusCode).toBe(401);
  expect((await pool.query('SELECT count(*) FROM accounts')).rows[0]).toEqual(before);
  await migrate(pool);
  expect((await app.inject(await nativeAttempt('newvoter'))).statusCode).toBe(200);
});

async function reconnectionFixture(name: string) {
  const logged = await app.inject(await nativeAttempt(name, native, 'signup'));
  expect(logged.statusCode, logged.body).toBe(200);
  const current = SessionSchema.parse(logged.json());
  memberRoot = PrivateKey.generate('K1');
  linkedNative = name;
  const challenge = await createChallenge(
    pool,
    { signingKey: memberRoot.toPublic().toString(), encryptionKey },
    origin,
  );
  const original = await authenticate(
    pool,
    challenge.id,
    memberRoot.signMessage(new TextEncoder().encode(challenge.message)).toString(),
    encryptionKey,
  );
  const headers = { origin, cookie: cookies(logged), 'x-csrf-token': current.csrfToken };
  const started = await app.inject({
    method: 'POST',
    url: '/v1/account/reconnect/challenge',
    headers,
    payload: { signingKey: memberRoot.toPublic().toString(), encryptionKey },
  });
  expect(started.statusCode, started.body).toBe(200);
  const intent = z.object({ id: z.uuid(), message: z.string() }).parse(started.json());
  const payload = {
    id: intent.id,
    signature: memberRoot.signMessage(new TextEncoder().encode(intent.message)).toString(),
  };
  async function request(signature = payload.signature, requestOrigin = origin) {
    const body = { ...payload, signature };
    const controlled = await app.inject({
      method: 'POST',
      url: '/v1/account/control',
      headers,
      payload: {
        path: '/v1/account/reconnect',
        bodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      },
    });
    expect(controlled.statusCode, controlled.body).toBe(200);
    const control = z.object({ id: z.uuid(), message: z.string() }).parse(controlled.json());
    const action = Action.from({
      account: runtime,
      name: 'authproof',
      authorization: [{ actor: name, permission: 'active' }],
      data: encodeAction('authproof', {
        account: name,
        intent: createHash('sha256').update(control.message).digest('hex'),
      }),
    });
    const transaction = Transaction.from({
      expiration: new Date(Date.now() + 60000),
      ref_block_num: 1,
      ref_block_prefix: 2,
      actions: [action],
    });
    return {
      method: 'POST' as const,
      url: '/v1/account/reconnect',
      headers: {
        ...headers,
        origin: requestOrigin,
        'x-account-intent-id': control.id,
        'x-account-proof': JSON.stringify({
          kind: 'native',
          chainId,
          account: name,
          proof: {
            packedTransaction: Serializer.encode({ object: transaction }).hexString,
            signatures: [native.signDigest(transaction.signingDigest(chainId)).toString()],
          },
        }),
      },
      payload: body,
    };
  }
  return { current, original, logged, headers, payload, request };
}

async function restoredReconnectRequest(
  f: Awaited<ReturnType<typeof reconnectionFixture>>,
  name: string,
  signer = native,
  rootSigner = memberRoot,
) {
  const headers = {
    origin,
    cookie: 'daclify_session=' + f.original.token,
    'x-csrf-token': f.original.csrfToken,
  };
  const started = await app.inject({
    method: 'POST',
    url: '/v1/account/native/challenge',
    headers,
    remoteAddress: '127.0.1.' + nativeAddress,
    payload: { purpose: 'pair', account: name, permission: 'active' },
  });
  expect(started.statusCode, started.body).toBe(200);
  const challenge = NativeChallengeSchema.parse(started.json());
  const transaction = Transaction.from({
    expiration: new Date(Date.now() + 60000),
    ref_block_num: 1,
    ref_block_prefix: 2,
    actions: [
      Action.from({
        account: runtime,
        name: 'authproof',
        authorization: [{ actor: name, permission: 'active' }],
        data: encodeAction('authproof', {
          account: name,
          intent: createHash('sha256').update(challenge.message).digest('hex'),
        }),
      }),
    ],
  });
  const payload = {
    id: challenge.id,
    proof: {
      packedTransaction: Serializer.encode({ object: transaction }).hexString,
      signatures: [signer.signDigest(transaction.signingDigest(chainId)).toString()],
    },
  };
  const controlled = await app.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers,
    payload: {
      path: '/v1/account/reconnect/native',
      bodyHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    },
  });
  expect(controlled.statusCode, controlled.body).toBe(200);
  const control = z.object({ id: z.uuid(), message: z.string() }).parse(controlled.json());
  return {
    method: 'POST' as const,
    url: '/v1/account/reconnect/native',
    payload,
    headers: {
      ...headers,
      cookie: headers.cookie + '; ' + cookies(started),
      'x-account-intent-id': control.id,
      'x-account-proof': JSON.stringify({
        kind: 'root',
        signature: rootSigner.signMessage(new TextEncoder().encode(control.message)).toString(),
      }),
    },
  };
}

it('reconnects existing sign-ins from the restored account and retains its newly paired methods', async () => {
  const f = await reconnectionFixture('restoredpair');
  await pool.query(
    'INSERT INTO credentials(provider_key,account_id) VALUES($1,$3),($2,$3),($4,$5)',
    [
      'email:old-restored@example.test',
      'telegram:restored-fixture',
      f.current.account.id,
      'email:new-restored@example.test',
      f.original.account.id,
    ],
  );
  await pool.query(
    'INSERT INTO passkeys(credential_id,account_id,public_key,sign_count) VALUES($1,$2,$3,17)',
    [randomBytes(32), f.current.account.id, randomBytes(96)],
  );
  await pool.query(
    'INSERT INTO passkeys(credential_id,account_id,public_key,sign_count) VALUES($1,$2,$3,23)',
    [randomBytes(32), f.original.account.id, randomBytes(96)],
  );
  const newAddress = '0x' + '43'.repeat(20);
  await pool.query(
    'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,41,$2,now())',
    [f.original.account.id, newAddress],
  );
  const request = await restoredReconnectRequest(f, 'restoredpair');
  const response = await app.inject(request);
  expect(response.statusCode, response.body).toBe(200);
  expect(SessionSchema.parse(response.json()).account).toEqual(f.original.account);
  expect(
    (
      await pool.query('SELECT account_id FROM credentials WHERE provider_key LIKE $1', [
        '%restored%',
      ])
    ).rows.every((row) => row.account_id === f.original.account.id),
  ).toBe(true);
  expect(
    (
      await pool.query('SELECT sign_count FROM passkeys WHERE account_id=$1 ORDER BY sign_count', [
        f.original.account.id,
      ])
    ).rows,
  ).toEqual([{ sign_count: '17' }, { sign_count: '23' }]);
  expect(
    (await pool.query('SELECT account_id FROM evm_links WHERE address=$1', [newAddress])).rows[0]
      ?.account_id,
  ).toBe(f.original.account.id);
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0]?.merged_into,
  ).toBe(f.original.account.id);
  expect((await app.inject(request)).statusCode).toBe(401);
});

it.each(['wallet', 'root', 'missing', 'non-root', 'origin'] as const)(
  'keeps both profiles intact when the restored reconnection %s proof is invalid',
  async (fault) => {
    const name = 'rejectpair';
    const f = await reconnectionFixture(name);
    const forged = PrivateKey.generate('K1');
    const request = await restoredReconnectRequest(
      f,
      name,
      fault === 'wallet' ? forged : native,
      fault === 'root' ? forged : memberRoot,
    );
    if (fault === 'missing') request.headers['x-account-proof'] = '';
    if (fault === 'non-root')
      request.headers['x-account-proof'] = JSON.stringify({
        kind: 'evm',
        chainId: 41,
        address: evm.address,
        signature: await evm.signMessage({ message: 'irrelevant' }),
      });
    if (fault === 'origin') request.headers.origin = 'http://localhost:5198';
    const result = await app.inject(request);
    expect([401, 403]).toContain(result.statusCode);
    expect(
      (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
        .rows[0]?.merged_into,
    ).toBeNull();
    expect(
      (await pool.query('SELECT account_id FROM native_links WHERE native_account=$1', [name]))
        .rows[0]?.account_id,
    ).toBe(f.current.account.id);
  },
);

it('refuses to reconnect a wallet whose profile has a separate registered identity', async () => {
  const f = await reconnectionFixture('registered');
  const request = await restoredReconnectRequest(f, 'registered');
  await pool.query('UPDATE accounts SET signing_key=$2,encryption_key=$3 WHERE id=$1', [
    f.current.account.id,
    PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey,
  ]);
  const result = await app.inject(request);
  expect(result.statusCode, result.body).toBe(409);
  expect(result.json()).toMatchObject({ code: 'ACCOUNT_RECONNECT_REGISTERED' });
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0]?.merged_into,
  ).toBeNull();
});

it('does not reconnect profiles during an ordinary native pairing request', async () => {
  const f = await reconnectionFixture('ordinarypair');
  const request = await restoredReconnectRequest(f, 'ordinarypair');
  request.url = '/v1/account/native/link';
  const controlled = await app.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers: request.headers,
    payload: {
      path: request.url,
      bodyHash: createHash('sha256').update(JSON.stringify(request.payload)).digest('hex'),
    },
  });
  const control = z.object({ id: z.uuid(), message: z.string() }).parse(controlled.json());
  request.headers['x-account-intent-id'] = control.id;
  request.headers['x-account-proof'] = JSON.stringify({
    kind: 'root',
    signature: memberRoot.signMessage(new TextEncoder().encode(control.message)).toString(),
  });
  const result = await app.inject(request);
  expect(result.statusCode, result.body).toBe(409);
  expect(result.json()).toMatchObject({ code: 'NATIVE_LINKED' });
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0]?.merged_into,
  ).toBeNull();
});

it('rechecks wallet ownership if the native pairing changes after proof verification', async () => {
  const f = await reconnectionFixture('changedpair');
  const request = await restoredReconnectRequest(f, 'changedpair');
  beforeMembershipRead = async () => {
    await pool.query('UPDATE native_links SET native_account=$2 WHERE account_id=$1', [
      f.current.account.id,
      'replacement',
    ]);
  };
  const result = await app.inject(request);
  expect(result.statusCode, result.body).toBe(409);
  expect(result.json()).toMatchObject({ code: 'ACCOUNT_RECONNECT_CHANGED' });
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0]?.merged_into,
  ).toBeNull();
});

it('reconnects proved wallet sign-ins to the original account and preserves immutable history', async () => {
  const f = await reconnectionFixture('recoverpair');
  await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
    'email:reconnect@example.test',
    f.current.account.id,
  ]);
  const credential = randomBytes(32),
    publicKey = randomBytes(96);
  await pool.query(
    'INSERT INTO passkeys(credential_id,account_id,public_key,sign_count) VALUES($1,$2,$3,17)',
    [credential, f.current.account.id, publicKey],
  );
  await pool.query(
    "INSERT INTO service_payments(checkout_id,account_id,price_id,status,payment_status,currency,amount_minor) VALUES('cs_reconnect',$1,'price_fixture','paid','paid','usd',1234)",
    [f.current.account.id],
  );
  const pendingVault = await createChallenge(
    pool,
    { signingKey: memberRoot.toPublic().toString(), encryptionKey },
    origin,
  );
  const pendingSignature = memberRoot
    .signMessage(new TextEncoder().encode(pendingVault.message))
    .toString();
  const result = await app.inject(await f.request());
  expect(result.statusCode, result.body).toBe(200);
  await expect(
    authenticate(pool, pendingVault.id, pendingSignature, encryptionKey),
  ).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  const restored = SessionSchema.parse(result.json());
  expect(restored.account).toEqual(f.original.account);
  expect(
    (
      await pool.query('SELECT account_id FROM credentials WHERE provider_key=$1', [
        'email:reconnect@example.test',
      ])
    ).rows[0],
  ).toEqual({ account_id: f.original.account.id });
  expect(
    (
      await pool.query('SELECT account_id,sign_count::text FROM passkeys WHERE credential_id=$1', [
        credential,
      ])
    ).rows[0],
  ).toEqual({ account_id: f.original.account.id, sign_count: '17' });
  expect(
    (await pool.query("SELECT account_id FROM service_payments WHERE checkout_id='cs_reconnect'"))
      .rows[0],
  ).toEqual({ account_id: f.current.account.id });
  const { PostgresServicePayments } = await import('../../services/api/src/billing/settle.js');
  expect(await new PostgresServicePayments(pool).receipts(f.original.account.id)).toContainEqual({
    status: 'paid',
    currency: 'usd',
    amountMinor: 1234,
    paymentStatus: 'paid',
  });
  expect(
    (await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookies(f.logged) } }))
      .statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { cookie: 'daclify_session=' + f.original.token },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    SessionSchema.parse((await app.inject(await nativeAttempt('recoverpair'))).json()).account,
  ).toEqual(f.original.account);
  const memberships = await app.inject({
    method: 'GET',
    url: '/v1/me/memberships',
    headers: { cookie: cookies(result) },
  });
  expect(memberships.statusCode, memberships.body).toBe(200);
  expect(
    z.object({ memberships: z.array(z.unknown()) }).parse(memberships.json()).memberships,
  ).toHaveLength(1);
  expect(memberships.json()).toMatchObject({
    memberships: [{ dao: { daoId: '1' }, memberId: '1', admin: true }],
  });
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/account/reconnect',
        headers: f.headers,
        payload: f.payload,
      })
    ).statusCode,
  ).toBe(401);
});

it('requires separate wallet control and recovered-account proof and rolls back conflicting wallets', async () => {
  const f = await reconnectionFixture('badrecover');
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/account/reconnect',
        headers: f.headers,
        payload: f.payload,
      })
    ).statusCode,
  ).toBe(403);
  const forged = PrivateKey.generate('K1')
    .signMessage(new TextEncoder().encode('different-intent'))
    .toString();
  expect((await app.inject(await f.request(forged))).statusCode).toBe(401);
  expect(
    (
      await pool.query('SELECT account_id FROM native_links WHERE native_account=$1', [
        'badrecover',
      ])
    ).rows[0],
  ).toEqual({ account_id: f.current.account.id });
  expect((await app.inject(await f.request())).statusCode).toBe(401);
  const next = await reconnectionFixture('clashrecover');
  await pool.query(
    "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,'othervault','active')",
    [next.original.account.id, chainId],
  );
  const rejected = await app.inject(await next.request());
  expect(rejected.statusCode, rejected.body).toBe(409);
  expect(rejected.json()).toMatchObject({ code: 'ACCOUNT_RECONNECT_CONFLICT' });
  expect(
    (await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: cookies(next.logged) } }))
      .statusCode,
  ).toBe(200);
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [next.current.account.id]))
      .rows[0],
  ).toEqual({ merged_into: null });
});

it('rejects changed origin and substituted encryption identity without altering either account', async () => {
  const f = await reconnectionFixture('originrecov');
  const moved = await app.inject(await f.request(f.payload.signature, 'http://localhost:5198'));
  expect(moved.statusCode, moved.body).toBe(403);
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const substituted = await app.inject({
    method: 'POST',
    url: '/v1/account/reconnect/challenge',
    headers: f.headers,
    payload: {
      signingKey: memberRoot.toPublic().toString(),
      encryptionKey: { kty: other.kty, crv: other.crv, x: other.x, y: other.y },
    },
  });
  expect(substituted.statusCode, substituted.body).toBe(409);
  expect(substituted.json()).toMatchObject({ code: 'ACCOUNT_RECONNECT_IDENTITY' });
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0],
  ).toEqual({ merged_into: null });
});

it('consumes concurrent reconciliation once and makes retired ownership one-way', async () => {
  const f = await reconnectionFixture('racerecover');
  const requests = await Promise.all([f.request(), f.request()]);
  const results = await Promise.all(requests.map((request) => app.inject(request)));
  expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
  expect(results.filter((r) => [401, 403, 409].includes(r.statusCode))).toHaveLength(1);
  const { ownsAccount } = await import('../../services/api/src/auth/account-ownership.js');
  expect(await ownsAccount(pool, f.original.account.id, f.current.account.id)).toBe(true);
  expect(await ownsAccount(pool, f.current.account.id, f.original.account.id)).toBe(false);
  expect(await ownsAccount(pool, f.current.account.id, f.current.account.id)).toBe(false);
  expect(
    (await pool.query('SELECT account_scope($1) AS id', [f.original.account.id])).rows
      .map((r: { id: string }) => r.id)
      .sort(),
  ).toEqual([f.current.account.id, f.original.account.id].sort());
  await expect(
    pool.query('UPDATE accounts SET merged_into=NULL WHERE id=$1', [f.current.account.id]),
  ).rejects.toMatchObject({ constraint: 'retired_account_immutable' });
  await expect(
    pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
      'email:retired@example.test',
      f.current.account.id,
    ]),
  ).rejects.toMatchObject({ constraint: 'retired_account_credential' });
  const { openAccountSession } = await import('../../services/api/src/auth/account-session.js');
  await expect(openAccountSession(pool, f.current.account.id)).rejects.toMatchObject({
    code: 'AUTH_REQUIRED',
  });
});

it('reads private-access history policy from the actual DAO record', async () => {
  const result = await app.inject({ method: 'GET', url: '/v1/daos/1/private-access' });
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json()).toEqual({
    dao: { chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    privacy: 'public',
    historyPolicy: 'full-history',
    keyEpoch: '1',
  });
});

it('preserves historical custody restrictions when reconnecting a private DAO wallet', async () => {
  const f = await reconnectionFixture('custodyrecov');
  daoPrivacy = 2;
  await pool.query('INSERT INTO vault_recovery_state(account_id,assisted_ever) VALUES($1,true)', [
    f.original.account.id,
  ]);
  const result = await app.inject(await f.request());
  expect(result.statusCode, result.body).toBe(403);
  expect(result.json()).toMatchObject({ code: 'CUSTODY_POLICY' });
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0],
  ).toEqual({ merged_into: null });
});

it('refuses reconciliation that would exceed the account passkey limit', async () => {
  const f = await reconnectionFixture('passkeyrecov');
  for (const id of [f.current.account.id, f.original.account.id]) {
    for (let i = 0; i < 5; i++)
      await pool.query(
        'INSERT INTO passkeys(credential_id,account_id,public_key,sign_count) VALUES($1,$2,$3,0)',
        [randomBytes(32), id, randomBytes(96)],
      );
  }
  const result = await app.inject(await f.request());
  expect(result.statusCode, result.body).toBe(409);
  expect(result.json()).toMatchObject({ code: 'ACCOUNT_RECONNECT_CONFLICT' });
  expect(
    (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
      .rows[0],
  ).toEqual({ merged_into: null });
});

it('preserves a registered canonical identity while historical owners reference it', async () => {
  const f = await reconnectionFixture('aliasrecov');
  expect((await app.inject(await f.request())).statusCode).toBe(200);
  await expect(
    pool.query('UPDATE accounts SET signing_key=NULL,encryption_key=NULL WHERE id=$1', [
      f.original.account.id,
    ]),
  ).rejects.toMatchObject({ constraint: 'account_reconnect_canonical' });
});

let miniAppId = 1000;
async function reconnectMiniApp(f: Awaited<ReturnType<typeof reconnectionFixture>>) {
  // Each case replaces the fixture's native member root; discard earlier cases' projections.
  await pool.query('DELETE FROM memberships WHERE chain_id=$1 AND contract=$2', [chainId, runtime]);
  const registrations: z.infer<typeof RuntimeTableSchemas.appregs>[] = [];
  const service = await ConnectedApps.create(
    pool,
    {
      ...gateway.connectedApps,
      registry: async () => registrations,
      membership: async (account, daoId) =>
        (await gateway.memberships(account)).find((member) => member.dao.daoId === daoId) ?? null,
    },
    {
      issuer: 'https://api.example',
      frontendOrigin: 'https://daclify.example',
      signingKey: AppIssuerKeySchema.parse({
        ...generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
          format: 'jwk',
        }),
        kid: 'mini-app-reconnect-fixture',
      }),
    },
  );
  const config = ConnectedAppConfigSchema.parse({
    dao: { chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    appId: String(++miniAppId),
    revision: '1',
    name: 'Reconnection fixture',
    origins: ['https://app.example'],
    redirectUris: ['https://app.example/callback'],
    sourceApiBase: 'https://app.example',
    activityAccount: 'activity',
    enabled: true,
  });
  const staged = await service.stage(f.current.account, config);
  registrations.push(
    RuntimeTableSchemas.appregs.parse({
      id: config.appId,
      target: 'activity',
      revision: '1',
      config_hash: staged.configHash,
      enabled: true,
      security_epoch: '1',
    }),
  );
  return {
    service,
    staged,
    binding: {
      schemaVersion: 1 as const,
      chainId,
      runtime,
      daoId: '1',
      appId: config.appId,
      issuer: 'https://api.example',
      clientId: staged.clientId,
    },
  };
}

it.each(['wallet', 'restored'] as const)(
  'preserves mini-app subject and native history but requires fresh consent after %s reconnection',
  async (direction) => {
    const name = direction === 'wallet' ? 'miniwallet' : 'minirestored';
    const f = await reconnectionFixture(name);
    const { service, staged, binding } = await reconnectMiniApp(f);
    const access = await service.sourceAccess(f.current.account, staged.clientId);
    const originalClaims = (await service.access(access.accessToken)).claims;
    const actor = actorFromVerifiedClaims(binding, originalClaims, binding);
    const db = new Store(':memory:', binding);
    try {
      const intent = db.complete('chillies', actor);
      const targetToken = randomBytes(32).toString('base64url');
      await pool.query(
        "INSERT INTO connected_app_tokens(token_hash,client_id,account_id,revision,expires_at) VALUES($1,$2,$3,1,now()+interval '5 minutes')",
        [createHash('sha256').update(targetToken).digest(), staged.clientId, f.original.account.id],
      );
      for (const account of [f.current.account, f.original.account]) {
        await pool.query(
          "INSERT INTO connected_app_refresh_families(id,client_id,account_id,revision,nonce,expires_at) VALUES($1,$2,$3,1,'fixture-reconnect',now()+interval '1 hour')",
          [randomUUID(), staged.clientId, account.id],
        );
      }
      const request =
        direction === 'wallet' ? await f.request() : await restoredReconnectRequest(f, name);
      const response = await app.inject(request);
      expect(response.statusCode, response.body).toBe(200);
      expect(SessionSchema.parse(response.json()).account.id).toBe(f.original.account.id);
      for (const token of [access.accessToken, targetToken])
        await expect(service.access(token)).rejects.toMatchObject({ code: 'APP_TOKEN_REQUIRED' });
      expect(
        (
          await pool.query(
            'SELECT revoked_at IS NOT NULL AS revoked FROM connected_app_refresh_families WHERE client_id=$1',
            [staged.clientId],
          )
        ).rows,
      ).toEqual([{ revoked: true }, { revoked: true }]);
      const fresh = await service.sourceAccess(f.original.account, staged.clientId);
      const claims = (await service.access(fresh.accessToken)).claims;
      expect({ subject: claims.sub, dao: claims.dao, memberId: claims.memberId }).toEqual({
        subject: originalClaims.sub,
        dao: originalClaims.dao,
        memberId: originalClaims.memberId,
      });
      const restoredActor = actorFromVerifiedClaims(binding, claims, binding);
      expect(db.pending(restoredActor)).toEqual([intent]);
      expect(() => db.pending({ ...restoredActor, subject: randomUUID() })).toThrow(
        'APP_ACTOR_CHANGED',
      );
    } finally {
      db.close();
    }
  },
);

it.each(['wallet', 'restored'] as const)(
  'rejects two existing same-client subjects without moving history during %s reconnection',
  async (direction) => {
    const name = direction === 'wallet' ? 'clashwallet' : 'clashrestore';
    const f = await reconnectionFixture(name);
    const { service, staged } = await reconnectMiniApp(f);
    const tokens = await Promise.all([
      service.sourceAccess(f.current.account, staged.clientId),
      service.sourceAccess(f.original.account, staged.clientId),
    ]);
    const before = (
      await pool.query(
        'SELECT account_id,subject FROM connected_app_subjects WHERE client_id=$1 ORDER BY account_id',
        [staged.clientId],
      )
    ).rows;
    const response = await app.inject(
      direction === 'wallet' ? await f.request() : await restoredReconnectRequest(f, name),
    );
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json()).toMatchObject({ code: 'ACCOUNT_RECONNECT_CONFLICT' });
    expect(
      (
        await pool.query(
          'SELECT account_id,subject FROM connected_app_subjects WHERE client_id=$1 ORDER BY account_id',
          [staged.clientId],
        )
      ).rows,
    ).toEqual(before);
    expect(
      (await pool.query('SELECT merged_into FROM accounts WHERE id=$1', [f.current.account.id]))
        .rows[0],
    ).toEqual({ merged_into: null });
    for (const token of tokens)
      expect((await service.access(token.accessToken)).claims.memberId).toBe('1');
  },
);
it.each(['wallet','restored'] as const)('refuses %s reconnect after erasure even for a proof issued beforehand',async direction=>{
 const name=direction==='wallet'?'erasewallet':'eraserestore',f=await reconnectionFixture(name);
 const request=direction==='wallet'?await f.request():await restoredReconnectRequest(f,name);
 for(const id of [f.current.account.id,f.original.account.id])await pool.query("UPDATE accounts SET erasure_state='pending' WHERE id=$1",[id]);
 const result=await app.inject(request);expect([401,409]).toContain(result.statusCode);
 expect((await pool.query('SELECT id,merged_into FROM accounts WHERE id=ANY($1::uuid[])',[[f.current.account.id,f.original.account.id]])).rows.every(row=>row.merged_into===null)).toBe(true);
});
it.each(['wallet','restored'] as const)('rechecks both %s reconnect owners under the shared locks when erasure wins a race',async direction=>{
 const name=direction==='wallet'?'raceerasewal':'raceeraserst',f=await reconnectionFixture(name);
 const request=direction==='wallet'?await f.request():await restoredReconnectRequest(f,name);
 beforeMembershipRead=async()=>{await pool.query("UPDATE accounts SET erasure_state='pending' WHERE id=$1",[f.current.account.id]);};
 const result=await app.inject(request);expect(result.statusCode,result.body).toBe(409);expect(result.json()).toMatchObject({code:'ACCOUNT_RECONNECT_CHANGED'});
 expect((await pool.query('SELECT merged_into FROM accounts WHERE id=$1',[f.current.account.id])).rows[0]).toEqual({merged_into:null});
 expect((await pool.query('SELECT account_id FROM native_links WHERE native_account=$1',[name])).rows[0]?.account_id).toBe(f.current.account.id);
});
it.each([{direction:'wallet',side:'source',name:'erwsource'},{direction:'wallet',side:'target',name:'erwtarget'},{direction:'restored',side:'source',name:'errsource'},{direction:'restored',side:'target',name:'errtarget'}] as const)('rejects $direction reconnect when its $side UUID was erased after proof issuance',async({direction,side,name})=>{
 const {AccountExit}=await import('../../services/api/src/account-exit/service.js');
 const f=await reconnectionFixture(name),request=direction==='wallet'?await f.request():await restoredReconnectRequest(f,name);
 const ownerId=side==='source'?f.current.account.id:f.original.account.id;
 const service=new AccountExit(pool,{...(await import('../helpers/auth-chain.js')).authChain,memberships:async()=>[]},{backupRetentionSeconds:86400});
 const operation=await service.begin(ownerId,{version:1,mode:'delete-account',memberships:[]},{reauthenticated:true});
 for(let attempts=0;attempts<20;attempts++)if(await service.eraseHosted(operation.id)==='completed')break;
 expect((await pool.query('SELECT erasure_state,signing_key FROM accounts WHERE id=$1',[ownerId])).rows[0]).toEqual({erasure_state:'erased',signing_key:null});
 const result=await app.inject(request);expect([401,409]).toContain(result.statusCode);
 expect((await pool.query('SELECT merged_into FROM accounts WHERE id=$1',[f.current.account.id])).rows[0]?.merged_into).toBeNull();
});
