import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  APIClient,
  Action,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
} from '@wharfkit/antelope';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { z } from 'zod';
import { createServer } from '../../services/api/src/server.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { migrate } from '../../services/api/src/store.js';
import { ChallengeSchema, SessionSchema } from '../../protocol/api.js';
import { NativeChallengeSchema } from '../../protocol/native-wallet.js';
import { encodeAction, makeInstruction, instructionDigest } from '../../sdk/index.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { controlledInject } from '../helpers/account-control.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
const network = z
  .strictObject({
    url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
    chainId: z.string(),
    container: z.literal('daclify-research-native'),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const database = process.env.DATABASE_URL;
if (
  !database ||
  !new URL(database).pathname.endsWith('_test') ||
  new URL(database).hostname !== '127.0.0.1'
)
  throw new Error('Owned local test database required');
const pool = new Pool({ connectionString: database }),
  rpc = new APIClient({ url: network.url }),
  origin = 'http://localhost:5178';
const key = PrivateKey.generate('K1'),
  native = fixtureKey('alice'),
  dao = String(Date.now());
const walletAccount =
  'n' +
  Array.from(createHash('sha256').update(dao).digest().subarray(0, 11), (byte) =>
    String.fromCharCode(97 + (byte % 26)),
  ).join('');
const chain = new NativeChainGateway(
  {
    rpcUrl: network.url,
    chainId: network.chainId,
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: fixtureKey('relay'),
  },
  pool,
);
const app = await createServer(pool, chain, origin, { signIn: { environment: 'local' } });
let rootCookie = '',
  csrf = '';
let pairedCookie = '';
let pairedCsrf = '';
let accountId = '';
function cookies(response: { cookies: { name: string; value: string }[] }) {
  return response.cookies.map((item) => `${item.name}=${item.value}`).join('; ');
}
const headers = () => ({ origin, cookie: rootCookie, 'x-csrf-token': csrf });
async function proof(challenge: z.infer<typeof NativeChallengeSchema>) {
  const info = await rpc.v1.chain.get_info();
  const action = Action.from({
    account: challenge.runtime,
    name: 'authproof',
    authorization: [
      { actor: challenge.identity.account, permission: challenge.identity.permission },
    ],
    data: encodeAction('authproof', {
      account: challenge.identity.account,
      intent: createHash('sha256').update(challenge.message).digest('hex'),
    }),
  });
  const transaction = Transaction.from({ ...info.getTransactionHeader(60), actions: [action] });
  return {
    packedTransaction: Serializer.encode({ object: transaction }).hexString,
    signatures: [native.signDigest(transaction.signingDigest(network.chainId)).toString()],
  };
}
async function push(name: string, data: Uint8Array, signer = native, actor = 'alice') {
  const info = await rpc.v1.chain.get_info();
  const transaction = Transaction.from({
    ...info.getTransactionHeader(60),
    actions: [
      Action.from({
        account: 'daclifycore',
        name,
        authorization: [{ actor, permission: 'active' }],
        data,
      }),
    ],
  });
  try {
    return await rpc.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: [signer.signDigest(transaction.signingDigest(network.chainId))],
      }),
    );
  } catch (cause) {
    if (typeof cause === 'object' && cause !== null && 'error' in cause) {
      const parsed = z
        .object({ details: z.array(z.object({ message: z.string() })) })
        .safeParse(cause.error);
      if (parsed.success)
        throw new Error(parsed.data.details.map((item) => item.message).join('; '));
    }
    throw cause;
  }
}
beforeAll(async () => {
  await migrate(pool);
  unlockFixtureWallet(network.container);
  configureFixtureContext(network.container);
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'create',
      'account',
      'eosio',
      walletAccount,
      native.toPublic().toString(),
      native.toPublic().toString(),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const challenge = ChallengeSchema.parse(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/challenge',
        headers: { origin },
        payload: { signingKey: key.toPublic().toString() },
      })
    ).json(),
  );
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const logged = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    },
  });
  const session = SessionSchema.parse(logged.json());
  rootCookie = cookies(logged);
  csrf = session.csrfToken;
  accountId = session.account.id;
  await push(
    'createdao',
    encodeAction('createdao', {
      dao_id: dao,
      owner: 'alice',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    }),
  );
  await push(
    'enroll',
    encodeAction('enroll', {
      dao_id: dao,
      member_id: '1',
      native_account: '',
      signing_key: key.toPublic().toString(),
      encryption_key: 'fixture',
      custody: 0,
    }),
  );
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
it('pairs a native account with dual consent, then logs into the same identity and rejects replay', async () => {
  const started = await app.inject({
    method: 'POST',
    url: '/v1/account/native/challenge',
    headers: headers(),
    payload: { purpose: 'pair', account: walletAccount, permission: 'active' },
  });
  const challenge = NativeChallengeSchema.parse(started.json()),
    walletProof = await proof(challenge);
  const cookie = `${rootCookie}; ${cookies(started)}`;
  const payload = { id: challenge.id, proof: walletProof };
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/account/native/link',
        headers: { ...headers(), cookie },
        payload,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await controlledInject(app, key, {
        method: 'POST',
        url: '/v1/account/native/link',
        headers: { ...headers(), cookie },
        payload,
      })
    ).statusCode,
  ).toBe(200);
  const login = await app.inject({
    method: 'POST',
    url: '/v1/account/native/challenge',
    headers: { origin },
    payload: { purpose: 'login', account: walletAccount, permission: 'active' },
  });
  const loginChallenge = NativeChallengeSchema.parse(login.json()),
    loginPayload = { id: loginChallenge.id, proof: await proof(loginChallenge) };
  const wrongBrowser = await app.inject({
    method: 'POST',
    url: '/v1/sign-in/native',
    headers: { origin },
    payload: loginPayload,
  });
  expect(wrongBrowser.statusCode).toBe(401);
  const logged = await app.inject({
    method: 'POST',
    url: '/v1/sign-in/native',
    headers: { origin, cookie: cookies(login) },
    payload: loginPayload,
  });
  expect(logged.statusCode).toBe(200);
  expect(SessionSchema.parse(logged.json()).account.id).toBe(accountId);
  pairedCookie = cookies(logged);
  pairedCsrf = SessionSchema.parse(logged.json()).csrfToken;
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/sign-in/native',
        headers: { origin, cookie: cookies(login) },
        payload: loginPayload,
      })
    ).statusCode,
  ).toBe(401);
});
it('executes native governance without the member signing key, and revokes both bindings explicitly', async () => {
  const domain = {
    chainId: network.chainId,
    contract: 'daclifycore',
    daoId: dao,
    interfaceVersion: 1 as const,
  };
  const bind = makeInstruction(
    domain,
    '1',
    '0',
    Math.floor(Date.now() / 1000) + 120,
    'daclifycore',
    'linknative',
    encodeAction('linknative', {
      runtime: 'daclifycore',
      dao_id: dao,
      member_id: '1',
      account: walletAccount,
    }),
  );
  await push(
    'submit',
    encodeAction('submit', {
      request: bind,
      sig: key.signDigest(instructionDigest(bind)).toString(),
    }),
    native,
    walletAccount,
  );
  const beforeRotation = await app.inject({
    method: 'GET',
    url: '/v1/me/memberships',
    headers: { cookie: pairedCookie },
  });
  expect(beforeRotation.statusCode).toBe(200);
  expect(beforeRotation.json().memberships).toContainEqual(
    expect.objectContaining({ memberId: '1', dao: domain }),
  );
  const rotate = makeInstruction(
    domain,
    '1',
    '1',
    Math.floor(Date.now() / 1000) + 120,
    'daclifycore',
    'rotatekey',
    encodeAction('rotatekey', {
      runtime: 'daclifycore',
      dao_id: dao,
      member_id: '1',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
    }),
  );
  await push('submitnat', encodeAction('submitnat', { request: rotate }), native, walletAccount);
  const afterRotation = await app.inject({
    method: 'GET',
    url: '/v1/me/memberships',
    headers: { cookie: pairedCookie },
  });
  expect(afterRotation.statusCode).toBe(200);
  expect(afterRotation.json().memberships).toContainEqual(
    expect.objectContaining({
      memberId: '1',
      dao: domain,
      nonce: '2',
      nativeAccount: walletAccount,
    }),
  );
  const unlink = makeInstruction(
    domain,
    '1',
    '2',
    Math.floor(Date.now() / 1000) + 120,
    'daclifycore',
    'unlinknat',
    encodeAction('unlinknat', { runtime: 'daclifycore', dao_id: dao, member_id: '1' }),
  );
  await push('submitnat', encodeAction('submitnat', { request: unlink }), native, walletAccount);
  const after = makeInstruction(
    domain,
    '1',
    '3',
    Math.floor(Date.now() / 1000) + 120,
    'daclifycore',
    'unlinknat',
    encodeAction('unlinknat', { runtime: 'daclifycore', dao_id: dao, member_id: '1' }),
  );
  await expect(
    push('submitnat', encodeAction('submitnat', { request: after }), native, walletAccount),
  ).rejects.toThrow();
  const payload = { chainId: network.chainId },
    path = '/v1/account/native/unlink',
    controlHeaders = { origin, cookie: pairedCookie, 'x-csrf-token': pairedCsrf };
  const intent = ChallengeSchema.parse(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/account/control',
        headers: controlHeaders,
        payload: {
          path,
          bodyHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
        },
      })
    ).json(),
  );
  const walletProof = await proof(
    NativeChallengeSchema.parse({
      ...intent,
      identity: { chainId: network.chainId, account: walletAccount, permission: 'active' },
      runtime: 'daclifycore',
    }),
  );
  expect(
    (
      await app.inject({
        method: 'POST',
        url: path,
        headers: {
          ...controlHeaders,
          'x-account-intent-id': intent.id,
          'x-account-proof': JSON.stringify({
            kind: 'native',
            chainId: network.chainId,
            account: walletAccount,
            proof: walletProof,
          }),
        },
        payload,
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (await app.inject({ method: 'GET', url: '/v1/me', headers: { cookie: pairedCookie } }))
      .statusCode,
  ).toBe(401);
});
