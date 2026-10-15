import { expect, it, vi } from 'vitest';
import { PrivateKey, SignedTransaction, Serializer, ABI } from '@wharfkit/antelope';
import { QuickAuthCodeHash, quickAuthAbi } from '../sdk/quick-accounts.js';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { NativeQuickBallots } from '../services/api/src/quick-ballots/chain.js';
const rpc = vi.hoisted(() => ({ info: vi.fn(), rows: vi.fn(), push: vi.fn() }));
vi.mock('../services/api/src/rpc.js', () => ({
  createRpcClient: () => ({
    v1: { chain: { get_info: rpc.info, get_table_rows: rpc.rows, push_transaction: rpc.push } },
  }),
}));
it('reclaims only inactive account rows after thirty days using bounded pages and the pinned authority', async () => {
  const config = {
    rpcUrl: 'http://127.0.0.1:18888',
    chainId: '11'.repeat(32),
    runtime: 'daclifycore1',
    authority: 'quickauth',
    source: 'quickvote',
    gateway: { actor: 'gateway', permission: 'active' },
  };
  const chain = new NativeQuickBallots(config, {
    key: PrivateKey.generate('K1'),
    resources: async () => {},
    confirm: async () => {},
  });
  vi.spyOn(chain, 'configuration').mockResolvedValue({
    ...config,
    authorityCodeHash: QuickAuthCodeHash,
    sourceCodeHash: ModuleCodeHashes['quick-ballots'],
  });
  const now = Math.floor(Date.now() / 1000),
    retention = 30 * 86400;
  rpc.info.mockResolvedValue({
    head_block_time: { toDate: () => new Date(now * 1000) },
    getTransactionHeader: () => ({
      expiration: new Date(Date.now() + 60_000).toISOString().slice(0, 19),
      ref_block_num: 1,
      ref_block_prefix: 2,
    }),
  });
  rpc.rows.mockResolvedValue({
    rows: [
      { id: '1', active: false, deactivated_at: now - retention },
      { id: '2', active: false, deactivated_at: now - retention + 1 },
      { id: '3', active: true, deactivated_at: now - retention - 1 },
    ].map((row) => ({
      ...row,
      identity: row.id.repeat(64),
      approval: { kind: 3, credential: '' },
      epoch: '1',
      nonce: '1',
    })),
    more: true,
  });
  let purged: unknown;
  rpc.push.mockImplementation(async (tx: SignedTransaction) => {
    const action = tx.actions[0];
    if (!action) throw Error('ACTION_REQUIRED');
    expect(action.account.toString()).toBe(config.authority);
    expect(action.name.toString()).toBe('qprune');
    purged = Serializer.objectify(
      Serializer.decode({ abi: ABI.from(quickAuthAbi), type: 'qprune', data: action.data }),
    );
    return {
      transaction_id: tx.id.toString(),
      processed: { id: tx.id.toString(), block_num: 2, receipt: { status: 'executed' } },
    };
  });
  expect(await chain.pruneInactiveAccounts('0')).toEqual({ next: '3', removed: 1 });
  expect(purged).toEqual({ runtime: config.runtime, ids: [1] });
});
