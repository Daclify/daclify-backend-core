import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { QuickBallotArchiveInputSchema, planQuickBallotArchive } from '@daclify/modules/archive';
import { NativeQuickBallots } from '../services/api/src/quick-ballots/chain.js';

const rpc = vi.hoisted(() => ({
  account: vi.fn(),
  info: vi.fn(),
  block: vi.fn(),
  call: vi.fn(),
}));
vi.mock('../services/api/src/rpc.js', () => ({
  createRpcClient: () => ({
    call: rpc.call,
    v1: { chain: { get_account: rpc.account, get_info: rpc.info, get_block: rpc.block } },
  }),
}));

function fixture() {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL('./fixtures/quick-ballots/archive-snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  const snapshot = QuickBallotArchiveInputSchema.omit({ kind: true, rows: true })
    .extend({
      responses: QuickBallotArchiveInputSchema.shape.rows,
      grants: QuickBallotArchiveInputSchema.shape.rows,
    })
    .parse(raw);
  const confirm = vi.fn(async () => {});
  const chain = new NativeQuickBallots(
    {
      rpcUrl: 'http://127.0.0.1:18888',
      chainId: snapshot.dao.chainId,
      runtime: snapshot.dao.contract,
      authority: 'quickauth',
      source: snapshot.source.account,
      gateway: { actor: 'gateway', permission: 'active' },
    },
    { key: PrivateKey.generate('K1'), resources: async () => {}, confirm },
  );
  vi.spyOn(chain, 'detail').mockResolvedValue({
    chainId: snapshot.dao.chainId,
    runtime: snapshot.dao.contract,
    source: snapshot.source.account,
    ballot: snapshot.ballot,
    grants: null,
  });
  rpc.account.mockResolvedValue({
    last_code_update: { toDate: () => new Date(snapshot.sourceUpdatedAt) },
  });
  const height = snapshot.snapshot.blockNumber;
  rpc.info.mockResolvedValue({ head_block_num: height - 1 });
  rpc.block.mockImplementation(async (number: number) => ({
    block_num: number,
    id:
      number === height
        ? snapshot.snapshot.blockId
        : (height - 1).toString(16).padStart(8, '0') + '00'.repeat(28),
    timestamp: {
      toDate: () =>
        new Date(Date.parse(snapshot.snapshot.timestamp) - (number === height ? 0 : 500)),
    },
  }));
  rpc.call.mockImplementation(async ({ params }: { params: { table: string } }) => ({
    rows: (params.table === 'qresponses' ? snapshot.responses : snapshot.grants).map(
      (row) => row.packed,
    ),
    more: false,
  }));
  return { chain, snapshot, confirm, height };
}
it('waits beyond the observed head so a pending source update is included in the irreversible snapshot', async () => {
  const { chain, snapshot, confirm, height } = fixture();
  const result = await chain.archiveSnapshot(snapshot.ballot.id);
  expect(confirm).toHaveBeenCalledWith(height);
  const { responses, grants: _grants, ...base } = result;
  expect(
    planQuickBallotArchive({ ...base, kind: 'quick-ballot-responses', rows: responses }).blocked,
  ).toEqual([]);
});
it('can archive surviving reader grants after another verified archive pruned the response rows', async () => {
  const { chain, snapshot } = fixture();
  rpc.call.mockImplementation(async ({ params }: { params: { table: string } }) => ({
    rows: params.table === 'qgrants' ? snapshot.grants.map((row) => row.packed) : [],
    more: false,
  }));
  const result = await chain.archiveSnapshot(snapshot.ballot.id, false);
  const { responses, grants, ...base } = result;
  expect(responses).toEqual([]);
  expect(
    planQuickBallotArchive({ ...base, kind: 'quick-ballot-grants', rows: grants }).blocked,
  ).toEqual([]);
});
