import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { DaoRefSchema } from '../../protocol/base.js';
import { storageFunding } from '../../services/api/src/billing/storage-state.js';
import { migrate } from '../../services/api/src/store.js';
import { DEFAULT_STORAGE_PRICING, storagePricingHash } from '../../protocol/storage.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
const account = randomUUID(),
  subscription = randomUUID(),
  approval = randomUUID(),
  key = storagePricingHash(DEFAULT_STORAGE_PRICING);
const dao = DaoRefSchema.parse({
  chainId: 'cd'.repeat(32),
  contract: 'daclifycore',
  daoId: BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 16)).toString(),
  interfaceVersion: 1,
});
beforeAll(async () => {
  await migrate(pool);
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
    [account, PrivateKey.generate('K1').toPublic().toString(), 'user-controlled', {}],
  );
  await pool.query(
    'INSERT INTO storage_prices(policy_key,pricing) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [key, DEFAULT_STORAGE_PRICING],
  );
  await pool.query(
    'INSERT INTO storage_subscriptions(id,dao_key,dao,provider_scope,created_by,initial_request) VALUES($1,$2,$3,$4,$5,$6)',
    [
      subscription,
      JSON.stringify([dao.chainId, dao.contract, dao.daoId]),
      dao,
      randomUUID(),
      account,
      approval,
    ],
  );
});
afterAll(() => pool.end());
it('stores exact immutable consent and refuses understated monthly amounts', async () => {
  const insert = `INSERT INTO storage_approvals(request_id,subscription_id,approved_by,pricing,pricing_hash,price_key,units,monthly_usd_cents,recurring_consent) VALUES($1,$2,$3,$4,$5,$5,1,$6,$7)`;
  const args = [approval, subscription, account, DEFAULT_STORAGE_PRICING, key];
  await expect(pool.query(insert, [...args, 1, true])).rejects.toThrow();
  await expect(pool.query(insert, [...args, 100, false])).rejects.toThrow();
  await pool.query(insert, [...args, 100, true]);
  await expect(
    pool.query('UPDATE storage_approvals SET units=2,monthly_usd_cents=200 WHERE request_id=$1', [
      approval,
    ]),
  ).rejects.toThrow('STORAGE_APPROVAL_IMMUTABLE');
  await expect(
    pool.query('DELETE FROM storage_approvals WHERE request_id=$1', [approval]),
  ).rejects.toThrow('STORAGE_APPROVAL_IMMUTABLE');
});
it('preserves invoice identity and original period when payment state changes', async () => {
  const invoice = 'in_' + randomUUID().replaceAll('-', '');
  await pool.query(
    `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end) VALUES($1,$2,$3,'2026-10-31T10:30:00Z','2026-11-30T10:30:00Z')`,
    [invoice, subscription, approval],
  );
  await expect(
    pool.query("UPDATE storage_invoices SET state='verified' WHERE invoice_id=$1", [invoice]),
  ).rejects.toThrow();
  await pool.query(
    "UPDATE storage_invoices SET state='verified',verified_at=now() WHERE invoice_id=$1",
    [invoice],
  );
  await expect(
    pool.query(
      "UPDATE storage_invoices SET period_end='2027-01-31T10:30:00Z' WHERE invoice_id=$1",
      [invoice],
    ),
  ).rejects.toThrow('STORAGE_PERIOD_IMMUTABLE');
  await pool.query("UPDATE storage_invoices SET state='revoked' WHERE invoice_id=$1", [invoice]);
  expect(
    (
      await pool.query<{ period_end: Date; state: string }>(
        'SELECT period_end,state FROM storage_invoices WHERE invoice_id=$1',
        [invoice],
      )
    ).rows[0],
  ).toEqual({ period_end: new Date('2026-11-30T10:30:00Z'), state: 'revoked' });
});

it('refuses an invoice dependency from another DAO subscription', async () => {
  const second = randomUUID(),
    secondApproval = randomUUID(),
    secondDao = { ...dao, daoId: (BigInt(dao.daoId) + 1n).toString() };
  await pool.query(
    'INSERT INTO storage_subscriptions(id,dao_key,dao,provider_scope,created_by,initial_request) VALUES($1,$2,$3,$4,$5,$6)',
    [
      second,
      JSON.stringify([secondDao.chainId, secondDao.contract, secondDao.daoId]),
      secondDao,
      randomUUID(),
      account,
      secondApproval,
    ],
  );
  await pool.query(
    `INSERT INTO storage_approvals(request_id,subscription_id,approved_by,pricing,pricing_hash,price_key,units,monthly_usd_cents,recurring_consent) VALUES($1,$2,$3,$4,$5,$5,1,100,true)`,
    [secondApproval, second, account, DEFAULT_STORAGE_PRICING, key],
  );
  const base = 'in_' + randomUUID().replaceAll('-', ''),
    child = 'in_' + randomUUID().replaceAll('-', '');
  await pool.query(
    `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end) VALUES($1,$2,$3,'2026-10-31T10:30:00Z','2026-11-30T10:30:00Z')`,
    [base, subscription, approval],
  );
  await expect(
    pool.query(
      `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,base_invoice) VALUES($1,$2,$3,'2026-11-15T10:30:00Z','2026-11-30T10:30:00Z',$4)`,
      [child, second, secondApproval, base],
    ),
  ).rejects.toThrow();
});

it('grants only verified current terms, retains through grace and keeps the original revoked deadline', async () => {
  const ownSubscription = randomUUID(),
    ownApproval = randomUUID(),
    scope = randomUUID(),
    ownDao = { ...dao, daoId: (BigInt(dao.daoId) + 2n).toString() };
  await pool.query(
    'INSERT INTO storage_subscriptions(id,dao_key,dao,provider_scope,created_by,initial_request) VALUES($1,$2,$3,$4,$5,$6)',
    [
      ownSubscription,
      JSON.stringify([ownDao.chainId, ownDao.contract, ownDao.daoId]),
      ownDao,
      scope,
      account,
      ownApproval,
    ],
  );
  await pool.query(
    `INSERT INTO storage_approvals(request_id,subscription_id,approved_by,pricing,pricing_hash,price_key,units,monthly_usd_cents,recurring_consent) VALUES($1,$2,$3,$4,$5,$5,1,100,true)`,
    [ownApproval, ownSubscription, account, DEFAULT_STORAGE_PRICING, key],
  );
  const invoice = 'in_' + randomUUID().replaceAll('-', '');
  await pool.query(
    `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end) VALUES($1,$2,$3,'2027-01-31T10:30:00Z','2027-02-28T10:30:00Z')`,
    [invoice, ownSubscription, ownApproval],
  );
  const read = (time: string) =>
    storageFunding(pool, ownDao, scope, DEFAULT_STORAGE_PRICING, new Date(time));
  expect((await read('2027-02-01T00:00:00Z')).uploadCapacityBytes).toBe('100000000');
  await pool.query(
    "UPDATE storage_invoices SET state='verified',verified_at=now() WHERE invoice_id=$1",
    [invoice],
  );
  expect(await read('2027-01-01T00:00:00Z')).toMatchObject({
    state: 'pending',
    uploadCapacityBytes: '100000000',
  });
  expect(await read('2027-02-01T00:00:00Z')).toMatchObject({
    state: 'active',
    uploadCapacityBytes: '1100000000',
    retainedCapacityBytes: '1100000000',
  });
  expect(await read('2027-02-28T10:30:00Z')).toMatchObject({
    state: 'grace',
    uploadCapacityBytes: '100000000',
    retainedCapacityBytes: '1100000000',
    graceEndsAt: '2027-03-30T10:30:00.000Z',
  });
  expect(await read('2027-03-30T10:30:00Z')).toMatchObject({
    state: 'overdue',
    retainedCapacityBytes: '100000000',
  });
  await pool.query("UPDATE storage_invoices SET state='revoked' WHERE invoice_id=$1", [invoice]);
  expect(await read('2027-03-01T00:00:00Z')).toMatchObject({
    state: 'grace',
    uploadCapacityBytes: '100000000',
    graceEndsAt: '2027-03-30T10:30:00.000Z',
  });
});

it('falls back to the funded base capacity after an upgrade refund and preserves uncertain extra retention', async () => {
  const scope = randomUUID(),
    ownSubscription = randomUUID(),
    ownApproval = randomUUID(),
    upgrade = randomUUID(),
    ownDao = { ...dao, daoId: (BigInt(dao.daoId) + 3n).toString() };
  await pool.query(
    'INSERT INTO storage_subscriptions(id,dao_key,dao,provider_scope,created_by,initial_request) VALUES($1,$2,$3,$4,$5,$6)',
    [
      ownSubscription,
      JSON.stringify([ownDao.chainId, ownDao.contract, ownDao.daoId]),
      ownDao,
      scope,
      account,
      ownApproval,
    ],
  );
  for (const [id, units] of [
    [ownApproval, 1],
    [upgrade, 2],
  ] as const)
    await pool.query(
      `INSERT INTO storage_approvals(request_id,subscription_id,approved_by,pricing,pricing_hash,price_key,units,monthly_usd_cents,recurring_consent) VALUES($1,$2,$3,$4,$5,$5,$6,$7,true)`,
      [id, ownSubscription, account, DEFAULT_STORAGE_PRICING, key, units, units * 100],
    );
  const base = 'in_' + randomUUID().replaceAll('-', ''),
    child = 'in_' + randomUUID().replaceAll('-', '');
  await pool.query(
    `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,state,verified_at) VALUES($1,$2,$3,'2027-01-31T10:30:00Z','2027-02-28T10:30:00Z','verified',now())`,
    [base, ownSubscription, ownApproval],
  );
  await pool.query(
    `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,base_invoice,state,verified_at) VALUES($1,$2,$3,'2027-02-15T10:30:00Z','2027-02-28T10:30:00Z',$4,'verified',now())`,
    [child, ownSubscription, upgrade, base],
  );
  const read = () =>
    storageFunding(pool, ownDao, scope, DEFAULT_STORAGE_PRICING, new Date('2027-02-20T10:30:00Z'));
  expect((await read()).uploadCapacityBytes).toBe('2100000000');
  await pool.query("UPDATE storage_invoices SET state='revoked' WHERE invoice_id=$1", [child]);
  expect((await read()).uploadCapacityBytes).toBe('1100000000');
  await pool.query("UPDATE storage_invoices SET state='review' WHERE invoice_id=$1", [child]);
  expect(await read()).toMatchObject({
    state: 'review',
    uploadCapacityBytes: '1100000000',
    retainedCapacityBytes: '2100000000',
    graceEndsAt: '2027-03-30T10:30:00.000Z',
  });
  await pool.query("UPDATE storage_invoices SET state='verified' WHERE invoice_id=$1", [child]);
  await pool.query(
    `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,state,verified_at) VALUES($1,$2,$3,'2027-02-28T10:30:00Z','2027-03-31T10:30:00Z','verified',now())`,
    ['in_' + randomUUID().replaceAll('-', ''), ownSubscription, ownApproval],
  );
  expect(
    await storageFunding(
      pool,
      ownDao,
      scope,
      DEFAULT_STORAGE_PRICING,
      new Date('2027-03-01T10:30:00Z'),
    ),
  ).toMatchObject({
    state: 'active',
    uploadCapacityBytes: '1100000000',
    retainedCapacityBytes: '2100000000',
    graceEndsAt: '2027-03-30T10:30:00.000Z',
  });
  expect(
    (
      await storageFunding(
        pool,
        ownDao,
        scope,
        DEFAULT_STORAGE_PRICING,
        new Date('2027-03-30T10:30:00Z'),
      )
    ).retainedCapacityBytes,
  ).toBe('1100000000');
});
