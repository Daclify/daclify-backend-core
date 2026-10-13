import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createHash, createHmac, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { generateKeyPair, SignJWT } from 'jose';
import { migrate } from '../../services/api/src/store.js';
import { createServer } from '../../services/api/src/server.js';
import { authChain } from '../helpers/auth-chain.js';
import { McpOAuth } from '../../services/api/src/mcp/oauth.js';
import { McpPairings } from '../../services/api/src/mcp/pairing.js';
import { beginAccountControl, consumeAccountControl } from '../../services/api/src/auth/intent.js';
import { AccountSchema, SessionSchema } from '../../protocol/api.js';

const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || !new URL(url).pathname.endsWith('_test'))
  throw Error('Owned test database required');
const pool = new Pool({ connectionString: url }),
  origin = 'http://localhost:5178',
  audience = 'http://localhost:3112',
  bot = '12345:owned-fixture-token',
  keys = await generateKeyPair('RS256');
const server = await createServer(pool, authChain, origin, {
  apiOrigin: audience,
  mcpOAuth: new McpOAuth(new McpPairings(pool, authChain, audience, origin), [
    { clientId: 'owned-client', redirectUris: ['https://client.example/callback'] },
  ]),
  providers: {
    google: { clientId: 'owned-google', key: keys.publicKey },
    telegram: { botToken: bot },
  },
});
const owned: string[] = [];
beforeAll(() => migrate(pool));
afterAll(async () => {
  await server.close();
  for (const accountId of owned) {
    await pool.query('DELETE FROM account_control_intents WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM sessions WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM credentials WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM passkeys WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM native_links WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM evm_links WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM audit_events WHERE account_id=$1', [accountId]);
    await pool.query('DELETE FROM accounts WHERE id=$1', [accountId]);
  }
  await pool.end();
});
async function login(provider: 'google' | 'telegram' = 'google') {
  const encryption = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey: { kty: 'EC', crv: 'P-256', x: encryption.x, y: encryption.y },
    custody: 'user-controlled',
  });
  owned.push(account.id);
  const subject =
      provider === 'google'
        ? randomUUID()
        : String(parseInt(randomBytes(6).toString('hex'), 16) + 1),
    nonce = randomBytes(32).toString('base64url');
  await pool.query(
    'INSERT INTO accounts(id,custody,signing_key,encryption_key) VALUES($1,$2,$3,$4)',
    [account.id, account.custody, account.signingKey, account.encryptionKey],
  );
  await pool.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
    provider + ':' + subject,
    account.id,
  ]);
  const fields = new URLSearchParams({
    id: subject,
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  fields.set(
    'hash',
    createHmac('sha256', createHash('sha256').update(bot).digest())
      .update(
        [...fields]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, value]) => name + '=' + value)
          .join('\n'),
      )
      .digest('hex'),
  );
  const proof =
    provider === 'google'
      ? await new SignJWT({ nonce })
          .setProtectedHeader({ alg: 'RS256' })
          .setIssuer('https://accounts.google.com')
          .setSubject(subject)
          .setAudience('owned-google')
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(keys.privateKey)
      : fields.toString();
  const response = await server.inject({
    method: 'POST',
    url: '/v1/auth/providers/login',
    headers: { origin },
    payload: { provider, proof, ...(provider === 'google' ? { nonce } : {}) },
  });
  expect(response.statusCode, response.body).toBe(200);
  const session = SessionSchema.parse(response.json()),
    token = response.cookies.find((cookie) => cookie.name === 'daclify_session')?.value;
  if (!token) throw Error('Fixture session missing');
  return {
    account: session.account,
    token,
    headers: { origin, cookie: 'daclify_session=' + token, 'x-csrf-token': session.csrfToken },
  };
}
const approvalBody = Buffer.from(
  JSON.stringify({
    id: randomUUID(),
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    memberId: '1',
    nativeScopes: ['vote'],
    localGrantId: null,
  }),
);
async function intent(
  current: Awaited<ReturnType<typeof login>>,
  path = '/v1/mcp/oauth/approve',
  body = approvalBody,
) {
  return beginAccountControl(
    pool,
    current.account,
    current.token,
    origin,
    { path, bodyHash: createHash('sha256').update(body).digest('hex') },
    audience,
  );
}
async function consume(
  current: Awaited<ReturnType<typeof login>>,
  challenge: { id: string },
  path = '/v1/mcp/oauth/approve',
  body = approvalBody,
) {
  return consumeAccountControl(
    pool,
    current.account,
    current.token,
    path,
    body,
    challenge.id,
    { kind: 'sign-in' },
    authChain.network,
    origin,
    audience,
  );
}
it.each(['google', 'telegram'] as const)(
  'accepts a fresh verified paired %s login without vault keys and refuses reuse',
  async (provider) => {
    const current = await login(provider),
      challenge = await intent(current);
    await expect(consume(current, challenge)).resolves.toBeUndefined();
    await expect(consume(current, challenge)).rejects.toThrow('ACCOUNT_CONTROL_REQUIRED');
  },
);
it.each(['native', 'evm', 'passkey'] as const)(
  'checks stored %s pairing provenance before accepting a recent login',
  async (kind) => {
    const current = await login(),
      chainId = 'ab'.repeat(32),
      address = '0x' + randomBytes(20).toString('hex'),
      credential = randomBytes(180);
    let credentialKey: string;
    if (kind === 'native') {
      const account =
        'pair' +
        randomBytes(4)
          .toString('hex')
          .replace(/[06789a-f]/g, '1');
      await pool.query(
        "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,$3,'active')",
        [current.account.id, chainId, account],
      );
      credentialKey = 'native:' + chainId + ':' + account;
    } else if (kind === 'evm') {
      await pool.query(
        'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,41,$2,now())',
        [current.account.id, address],
      );
      credentialKey = 'evm:41:' + address;
    } else {
      await pool.query(
        'INSERT INTO passkeys(account_id,credential_id,public_key,sign_count) VALUES($1,$2,$3,0)',
        [current.account.id, credential, randomBytes(65)],
      );
      credentialKey = 'passkey:' + credential.toString('base64url');
    }
    await pool.query('UPDATE sessions SET credential_key=$2 WHERE account_id=$1', [
      current.account.id,
      credentialKey,
    ]);
    await expect(consume(current, await intent(current))).resolves.toBeUndefined();
    if (kind === 'native')
      await pool.query('DELETE FROM native_links WHERE account_id=$1', [current.account.id]);
    else if (kind === 'evm')
      await pool.query('UPDATE evm_links SET control_verified_at=NULL WHERE account_id=$1', [
        current.account.id,
      ]);
    else await pool.query('DELETE FROM passkeys WHERE account_id=$1', [current.account.id]);
    await expect(consume(current, await intent(current))).rejects.toThrow('MCP_SIGN_IN_REQUIRED');
  },
);
it('does not infer paired sign-in approval from a key-only session', async () => {
  const current = await login();
  await pool.query('UPDATE sessions SET credential_key=NULL WHERE account_id=$1', [
    current.account.id,
  ]);
  await expect(consume(current, await intent(current))).rejects.toThrow('MCP_SIGN_IN_REQUIRED');
});
it('does not treat CSRF/session resumption as fresh authentication', async () => {
  const current = await login();
  await pool.query(
    "UPDATE sessions SET step_up_at=now()-interval '6 minutes' WHERE account_id=$1",
    [current.account.id],
  );
  const resumed = await server.inject({
    method: 'POST',
    url: '/v1/sign-in/session',
    headers: current.headers,
    payload: {},
  });
  expect(resumed.statusCode).toBe(200);
  await expect(consume(current, await intent(current))).rejects.toThrow('MCP_SIGN_IN_REQUIRED');
});
it('rejects removed credentials and revoked sessions even with a valid one-use intent', async () => {
  const removed = await login(),
    revoked = await login();
  const removedIntent = await intent(removed),
    revokedIntent = await intent(revoked);
  await pool.query('DELETE FROM credentials WHERE account_id=$1', [removed.account.id]);
  await pool.query('UPDATE sessions SET revoked_at=now() WHERE account_id=$1', [
    revoked.account.id,
  ]);
  await expect(consume(removed, removedIntent)).rejects.toThrow('MCP_SIGN_IN_REQUIRED');
  await expect(consume(revoked, revokedIntent)).rejects.toThrow('MCP_SIGN_IN_REQUIRED');
});
it('keeps the proof bound to the exact body, browser session, origin and API audience', async () => {
  const current = await login();
  await expect(
    consume(current, await intent(current), undefined, Buffer.from('{}')),
  ).rejects.toThrow('ACCOUNT_CONTROL_REQUIRED');
  const other = { ...current, token: randomBytes(32).toString('base64url') };
  await expect(consume(other, await intent(current))).rejects.toThrow('ACCOUNT_CONTROL_REQUIRED');
  for (const [site, api] of [
    ['https://foreign.example', audience],
    [origin, 'https://foreign.example'],
  ] as const) {
    const challenge = await intent(current);
    await expect(
      consumeAccountControl(
        pool,
        current.account,
        current.token,
        '/v1/mcp/oauth/approve',
        approvalBody,
        challenge.id,
        { kind: 'sign-in' },
        authChain.network,
        site,
        api,
      ),
    ).rejects.toThrow('ACCOUNT_CONTROL_REQUIRED');
  }
});
it('never accepts a paired login proof for credential changes, native delegation, key sharing or erasure', async () => {
  const current = await login();
  for (const path of [
    '/v1/auth/providers/unlink',
    '/v1/mcp/pairings/approve',
    '/v1/profiles/keys/share',
    '/v1/me/exit',
  ])
    await expect(consume(current, await intent(current, path), path)).rejects.toThrow(
      'ACCOUNT_CONTROL_REQUIRED',
    );
});
it('reports fresh approval availability only to the authenticated session', async () => {
  const current = await login();
  const fresh = await server.inject({
    method: 'GET',
    url: '/v1/mcp/oauth/sign-in-approval',
    headers: current.headers,
  });
  expect(fresh.statusCode).toBe(200);
  expect(Date.parse(fresh.json().expires)).toBeGreaterThan(Date.now());
  await pool.query(
    "UPDATE sessions SET step_up_at=now()-interval '6 minutes' WHERE account_id=$1",
    [current.account.id],
  );
  const stale = await server.inject({
    method: 'GET',
    url: '/v1/mcp/oauth/sign-in-approval',
    headers: current.headers,
  });
  expect(stale.json()).toEqual({ expires: null });
  const anonymous = await server.inject({ method: 'GET', url: '/v1/mcp/oauth/sign-in-approval' });
  expect(anonymous.statusCode).toBe(401);
});
