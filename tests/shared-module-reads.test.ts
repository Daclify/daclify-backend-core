import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
const gateway = () =>
  new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:19988',
    chainId: 'ab'.repeat(32),
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
    modules: [
      { id: 'decide', account: 'decide' },
      { id: 'works', account: 'works' },
      { id: 'payroll', account: 'payroll' },
    ],
  });
afterEach(() => vi.unstubAllGlobals());
function rpc(
  reads: Record<string, unknown>[],
  ballots: (payload: Record<string, unknown>) => { rows: unknown[]; more: boolean } = () => ({
    rows: [],
    more: false,
  }),
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      if (typeof body !== 'object' || body === null) throw new Error('RPC fixture');
      const payload = Object.fromEntries(Object.entries(body));
      if (url.endsWith('get_code_hash'))
        return Response.json({
          code_hash:
            ModuleCodeHashes[
              payload.account_name === 'decide'
                ? 'decide'
                : payload.account_name === 'works'
                  ? 'works'
                  : 'payroll'
            ],
        });
      reads.push(payload);
      if (payload.table === 'daos')
        return Response.json({
          rows: [
            {
              id: '7',
              owner: 'alice',
              metadata: '{}',
              privacy: 0,
              token_contract: 'eosio.token',
              token_symbol: '4,TLOS',
              available: '0',
              reserved: '0',
              claims: '0',
              key_epoch: '0',
              history_policy: 0,
              admin_count: 0,
              credit_supply: '0',
              staked: '0',
              eligible_credits: '0',
              eligible_stake: '0',
              member_count: '0',
              max_member: '0',
              active_ballots: 0,
            },
          ],
          more: false,
        });
      if (payload.table === 'modules')
        return Response.json({
          rows: [
            {
              account: 'decide',
              version: 1,
              actions: ['open'],
              grants: [],
              code_hash: ModuleCodeHashes.decide,
            },
            {
              account: 'works',
              version: 1,
              actions: ['propose'],
              grants: [],
              code_hash: ModuleCodeHashes.works,
            },
            {
              account: 'payroll',
              version: 1,
              actions: ['commit'],
              grants: [],
              code_hash: ModuleCodeHashes.payroll,
            },
          ],
          more: false,
        });
      if (payload.table === 'ballots') return Response.json(ballots(payload));
      // Shared, unbounded queries are the regression; bounded empty target queries are valid.
      if (!('lower_bound' in payload) || !('upper_bound' in payload))
        return Response.json({ rows: [], more: true, next_key: '1001' });
      return Response.json({ rows: [], more: false });
    }),
  );
}
it('reads only target DAO and related records even when other DAOs fill shared tables', async () => {
  const reads: Record<string, unknown>[] = [];
  rpc(reads);
  expect((await gateway().moduleState('7')).ballots).toEqual([]);
  for (const table of ['ballots', 'projects', 'schedules'])
    expect(reads.find((row) => row.table === table)).toMatchObject({
      index_position: 2,
      lower_bound: '7',
      upper_bound: '7',
    });
  expect(
    reads.some((row) =>
      ['votes', 'milestones', 'entries', 'controls', 'executions'].includes(String(row.table)),
    ),
  ).toBe(false);
});

const ballot = (id: string, dao_id = '7') => ({
  id,
  dao_id,
  creator: '1',
  kind: 0,
  choices: 2,
  closes: 0,
  quorum: 1,
  approval: 5001,
  denominator: '1',
  max_member: '1',
  cast: '0',
  tallies: ['0', '0'],
  status: 0,
  winner: -1,
  metadata: '{}',
});
it('continues shared primary pages while returning only the target DAO and scoped member votes', async () => {
  const reads: Record<string, unknown>[] = [];
  rpc(reads, (payload) =>
    payload.index_position === 2
      ? { rows: [ballot('10')], more: true }
      : payload.lower_bound === '11'
        ? { rows: [ballot('11', '8'), ballot('12')], more: true }
        : { rows: [ballot('13', '8')], more: false },
  );
  const first = await gateway().moduleState('7', {
    projects: 'done',
    schedules: 'done',
    memberId: '2',
  });
  expect(first.ballots.map((row) => row.id)).toEqual(['10']);
  expect(first.next.ballots).toBe('11');
  const second = await gateway().moduleState('7', {
    ballots: '11',
    projects: 'done',
    schedules: 'done',
    memberId: '2',
  });
  expect(second.ballots.map((row) => row.id)).toEqual(['12']);
  expect(second.next.ballots).toBe('13');
  const last = await gateway().moduleState('7', {
    ballots: '13',
    projects: 'done',
    schedules: 'done',
    memberId: '2',
  });
  expect(last.ballots).toEqual([]);
  expect(last.next.ballots).toBeNull();
  expect(first.modules.every((module) => module.installed)).toBe(true);
  const voteReads = reads.filter((row) => row.table === 'votes');
  expect(voteReads).toHaveLength(2);
  for (const [index, id] of ['10', '12'].entries()) {
    const key = ((BigInt(id) << 64n) | 2n).toString();
    expect(voteReads[index]).toMatchObject({
      index_position: 2,
      key_type: 'i128',
      lower_bound: key,
      upper_bound: key,
    });
  }
});
it('rejects a backwards module continuation before another shared scan', async () => {
  rpc([], () => ({ rows: [ballot('1')], more: true }));
  await expect(
    gateway().moduleState('7', { ballots: '11', projects: 'done', schedules: 'done' }),
  ).rejects.toThrow('CHAIN_RESPONSE_INVALID');
});
