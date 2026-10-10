import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivateKey, ABI, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { NameQuoteSchema } from '../protocol/service-api.js';
import { namesAbi, NamesCodeHash } from '../sdk/names.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture(party: 'first-party' | 'third-party' = 'first-party', codeHash = NamesCodeHash) {
  const key = PrivateKey.generate('K1');
  const gateway = new NativeChainGateway({
    rpcUrl: 'http://localhost:18888',
    chainId: 'ab'.repeat(32),
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: key,
  });
  vi.spyOn(gateway, 'nameQuote').mockResolvedValue(
    NameQuoteSchema.parse({
      accountName: 'premname',
      kind: 'premium',
      party,
      seller: 'bob',
      price: '10.0000 TLOS',
      usdCents: 1000,
      ramBytes: 30720,
      netStake: '0.5000 TLOS',
      cpuStake: '0.5000 TLOS',
      platformBps: 500,
      suffix: null,
      sales: 0,
      nextPrice: null,
      nextUsdCents: null,
      listed: false,
      bumpBps: 2000,
      quotePremiumBps: 2000,
      priceFromOracle: false,
    }),
  );
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('get_raw_abi'))
      return Response.json({
        account_name: 'names',
        code_hash: codeHash,
        abi_hash: 'ef'.repeat(32),
        abi: Buffer.from(Serializer.encode({ object: ABI.from(namesAbi) }).array).toString(
          'base64',
        ),
      });
    const { table } = z
      .object({ table: z.string() })
      .parse(JSON.parse(typeof options?.body === 'string' ? options.body : '{}'));
    return Response.json({
      rows:
        table === 'feecfg'
          ? [
              {
                third_party_bps: 500,
                first_party_bps: 10000,
                treasury: 'alice',
                token_contract: 'eosio.token',
                token_symbol: '4,TLOS',
                names: 'names',
              },
            ]
          : [],
      more: false,
    });
  });
  vi.stubGlobal('fetch', fetcher);
  return {
    gateway,
    fetcher,
    purchase: {
      accountName: 'premname',
      ownerKey: key.toPublic().toString(),
      activeKey: key.toPublic().toString(),
      usdCents: 1000,
      reference: 'cd'.repeat(32),
    },
  };
}
describe('Names card settlement preflight', () => {
  it('requires net proceeds for first-party cards without a profit policy', async () => {
    const { gateway, purchase } = fixture();
    await expect(gateway.fulfillName(purchase)).rejects.toThrow('NAME_NET_REQUIRED');
  });
  it('blocks third-party card settlement even with net evidence', async () => {
    const { gateway, purchase, fetcher } = fixture('third-party');
    await expect(gateway.fulfillName({ ...purchase, netUsdCents: 900 })).rejects.toThrow(
      'NAME_CARD_ROUTING',
    );
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('get_raw_abi'))).toBe(false);
  });
  it('pins the deployed cost-recovery code for every first-party card', async () => {
    const { gateway, purchase } = fixture('first-party', 'ef'.repeat(32));
    await expect(gateway.fulfillName({ ...purchase, netUsdCents: 900 })).rejects.toThrow(
      'NAMES_UNCONFIGURED',
    );
  });
  it('preserves the exact non-dynamic quote requirement', async () => {
    const { gateway, purchase } = fixture();
    await expect(
      gateway.fulfillName({ ...purchase, usdCents: 999, netUsdCents: 900 }),
    ).rejects.toThrow('NAME_PRICE');
  });
});
