import { execFileSync } from 'node:child_process';
import { APIClient } from '@wharfkit/antelope';
import { z } from 'zod';
import { fixtureNetwork } from './network.js';
import { unlockFixtureWallet } from './wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { Uint64Schema } from '../../protocol/base.js';

// Synthetic issuer funding only on the explicitly owned resource fixture.
export async function fundResourceFixture() {
  const network = fixtureNetwork();
  if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
    throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
  const api = new APIClient({ url: network.url });
  if ((await api.v1.chain.get_info()).chain_id.toString() !== network.chainId)
    throw new Error('FIXTURE_CHAIN_CHANGED');
  const balance = (await api.v1.chain.get_currency_balance('eosio.token', 'alice', 'TLOS'))[0];
  if (!balance || balance.symbol.toString() !== '4,TLOS')
    throw new Error('RESOURCE_FIXTURE_FUNDING_REQUIRED');
  const market = await api.v1.chain.get_table_rows({
    code: 'eosio',
    scope: 'eosio',
    table: 'rammarket',
    json: true,
    limit: 1,
  });
  if (market.more) throw new Error('RESOURCE_FIXTURE_MARKET_REQUIRED');
  const reserve = z
    .array(z.object({ base: z.object({ balance: z.string().regex(/^[0-9]+ RAM$/) }) }))
    .length(1)
    .parse(market.rows)[0];
  if (!reserve) throw new Error('RESOURCE_FIXTURE_MARKET_REQUIRED');
  // Keep the synthetic reserve above the population fixture's multi-payer batch.
  if (BigInt(reserve.base.balance.split(' ')[0] ?? '') < 2147483648n) {
    const global = await api.v1.chain.get_table_rows({
      code: 'eosio',
      scope: 'eosio',
      table: 'global',
      json: true,
      limit: 1,
    });
    if (global.more) throw new Error('RESOURCE_FIXTURE_MARKET_REQUIRED');
    const state = z
      .array(z.object({ max_ram_size: Uint64Schema }))
      .length(1)
      .parse(global.rows)[0];
    if (!state) throw new Error('RESOURCE_FIXTURE_MARKET_REQUIRED');
    const expanded = Uint64Schema.parse((BigInt(state.max_ram_size) + 2147483648n).toString());
    unlockFixtureWallet(network.container);
    fixtureAction(network.container, 'eosio', 'setram', [expanded], 'eosio');
  }
  if (BigInt(balance.units.toString()) >= 1000000000n) return;
  unlockFixtureWallet(network.container);
  fixtureAction(
    network.container,
    'eosio.token',
    'issue',
    ['alice', '100000.0000 TLOS', 'Owned resource fixture funding'],
    'alice',
  );
}
function fixtureAction(
  container: string,
  account: string,
  action: string,
  data: string[],
  actor: string,
) {
  let result: unknown;
  try {
    result = JSON.parse(
      execFileSync(
        'docker',
        [
          'exec',
          container,
          'cleos',
          '--wallet-url',
          'http://127.0.0.1:8900',
          'push',
          'action',
          account,
          action,
          JSON.stringify(data),
          '-p',
          actor + '@active',
          '--force-unique',
          '-j',
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ),
    );
  } catch {
    throw new Error('RESOURCE_FIXTURE_FUNDING_REJECTED');
  }
  executedChainResult(
    result,
    z.object({ transaction_id: z.string().regex(/^[0-9a-f]{64}$/) }).parse(result).transaction_id,
  );
}
