import { afterAll, beforeAll, expect, it } from 'vitest';
import { ABI } from '@wharfkit/antelope';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import { namesAbi } from '../../sdk/names.js';
import { loadNames } from '../../services/api/src/market/read.js';

let owned: NativeProcess | undefined;
function fixture() {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
}
const call = (name: string, data: object, actor: string) =>
  fixture().push(
    [fixture().action('names', name, data, [{ actor, permission: 'active' }], ABI.from(namesAbi))],
    [fixture().key(actor)],
  );
beforeAll(async () => {
  owned = await nativeProcess();
  for (const account of ['core', 'names', 'treasury', 'seller', 'outsider', 'eosio.token'])
    await owned.create(account);
  await owned.deploy('names', '.artifacts/contracts/names');
  await call(
    'init',
    { runtime: 'core', settler: 'seller', token_contract: 'eosio.token', token_symbol: '4,TLOS' },
    'names',
  );
  await call(
    'setrates',
    {
      runtime: 'core',
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'treasury',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'core',
  );
  await call(
    'settier',
    {
      kind: 0,
      price: '10.0000 TLOS',
      usd_cents: 100,
      ram_bytes: 30720,
      net_stake: '0.0000 TLOS',
      cpu_stake: '0.0000 TLOS',
    },
    'names',
  );
}, 60000);
afterAll(async () => owned?.stop());

it('rejects a signed ordinary-name takeover without writing a listing', async () => {
  await expect(
    call(
      'regname',
      {
        seller: 'seller',
        account_name: 'reviewaaaaaa',
        price: '100.0000 TLOS',
        usd_cents: 10000,
        accepts_fee_rule: 1,
      },
      'seller',
    ),
  ).rejects.toThrow('NAME_BASIC_FIRST_PARTY');
  const rows = await fixture().api.v1.chain.get_table_rows({
    code: 'names',
    scope: 'names',
    table: 'namelist',
    limit: 100,
  });
  expect(rows.rows).toEqual([]);
});
it('charges valid exact and suffix listing storage to the authorizing seller', async () => {
  const before = await Promise.all(
    ['names', 'seller'].map((account) => fixture().api.v1.chain.get_account(account)),
  );
  await call(
    'regname',
    {
      seller: 'seller',
      account_name: 'good.seller',
      price: '100.0000 TLOS',
      usd_cents: 10000,
      accepts_fee_rule: 1,
    },
    'seller',
  );
  await call(
    'regsuffix',
    { suffix: 'seller', price: '100.0000 TLOS', usd_cents: 10000, accepts_fee_rule: 1 },
    'seller',
  );
  const after = await Promise.all(
    ['names', 'seller'].map((account) => fixture().api.v1.chain.get_account(account)),
  );
  expect(Number(after[0]?.ram_usage) - Number(before[0]?.ram_usage)).toBe(0);
  expect(Number(after[1]?.ram_usage) - Number(before[1]?.ram_usage)).toBeGreaterThan(0);
});
it('rejects listing another account namespace and rejects a substituted signer', async () => {
  await expect(
    call(
      'regname',
      {
        seller: 'seller',
        account_name: 'bad.treasury',
        price: '100.0000 TLOS',
        usd_cents: 10000,
        accepts_fee_rule: 1,
      },
      'seller',
    ),
  ).rejects.toThrow('NATIVE_SUFFIX_REQUIRED');
  await expect(
    call(
      'regname',
      {
        seller: 'seller',
        account_name: 'fake.seller',
        price: '100.0000 TLOS',
        usd_cents: 10000,
        accepts_fee_rule: 1,
      },
      'outsider',
    ),
  ).rejects.toThrow();
});
it('pages more than 100 actual native listings and reads a later offer directly', async () => {
  let target = '';
  for (let i = 0; i < 101; i++) {
    target =
      'a' +
      String.fromCharCode(97 + Math.floor(i / 26)) +
      String.fromCharCode(97 + (i % 26)) +
      '.seller';
    await call(
      'regname',
      {
        seller: 'seller',
        account_name: target,
        price: '100.0000 TLOS',
        usd_cents: 10000,
        accepts_fee_rule: 1,
      },
      'seller',
    );
  }
  const f = fixture(),
    first = await loadNames(f.url, 'names');
  expect(first?.listings).toHaveLength(100);
  if (!first?.listingsNext) throw new Error('CATALOGUE_CURSOR_REQUIRED');
  const last = await loadNames(f.url, 'names', { listingsCursor: first.listingsNext });
  expect(last?.listings).toHaveLength(2);
  expect(last?.listingsNext).toBeNull();
  const exact = await loadNames(f.url, 'names', { accountName: target });
  expect(exact?.listings).toEqual([
    { accountName: target, seller: 'seller', price: '100.0000 TLOS', usdCents: 10000, sold: false },
  ]);
}, 30000);
