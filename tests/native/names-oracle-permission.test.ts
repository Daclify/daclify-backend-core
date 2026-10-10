import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ABI, Action, Authority, PrivateKey, Serializer } from '@wharfkit/antelope';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import { nameOraclePermissionActions, namesAbi } from '../../sdk/names.js';
import { NamesTableSchemas } from '../../sdk/generated/names-schemas.js';
let owned: NativeProcess | undefined;
const oracle = PrivateKey.generate('K1'),
  wrong = PrivateKey.generate('K1');
const fixture = () => {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
};
const executives = () => [fixture().key('execone'), fixture().key('exectwo')];
const auth = (accounts: { actor: string; permission: string; weight: number }[], threshold = 1) => {
  const value = Authority.from({
    threshold,
    keys: [],
    waits: [],
    accounts: accounts.map(({ actor, permission, weight }) => ({
      permission: { actor, permission },
      weight,
    })),
  });
  value.sort();
  return value;
};
const observation = async () =>
  Math.floor((await fixture().api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000) - 1;
const call = (
  name: string,
  data: object,
  actor = 'names',
  permission = 'oracle',
  keys = [oracle],
) =>
  fixture().push(
    [
      Action.from(
        { account: 'names', name, data, authorization: [{ actor, permission }] },
        ABI.from(namesAbi),
      ),
    ],
    keys,
  );
const rows = async (table: string) =>
  (
    await fixture().api.v1.chain.get_table_rows({
      code: 'names',
      scope: 'names',
      table,
      json: true,
      limit: 10,
    })
  ).rows;
beforeAll(async () => {
  owned = await nativeProcess();
  const f = fixture();
  for (const name of [
    'core',
    'names',
    'recovery',
    'execone',
    'exectwo',
    'relay',
    'outsider',
    'eosio.token',
  ])
    await f.create(name);
  await f.deploy('names', '.artifacts/contracts/names');
  await f.deploy('eosio.token', '.artifacts/contracts/testtoken');
  const stamp = await observation();
  await call(
    'init',
    { runtime: 'core', settler: 'relay', token_contract: 'eosio.token', token_symbol: '4,TLOS' },
    'names',
    'active',
    [f.key('names')],
  );
  await call(
    'setoracle',
    { runtime: 'core', median: '176', quoted_precision: 4, observed_at: stamp - 30 },
    'core',
    'active',
    [f.key('core')],
  );
  await call(
    'setprofit',
    {
      runtime: 'core',
      version: 1,
      minimum_usd_cents: 100,
      card_fee_bps: 515,
      card_fixed_usd_cents: 29,
      fee_observed_at: stamp - 30,
    },
    'core',
    'active',
    [f.key('core')],
  );
  await f.update(
    'core',
    'active',
    'owner',
    auth(
      [
        { actor: 'execone', permission: 'active', weight: 1 },
        { actor: 'exectwo', permission: 'active', weight: 1 },
        { actor: 'core', permission: 'eosio.code', weight: 2 },
      ],
      2,
    ),
  );
  await f.update(
    'core',
    'owner',
    '',
    auth([{ actor: 'recovery', permission: 'active', weight: 1 }]),
  );
  await f.update(
    'names',
    'active',
    'owner',
    auth([
      { actor: 'core', permission: 'active', weight: 1 },
      { actor: 'names', permission: 'eosio.code', weight: 1 },
    ]),
  );
  await f.update('names', 'owner', '', auth([{ actor: 'core', permission: 'active', weight: 1 }]));
  await f.push(nameOraclePermissionActions('names', oracle.toPublic().toString()), executives());
  for (const type of ['setcode', 'setabi'])
    await f.push(
      [
        f.system(
          'linkauth',
          { account: 'names', code: 'eosio', type, requirement: 'owner' },
          'names',
          'owner',
        ),
      ],
      executives(),
    );
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it('publishes real observations while preserving executive pricing policy', async () => {
  const stamp = await observation();
  await call('observeprice', { median: '190', quoted_precision: 4, observed_at: stamp });
  await call('observefee', { card_fixed_usd_cents: 51, observed_at: stamp });
  expect((await rows('policy'))[0]).toMatchObject({
    median: 190,
    quoted_precision: 4,
    observed_at: stamp,
    bump_bps: 2000,
    quote_premium_bps: 2000,
  });
  expect((await rows('profitcfg'))[0]).toMatchObject({
    version: 1,
    minimum_usd_cents: 100,
    card_fee_bps: 515,
    card_fixed_usd_cents: 51,
    fee_observed_at: stamp,
  });
});
it('rejects stale, future and replayed price observations without changing data', async () => {
  const before = NamesTableSchemas.policy.parse((await rows('policy'))[0]);
  for (const stamp of [
    before.observed_at,
    (await observation()) - 901,
    (await observation()) + 100,
  ]) {
    await expect(
      call('observeprice', { median: '191', quoted_precision: 4, observed_at: stamp }),
    ).rejects.toThrow('ORACLE_TIMESTAMP');
    expect(NamesTableSchemas.policy.parse((await rows('policy'))[0])).toEqual(before);
  }
});
it('rejects unrelated signatures and an incorrect declared permission', async () => {
  const data = { median: '191', quoted_precision: 4, observed_at: await observation() };
  await expect(call('observeprice', data, 'names', 'oracle', [wrong])).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  await expect(call('observeprice', data, 'names', 'active')).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
});
it.each(['setprofit', 'setpolicy', 'setrates', 'setsettler'])(
  'denies the oracle key pricing/governance action %s',
  async (name) => {
    const stamp = await observation();
    const data: Record<string, object> = {
      setprofit: {
        runtime: 'core',
        version: 1,
        minimum_usd_cents: 200,
        card_fee_bps: 1,
        card_fixed_usd_cents: 1,
        fee_observed_at: stamp,
      },
      setpolicy: { runtime: 'core', bump_bps: 0, quote_premium_bps: 0 },
      setrates: {
        runtime: 'core',
        third_party_bps: 0,
        first_party_bps: 0,
        treasury: 'outsider',
        token_contract: 'eosio.token',
        token_symbol: '4,TLOS',
      },
      setsettler: { settler: 'outsider' },
    };
    const value = data[name];
    if (!value) throw new Error('FIXTURE_ACTION');
    await expect(call(name, value)).rejects.toThrow('NATIVE_AUTH_REJECTED');
    await expect(
      call(name, value, name === 'setsettler' ? 'names' : 'core', 'active'),
    ).rejects.toThrow('NATIVE_AUTH_REJECTED');
  },
);
it('cannot upgrade Names, relax upgrade links or change parent authority', async () => {
  const f = fixture();
  for (const action of [
    f.system(
      'setabi',
      { account: 'names', abi: Serializer.encode({ object: ABI.from(namesAbi) }) },
      'names',
      'oracle',
    ),
    f.system(
      'setcode',
      {
        account: 'names',
        vmtype: 0,
        vmversion: 0,
        code: readFileSync('.artifacts/contracts/names.wasm'),
      },
      'names',
      'oracle',
    ),
    f.system(
      'updateauth',
      {
        account: 'names',
        permission: 'active',
        parent: 'owner',
        auth: Authority.from({
          threshold: 1,
          keys: [{ key: wrong.toPublic(), weight: 1 }],
          accounts: [],
          waits: [],
        }),
      },
      'names',
      'oracle',
    ),
    f.system(
      'linkauth',
      { account: 'names', code: 'eosio.token', type: 'transfer', requirement: 'oracle' },
      'names',
      'oracle',
    ),
    f.system(
      'linkauth',
      { account: 'names', code: 'eosio', type: 'setabi', requirement: 'oracle' },
      'names',
      'oracle',
    ),
    f.system('unlinkauth', { account: 'names', code: 'eosio', type: 'setabi' }, 'names', 'oracle'),
  ])
    await expect(f.push([action], [oracle])).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('cannot withdraw tokens with an observation permission', async () => {
  const action = Action.from(
    {
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: 'names', permission: 'oracle' }],
      data: { from: 'names', to: 'outsider', quantity: '1.0000 TLOS', memo: '' },
    },
    ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8')),
  );
  await expect(fixture().push([action], [oracle])).rejects.toThrow('NATIVE_AUTH_REJECTED');
});
it('preserves two-executive approval and immediately revokes an old oracle key', async () => {
  const f = fixture();
  const action = nameOraclePermissionActions('names', wrong.toPublic().toString())[0];
  if (!action) throw new Error('FIXTURE_ACTION');
  await expect(f.push([action], [f.key('execone')])).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await f.push([action], executives());
  const data = { card_fixed_usd_cents: 52, observed_at: await observation() };
  await expect(call('observefee', data)).rejects.toThrow('NATIVE_AUTH_REJECTED');
  await call('observefee', data, 'names', 'oracle', [wrong]);
  expect((await rows('profitcfg'))[0]).toMatchObject({
    minimum_usd_cents: 100,
    card_fee_bps: 515,
    card_fixed_usd_cents: 52,
  });
});
