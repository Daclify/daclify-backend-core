import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { ModulePermissions } from '@daclify/modules';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { RuntimeCodeHash } from '../sdk/index.js';
const reference = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '7',
  interfaceVersion: 1 as const,
};
const gateway = () =>
  new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:19988',
    chainId: reference.chainId,
    runtime: reference.contract,
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
    modules: [{ id: 'decide', account: 'decide' }],
  });
const registration = (id: string, dao_id = '7') => ({
  id,
  dao_id,
  document_id: '9',
  category: 0,
  approval: 1,
  track_acceptance: true,
  revision: '0',
  adopted_id: '0',
  pending_id: '0',
});
function rpc(verified = true, runtimeVerified = true, wrongDao = false, disabled = false) {
  const reads: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      if (typeof body !== 'object' || body === null) throw new Error('FIXTURE_RPC');
      const payload = Object.fromEntries(Object.entries(body));
      reads.push(payload);
      if (url.endsWith('get_code_hash'))
        return Response.json({
          code_hash:
            payload.account_name === 'daclifycore'
              ? runtimeVerified
                ? RuntimeCodeHash
                : 'cd'.repeat(32)
              : verified
                ? ModuleCodeHashes.decide
                : 'cd'.repeat(32),
        });
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
              actions: disabled ? [] : ModulePermissions.decide.actions,
              grants: disabled ? [] : ModulePermissions.decide.grants,
              code_hash: ModuleCodeHashes.decide,
            },
          ],
          more: false,
        });
      if (payload.table === 'docregs')
        return Response.json({
          rows:
            payload.lower_bound === ((7n << 64n) | 26n).toString()
              ? [registration('26')]
              : Array.from({ length: 25 }, (_, i) =>
                  registration(String(i + 1), wrongDao && i === 0 ? '8' : '7'),
                ),
          more: payload.lower_bound !== ((7n << 64n) | 26n).toString(),
        });
      return Response.json({ rows: [], more: false });
    }),
  );
  return reads;
}
afterEach(() => vi.unstubAllGlobals());
it('retains the official register when Decide member actions are disabled', async () => {
  rpc(true, true, false, true);
  const page = await gateway().governingDocuments('7', {});
  expect(page.available).toBe(true);
  expect(page.module?.enabled).toBe(false);
  expect(page.registrations).toHaveLength(25);
});
it('keeps formal management unavailable until the core RAM and document-reference release is deployed', async () => {
  const reads = rpc(true, false);
  expect((await gateway().governingDocuments('7', {})).available).toBe(false);
  expect(
    reads.some((row) => ['docregs', 'docchanges', 'docaccepts'].includes(String(row.table))),
  ).toBe(false);
});
it('returns bounded DAO index pages and advances the registration cursor', async () => {
  const reads = rpc();
  const service = gateway();
  const first = await service.governingDocuments('7', {});
  expect(first.available).toBe(true);
  expect(first.registrations).toHaveLength(25);
  expect(first.next).toBe('26');
  expect(reads.find((r) => r.table === 'docregs')).toMatchObject({
    index_position: 2,
    limit: 25,
    key_type: 'i128',
    lower_bound: (7n << 64n).toString(),
    upper_bound: ((8n << 64n) - 1n).toString(),
  });
  const second = await service.governingDocuments('7', { after: '26' });
  expect(second.registrations.map((r) => r.id)).toEqual(['26']);
  expect(second.next).toBeNull();
});
it('rejects a cross-DAO row returned inside a scoped register index', async () => {
  rpc(true, true, true);
  await expect(gateway().governingDocuments('7', {})).rejects.toThrow('CHAIN_RESPONSE_INVALID');
});
it('refuses to read formal governance state from an unverified module deployment', async () => {
  const reads = rpc(false);
  const page = await gateway().governingDocuments('7', {});
  expect(page.available).toBe(false);
  expect(page.registrations).toEqual([]);
  expect(reads.some((r) => ['docregs', 'docchanges', 'docaccepts'].includes(String(r.table)))).toBe(
    false,
  );
});

it('refuses cleanup through an unverified module before signing any transaction', async () => {
  const reads = rpc(false);
  await expect(
    gateway().clearGoverningDocuments({ dao: reference, proposalIds: ['1'] }),
  ).rejects.toThrow('MODULE_UNVERIFIED');
  expect(reads.some((row) => row.code === 'decide' && row.table === 'docchanges')).toBe(false);
});
