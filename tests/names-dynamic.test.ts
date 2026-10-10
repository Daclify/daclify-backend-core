import { describe, expect, it, vi } from 'vitest';
import { loadNames, quoteName } from '../services/api/src/market/read.js';
import { NameQuoteSchema } from '../protocol/service-api.js';
const now = Math.floor(Date.now() / 1000);
const rows: Record<string, unknown[]> = {
  namescfg: [
    {
      runtime: 'core',
      settler: 'relay',
      treasury: 'fees',
      third_party_bps: 500,
      first_party_bps: 10000,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
  ],
  tiers: [
    {
      kind: 0,
      price: '0.0000 TLOS',
      usd_cents: 100,
      ram_bytes: 30720,
      net_stake: '0.5000 TLOS',
      cpu_stake: '0.5000 TLOS',
    },
  ],
  policy: [
    {
      bump_bps: 2000,
      quote_premium_bps: 2000,
      median: '176',
      quoted_precision: 4,
      observed_at: now,
    },
  ],
  profitcfg: [
    {
      version: 1,
      minimum_usd_cents: 100,
      card_fee_bps: 515,
      card_fixed_usd_cents: 29,
      fee_observed_at: now,
    },
  ],
  rammarket: [
    {
      supply: '10000000000.0000 RAMCORE',
      base: { balance: '20963900417 RAM', weight: 0.5 },
      quote: { balance: '1193977.8471 TLOS', weight: 0.5 },
    },
  ],
};
describe('dynamic Names chain reads', () => {
  it('publishes distinct card and native prices in the existing quote shape', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request: unknown = JSON.parse(String(init?.body));
      if (
        typeof request !== 'object' ||
        request === null ||
        !('table' in request) ||
        typeof request.table !== 'string'
      )
        throw new Error('FIXTURE_SHAPE');
      return new Response(JSON.stringify({ rows: rows[request.table] ?? [], more: false }));
    });
    try {
      const state = await loadNames('https://chain.example', 'names');
      if (!state) throw new Error('STATE');
      const quote = quoteName({ ...state, accountName: 'dacux1111111' });
      expect(NameQuoteSchema.parse(quote)).toMatchObject({
        usdCents: 142,
        price: '71.5910 TLOS',
        ramBytes: 30720,
      });
    } finally {
      fetcher.mockRestore();
    }
  });
});
