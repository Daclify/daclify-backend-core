import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { CreateDaoSchema } from '../protocol/api.js';
import { defaultDaoSetup } from '../protocol/dao.js';
import { MAX_ASSET_UNITS } from '../protocol/base.js';
const chainId = 'ab'.repeat(32);
const gateway = () =>
  new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:20088',
    chainId,
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
const input = () =>
  CreateDaoSchema.parse({
    metadata: { schemaVersion: 1, title: 'Preflight' },
    privacy: 'public',
    token: { chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
    setup: {
      ...defaultDaoSetup(),
      governance: { ...defaultDaoSetup().governance, guardian: 'ghostguard' },
    },
  });
afterEach(() => vi.unstubAllGlobals());
it('rejects a nonexistent guardian before token/payment work', async () => {
  const fetch = vi.fn(async () => Response.json({}, { status: 500 }));
  vi.stubGlobal('fetch', fetch);
  await expect(gateway().validateCreation(input())).rejects.toThrow('POLICY_GUARDIAN');
  expect(fetch).toHaveBeenCalledOnce();
});
it('requires the configured symbol and exact precision from the token stat row', async () => {
  for (const supply of ['0.000 TLOS', '0.0000 EOS', '']) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('get_account')
          ? Response.json({ account_name: 'ghostguard' })
          : Response.json({
              rows: [{ supply, max_supply: '1000.0000 TLOS', issuer: 'alice' }],
              more: false,
            }),
      ),
    );
    await expect(gateway().validateCreation(input())).rejects.toThrow('ASSET_UNAVAILABLE');
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('get_account')
        ? Response.json({ account_name: 'ghostguard' })
        : Response.json({
            rows: [{ supply: '0.0000 TLOS', max_supply: '1000.0000 TLOS', issuer: 'alice' }],
            more: false,
          }),
    ),
  );
  await expect(gateway().validateCreation(input())).resolves.toBeUndefined();
});
it('keeps commitment budgets within the authoritative Antelope asset integer range', () => {
  const request = input();
  if (!request.setup) throw new Error('Fixture');
  expect(
    CreateDaoSchema.safeParse({
      ...request,
      setup: {
        ...request.setup,
        governance: {
          ...request.setup.governance,
          maxCommitment: (MAX_ASSET_UNITS + 1n).toString(),
        },
      },
    }).success,
  ).toBe(false);
});
it('continues scoped content history instead of failing at its old row ceiling', async () => {
  const reads: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      const data: unknown = JSON.parse(typeof options?.body === 'string' ? options.body : '{}');
      if (
        typeof data !== 'object' ||
        data === null ||
        !('lower_bound' in data) ||
        typeof data.lower_bound !== 'string'
      )
        throw new Error('RPC fixture');
      reads.push(data.lower_bound);
      const cursor = Number(data.lower_bound);
      const rows = Array.from({ length: Math.min(200, 1001 - cursor) }, (_, index) => ({
        epoch: String(cursor + index + 1),
        commitment: 'ab'.repeat(32),
        creator: '1',
      }));
      return Response.json({
        rows,
        more: cursor + rows.length < 1001,
        next_key: String(cursor + rows.length),
      });
    }),
  );
  expect(await gateway().table('epochs', '7', '0', 1000)).toHaveLength(1001);
  expect(reads.length).toBe(6);
});
it('refuses a nonadvancing RPC cursor rather than looping forever', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ rows: [], more: true, next_key: '0' })),
  );
  await expect(gateway().table('epochs', '7')).rejects.toThrow('CHAIN_RESPONSE_INVALID');
});
