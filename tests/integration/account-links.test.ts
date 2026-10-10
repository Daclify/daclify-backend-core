import { controlledInject } from '../helpers/account-control.js';
import { parseSiweMessage } from 'viem/siwe';
import { EvmSignInChallengeSchema } from '../../protocol/evm-wallet.js';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { checksumAddress, personalDigest } from '../../services/api/src/auth/evm-proof.js';
import { ChallengeSchema, NetworkSchema, SessionSchema } from '../../protocol/api.js';
import { readTelegramDocs } from '../../services/api/src/docs/telegram-config.js';
import { TELEGRAM_DOCS_PATH } from '../../services/api/src/docs/telegram.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryptionKey = { kty: 'EC' as const, crv: 'P-256' as const, x: jwk.x, y: jwk.y };
let executiveBinding: 'bound' | 'unbound' | 'unavailable' = 'unbound';
const chain: ChainGateway = {
  nativeGovernanceWalletInUse: async () => {
    if (executiveBinding === 'unavailable') throw new Error('Chain check unavailable');
    return executiveBinding === 'bound';
  },
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
  dao: async () => {
    throw new Error('not deployed');
  },
  content: async () => {
    throw new Error('not deployed');
  },
  moduleState: async () => {
    throw new Error('not deployed');
  },
  network: async () =>
    NetworkSchema.parse({
      chainId: 'ab'.repeat(32),
      rpcUrl: 'http://127.0.0.1:18888',
      runtime: 'daclifycore',
      hub: null,
      environment: 'local',
      interfaceVersion: 1,
      coreVersion: '0.1.0-alpha.1',
      capabilities: [],
    }),
  listDaos: async () => [],
  memberships: async () => [],
  memberProfile: async () => ({ accountName: null, profile: null }),
  createDao: async () => {
    throw new Error('not deployed');
  },
  relay: async () => {
    throw new Error('not deployed');
  },
};
const calls: string[] = [];
const fetchImpl: typeof fetch = async (input) => {
  calls.push(String(input));
  if (String(input).endsWith('/decisions')) {
    return new Response(
      JSON.stringify({
        answers: {
          acceptable: { noul: 0.99 },
          in_scope: { noul: 0.88 },
          topic: { choice: 'accounts', probabilities: { accounts: 0.7, unlisted: 0.1 } },
        },
      }),
      { status: 200 },
    );
  }
  return new Response(
    JSON.stringify({ choices: [{ message: { content: 'From the accounts guide.' } }] }),
    {
      status: 200,
    },
  );
};
const telegramDocs = readTelegramDocs({
  TELEGRAM_DOCS_ENABLED: 'true',
  TELEGRAM_BOT_TOKEN: '12345:fixture',
  TELEGRAM_BOT_USERNAME: 'fixture_bot',
  TELEGRAM_DOCS_GROUP_IDS: '["-100123"]',
  TELEGRAM_DOCS_WEBHOOK_SECRET: 'a'.repeat(32),
  TELEGRAM_DOCS_WEBHOOK_URL: 'https://testnet.api.example/v1/docs/telegram/webhook',
  OPENROUTER_API_KEY: 'sk-or-v1-local-fixture-key',
  FRONTEND_ORIGIN: origin,
  NETWORK_ENVIRONMENT: 'local',
});
if (!telegramDocs) throw new Error('Expected configured Telegram docs fixture');
const app = await createServer(pool, chain, origin, {
  telegramDocs,
  docs: {
    apiKey: 'sk-or-v1-local-fixture-key',
    model: 'openai/gpt-4.1-mini',
    decisionsModel: 'openai/gpt-6-luna-decisions',
    fetch: fetchImpl,
  },
});
const closed = await createServer(pool, chain, origin);
beforeAll(() => migrate(pool));
afterAll(async () => {
  await app.close();
  await closed.close();
  await pool.end();
});

function sign(message: string, secret: Uint8Array): string {
  const signature = secp256k1.sign(personalDigest(message), secret, {
    prehash: false,
    format: 'recovered',
  });
  const eth = new Uint8Array(65);
  eth.set(signature.subarray(1), 0);
  eth[64] = (signature[0] ?? 0) + 27;
  return `0x${Buffer.from(eth).toString('hex')}`;
}
function addressOf(secret: Uint8Array): string {
  const encoded = secp256k1.getPublicKey(secret, false);
  return `0x${Buffer.from(keccak_256(encoded.subarray(1)).subarray(12)).toString('hex')}`;
}
async function login(server: typeof app) {
  const key = PrivateKey.generate('K1');
  const challengeResponse = await server.inject({
    method: 'POST',
    url: '/v1/auth/challenge',
    headers: { origin },
    payload: { signingKey: key.toPublic().toString(), encryptionKey },
  });
  const challenge = ChallengeSchema.parse(challengeResponse.json());
  const response = await server.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
    },
  });
  const session = SessionSchema.parse(response.json());
  return {
    session,
    key,
    cookie: response.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
  };
}
function headers(cookie: string, csrf: string) {
  return { origin, cookie, 'x-csrf-token': csrf };
}

describe('Telos EVM account links', () => {
  it('uses browser-bound SIWE and dual consent, preserves identity and revokes removed wallet sessions', async () => {
    const owner = await login(app),
      secret = secp256k1.utils.randomSecretKey(),
      address = addressOf(secret);
    const started = await app.inject({
      method: 'POST',
      url: '/v1/account/evm/sign-in/challenge',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { purpose: 'pair', chainId: 41, address },
    });
    const challenge = EvmSignInChallengeSchema.parse(started.json());
    expect(parseSiweMessage(challenge.message)).toMatchObject({
      domain: 'localhost:5178',
      scheme: 'http',
      address: checksumAddress(address),
      chainId: 41,
      uri: origin + '/account',
      version: '1',
    });
    const attempt = started.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
      payload = { id: challenge.id, signature: sign(challenge.message, secret) },
      pairHeaders = headers(`${owner.cookie}; ${attempt}`, owner.session.csrfToken);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/account/evm/sign-in/link',
          headers: pairHeaders,
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await controlledInject(app, owner.key, {
          method: 'POST',
          url: '/v1/account/evm/sign-in/link',
          headers: pairHeaders,
          payload,
        })
      ).statusCode,
    ).toBe(200);
    const loginStart = await app.inject({
      method: 'POST',
      url: '/v1/account/evm/sign-in/challenge',
      headers: { origin },
      payload: { purpose: 'login', chainId: 41, address },
    });
    const incoming = EvmSignInChallengeSchema.parse(loginStart.json()),
      loginCookie = loginStart.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
      loginProof = { id: incoming.id, signature: sign(incoming.message, secret) };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/sign-in/evm',
          headers: { origin },
          payload: loginProof,
        })
      ).statusCode,
    ).toBe(401);
    const logged = await app.inject({
      method: 'POST',
      url: '/v1/sign-in/evm',
      headers: { origin, cookie: loginCookie },
      payload: loginProof,
    });
    expect(logged.statusCode).toBe(200);
    expect(SessionSchema.parse(logged.json()).account.id).toBe(owner.session.account.id);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/sign-in/evm',
          headers: { origin, cookie: loginCookie },
          payload: loginProof,
        })
      ).statusCode,
    ).toBe(401);
    const removed = await controlledInject(app, owner.key, {
      method: 'POST',
      url: '/v1/account/evm/unlink',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { chainId: 41 },
    });
    expect(removed.statusCode).toBe(204);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/v1/me',
          headers: {
            cookie: logged.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
          },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('links an address proved by personal_sign and refuses a second account', async () => {
    const first = await login(app);
    const second = await login(app);
    const secret = secp256k1.utils.randomSecretKey();
    const claimed = addressOf(secret);
    const challenge = await app.inject({
      method: 'POST',
      url: '/v1/account/evm/challenge',
      headers: headers(first.cookie, first.session.csrfToken),
      payload: { chainId: 41 },
    });
    expect(challenge.statusCode).toBe(200);
    const body = challenge.json() as { message: string };
    const bad = await controlledInject(app, first.key, {
      method: 'POST',
      url: '/v1/account/evm/link',
      headers: headers(first.cookie, first.session.csrfToken),
      payload: { chainId: 41, address: claimed, signature: `0x${'ab'.repeat(65)}` },
    });
    expect(bad.statusCode).toBe(401);
    const linked = await controlledInject(app, first.key, {
      method: 'POST',
      url: '/v1/account/evm/link',
      headers: headers(first.cookie, first.session.csrfToken),
      payload: { chainId: 41, address: claimed, signature: sign(body.message, secret) },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toEqual({ chainId: 41, address: checksumAddress(claimed) });
    const listed = await app.inject({
      method: 'GET',
      url: '/v1/account/evm',
      headers: { cookie: first.cookie },
    });
    expect(listed.json()).toEqual({
      links: [{ chainId: 41, address: checksumAddress(claimed), controlVerified: true }],
    });
    const otherChallenge = await app.inject({
      method: 'POST',
      url: '/v1/account/evm/challenge',
      headers: headers(second.cookie, second.session.csrfToken),
      payload: { chainId: 41 },
    });
    const other = otherChallenge.json() as { message: string };
    const conflict = await controlledInject(app, second.key, {
      method: 'POST',
      url: '/v1/account/evm/link',
      headers: headers(second.cookie, second.session.csrfToken),
      payload: { chainId: 41, address: claimed, signature: sign(other.message, secret) },
    });
    expect(conflict.statusCode).toBe(409);
    const removed = await controlledInject(app, first.key, {
      method: 'POST',
      url: '/v1/account/evm/unlink',
      headers: headers(first.cookie, first.session.csrfToken),
      payload: { chainId: 41 },
    });
    expect(removed.statusCode).toBe(204);
    const empty = await app.inject({
      method: 'GET',
      url: '/v1/account/evm',
      headers: { cookie: first.cookie },
    });
    expect(empty.json()).toEqual({ links: [] });
  });
});

describe('documentation assistant route', () => {
  it('accepts only the authenticated Telegram callback without browser origin and keeps app origin checks', async () => {
    expect(
      (await app.inject({ method: 'POST', url: TELEGRAM_DOCS_PATH, payload: { update_id: 9 } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: TELEGRAM_DOCS_PATH,
          headers: { 'x-telegram-bot-api-secret-token': 'a'.repeat(32) },
          payload: { update_id: 9 },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/docs/ask',
          payload: { question: 'Where are my keys?' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await closed.inject({ method: 'POST', url: TELEGRAM_DOCS_PATH, payload: { update_id: 9 } }))
        .statusCode,
    ).toBe(404);
  });
  it('answers from the mocked model and stays unavailable without a key', async () => {
    const missing = await closed.inject({ method: 'GET', url: '/v1/docs/agent' });
    expect(missing.json()).toMatchObject({
      configured: false,
      profile: { name: 'Daxi', answerModel: null, decisionsModel: null },
    });
    const refused = await closed.inject({
      method: 'POST',
      url: '/v1/docs/ask',
      headers: { origin },
      payload: { question: 'How do accounts work?' },
    });
    expect(refused.statusCode).toBe(503);
    const status = await app.inject({ method: 'GET', url: '/v1/docs/agent' });
    expect(status.json()).toMatchObject({
      configured: true,
      profile: { name: 'Daxi', scope: ['Daclify', 'Telos', 'DAOs'] },
    });
    const asked = await app.inject({
      method: 'POST',
      url: '/v1/docs/ask',
      headers: { origin },
      payload: { question: `How do accounts work? ${randomUUID()}` },
    });
    expect(asked.statusCode).toBe(200);
    expect(asked.json()).toMatchObject({ status: 'answered', topicId: 'accounts' });
    expect(calls.length).toBeGreaterThan(0);
  });
});

it('preserves sign-in pairing when native executive authority remains or chain verification fails', async () => {
  const owner = await login(app);
  await pool.query(
    "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,'alice','active')",
    [owner.session.account.id, 'ab'.repeat(32)],
  );
  executiveBinding = 'bound';
  try {
    const rejected = await controlledInject(app, owner.key, {
      method: 'POST',
      url: '/v1/account/native/unlink',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { chainId: 'ab'.repeat(32) },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toMatchObject({ code: 'NATIVE_EXECUTIVE_BINDING_REQUIRED' });
    expect(
      (
        await pool.query('SELECT native_account FROM native_links WHERE account_id=$1', [
          owner.session.account.id,
        ])
      ).rows,
    ).toHaveLength(1);
    executiveBinding = 'unavailable';
    const failed = await controlledInject(app, owner.key, {
      method: 'POST',
      url: '/v1/account/native/unlink',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { chainId: 'ab'.repeat(32) },
    });
    expect(failed.statusCode).toBeGreaterThanOrEqual(500);
    expect(
      (
        await pool.query('SELECT native_account FROM native_links WHERE account_id=$1', [
          owner.session.account.id,
        ])
      ).rows,
    ).toHaveLength(1);
    executiveBinding = 'unbound';
    const removed = await controlledInject(app, owner.key, {
      method: 'POST',
      url: '/v1/account/native/unlink',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { chainId: 'ab'.repeat(32) },
    });
    expect(removed.statusCode).toBe(204);
    expect(
      (
        await pool.query('SELECT native_account FROM native_links WHERE account_id=$1', [
          owner.session.account.id,
        ])
      ).rows,
    ).toHaveLength(0);
  } finally {
    executiveBinding = 'unbound';
  }
});
