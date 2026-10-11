import { afterEach, expect, it, vi } from 'vitest';
import { Name, PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadNames, readChainRows } from '../services/api/src/market/read.js';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
afterEach(() => vi.restoreAllMocks());

const listings = Array.from({ length: 101 }, (_, i) => ({
  account_name:
    'a' +
    String.fromCharCode(97 + Math.floor(i / 26)) +
    String.fromCharCode(97 + (i % 26)) +
    '.seller',
  seller: 'seller',
  price: '100.0000 TLOS',
  usd_cents: 10000,
  accepts: 1,
  sold: 0,
}));
const lastListing = listings[100];
if (!lastListing) throw new Error('FIXTURE_LISTING_REQUIRED');
const next = Name.from(lastListing.account_name).value.toString();
it.each(['0', '18446744073709551616', undefined])(
  'rejects a non-advancing, out-of-range or absent chain cursor: %s',
  async (nextKey) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ rows: [], more: true, next_key: nextKey }),
    );
    await expect(
      readChainRows({
        rpcUrl: 'https://chain.example',
        code: 'names',
        scope: 'names',
        table: 'namelist',
        paginate: true,
        lowerBound: '0',
        limit: 100,
      }),
    ).rejects.toThrow('CHAIN_RESPONSE_INVALID');
  },
);
function rpc() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).endsWith('get_account')) return Response.json({}, { status: 500 });
    const request = z
      .object({
        table: z.string(),
        limit: z.number(),
        lower_bound: z.string().optional(),
        upper_bound: z.string().optional(),
        key_type: z.string().optional(),
      })
      .parse(JSON.parse(String(init?.body)));
    if (request.table === 'namelist') {
      if (request.key_type === 'name')
        return Response.json({
          rows: listings.filter((row) => row.account_name === request.lower_bound),
          more: false,
        });
      const rest = request.lower_bound === next ? listings.slice(100) : listings;
      return Response.json({
        rows: rest.slice(0, request.limit),
        more: rest.length > request.limit,
        next_key: rest.length > request.limit ? next : '',
      });
    }
    const tables: Record<string, unknown[]> = {
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
      feecfg: [
        {
          third_party_bps: 500,
          first_party_bps: 10000,
          treasury: 'fees',
          token_contract: 'eosio.token',
          token_symbol: '4,TLOS',
          names: 'names',
        },
      ],
      mktcfg: [{ bump_bps: 2000, quote_premium_bps: 2000, dao_id: 1 }],
      tiers: [
        {
          kind: 0,
          price: '10.0000 TLOS',
          usd_cents: 100,
          ram_bytes: 30720,
          net_stake: '0.0000 TLOS',
          cpu_stake: '0.0000 TLOS',
        },
        {
          kind: 1,
          price: '20.0000 TLOS',
          usd_cents: 200,
          ram_bytes: 30720,
          net_stake: '0.0000 TLOS',
          cpu_stake: '0.0000 TLOS',
        },
      ],
    };
    return Response.json({ rows: tables[request.table] ?? [], more: false, next_key: '' });
  });
}
it('browses a 101-entry catalogue in bounded pages', async () => {
  rpc();
  const first = await loadNames('https://chain.example', 'names');
  expect(first?.listings).toHaveLength(100);
  expect(first?.listingsNext).toBe(next);
  const last = await loadNames('https://chain.example', 'names', { listingsCursor: next });
  expect(last?.listings.map((row) => row.accountName)).toEqual([lastListing.account_name]);
  expect(last?.listingsNext).toBeNull();
});
it('quotes a name outside the first catalogue page through keyed listing reads', async () => {
  const fetcher = rpc();
  const gateway = new NativeChainGateway({
    rpcUrl: 'https://chain.example',
    chainId: 'ab'.repeat(32),
    runtime: 'core',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
  expect(await gateway.nameQuote(lastListing.account_name)).toMatchObject({
    seller: 'seller',
    listed: true,
    party: 'third-party',
    price: '100.0000 TLOS',
  });
  const reads = fetcher.mock.calls.flatMap(([, init]) => {
    const body = z
      .object({
        table: z.string(),
        lower_bound: z.string().optional(),
        upper_bound: z.string().optional(),
        limit: z.number(),
      })
      .safeParse(JSON.parse(String(init?.body)));
    return body.success && body.data.table === 'namelist' ? [body.data] : [];
  });
  expect(reads).toEqual([
    {
      table: 'namelist',
      lower_bound: lastListing.account_name,
      upper_bound: lastListing.account_name,
      limit: 1,
    },
  ]);
});
