import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createServer } from '../../services/api/src/server.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { migrate } from '../../services/api/src/store.js';
import { NetworkSchema } from '../../protocol/api.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname)
)
  throw new Error('Owned local test DB required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const unavailable = async (): Promise<never> => {
  throw new Error('Unavailable fixture');
};
const chain: ChainGateway = {
  network: async () =>
    NetworkSchema.parse({
      chainId: 'ab'.repeat(32),
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      rpcUrl: 'http://localhost:18888',
      environment: 'local',
      interfaceVersion: 1,
      coreVersion: '0.6.0-alpha.1',
      capabilities: [],
    }),
  governance: unavailable,
  execute: unavailable,
  treasury: unavailable,
  settle: unavailable,
  finalize: unavailable,
  content: unavailable,
  dao: unavailable,
  moduleState: unavailable,
  listDaos: async () => [],
  memberships: async () => [],
  memberProfile: unavailable,
  createDao: unavailable,
  relay: unavailable,
};
const app = await createServer(pool, chain, origin);
beforeAll(() => migrate(pool));
afterAll(async () => {
  await app.close();
  await pool.end();
});
it('registers payment endpoints with distinct server and browser authentication boundaries', async () => {
  const query = encodeURIComponent(
    JSON.stringify({
      chainId: 'ab'.repeat(32),
      contract: 'daclifycore',
      daoId: '1',
      interfaceVersion: 1,
    }),
  );
  const response = await app.inject('/v1/payments/catalogue?dao=' + query);
  expect(response.statusCode).toBe(503);
  expect(response.json()).toMatchObject({ code: 'PAYMENTS_UNCONFIGURED' });
  const input = {
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    productId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    customerReference: 'customer',
  };
  expect(
    (await app.inject({ method: 'POST', url: '/v1/payments/broker/checkout', payload: input }))
      .statusCode,
  ).toBe(401);
  expect(
    (await app.inject({ method: 'POST', url: '/v1/payments/onboard', payload: {} })).statusCode,
  ).toBe(403);
  expect(
    (await app.inject({ method: 'POST', url: '/v1/payments/stripe/webhook', payload: {} }))
      .statusCode,
  ).toBe(400);
});
