import { readFileSync } from 'node:fs';
import { createHash, createHmac, generateKeyPairSync, randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { generateKeyPair, SignJWT } from 'jose';
import { migrate } from '../../services/api/src/store.js';
import { authenticate, createChallenge, readSession } from '../../services/api/src/auth.js';
import {
  linkProvider,
  openLinkedSession,
  unlinkProvider,
} from '../../services/api/src/auth/linking.js';
import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import type { ProviderPrincipal } from '../../services/api/src/providers/proofs.js';
import { ChallengeSchema, NetworkSchema, SessionSchema } from '../../protocol/api.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const bot = '12345:local-fixture-token';
const now = Math.floor(Date.now() / 1000);
const keys = await generateKeyPair('RS256');
const chain: ChainGateway = {
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
const configured = await createServer(pool, chain, origin, {
  providers: {
    google: { clientId: 'client', key: keys.publicKey },
    telegram: { botToken: bot },
  },
});
const unconfigured = await createServer(pool, chain, origin);
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryptionKey = { kty: 'EC' as const, crv: 'P-256' as const, x: jwk.x, y: jwk.y };
beforeAll(() => migrate(pool));
afterAll(async () => {
  await configured.close();
  await unconfigured.close();
  await pool.end();
});
function principal(
  provider: ProviderPrincipal['provider'],
  subject: string,
  proof: string,
): ProviderPrincipal {
  return {
    provider,
    subject,
    proofHash: createHash('sha256').update(proof).digest(),
    expires: new Date(Date.now() + 60_000),
  };
}
async function account() {
  const key = PrivateKey.generate('K1');
  const challenge = await createChallenge(pool, key.toPublic().toString(), origin);
  const result = await authenticate(
    pool,
    challenge.id,
    key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
    encryptionKey,
  );
  const sentinel = `vault:v1:${randomUUID()}`;
  await pool.query(
    'INSERT INTO custody.managed_keys(account_id,signer_name,signing_public_key,wrapped_encryption_key) VALUES($1,$2,$3,$4)',
    [result.account.id, `sentinel-${result.account.id}`, result.account.signingKey, sentinel],
  );
  await pool.query(
    'INSERT INTO memberships(account_id,chain_id,contract,dao_id,member_id) VALUES($1,$2,$3,$4,$5)',
    [result.account.id, 'ab'.repeat(32), 'daclifycore', randomInt(1, 1_000_000_000), 7],
  );
  return { ...result, key, sentinel };
}
async function google(subject: string, email = 'same-person@example.test') {
  return new SignJWT({
    iss: 'https://accounts.google.com',
    sub: subject,
    aud: 'client',
    nonce: 'one-time-nonce',
    iat: now,
    exp: now + 300,
    email,
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(keys.privateKey);
}
function telegram(subject: number) {
  const pairs = {
    auth_date: String(now),
    user: JSON.stringify({ id: subject, first_name: 'Fixture' }),
    query_id: randomUUID(),
  };
  const check = Object.entries(pairs)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(bot).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...pairs, hash }).toString();
}
async function httpLogin() {
  const key = PrivateKey.generate('K1');
  const challengeResponse = await configured.inject({
    method: 'POST',
    url: '/v1/auth/challenge',
    headers: { origin },
    payload: { signingKey: key.toPublic().toString() },
  });
  const challenge = ChallengeSchema.parse(challengeResponse.json());
  const response = await configured.inject({
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
    cookie: response.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
  };
}
describe('provider session linking', () => {
  it('does not query custody or change the user-controlled account', () => {
    const source = readFileSync('services/api/src/auth/linking.ts', 'utf8');
    expect(source).not.toContain('managed_keys');
    expect(source).not.toContain('unwrap');
  });
  it('links a subject and later opens a session without creating another member', async () => {
    const first = await account();
    const subject = `google-subject-${randomUUID()}`;
    const linked = principal('google', subject, randomUUID());
    await linkProvider(pool, first.account.id, linked);
    const opened = await openLinkedSession(pool, principal('google', subject, randomUUID()));
    expect(opened.account.id).toBe(first.account.id);
    expect(opened.account.signingKey).toBe(first.account.signingKey);
    expect(opened.account.custody).toBe('user-controlled');
    expect(JSON.stringify(opened)).not.toContain(first.sentinel);
    expect((await readSession(pool, opened.token))?.id).toBe(first.account.id);
    const stored = await pool.query<{ signing_key: string; member_id: string }>(
      'SELECT a.signing_key,m.member_id::text FROM accounts a JOIN memberships m ON m.account_id=a.id WHERE a.id=$1',
      [first.account.id],
    );
    expect(stored.rows[0]?.signing_key).toBe(first.account.signingKey);
    expect(stored.rows[0]?.member_id).toBe('7');
    const wrapped = await pool.query<{ wrapped_encryption_key: string }>(
      'SELECT wrapped_encryption_key FROM custody.managed_keys WHERE account_id=$1',
      [first.account.id],
    );
    expect(wrapped.rows[0]?.wrapped_encryption_key).toBe(first.sentinel);
  });
  it('rejects a replayed proof and a subject already linked to someone else', async () => {
    const first = await account();
    const second = await account();
    const subject = `taken-${randomUUID()}`;
    const proof = principal('google', subject, randomUUID());
    await linkProvider(pool, first.account.id, proof);
    await expect(linkProvider(pool, second.account.id, proof)).rejects.toThrow('PROVIDER_REPLAY');
    await expect(
      linkProvider(pool, second.account.id, principal('google', subject, randomUUID())),
    ).rejects.toThrow('CREDENTIAL_LINKED');
    await expect(
      openLinkedSession(pool, principal('telegram', `missing-${randomUUID()}`, randomUUID())),
    ).rejects.toThrow('PROVIDER_UNKNOWN');
  });
  it('burns an unknown proof so a later link cannot redeem it', async () => {
    const first = await account();
    const subject = `late-${randomUUID()}`;
    const proof = principal('google', subject, randomUUID());
    await expect(openLinkedSession(pool, proof)).rejects.toThrow('PROVIDER_UNKNOWN');
    await linkProvider(pool, first.account.id, principal('google', subject, randomUUID()));
    await expect(openLinkedSession(pool, proof)).rejects.toThrow('PROVIDER_REPLAY');
  });
  it('burns a proof that tried to link a subject owned by someone else', async () => {
    const first = await account();
    const second = await account();
    const subject = `owned-${randomUUID()}`;
    await linkProvider(pool, first.account.id, principal('google', subject, randomUUID()));
    const stolen = principal('google', subject, randomUUID());
    await expect(linkProvider(pool, second.account.id, stolen)).rejects.toThrow(
      'CREDENTIAL_LINKED',
    );
    await expect(openLinkedSession(pool, stolen)).rejects.toThrow('PROVIDER_REPLAY');
  });
  it('keeps Google and Telegram subjects distinct and restores key login after unlink', async () => {
    const first = await account();
    const subject = String(randomInt(10_000, 2_000_000_000));
    await linkProvider(pool, first.account.id, principal('google', subject, randomUUID()));
    await linkProvider(pool, first.account.id, principal('telegram', subject, randomUUID()));
    await unlinkProvider(pool, first.account.id, 'google', subject);
    await expect(
      openLinkedSession(pool, principal('google', subject, randomUUID())),
    ).rejects.toThrow('PROVIDER_UNKNOWN');
    const telegramSession = await openLinkedSession(
      pool,
      principal('telegram', subject, randomUUID()),
    );
    expect(telegramSession.account.id).toBe(first.account.id);
    const challenge = await createChallenge(pool, first.account.signingKey, origin);
    const again = await authenticate(
      pool,
      challenge.id,
      first.key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
    );
    expect(again.account.id).toBe(first.account.id);
  });
  it('refuses provider routes until fixture keys are supplied', async () => {
    const response = await unconfigured.inject({
      method: 'POST',
      url: '/v1/auth/providers/login',
      headers: { origin },
      payload: { provider: 'google', proof: 'unsigned', nonce: 'one-time-nonce' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'PROVIDER_UNCONFIGURED' });
  });
  it('requires the current session to link and does not merge equal emails', async () => {
    const current = await httpLogin();
    const missing = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/link',
      headers: { origin, cookie: current.cookie },
      payload: {
        provider: 'google',
        proof: await google(`csrf-${randomUUID()}`),
        nonce: 'one-time-nonce',
      },
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'CSRF_REQUIRED' });
    const aliceSubject = `alice-${randomUUID()}`;
    const bobSubject = `bob-${randomUUID()}`;
    const linked = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/link',
      headers: { origin, cookie: current.cookie, 'x-csrf-token': current.session.csrfToken },
      payload: { provider: 'google', proof: await google(aliceSubject), nonce: 'one-time-nonce' },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ provider: 'google', subject: aliceSubject });
    const other = await httpLogin();
    const otherLink = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/link',
      headers: { origin, cookie: other.cookie, 'x-csrf-token': other.session.csrfToken },
      payload: { provider: 'google', proof: await google(bobSubject), nonce: 'one-time-nonce' },
    });
    expect(otherLink.statusCode).toBe(200);
    const login = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/login',
      headers: { origin },
      payload: { provider: 'google', proof: await google(aliceSubject), nonce: 'one-time-nonce' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.body).not.toContain('vault:v1');
    expect(SessionSchema.parse(login.json()).account.id).toBe(current.session.account.id);
    expect(SessionSchema.parse(login.json()).account.id).not.toBe(other.session.account.id);
  });
  it('accepts a Telegram fixture proof and rejects the same proof on replay', async () => {
    const current = await httpLogin();
    const subject = randomInt(10_000, 2_000_000_000);
    const proof = telegram(subject);
    const linked = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/link',
      headers: { origin, cookie: current.cookie, 'x-csrf-token': current.session.csrfToken },
      payload: { provider: 'telegram', proof },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ provider: 'telegram', subject: String(subject) });
    const replay = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/login',
      headers: { origin },
      payload: { provider: 'telegram', proof },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toMatchObject({ code: 'PROVIDER_REPLAY' });
    const fresh = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/login',
      headers: { origin },
      payload: { provider: 'telegram', proof: telegram(subject) },
    });
    expect(fresh.statusCode).toBe(200);
    const session = SessionSchema.parse(fresh.json());
    expect(session.account.id).toBe(current.session.account.id);
    expect(session.account.encryptionKey).toEqual(current.session.account.encryptionKey);
    expect(fresh.body).not.toContain('PVT_');
    const removed = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/unlink',
      headers: {
        origin,
        cookie: fresh.cookies.map((item) => `${item.name}=${item.value}`).join('; '),
        'x-csrf-token': session.csrfToken,
      },
      payload: { provider: 'telegram', subject: String(subject) },
    });
    expect(removed.statusCode).toBe(204);
    const denied = await configured.inject({
      method: 'POST',
      url: '/v1/auth/providers/login',
      headers: { origin },
      payload: { provider: 'telegram', proof: telegram(subject) },
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toMatchObject({ code: 'PROVIDER_UNKNOWN' });
  });
});
