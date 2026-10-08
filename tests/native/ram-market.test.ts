import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';

const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
function cleos(args: string[]): string {
  try {
    const result = execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
        ...(args[0] === 'push' ? ['-j', '--force-unique'] : []),
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (args[0] === 'push') {
      const raw: unknown = JSON.parse(result);
      const rejected = z.object({ processed: z.object({ except: z.unknown() }) }).safeParse(raw);
      if (rejected.success && rejected.data.processed.except) {
        const detail = JSON.stringify(rejected.data.processed.except);
        for (const code of [
          'RAM_MANAGED_ACCOUNT',
          'RAM_ACQUISITION_MINIMUM',
          'RAM_PURCHASE_SENDER',
        ])
          if (detail.includes(code)) throw new Error(code);
      }
      const expected = z.object({ transaction_id: z.string() }).parse(raw).transaction_id;
      executedChainResult(raw, expected);
    }
    return result;
  } catch (error) {
    for (const code of ['RAM_MANAGED_ACCOUNT', 'RAM_ACQUISITION_MINIMUM', 'RAM_PURCHASE_SENDER'])
      if (
        error instanceof Error &&
        (error.message === code ||
          ('stdout' in error && String(error.stdout).includes(code)) ||
          ('stderr' in error && String(error.stderr).includes(code)))
      )
        throw new Error(code);
    throw new Error('NATIVE_RAM_MARKET_REJECTED');
  }
}
async function rpc(path: string, body: object): Promise<unknown> {
  const response = await fetch(network.url + '/v1/chain/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('NATIVE_RAM_MARKET_QUERY_FAILED');
  return response.json();
}
async function account(name: string) {
  return z
    .object({ ram_quota: z.number().int(), ram_usage: z.number().int().nonnegative() })
    .parse(await rpc('get_account', { account_name: name }));
}
async function resources(name: string) {
  const result = z
    .object({ rows: z.array(z.object({ ram_bytes: z.number().int().nonnegative() })) })
    .parse(
      await rpc('get_table_rows', {
        code: 'eosio',
        scope: name,
        table: 'userres',
        json: true,
        limit: 1,
      }),
    );
  return result.rows[0]?.ram_bytes ?? 0;
}
beforeAll(() => {
  unlockFixtureWallet(network.container);
  cleos([
    'set',
    'contract',
    'permprobe',
    '/work/.artifacts/contracts',
    'ramprobe.wasm',
    'ramprobe.abi',
    '-p',
    'permprobe@active',
  ]);
  cleos([
    'set',
    'account',
    'permission',
    'permprobe',
    'active',
    '--add-code',
    '-p',
    'permprobe@active',
  ]);
});
it('buys actual receiver quota and reconciles the supported system-table delta', async () => {
  const before = await account('daclifycore'),
    billed = await resources('daclifycore');
  cleos([
    'push',
    'action',
    'eosio',
    'buyrambytes',
    JSON.stringify(['alice', 'daclifycore', 16_777_216]),
    '-p',
    'alice@active',
  ]);
  const after = await account('daclifycore'),
    purchased = await resources('daclifycore');
  expect(purchased - billed).toBeGreaterThan(0);
  expect(after.ram_quota).toBe(purchased + 1400);
  expect(after.ram_quota).toBeGreaterThan(after.ram_usage);
  expect(before.ram_quota === -1 || after.ram_quota > before.ram_quota).toBe(true);
});
it('rolls back actual quota acquisition when a later action fails', async () => {
  const before = await account('decide'),
    billed = await resources('decide');
  const tx = {
    actions: [
      {
        account: 'eosio',
        name: 'buyrambytes',
        authorization: [{ actor: 'alice', permission: 'active' }],
        data: { payer: 'alice', receiver: 'decide', bytes: 1_048_576 },
      },
      {
        account: 'permprobe',
        name: 'remove',
        authorization: [{ actor: 'permprobe', permission: 'active' }],
        data: { id: 999999, secondary: false },
      },
    ],
  };
  expect(() => cleos(['push', 'transaction', JSON.stringify(tx)])).toThrow(
    'NATIVE_RAM_MARKET_REJECTED',
  );
  expect(await account('decide')).toEqual(before);
  expect(await resources('decide')).toBe(billed);
});
it('reads supported unmanaged quota from an ordinary contract and rejects managed RAM', async () => {
  const before = await account('daclifycore');
  const check = () =>
    cleos([
      'push',
      'action',
      'permprobe',
      'quotafromsys',
      JSON.stringify(['daclifycore', before.ram_quota]),
      '-p',
      'permprobe@active',
    ]);
  check();
  try {
    cleos([
      'push',
      'action',
      'eosio',
      'setacctram',
      JSON.stringify(['daclifycore', before.ram_quota + 1048576]),
      '-p',
      'eosio@active',
    ]);
    expect(() => check()).toThrow('RAM_MANAGED_ACCOUNT');
  } finally {
    cleos([
      'push',
      'action',
      'eosio',
      'setacctram',
      JSON.stringify(['daclifycore', null]),
      '-p',
      'eosio@active',
    ]);
  }
  expect((await account('daclifycore')).ram_quota).toBe(before.ram_quota);
  check();
});
it('verifies actual acquisition after an inline system buy and atomically rolls back an unmet minimum', async () => {
  const purchase = (minimum: string) =>
    cleos([
      'push',
      'transaction',
      JSON.stringify({
        actions: [
          {
            account: 'eosio.token',
            name: 'transfer',
            authorization: [{ actor: 'alice', permission: 'active' }],
            data: {
              from: 'alice',
              to: 'permprobe',
              quantity: '0.0010 TLOS',
              memo: 'Owned RAM acquisition fixture',
            },
          },
          {
            account: 'permprobe',
            name: 'buyassert',
            authorization: [{ actor: 'permprobe', permission: 'active' }],
            data: { receiver: 'daclifycore', quantity: '0.0010 TLOS', minimum },
          },
        ],
      }),
    ]);
  const before = await account('daclifycore');
  purchase('1');
  const bought = await account('daclifycore');
  expect(bought.ram_quota).toBeGreaterThan(before.ram_quota);
  const billed = await resources('daclifycore');
  const balance = cleos(['get', 'currency', 'balance', 'eosio.token', 'alice', 'TLOS']);
  expect(() => purchase('18446744073709551615')).toThrow('RAM_ACQUISITION_MINIMUM');
  expect(await account('daclifycore')).toEqual(bought);
  expect(await resources('daclifycore')).toBe(billed);
  expect(cleos(['get', 'currency', 'balance', 'eosio.token', 'alice', 'TLOS'])).toBe(balance);
  expect(() =>
    cleos([
      'push',
      'action',
      'permprobe',
      'checkgain',
      JSON.stringify(['daclifycore', '0', '1']),
      '-p',
      'permprobe@active',
    ]),
  ).toThrow('RAM_PURCHASE_SENDER');
});
