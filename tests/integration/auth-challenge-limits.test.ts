import { afterAll, beforeAll, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { createServer } from '../../services/api/src/server.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { cleanupExpiredChallenges, createChallenge } from '../../services/api/src/auth.js';
import { migrate } from '../../services/api/src/store.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const encryptionKey = EncryptionPublicKeySchema.parse({
  kty: 'EC',
  crv: 'P-256',
  x: jwk.x,
  y: jwk.y,
});
beforeAll(() => migrate(pool));
afterAll(() => pool.end());

it('limits unauthenticated challenge inserts before touching the database', async () => {
  const signingKey = PrivateKey.generate('K1').toPublic().toString();
  const chain = new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:1',
    chainId: 'ab'.repeat(32),
    runtime: 'core',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
  const app = await createServer(pool, chain, origin);
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++)
      statuses.push(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/auth/challenge',
            remoteAddress: '203.0.113.5',
            headers: { origin },
            payload: { signingKey, encryptionKey },
          })
        ).statusCode,
      );
    expect(statuses.filter((status) => status === 200)).toHaveLength(20);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
    expect(
      Number(
        (
          await pool.query('SELECT count(*) AS total FROM challenges WHERE signing_key=$1', [
            signingKey,
          ])
        ).rows[0].total,
      ),
    ).toBe(20);
  } finally {
    await app.close();
  }
});
it('removes expired challenges in bounded batches while keeping active login proofs', async () => {
  await pool.query('DELETE FROM challenges WHERE expires_at<=now()');
  const signingKey = PrivateKey.generate('K1').toPublic().toString();
  const input = { signingKey, encryptionKey };
  const expired = await Promise.all([0, 1, 2].map(() => createChallenge(pool, input, origin)));
  const ids = expired.map((row) => row.id);
  await pool.query(
    "UPDATE challenges SET expires_at=now()-interval '1 minute' WHERE id=ANY($1::uuid[])",
    [ids],
  );
  const active = await createChallenge(pool, input, origin);
  expect(await cleanupExpiredChallenges(pool, 2)).toBe(2);
  expect(
    Number(
      (await pool.query('SELECT count(*) AS total FROM challenges WHERE id=ANY($1::uuid[])', [ids]))
        .rows[0].total,
    ),
  ).toBe(1);
  expect(await cleanupExpiredChallenges(pool, 2)).toBe(1);
  expect((await pool.query('SELECT id FROM challenges WHERE id=$1', [active.id])).rowCount).toBe(1);
});

it('admits visitors behind an unchanged shared proxy while ignoring forged forwarding headers', async () => {
  const signingKey = PrivateKey.generate('K1').toPublic().toString();
  const chain = new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:1',
    chainId: 'ab'.repeat(32),
    runtime: 'core',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
  const app = await createServer(pool, chain, origin, { sharedProxyIps: ['192.168.5.1'] });
  app.get('/fixture/peer', async (request) => ({ ip: request.ip, protocol: request.protocol }));
  try {
    const headers = {
      origin,
      'x-forwarded-for': '203.0.113.99',
      'x-forwarded-proto': 'https',
    };
    expect(
      (await app.inject({ url: '/fixture/peer', remoteAddress: '192.168.5.1', headers })).json(),
    ).toEqual({ ip: '192.168.5.1', protocol: 'http' });
    for (const [remoteAddress, expectedAllowed] of [
      ['192.168.5.1', 25],
      ['192.168.5.2', 20],
    ] as const) {
      for (const [url, payload] of [
        ['/v1/auth/challenge', { signingKey, encryptionKey }],
        ['/v1/sign-in/passkey/login/options', {}],
      ] as const) {
        const statuses = [];
        for (let i = 0; i < 25; i++) {
          const response = await app.inject({
            method: 'POST',
            url,
            remoteAddress,
            headers: { ...headers, 'x-forwarded-for': `203.0.113.${i + 1}` },
            payload,
          });
          statuses.push(response.statusCode);
        }
        expect(statuses.filter((status) => status === 200)).toHaveLength(expectedAllowed);
        expect(statuses.filter((status) => status === 429)).toHaveLength(25 - expectedAllowed);
      }
    }
    expect(
      Number(
        (
          await pool.query('SELECT count(*) AS total FROM challenges WHERE signing_key=$1', [
            signingKey,
          ])
        ).rows[0].total,
      ),
    ).toBe(45);
  } finally {
    await app.close();
  }
});
