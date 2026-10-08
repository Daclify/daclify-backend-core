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
        ...(args[0] === 'push' ? ['-j'] : []),
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (args[0] === 'push') {
      const raw: unknown = JSON.parse(result);
      const expected = z.object({ transaction_id: z.string() }).parse(raw).transaction_id;
      executedChainResult(raw, expected);
    }
    return result;
  } catch {
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
