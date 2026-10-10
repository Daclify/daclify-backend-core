import { createHash, randomBytes, generateKeyPairSync } from 'node:crypto';
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
let bound = true,
  evmActive = true,
  chainMismatch = false,
  rpcUnavailable = false;
const member = (dao: string) => ({
  id: '1',
  native_account: dao === '1' && bound ? 'alice' : '',
  signing_key: root.toPublic().toString(),
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
  privacy: 0,
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
    return Response.json({
      rows:
        body.table === 'daos'
          ? [dao('1'), dao('2')]
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
  const gateway = new NativeChainGateway(
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
  bound = true;
  evmActive = true;
  chainMismatch = false;
  rpcUnavailable = false;
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
async function nativeAttempt(account = 'alice', signer = native) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/account/native/challenge',
    headers: { origin },
    payload: { purpose: 'login', account, permission: 'active' },
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
    url: '/v1/sign-in/native',
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
