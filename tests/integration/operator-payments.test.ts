import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { migrate } from '../../services/api/src/store.js';
import {
  OperatorPayments,
  readOperatorPayments,
} from '../../services/api/src/payments/operator.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { AccountSchema, NetworkSchema, UserMembershipSchema } from '../../protocol/api.js';
import { PaymentOrderSchema } from '../../protocol/payments.js';
const database = process.env.DATABASE_URL;
if (
  !database ||
  !new URL(database).pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(new URL(database).hostname)
)
  throw new Error('Owned test DB required');
const pool = new Pool({ connectionString: database });
const dao = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '972834',
  interfaceVersion: 1 as const,
};
const network = NetworkSchema.parse({
  chainId: dao.chainId,
  runtime: dao.contract,
  hub: 'daclifyhub',
  rpcUrl: 'http://localhost:18888',
  environment: 'local',
  interfaceVersion: 1,
  coreVersion: '0.7.0-alpha.1',
  capabilities: [],
});
const unavailable = async (): Promise<never> => {
  throw new Error('Not in fixture');
};
let administrator = '';
const chain: ChainGateway = {
  network: async () => network,
  memberships: async (account) =>
    account.id === administrator
      ? [
          UserMembershipSchema.parse({
            dao,
            memberId: '1',
            nonce: '0',
            active: true,
            admin: true,
            reviewer: false,
            credits: '0',
            claim: '0',
            stake: '0',
            nativeAccount: '',
            custody: 'user-controlled',
            signingKey: account.signingKey,
          }),
        ]
      : [],
  governance: unavailable,
  execute: unavailable,
  treasury: unavailable,
  settle: unavailable,
  finalize: unavailable,
  content: unavailable,
  dao: unavailable,
  moduleState: unavailable,
  listDaos: async () => [],
  memberProfile: unavailable,
  createDao: unavailable,
  relay: unavailable,
};

const publicKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
function account() {
  return AccountSchema.parse({
    id: randomUUID(),
    signingKey: PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey: { kty: 'EC', crv: 'P-256', x: publicKey.x, y: publicKey.y },
    custody: 'user-controlled',
  });
}
const buyer = account(),
  other = account(),
  admin = account();
const token = 'dcp_' + 'a'.repeat(43),
  productId = randomUUID();
const config = readOperatorPayments(
  JSON.stringify({
    apiOrigin: 'https://central.example',
    frontendOrigin: 'https://app.example',
    daos: [{ dao, token }],
  }),
);
if (!config) throw new Error('Config missing');
const service = new OperatorPayments(pool, chain, config);
let response = PaymentOrderSchema.parse({
  id: randomUUID(),
  dao,
  productId,
  title: 'Workshop',
  moduleId: 'works',
  amountMinor: 1000,
  currency: 'usd',
  applicationFeeMinor: 50,
  policy: { basisPoints: 500, revision: '0' },
  state: 'paid',
  checkoutUrl: null,
  refundedMinor: 0,
  dispute: 'none',
});
const calls: { url: string; headers: Headers; body: unknown }[] = [];
beforeAll(async () => {
  await migrate(pool);
  for (const value of [buyer, other, admin])
    await pool.query(
      "INSERT INTO accounts(id,signing_key,encryption_key,custody)VALUES($1,$2,$3,'user-controlled')",
      [value.id, value.signingKey, value.encryptionKey],
    );
  administrator = admin.id;
  vi.stubGlobal('fetch', async (input: string, options?: RequestInit) => {
    calls.push({ url: input, headers: new Headers(options?.headers), body: options?.body });
    return Response.json(response);
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await pool.end();
});
it('binds retries and receipts to the local buyer, product and complete DAO', async () => {
  const requestId = randomUUID();
  const order = await service.checkout(dao, productId, requestId, 'account:' + buyer.id, buyer.id);
  expect(order.id).toBe(response.id);
  expect(calls.at(-1)?.headers.get('authorization')).toBe('Bearer ' + token);
  await expect(
    service.checkout(dao, productId, requestId, 'account:' + other.id, other.id),
  ).rejects.toMatchObject({ code: 'PAYMENT_REQUEST_CONFLICT' });
  await expect(service.readOrder(other, order.id)).rejects.toMatchObject({
    code: 'PAYMENT_ADMIN_REQUIRED',
  });
  expect((await service.readOrder(buyer, order.id)).id).toBe(order.id);
  expect((await service.readOrder(admin, order.id)).id).toBe(order.id);
  administrator = '';
  await expect(service.readOrder(admin, order.id)).rejects.toMatchObject({
    code: 'PAYMENT_ADMIN_REQUIRED',
  });
  response = { ...response, id: randomUUID() };
  await expect(
    service.checkout(dao, productId, requestId, 'account:' + buyer.id, buyer.id),
  ).rejects.toMatchObject({ code: 'PAYMENT_RECEIPT_INVALID' });
});
it('rejects foreign DAO configuration and keeps central merchant changes outside the broker', async () => {
  await expect(
    service.checkout(
      { ...dao, contract: 'otherdao' },
      productId,
      randomUUID(),
      'account:' + buyer.id,
      buyer.id,
    ),
  ).rejects.toMatchObject({ code: 'PAYMENT_DAO' });
  await expect(service.onboard(admin, dao, 'new', 'token')).rejects.toMatchObject({
    code: 'PAYMENT_PLATFORM_SETUP_REQUIRED',
  });
  expect(() =>
    readOperatorPayments(
      JSON.stringify({
        ...config,
        daos: [
          { dao, token },
          { dao, token },
        ],
      }),
    ),
  ).toThrow('PAYMENT_OPERATOR_CONFIGURATION_INVALID');
});
