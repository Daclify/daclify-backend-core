import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { migrate } from '../../services/api/src/store.js';
import { authenticate, createChallenge, readSession } from '../../services/api/src/auth.js';
import { claimContactRecovery } from '../../services/api/src/auth/contact-recovery.js';
import { ContactRecoveryStateSchema } from '../../protocol/contact-recovery.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test database required');
const database = 'daclify_contact_' + randomBytes(6).toString('hex') + '_test',
  target = new URL(url);
target.pathname = '/' + database;
const owner = new Pool({ connectionString: url }),
  pool = new Pool({ connectionString: target.toString() });
const origin = 'http://localhost:5178',
  old = PrivateKey.generate('K1'),
  next = PrivateKey.generate('K1');
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryption = EncryptionPublicKeySchema.parse({
  kty: jwk.kty,
  crv: jwk.crv,
  x: jwk.x,
  y: jwk.y,
});
const recoveryTarget = {
  dao: {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
    interfaceVersion: 1 as const,
  },
  memberId: '1',
};
const request = {
  action: 'startrecover',
  chain_id: recoveryTarget.dao.chainId,
  runtime: 'daclifycore',
  dao_id: '1',
  member_id: '1',
  revision: '1',
  request_id: '1',
  signing_key: next.toPublic().toString(),
  encryption_key: JSON.stringify(encryption),
  native_account: '',
  expires: Math.floor(Date.now() / 1000) + 604800,
};
const originalState = () =>
  ContactRecoveryStateSchema.parse({
    target: recoveryTarget,
    supported: true,
    documentsAllowed: false,
    nextPacketId: '1',
    identity: {
      id: '1',
      dao_id: '1',
      signing_key: next.toPublic().toString(),
      origin_key: old.toPublic().toString(),
    },
    member: {
      id: '1',
      native_account: '',
      signing_key: request.signing_key,
      encryption_key: request.encryption_key,
      custody: 0,
      nonce: '2',
      credits: '42',
      active: true,
      admin: true,
      reviewer: false,
      stake: '0',
      claim: '0',
      join_epoch: '1',
    },
    policy: null,
    pending: null,
    result: {
      member_id: '1',
      request,
      old_signing_key: old.toPublic().toString(),
      completed: Math.floor(Date.now() / 1000),
      document_epoch: '1',
      identity_id: '1',
      documents_approved: false,
      future_grants: false,
    },
    packets: [],
    next: null,
  });
let state = originalState();
const chain = { contactRecovery: async () => structuredClone(state) };
async function login(key: PrivateKey) {
  const c = await createChallenge(
    pool,
    { signingKey: key.toPublic().toString(), encryptionKey: encryption },
    origin,
  );
  return authenticate(
    pool,
    c.id,
    key.signMessage(new TextEncoder().encode(c.message)).toString(),
    encryption,
    { origin, audience: origin },
  );
}
async function claim(challengeOrigin = origin, signer = next) {
  const c = await createChallenge(
    pool,
    { signingKey: next.toPublic().toString(), encryptionKey: encryption },
    challengeOrigin,
  );
  const input = {
    target: recoveryTarget,
    requestId: '1',
    challengeId: c.id,
    signature: signer.signMessage(new TextEncoder().encode(c.message)).toString(),
    encryptionKey: encryption,
  };
  return { input, finish: () => claimContactRecovery(pool, chain, input, origin, origin) };
}
beforeAll(async () => {
  await owner.query(`CREATE DATABASE ${database}`);
  await migrate(pool);
});
afterAll(async () => {
  await pool.end();
  await owner.query(`DROP DATABASE ${database}`);
  await owner.end();
});
beforeEach(async () => {
  await pool.query('TRUNCATE accounts,challenges CASCADE');
  state = originalState();
});
it('preserves the account UUID, revokes old sessions and consumes the challenge once', async () => {
  const original = await login(old),
    c = await claim();
  const recovered = await c.finish();
  expect(recovered.account.id).toBe(original.account.id);
  expect(recovered.account.signingKey).toBe(next.toPublic().toString());
  expect(await readSession(pool, original.token)).toBeUndefined();
  await expect(c.finish()).rejects.toThrow('AUTH_INVALID');
  expect((await readSession(pool, recovered.token))?.id).toBe(original.account.id);
});
it('reconstructs a service profile when the original database is lost', async () => {
  const c = await claim(),
    recovered = await c.finish();
  expect(recovered.account.signingKey).toBe(next.toPublic().toString());
  expect((await pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n).toBe(1);
});
it('rejects wrong origin, forged new-key proof and changed on-chain control', async () => {
  await expect((await claim('http://localhost:9999')).finish()).rejects.toThrow('AUTH_INVALID');
  await expect((await claim(origin, old)).finish()).rejects.toThrow('AUTH_INVALID');
  const c = await claim();
  if (!state.member) throw new Error('CONTACT_FIXTURE');
  state.member.signing_key = old.toPublic().toString();
  await expect(c.finish()).rejects.toThrow('CONTACT_RECOVERY_CHANGED');
});
it('does not merge two existing profiles', async () => {
  const original = await login(old),
    replacement = await login(next);
  await expect((await claim()).finish()).rejects.toThrow('CONTACT_RECOVERY_IDENTITY_CONFLICT');
  expect((await readSession(pool, original.token))?.id).toBe(original.account.id);
  expect((await readSession(pool, replacement.token))?.id).toBe(replacement.account.id);
});
it('serializes competing completion claims without creating a second profile', async () => {
  await login(old);
  const a = await claim(),
    b = await claim();
  const results = await Promise.allSettled([a.finish(), b.finish()]);
  expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  expect((await pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n).toBe(1);
});

it('rejects a stale restored session and a fresh login with a retired key', async () => {
  const { createServer } = await import('../../services/api/src/server.js');
  const { authChain } = await import('../helpers/auth-chain.js');
  const original = await login(old);
  const app = await createServer(
    pool,
    { ...authChain, accountKeyRetired: async (key) => key === old.toPublic().toString() },
    origin,
  );
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { origin, cookie: 'daclify_session=' + original.token },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('ACCOUNT_KEY_RETIRED');
    const c = await createChallenge(
      pool,
      { signingKey: old.toPublic().toString(), encryptionKey: encryption },
      origin,
    );
    const attempt = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin },
      payload: {
        challengeId: c.id,
        signature: old.signMessage(new TextEncoder().encode(c.message)).toString(),
        encryptionKey: encryption,
      },
    });
    expect(attempt.statusCode).toBe(401);
    expect(attempt.json().code).toBe('ACCOUNT_KEY_RETIRED');
  } finally {
    await app.close();
  }
});

it('keeps the service UUID when another DAO recovers a replacement lost during partial recovery', async () => {
  const original = await login(old),
    first = await claim(),
    recovered = await first.finish();
  const newest = PrivateKey.generate('K1');
  state = originalState();
  state.target.dao.daoId = '2';
  if (!state.member || !state.result || !state.identity) throw new Error('CONTACT_FIXTURE');
  state.member.signing_key = newest.toPublic().toString();
  state.result.request = {
    ...state.result.request,
    dao_id: '2',
    signing_key: newest.toPublic().toString(),
  };
  state.identity.signing_key = newest.toPublic().toString();
  const challenge = await createChallenge(
    pool,
    { signingKey: newest.toPublic().toString(), encryptionKey: encryption },
    origin,
  );
  const input = {
    target: state.target,
    requestId: '1',
    challengeId: challenge.id,
    signature: newest.signMessage(new TextEncoder().encode(challenge.message)).toString(),
    encryptionKey: encryption,
  };
  const result = await claimContactRecovery(pool, chain, input, origin, origin);
  expect(result.account.id).toBe(original.account.id);
  expect(await readSession(pool, recovered.token)).toBeUndefined();
  expect((await pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n).toBe(1);
});

it('finds the original UUID in a database snapshot from before the first replacement claim', async () => {
  const original = await login(old),
    newest = PrivateKey.generate('K1');
  if (!state.member || !state.result || !state.identity) throw new Error('CONTACT_FIXTURE');
  state.member.signing_key = newest.toPublic().toString();
  state.result.old_signing_key = next.toPublic().toString();
  state.result.request.signing_key = newest.toPublic().toString();
  state.identity.signing_key = newest.toPublic().toString();
  const c = await createChallenge(
    pool,
    { signingKey: newest.toPublic().toString(), encryptionKey: encryption },
    origin,
  );
  const restored = await claimContactRecovery(
    pool,
    chain,
    {
      target: state.target,
      requestId: '1',
      challengeId: c.id,
      signature: newest.signMessage(new TextEncoder().encode(c.message)).toString(),
      encryptionKey: encryption,
    },
    origin,
    origin,
  );
  expect(restored.account.id).toBe(original.account.id);
});
it('does not revoke fresh sessions when another membership completes with the same replacement key', async () => {
  await login(old);
  const first = await claim(),
    current = await first.finish();
  state.target.dao.daoId = '2';
  if (!state.result) throw new Error('CONTACT_FIXTURE');
  state.result.request.dao_id = '2';
  const c = await createChallenge(
    pool,
    { signingKey: next.toPublic().toString(), encryptionKey: encryption },
    origin,
  );
  const second = await claimContactRecovery(
    pool,
    chain,
    {
      target: state.target,
      requestId: '1',
      challengeId: c.id,
      signature: next.signMessage(new TextEncoder().encode(c.message)).toString(),
      encryptionKey: encryption,
    },
    origin,
    origin,
  );
  expect(second.account.id).toBe(current.account.id);
  expect((await readSession(pool, current.token))?.id).toBe(current.account.id);
});

it('requires the recovery claim before registering the replacement key as a separate profile', async () => {
  const { createServer } = await import('../../services/api/src/server.js');
  const { authChain } = await import('../helpers/auth-chain.js');
  const original = await login(old);
  const app = await createServer(
    pool,
    {
      ...authChain,
      ...chain,
      accountRecoveryIdentity: async () => {
        if (!state.identity) throw new Error('CONTACT_FIXTURE');
        return {
          network: { chainId: state.target.dao.chainId, runtime: state.target.dao.contract },
          identity: state.identity,
        };
      },
    },
    origin,
  );
  try {
    const c = await claim();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin },
      payload: {
        challengeId: c.input.challengeId,
        signature: c.input.signature,
        encryptionKey: encryption,
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('CONTACT_RECOVERY_CLAIM_REQUIRED');
    expect((await pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n).toBe(1);
    expect((await c.finish()).account.id).toBe(original.account.id);
  } finally {
    await app.close();
  }
});
