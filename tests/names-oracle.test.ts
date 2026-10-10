import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { API, TimePoint } from '@greymass/eosio';
import { loadContract, send } from './helpers/vert.js';
const now = 1791669600;
let names: ReturnType<typeof loadContract>;
const singleton = (table: string) => {
  const accessor = names.tables[table];
  if (!accessor) throw new Error('FIXTURE_TABLE');
  const rows = accessor(names.toBigInt()).getTableRows();
  expect(rows).toHaveLength(1);
  return rows[0];
};
beforeEach(async () => {
  const chain = new Blockchain();
  chain.setTime(TimePoint.fromMilliseconds(now * 1000));
  chain.createAccounts('daclifycore', 'relay', 'outsider', 'eosio.token');
  names = loadContract(chain, 'names', '.artifacts/contracts/names');
  names.setPermissions([
    ...names.permissions,
    API.v1.AccountPermission.from({
      perm_name: 'oracle',
      parent: 'active',
      required_auth: {
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [{ permission: { actor: 'names', permission: 'eosio.code' }, weight: 1 }],
      },
    }),
  ]);
  await send(names, 'init', ['daclifycore', 'relay', 'eosio.token', '4,TLOS'], 'names@active');
  await send(names, 'setoracle', ['daclifycore', 176, 4, now - 100], 'daclifycore@active');
  await send(names, 'setprofit', ['daclifycore', 1, 100, 515, 29, now - 100], 'daclifycore@active');
});
it('updates the price observation without changing governance-controlled premiums', async () => {
  await send(names, 'observeprice', [190, 4, now - 1], 'names@oracle');
  expect(singleton('policy')).toMatchObject({
    median: 190,
    quoted_precision: 4,
    observed_at: now - 1,
    bump_bps: 2000,
    quote_premium_bps: 2000,
  });
});
it('updates the fixed fee observation without changing profit or percentage policy', async () => {
  await send(names, 'observefee', [51, now - 10], 'names@oracle');
  expect(singleton('profitcfg')).toMatchObject({
    version: 1,
    minimum_usd_cents: 100,
    card_fee_bps: 515,
    card_fixed_usd_cents: 51,
    fee_observed_at: now - 10,
  });
});
it.each([
  { median: 0, precision: 4, observed: now - 1, error: 'ORACLE' },
  { median: 1000000000001, precision: 4, observed: now - 1, error: 'ORACLE' },
  { median: 190, precision: 19, observed: now - 1, error: 'PRICE_SCALE' },
  { median: 190, precision: 4, observed: now + 1, error: 'ORACLE_TIMESTAMP' },
  { median: 190, precision: 4, observed: now - 901, error: 'ORACLE_TIMESTAMP' },
  { median: 190, precision: 4, observed: now - 100, error: 'ORACLE_TIMESTAMP' },
  { median: 190, precision: 4, observed: now - 101, error: 'ORACLE_TIMESTAMP' },
])(
  'rejects invalid or replayed price observations: $error/$observed/$median/$precision',
  async ({ median, precision, observed, error }) => {
    const before = singleton('policy');
    await expect(
      send(names, 'observeprice', [median, precision, observed], 'names@oracle'),
    ).rejects.toThrow(error);
    expect(singleton('policy')).toEqual(before);
  },
);
it.each([
  { fixed: 1000001, observed: now - 1 },
  { fixed: 51, observed: now + 1 },
  { fixed: 51, observed: now - 101 },
  { fixed: 51, observed: now - 604801 },
])('rejects invalid fee observations: $fixed/$observed', async ({ fixed, observed }) => {
  const before = singleton('profitcfg');
  await expect(send(names, 'observefee', [fixed, observed], 'names@oracle')).rejects.toThrow(
    'NAME_FEE_REFERENCE',
  );
  expect(singleton('profitcfg')).toEqual(before);
});
it('requires the explicit observation permission for new publisher actions', async () => {
  await expect(send(names, 'observeprice', [190, 4, now - 1], 'outsider@active')).rejects.toThrow();
  await expect(send(names, 'observefee', [51, now - 1], 'outsider@active')).rejects.toThrow();
});

it('accepts the exact freshness limits and a same-day corrected fee observation', async () => {
  await send(names, 'setoracle', ['daclifycore', 176, 4, now - 1000], 'daclifycore@active');
  await send(names, 'observeprice', [190, 4, now - 900], 'names@oracle');
  await send(
    names,
    'setprofit',
    ['daclifycore', 1, 100, 515, 29, now - 604801],
    'daclifycore@active',
  );
  await send(names, 'observefee', [0, now - 604800], 'names@oracle');
  await send(names, 'observefee', [51, now - 604800], 'names@oracle');
  expect(singleton('policy')).toMatchObject({ median: 190, observed_at: now - 900 });
  expect(singleton('profitcfg')).toMatchObject({
    minimum_usd_cents: 100,
    card_fee_bps: 515,
    card_fixed_usd_cents: 51,
    fee_observed_at: now - 604800,
  });
});
