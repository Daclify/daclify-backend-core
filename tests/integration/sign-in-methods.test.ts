import {
  createHash,
  createHmac,
  createSign,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
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
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryptionKey = { kty: 'EC' as const, crv: 'P-256' as const, x: jwk.x, y: jwk.y };
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
const delivered: { to: string; code: string }[] = [];
const local = await createServer(pool, chain, origin, {
  providers: { telegram: { botToken: bot, botUsername: 'fixture_bot' } },
  signIn: { environment: 'local' },
});
const mailed = await createServer(pool, chain, origin, {
  signIn: {
    environment: 'testnet',
    deliverEmail: async (to, code) => {
      delivered.push({ to, code });
    },
  },
});
const closed = await createServer(pool, chain, origin, { signIn: { environment: 'mainnet' } });
beforeAll(() => migrate(pool));
afterAll(async () => {
  await local.close();
  await mailed.close();
  await closed.close();
  await pool.end();
});
async function httpLogin(app: typeof local) {
  const key = PrivateKey.generate('K1');
  const challengeResponse = await app.inject({
    method: 'POST',
    url: '/v1/auth/challenge',
    headers: { origin },
    payload: { signingKey: key.toPublic().toString() },
  });
  const challenge = ChallengeSchema.parse(challengeResponse.json());
  const response = await app.inject({
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
    key,
  };
}
function headers(cookie: string, csrf: string) {
  return { origin, cookie, 'x-csrf-token': csrf };
}
function widget(subject: number) {
  const pairs = {
    auth_date: String(now),
    first_name: 'Fixture',
    id: String(subject),
    username: `user_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
  };
  const check = Object.entries(pairs)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHash('sha256').update(bot).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...pairs, hash }).toString();
}
const passkey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const passkeyJwk = passkey.publicKey.export({ format: 'jwk' });
const passkeyX = Buffer.from(String(passkeyJwk.x), 'base64url');
const passkeyY = Buffer.from(String(passkeyJwk.y), 'base64url');
function cborText(value: string): Buffer {
  return Buffer.concat([Buffer.from([0x60 + value.length]), Buffer.from(value)]);
}
function cborBytes(value: Buffer): Buffer {
  if (value.length < 24) return Buffer.concat([Buffer.from([0x40 + value.length]), value]);
  return Buffer.concat([Buffer.from([0x58, value.length]), value]);
}
function cborInt(value: number): Buffer {
  if (value >= 0 && value < 24) return Buffer.from([value]);
  const argument = value < 0 ? -1 - value : value;
  return Buffer.from([(value < 0 ? 0x20 : 0) + argument]);
}
function attestation(credentialId: Buffer, challenge: string) {
  const counter = Buffer.alloc(4);
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(credentialId.length);
  const cose = Buffer.concat([
    Buffer.from([0xa5]),
    cborInt(1),
    cborInt(2),
    cborInt(3),
    cborInt(-7),
    cborInt(-1),
    cborInt(1),
    cborInt(-2),
    cborBytes(passkeyX),
    cborInt(-3),
    cborBytes(passkeyY),
  ]);
  const authData = Buffer.concat([
    createHash('sha256').update('localhost').digest(),
    Buffer.from([0x45]),
    counter,
    Buffer.alloc(16),
    idLength,
    credentialId,
    cose,
  ]);
  const attestationObject = Buffer.concat([
    Buffer.from([0xa3]),
    cborText('fmt'),
    cborText('none'),
    cborText('attStmt'),
    Buffer.from([0xa0]),
    cborText('authData'),
    cborBytes(authData),
  ]);
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false }),
  );
  return {
    clientDataJSON: clientDataJSON.toString('base64url'),
    attestationObject: attestationObject.toString('base64url'),
  };
}
function assertion(challenge: string, signCount: number) {
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(signCount);
  const authenticatorData = Buffer.concat([
    createHash('sha256').update('localhost').digest(),
    Buffer.from([0x05]),
    counter,
  ]);
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }),
  );
  const signature = createSign('SHA256')
    .update(
      Buffer.concat([authenticatorData, createHash('sha256').update(clientDataJSON).digest()]),
    )
    .sign(passkey.privateKey);
  return {
    clientDataJSON: clientDataJSON.toString('base64url'),
    authenticatorData: authenticatorData.toString('base64url'),
    signature: signature.toString('base64url'),
  };
}
describe('account sign-in methods', () => {
  it('pairs a passkey with the current vault account and opens that same account', async () => {
    const owner = await httpLogin(local);
    const other = await httpLogin(local);
    const options = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/register/options',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: {},
    });
    expect(options.statusCode).toBe(200);
    const credentialId = randomBytes(16);
    const challenge = zChallenge(options.json());
    const registered = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/register',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: attestation(credentialId, challenge),
    });
    expect(registered.statusCode).toBe(200);
    const stolen = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/register/options',
      headers: headers(other.cookie, other.session.csrfToken),
      payload: {},
    });
    const rejected = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/register',
      headers: headers(other.cookie, other.session.csrfToken),
      payload: attestation(credentialId, zChallenge(stolen.json())),
    });
    expect(rejected.statusCode).toBe(409);
    const loginOptions = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/login/options',
      headers: { origin },
      payload: {},
    });
    const logged = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/login',
      headers: { origin },
      payload: {
        credentialId: credentialId.toString('base64url'),
        ...assertion(zChallenge(loginOptions.json()), 1),
      },
    });
    expect(logged.statusCode).toBe(200);
    const session = SessionSchema.parse(logged.json());
    expect(session.account.id).toBe(owner.session.account.id);
    expect(session.account.signingKey).toBe(owner.session.account.signingKey);
    expect(logged.body).not.toContain('PVT_');
    const replay = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/login',
      headers: { origin },
      payload: {
        credentialId: credentialId.toString('base64url'),
        ...assertion(zChallenge(loginOptions.json()), 1),
      },
    });
    expect(replay.statusCode).toBe(401);
  });
  it('shows an email code only to the signed-in local account that asked to link it', async () => {
    const owner = await httpLogin(local);
    const mailbox = `person.${randomUUID()}@example.test`;
    const started = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/email/start',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox.toUpperCase() },
    });
    expect(started.statusCode).toBe(200);
    const body = started.json<{ delivery: string; code?: string }>();
    expect(body.delivery).toBe('local');
    expect(body.code).toMatch(/^\d{8}$/);
    const anonymous = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/email/login/start',
      headers: { origin },
      payload: { email: mailbox },
    });
    expect(anonymous.statusCode).toBe(503);
    expect(anonymous.body).not.toContain(body.code);
    const confirmed = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/email/confirm',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox, code: body.code },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ subject: mailbox });
    const listed = await local.inject({
      method: 'GET',
      url: '/v1/sign-in/methods',
      headers: { cookie: owner.cookie },
    });
    expect(listed.json()).toMatchObject({ email: { subjects: [mailbox] } });
    const other = await httpLogin(local);
    const hidden = await local.inject({
      method: 'GET',
      url: '/v1/sign-in/methods',
      headers: { cookie: other.cookie },
    });
    expect(JSON.stringify(hidden.json())).not.toContain(mailbox);
    const second = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/email/start',
      headers: headers(other.cookie, other.session.csrfToken),
      payload: { email: mailbox },
    });
    const secondCode = second.json<{ code: string }>().code;
    const conflict = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/email/confirm',
      headers: headers(other.cookie, other.session.csrfToken),
      payload: { email: mailbox, code: secondCode },
    });
    expect(conflict.statusCode).toBe(409);
    const closedStart = await closed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/start',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: `closed.${randomUUID()}@example.test` },
    });
    expect(closedStart.statusCode).toBe(503);
    expect(closedStart.body).not.toMatch(/\d{8}/);
  });
  it('mails an email login code without returning it and keeps the linked account', async () => {
    const owner = await httpLogin(mailed);
    const mailbox = `mail.${randomUUID()}@example.test`;
    const before = delivered.length;
    const started = await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/start',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toEqual({ delivery: 'sent' });
    expect(started.body).not.toContain(delivered[before]?.code);
    const confirmed = await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/confirm',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox, code: delivered[before]?.code },
    });
    expect(confirmed.statusCode).toBe(200);
    const loginStart = await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/login/start',
      headers: { origin },
      payload: { email: mailbox },
    });
    expect(loginStart.statusCode).toBe(200);
    expect(loginStart.json()).toEqual({ delivery: 'sent' });
    const code = delivered.at(-1)?.code ?? '';
    expect(loginStart.body).not.toContain(code);
    const logged = await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/login',
      headers: { origin },
      payload: { email: mailbox, code },
    });
    expect(SessionSchema.parse(logged.json()).account.id).toBe(owner.session.account.id);
    const again = await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/login',
      headers: { origin },
      payload: { email: mailbox, code },
    });
    expect(again.statusCode).toBe(401);
  });
  it('consumes concurrent email and zero-counter passkey proofs only once', async () => {
    const owner = await httpLogin(mailed);
    const mailbox = `race.${randomUUID()}@example.test`;
    const linked = await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/start',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox },
    });
    expect(linked.statusCode).toBe(200);
    await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/confirm',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox, code: delivered.at(-1)?.code },
    });
    await mailed.inject({
      method: 'POST',
      url: '/v1/sign-in/email/login/start',
      headers: { origin },
      payload: { email: mailbox },
    });
    const code = delivered.at(-1)?.code;
    const emailRow = await pool.query<{ id: string }>(
      "SELECT id FROM signin_challenges WHERE subject=$1 AND purpose='email-login' AND consumed_at IS NULL",
      [mailbox],
    );
    await concurrentProof(emailRow.rows[0]?.id ?? '', () =>
      mailed.inject({
        method: 'POST',
        url: '/v1/sign-in/email/login',
        headers: { origin },
        payload: { email: mailbox, code },
      }),
    );
    const registration = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/register/options',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: {},
    });
    const credential = randomBytes(16);
    expect(
      (
        await local.inject({
          method: 'POST',
          url: '/v1/sign-in/passkey/register',
          headers: headers(owner.cookie, owner.session.csrfToken),
          payload: attestation(credential, zChallenge(registration.json())),
        })
      ).statusCode,
    ).toBe(200);
    const options = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/passkey/login/options',
      headers: { origin },
      payload: {},
    });
    const challenge = zChallenge(options.json());
    const passkeyRow = await pool.query<{ id: string }>(
      "SELECT id FROM signin_challenges WHERE secret_hash=$1 AND purpose='passkey-login'",
      [createHash('sha256').update(Buffer.from(challenge, 'base64url')).digest()],
    );
    const payload = { credentialId: credential.toString('base64url'), ...assertion(challenge, 0) };
    await concurrentProof(passkeyRow.rows[0]?.id ?? '', () =>
      local.inject({
        method: 'POST',
        url: '/v1/sign-in/passkey/login',
        headers: { origin },
        payload,
      }),
    );
  });
  it('exhausts an email challenge after five incorrect guesses', async () => {
    const owner = await httpLogin(local);
    const mailbox = `budget.${randomUUID()}@example.test`;
    const started = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/email/start',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { email: mailbox },
    });
    const code = started.json<{ code: string }>().code;
    for (let attempt = 0; attempt < 5; attempt++)
      expect(
        (
          await local.inject({
            method: 'POST',
            url: '/v1/sign-in/email/confirm',
            headers: headers(owner.cookie, owner.session.csrfToken),
            payload: { email: mailbox, code: code === '00000000' ? '00000001' : '00000000' },
          })
        ).statusCode,
      ).toBe(401);
    expect(
      (
        await local.inject({
          method: 'POST',
          url: '/v1/sign-in/email/confirm',
          headers: headers(owner.cookie, owner.session.csrfToken),
          payload: { email: mailbox, code },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('limits challenge issuance per caller even when query strings vary', async () => {
    const request = (address: string, index: number) =>
      local.inject({
        method: 'POST',
        url: '/v1/sign-in/passkey/login/options?nonce=' + index,
        remoteAddress: address,
        headers: { origin },
        payload: {},
      });
    for (let index = 0; index < 20; index++)
      expect((await request('203.0.113.7', index)).statusCode).toBe(200);
    expect((await request('203.0.113.7', 20)).statusCode).toBe(429);
    expect((await request('203.0.113.8', 21)).statusCode).toBe(200);
  });
  it('links a Telegram login widget to the current account and can remove it', async () => {
    const owner = await httpLogin(local);
    const subject = 200_000_000 + Math.floor(Math.random() * 100_000_000);
    const linked = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/telegram',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { proof: widget(subject) },
    });
    const options = await local.inject({ method: 'GET', url: '/v1/sign-in/options' });
    expect(options.json()).toMatchObject({
      telegram: { configured: true, username: 'fixture_bot' },
      email: { delivery: 'local' },
      passkey: { rpId: 'localhost' },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ provider: 'telegram', subject: String(subject) });
    const logged = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/telegram/login',
      headers: { origin },
      payload: { proof: widget(subject) },
    });
    expect(SessionSchema.parse(logged.json()).account.id).toBe(owner.session.account.id);
    const methods = await local.inject({
      method: 'GET',
      url: '/v1/sign-in/methods',
      headers: { cookie: owner.cookie },
    });
    expect(methods.statusCode).toBe(200);
    expect(methods.json()).toMatchObject({
      telegram: { username: 'fixture_bot', subjects: [String(subject)] },
      email: { delivery: 'local' },
    });
    const removed = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/remove',
      headers: headers(owner.cookie, owner.session.csrfToken),
      payload: { method: 'telegram', subject: String(subject) },
    });
    expect(removed.statusCode).toBe(204);
    const after = await local.inject({
      method: 'POST',
      url: '/v1/sign-in/telegram/login',
      headers: { origin },
      payload: { proof: widget(subject) },
    });
    expect(after.statusCode).toBe(401);
  });
});
function zChallenge(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('challenge' in value))
    throw new Error('Missing challenge');
  const challenge = value.challenge;
  if (typeof challenge !== 'string') throw new Error('Missing challenge');
  return challenge;
}

async function concurrentProof(id: string, submit: () => Promise<{ statusCode: number }>) {
  expect(id).not.toBe('');
  const blocker = await pool.connect();
  await blocker.query('BEGIN');
  await blocker.query('SELECT id FROM signin_challenges WHERE id=$1 FOR UPDATE', [id]);
  const first = submit();
  const second = submit();
  let blocked = 0;
  const deadline = Date.now() + 5000;
  try {
    while (Date.now() < deadline) {
      const row = await pool.query<{ count: string }>(
        "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%UPDATE signin_challenges%' AND pid<>pg_backend_pid()",
      );
      blocked = Number(row.rows[0]?.count);
      if (blocked >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    await blocker.query('COMMIT');
    blocker.release();
  }
  const results = await Promise.all([first, second]);
  expect(blocked).toBe(2);
  expect(results.map((result) => result.statusCode).sort()).toEqual([200, 401]);
}
