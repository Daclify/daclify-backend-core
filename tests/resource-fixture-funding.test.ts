import { beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  network: {
    container: 'daclify-resources-native',
    url: 'http://127.0.0.1:20588',
    chainId: 'ab'.repeat(32),
  },
  info: vi.fn(async () => ({ chain_id: 'ab'.repeat(32) })),
  balance: vi.fn(async () => [{ units: 1000000000n, symbol: '4,TLOS' }]),
  stats: vi.fn(async () => ({
    TLOS: {
      supply: { units: 0n, symbol: '4,TLOS' },
      max_supply: { units: 10000000000n, symbol: '4,TLOS' },
      issuer: 'alice',
    },
  })),
  tables: vi.fn(async (): Promise<{ rows: unknown[]; more: boolean }> => ({
    rows: [{ base: { balance: '2147483648 RAM' } }],
    more: false,
  })),
  unlock: vi.fn(),
  exec: vi.fn(() =>
    JSON.stringify({
      transaction_id: 'ef'.repeat(32),
      processed: {
        id: 'ef'.repeat(32),
        block_num: 1,
        receipt: { status: 'executed' },
        except: null,
      },
    }),
  ),
}));
vi.mock('../tools/native/network.js', () => ({ fixtureNetwork: () => fixture.network }));
vi.mock('../tools/native/wallet.js', () => ({ unlockFixtureWallet: fixture.unlock }));
vi.mock('node:child_process', () => ({ execFileSync: fixture.exec }));
vi.mock('@wharfkit/antelope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@wharfkit/antelope')>()),
  APIClient: class {
    v1 = {
      chain: {
        get_info: fixture.info,
        get_currency_balance: fixture.balance,
        get_currency_stats: fixture.stats,
        get_table_rows: fixture.tables,
      },
    };
  },
}));
import { fundResourceFixture } from '../tools/native/resource-funding.js';

beforeEach(() => {
  vi.clearAllMocks();
  fixture.network.container = 'daclify-resources-native';
  fixture.network.url = 'http://127.0.0.1:20588';
});
it('caps synthetic top-ups at the remaining supply and leaves a funded issuer usable when minting is exhausted', async () => {
  fixture.balance.mockResolvedValueOnce([{ units: 876056238n, symbol: '4,TLOS' }]);
  fixture.stats.mockResolvedValueOnce({
    TLOS: {
      supply: { units: 9895002856n, symbol: '4,TLOS' },
      max_supply: { units: 10000000000n, symbol: '4,TLOS' },
      issuer: 'alice',
    },
  });
  await fundResourceFixture();
  expect(fixture.exec).toHaveBeenCalledWith(
    'docker',
    expect.arrayContaining([
      'issue',
      '["alice","10499.7144 TLOS","Owned resource fixture funding"]',
    ]),
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  fixture.exec.mockClear();
  fixture.balance.mockResolvedValueOnce([{ units: 876056238n, symbol: '4,TLOS' }]);
  fixture.stats.mockResolvedValueOnce({
    TLOS: {
      supply: { units: 10000000000n, symbol: '4,TLOS' },
      max_supply: { units: 10000000000n, symbol: '4,TLOS' },
      issuer: 'alice',
    },
  });
  await fundResourceFixture();
  expect(fixture.exec).not.toHaveBeenCalled();
});
it('refuses an exhausted empty issuer instead of inventing funds', async () => {
  fixture.balance.mockResolvedValueOnce([{ units: 0n, symbol: '4,TLOS' }]);
  fixture.stats.mockResolvedValueOnce({
    TLOS: {
      supply: { units: 10000000000n, symbol: '4,TLOS' },
      max_supply: { units: 10000000000n, symbol: '4,TLOS' },
      issuer: 'alice',
    },
  });
  await expect(fundResourceFixture()).rejects.toThrow('RESOURCE_FIXTURE_FUNDING_REQUIRED');
  expect(fixture.exec).not.toHaveBeenCalled();
});

it.each(['https://testnet.telos.net', 'http://127.0.0.1:20488'])(
  'refuses funding outside the owned resource endpoint: %s',
  async (url) => {
    fixture.network.url = url;
    await expect(fundResourceFixture()).rejects.toThrow('OWNED_RESOURCE_FIXTURE_REQUIRED');
    expect(fixture.info).not.toHaveBeenCalled();
    expect(fixture.exec).not.toHaveBeenCalled();
  },
);
it('refuses another container or a changed chain before invoking the issuer', async () => {
  fixture.network.container = 'daclify-ram-native';
  await expect(fundResourceFixture()).rejects.toThrow('OWNED_RESOURCE_FIXTURE_REQUIRED');
  fixture.network.container = 'daclify-resources-native';
  fixture.info.mockResolvedValueOnce({ chain_id: 'cd'.repeat(32) });
  await expect(fundResourceFixture()).rejects.toThrow('FIXTURE_CHAIN_CHANGED');
  expect(fixture.exec).not.toHaveBeenCalled();
});
it('leaves sufficient balances untouched and verifies actual issuer execution for depleted fixtures', async () => {
  await fundResourceFixture();
  expect(fixture.unlock).not.toHaveBeenCalled();
  expect(fixture.exec).not.toHaveBeenCalled();
  fixture.balance.mockResolvedValueOnce([{ units: 4500000n, symbol: '4,TLOS' }]);
  await fundResourceFixture();
  expect(fixture.exec).toHaveBeenCalledWith(
    'docker',
    expect.arrayContaining(['daclify-resources-native', 'issue', 'alice@active']),
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  fixture.balance.mockResolvedValueOnce([{ units: 0n, symbol: '4,TLOS' }]);
  fixture.exec.mockReturnValueOnce(
    JSON.stringify({
      transaction_id: 'ef'.repeat(32),
      processed: { id: 'ef'.repeat(32), block_num: 1, receipt: { status: 'hard_fail' } },
    }),
  );
  await expect(fundResourceFixture()).rejects.toThrow('CHAIN_ACTION_REJECTED');
});
it.each(['58737625 RAM', '649872420 RAM'])(
  'expands only the synthetic fixture market before a large population allocation: %s',
  async (balance) => {
    fixture.tables.mockResolvedValueOnce({
      rows: [{ base: { balance } }],
      more: false,
    });
    fixture.tables.mockResolvedValueOnce({ rows: [{ max_ram_size: '4294967296' }], more: false });
    await fundResourceFixture();
    expect(fixture.exec).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining([
        'daclify-resources-native',
        'setram',
        '["6442450944"]',
        'eosio@active',
      ]),
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  },
);
it('issues only the exact shortfall instead of exhausting the finite dummy-token supply', async () => {
  fixture.balance.mockResolvedValueOnce([{ units: 836576178n, symbol: '4,TLOS' }]);
  await fundResourceFixture();
  expect(fixture.exec).toHaveBeenCalledWith(
    'docker',
    expect.arrayContaining([
      'issue',
      '["alice","16342.3822 TLOS","Owned resource fixture funding"]',
    ]),
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
});
