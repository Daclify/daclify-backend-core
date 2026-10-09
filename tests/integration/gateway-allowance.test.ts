import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrate } from '../../services/api/src/store.js';
import {
  GatewayAllowance,
  registerGatewayAllowance,
} from '../../services/api/src/content/gateway-allowance.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Isolated local test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());
const gateway = 'https://fixture.mypinata.cloud';
function grant() {
  const now = Date.now();
  return {
    id: randomUUID(),
    providerScope: 'gateway-' + randomUUID(),
    gateway,
    startsAt: new Date(now - 60000).toISOString(),
    endsAt: new Date(now + 3600000).toISOString(),
    byteLimit: '100',
    requestLimit: '3',
    fundingReference: 'owned-fixture-not-provider-funding',
  };
}
it('reserves atomically across processes and preserves consumed capacity after restart', async () => {
  const funding = grant();
  await registerGatewayAllowance(pool, funding);
  const first = new GatewayAllowance(pool, funding.providerScope, gateway, funding.id);
  const second = new GatewayAllowance(pool, funding.providerScope, gateway, funding.id);
  const results = await Promise.allSettled([
    first.reserve(40),
    second.reserve(40),
    first.reserve(40),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  expect(await second.status()).toMatchObject({
    byteLimit: '100',
    reservedBytes: '80',
    requestLimit: '3',
    requests: '2',
  });
  await second.reserve(20);
  await expect(first.reserve(1)).rejects.toThrow('CONTENT_GATEWAY_ALLOWANCE_EXHAUSTED');
  expect(await first.status()).toMatchObject({
    state: 'exhausted',
    reservedBytes: '100',
    requests: '3',
  });
});
it('requires the exact account, gateway, active period and pre-existing allowance', async () => {
  const funding = grant();
  await registerGatewayAllowance(pool, funding);
  for (const allowance of [
    new GatewayAllowance(pool, funding.providerScope, gateway, null),
    new GatewayAllowance(pool, funding.providerScope, gateway, randomUUID()),
    new GatewayAllowance(pool, funding.providerScope + '-other', gateway, funding.id),
    new GatewayAllowance(pool, funding.providerScope, 'https://other.mypinata.cloud', funding.id),
  ])
    await expect(allowance.reserve(1)).rejects.toThrow('CONTENT_GATEWAY_ALLOWANCE_REQUIRED');
  const past = {
    ...grant(),
    startsAt: new Date(Date.now() - 7200000).toISOString(),
    endsAt: new Date(Date.now() - 3600000).toISOString(),
  };
  await registerGatewayAllowance(pool, past);
  const expired = new GatewayAllowance(pool, past.providerScope, gateway, past.id);
  await expect(expired.reserve(1)).rejects.toThrow('CONTENT_GATEWAY_ALLOWANCE_EXPIRED');
  expect(await expired.status()).toMatchObject({ state: 'expired', reservedBytes: '0' });
});
it('does not replenish on registration retries and rejects changed or overlapping funding', async () => {
  const funding = grant();
  await registerGatewayAllowance(pool, funding);
  const allowance = new GatewayAllowance(pool, funding.providerScope, gateway, funding.id);
  await allowance.reserve(25);
  await registerGatewayAllowance(pool, funding);
  expect(await allowance.status()).toMatchObject({ reservedBytes: '25', requests: '1' });
  await expect(registerGatewayAllowance(pool, { ...funding, byteLimit: '101' })).rejects.toThrow(
    'CONTENT_GATEWAY_ALLOWANCE_CHANGED',
  );
  const attempts = await Promise.allSettled([
    registerGatewayAllowance(pool, {
      ...funding,
      id: randomUUID(),
      fundingReference: 'second-funded-period',
    }),
    registerGatewayAllowance(pool, {
      ...funding,
      id: randomUUID(),
      fundingReference: 'third-funded-period',
    }),
  ]);
  expect(attempts.every((r) => r.status === 'rejected')).toBe(true);
  await expect(
    registerGatewayAllowance(pool, {
      ...grant(),
      endsAt: new Date(Date.now() + 40 * 86400000).toISOString(),
    }),
  ).rejects.toThrow();
});
it('never grants a new period automatically and refuses resetting persisted usage or funding', async () => {
  const funding = grant();
  await registerGatewayAllowance(pool, funding);
  const allowance = new GatewayAllowance(pool, funding.providerScope, gateway, funding.id);
  await allowance.reserve(10);
  await expect(
    pool.query('UPDATE gateway_allowances SET reserved_bytes=0 WHERE id=$1', [funding.id]),
  ).rejects.toThrow();
  await expect(
    pool.query('UPDATE gateway_allowances SET byte_limit=1000 WHERE id=$1', [funding.id]),
  ).rejects.toThrow();
  expect(await allowance.status()).toMatchObject({
    reservedBytes: '10',
    fundingQualification: 'operator-attested',
  });
});
it('enforces request capacity independently of bytes and does not admit future periods', async () => {
  const funding = { ...grant(), requestLimit: '1' };
  await registerGatewayAllowance(pool, funding);
  const allowance = new GatewayAllowance(pool, funding.providerScope, gateway, funding.id);
  await allowance.reserve(1);
  await expect(allowance.reserve(1)).rejects.toThrow('CONTENT_GATEWAY_ALLOWANCE_EXHAUSTED');
  expect(await allowance.status()).toMatchObject({
    state: 'exhausted',
    reservedBytes: '1',
    requests: '1',
  });
  const scheduled = {
    ...grant(),
    startsAt: new Date(Date.now() + 60000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
  };
  await registerGatewayAllowance(pool, scheduled);
  const future = new GatewayAllowance(pool, scheduled.providerScope, gateway, scheduled.id);
  await expect(future.reserve(1)).rejects.toThrow('CONTENT_GATEWAY_ALLOWANCE_EXPIRED');
  expect(await future.status()).toMatchObject({ state: 'scheduled', requests: '0' });
});
it('compares funding dates by their canonical instant on an exact registration retry', async () => {
  const start = Math.floor(Date.now() / 1000) * 1000 - 60000;
  const funding = {
    ...grant(),
    startsAt: new Date(start).toISOString().replace('.000Z', 'Z'),
    endsAt: new Date(start + 3600000).toISOString().replace('.000Z', 'Z'),
  };
  await registerGatewayAllowance(pool, funding);
  await registerGatewayAllowance(pool, funding);
  await registerGatewayAllowance(pool, {
    ...funding,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 3600000).toISOString(),
  });
});
