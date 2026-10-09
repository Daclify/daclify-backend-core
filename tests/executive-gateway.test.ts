import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
const chainId = 'ab'.repeat(32),
  key = PrivateKey.generate('K1').toPublic().toString();
const gateway = () =>
  new NativeChainGateway({
    chainId,
    rpcUrl: 'http://localhost:18888',
    runtime: 'daclifycore',
    hub: null,
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
    environment: 'local',
  });
afterEach(() => vi.unstubAllGlobals());
function rpc(nativeTable = true, bound = 'alice', revoked = false) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('get_info'))
        return Response.json({
          chain_id: chainId,
          server_version: '00000000',
          head_block_num: 1,
          last_irreversible_block_num: 1,
          last_irreversible_block_id: '11'.repeat(32),
          head_block_id: '11'.repeat(32),
          head_block_time: '2026-10-09T00:00:00.000',
          head_block_producer: 'eosio',
          virtual_block_cpu_limit: 200000,
          virtual_block_net_limit: 1048576,
          block_cpu_limit: 200000,
          block_net_limit: 1048576,
        });
      if (url.endsWith('get_abi'))
        return Response.json({
          account_name: 'daclifycore',
          abi: {
            version: 'eosio::abi/1.2',
            types: [],
            structs: [],
            actions: [],
            tables: nativeTable
              ? [
                  {
                    name: 'nativegov',
                    type: 'nativegov',
                    index_type: 'i64',
                    key_names: [],
                    key_types: [],
                  },
                ]
              : [],
          },
        });
      const value: unknown = JSON.parse(typeof options?.body === 'string' ? options.body : '{}');
      if (typeof value !== 'object' || value === null || !('table' in value))
        throw new Error('FIXTURE_REQUEST');
      const table = String(value.table);
      requests.push(table);
      const rows =
        table === 'nativegov'
          ? [
              {
                dao_id: '1',
                contracts: [],
                service_key: key,
                handed_over: true,
                signers: ['alice'],
                threshold: 1,
                admin_members: ['1'],
              },
            ]
          : table === 'executives'
            ? [{ member_id: '1', last_active: 1, office_epoch: '1', election_id: '0' }]
            : table === 'members'
              ? [
                  {
                    id: '1',
                    native_account: bound,
                    signing_key: key,
                    encryption_key: 'key',
                    custody: 0,
                    nonce: '0',
                    credits: '0',
                    active: true,
                    admin: true,
                    reviewer: false,
                    stake: '0',
                    claim: '0',
                    join_epoch: '1',
                  },
                ]
              : table === 'actors' && revoked
                ? [
                    {
                      id: '1',
                      kind: 1,
                      operator_label: 'Fixture agent',
                      revoked: true,
                      credential_epoch: '1',
                    },
                  ]
                : [];
      return Response.json({ rows, more: false });
    }),
  );
  return requests;
}
it('detects an inactive executive wallet still bound to native governance', async () => {
  const requests = rpc();
  expect(await gateway().nativeGovernanceWalletInUse(chainId, 'alice')).toBe(true);
  expect(requests).toEqual(['nativegov', 'executives', 'members', 'actors']);
});
it('does not keep a revoked executive’s sign-in credential locked', async () => {
  rpc(true, 'alice', true);
  expect(await gateway().nativeGovernanceWalletInUse(chainId, 'alice')).toBe(false);
});
it('does not block a wallet after its authoritative binding was replaced', async () => {
  rpc(true, 'bob');
  expect(await gateway().nativeGovernanceWalletInUse(chainId, 'alice')).toBe(false);
});
it('does not invent executive governance on an older deployment', async () => {
  const requests = rpc(false);
  expect(await gateway().nativeGovernanceWalletInUse(chainId, 'alice')).toBe(false);
  expect(requests).toEqual([]);
});
it('rejects unavailable authoritative state instead of permitting removal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
  await expect(gateway().nativeGovernanceWalletInUse(chainId, 'alice')).rejects.toThrow();
});
