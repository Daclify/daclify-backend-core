import { afterEach, expect, it, vi } from 'vitest';
import { ABI, PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { decideAbi } from '@daclify/modules/sdk';
import { archiveSourceSchema } from '@daclify/modules/archive';
import { runtimeAbi, RuntimeCodeHash, RuntimeRawAbiHash } from '../sdk/index.js';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
const source = archiveSourceSchema('ordinary-poll-votes'),
  chainId = 'ab'.repeat(32),
  at = 1_700_000_000;
const input = {
  dao: { chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 as const },
  ballotIds: ['7'],
  retentionSeconds: 90 * 86400,
};
const ballot = {
  id: '7',
  dao_id: '1',
  creator: '1',
  kind: 0,
  choices: 2,
  closes: at - 91 * 86400,
  quorum: 5000,
  approval: 5001,
  denominator: '2',
  max_member: '2',
  cast: '2',
  tallies: ['1', '1'],
  status: 2,
  winner: -1,
  metadata: '{}',
};
const votes = [
  { id: '2', ballot: '7', member: '1', weight: '1', choice: 0 },
  { id: '3', ballot: '7', member: '2', weight: '1', choice: 1 },
];
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  let codeChanged = false,
    snapshotChanged = false,
    repeatedPage = false,
    truncated = false,
    reads = 0;
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const body = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));
    requests.push({ url, ...body });
    if (url.endsWith('get_info'))
      return Response.json({
        server_version: 'fixture',
        chain_id: chainId,
        head_block_num: 11,
        last_irreversible_block_num: 10,
        last_irreversible_block_id: '0000000a' + 'ab'.repeat(28),
        head_block_id: '0000000b' + 'ab'.repeat(28),
        head_block_time: new Date((at + 1) * 1000).toISOString().replace('Z', ''),
        head_block_producer: 'eosio',
        virtual_block_cpu_limit: 1000000,
        virtual_block_net_limit: 1000000,
        block_cpu_limit: 100000,
        block_net_limit: 100000,
      });
    if (url.endsWith('get_raw_abi')) {
      const core = body.account_name === 'daclifycore';
      if (!core) reads++;
      return Response.json({
        account_name: body.account_name,
        code_hash: core
          ? RuntimeCodeHash
          : codeChanged && reads > 1
            ? '00'.repeat(32)
            : source.codeHash,
        abi_hash: core ? RuntimeRawAbiHash : source.rawAbiHash,
        abi: Buffer.from(
          Serializer.encode({ object: ABI.from(core ? runtimeAbi : decideAbi) }).array,
        ).toString('base64'),
      });
    }
    if (url.endsWith('get_block'))
      return Response.json({
        timestamp: new Date(at * 1000).toISOString().replace('Z', ''),
        producer: 'eosio',
        confirmed: 0,
        previous: '00'.repeat(32),
        transaction_mroot: '00'.repeat(32),
        action_mroot: '00'.repeat(32),
        schedule_version: 0,
        producer_signature: PrivateKey.generate('K1').signDigest('ab'.repeat(32)).toString(),
        transactions: [],
        id: snapshotChanged ? '0000000a' + 'cd'.repeat(28) : '0000000a' + 'ab'.repeat(28),
        block_num: 10,
        ref_block_prefix: 0,
      });
    if (url.endsWith('get_account'))
      return Response.json({
        account_name: 'decide',
        head_block_num: 11,
        head_block_time: new Date(at * 1000).toISOString().replace('Z', ''),
        privileged: false,
        last_code_update: new Date((at - 92 * 86400) * 1000).toISOString().replace('Z', ''),
        created: '2020-01-01T00:00:00.000',
        ram_quota: 1000000,
        net_weight: 1000,
        cpu_weight: 1000,
        net_limit: { used: 0, available: 1000, max: 1000 },
        cpu_limit: { used: 0, available: 1000, max: 1000 },
        ram_usage: 1000,
        permissions: [],
      });
    if (!url.endsWith('get_table_rows')) throw new Error('UNEXPECTED_ARCHIVE_FIXTURE_RPC');
    const table = body.table;
    return Response.json({
      rows:
        table === 'modules'
          ? [
              {
                account: 'decide',
                version: 1,
                actions: ['open', 'vote'],
                grants: ['govlock'],
                code_hash: source.codeHash,
              },
            ]
          : table === 'ballots'
            ? [ballot]
            : table === 'pollends'
              ? [{ ballot_id: '7', dao_id: '1', completed_at: at - 90 * 86400, legacy: false }]
              : table === 'votes'
                ? truncated
                  ? votes.slice(0, 1)
                  : votes
                : [],
      more: table === 'votes' && repeatedPage,
    });
  });
  const gateway = new NativeChainGateway({
    rpcUrl: 'http://localhost:18888',
    chainId,
    runtime: 'daclifycore',
    hub: null,
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
    environment: 'local',
    modules: [{ id: 'decide', account: 'decide' }],
  });
  return {
    gateway,
    requests,
    code: () => {
      codeChanged = true;
    },
    snapshot: () => {
      snapshotChanged = true;
    },
    repeated: () => {
      repeatedPage = true;
    },
    truncate: () => {
      truncated = true;
    },
  };
}
it('plans complete immutable poll rows using the exact irreversible block and approved deployed schema', async () => {
  const f = fixture(),
    result = await f.gateway.archivePreview(input);
  expect(result.pruningAuthorized).toBe(false);
  expect(result.snapshot.blockNumber).toBe(10);
  expect(result.families[0]?.grossRamBytes).toBe('578');
  expect(f.requests.some((r) => String(r.url).endsWith('push_transaction'))).toBe(false);
  expect(f.requests.find((r) => r.table === 'votes')).toMatchObject({
    index_position: 2,
    key_type: 'i128',
  });
});
it('refuses changed source code, a mismatched irreversible block and missing or repeated coverage', async () => {
  for (const change of ['code', 'snapshot', 'repeated', 'truncate'] as const) {
    const f = fixture();
    f[change]();
    await expect(f.gateway.archivePreview(input)).rejects.toThrow();
  }
});
it('rejects another deployment before any source read', async () => {
  const f = fixture();
  await expect(
    f.gateway.archivePreview({ ...input, dao: { ...input.dao, contract: 'daoother' } }),
  ).rejects.toThrow('DAO_REFERENCE');
  expect(f.requests).toEqual([]);
});
