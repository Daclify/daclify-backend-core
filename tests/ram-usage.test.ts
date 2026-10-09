import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey, ABI, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { RuntimeCodeHash, RuntimeRawAbiHash, runtimeAbi } from '../sdk/index.js';
import { RamUsageSchema } from '../protocol/resources.js';
import {
  AccountSchema,
  DaoSummarySchema,
  NetworkSchema,
  UserMembershipSchema,
} from '../protocol/api.js';
import { ramUsage } from '../services/api/src/resources/service.js';
const chainId = 'ab'.repeat(32);
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  let migrating = false,
    observing = true,
    changed = false,
    truncated = false,
    held = false,
    tooManyHolds = false;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const body = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(typeof init?.body === 'string' ? init.body : '{}'));
    if (url.endsWith('get_info')) return Response.json({ chain_id: chainId });
    if (url.endsWith('get_raw_abi'))
      return Response.json({
        account_name: body.account_name,
        code_hash: body.account_name === 'daclifycore' ? RuntimeCodeHash : 'cd'.repeat(32),
        abi_hash: RuntimeRawAbiHash,
        abi: Buffer.from(Serializer.encode({ object: ABI.from(runtimeAbi) }).array).toString(
          'base64',
        ),
      });
    if (url.endsWith('get_code_hash'))
      return Response.json({
        code_hash:
          body.account_name === 'daclifycore'
            ? RuntimeCodeHash
            : changed
              ? '00'.repeat(32)
              : 'cd'.repeat(32),
      });
    if (url.endsWith('get_account'))
      return Response.json({
        account_name: body.account_name,
        head_block_num: 11,
        head_block_time: '2026-10-08T00:00:00.000',
        privileged: false,
        last_code_update: '2026-01-01T00:00:00.000',
        created: '2020-01-01T00:00:00.000',
        ram_quota: 1000000,
        ram_usage: 10000,
        net_weight: 1000,
        cpu_weight: 1000,
        net_limit: { used: 0, available: 1000, max: 1000 },
        cpu_limit: { used: 0, available: 1000, max: 1000 },
        permissions: [],
      });
    if (!url.endsWith('get_table_rows')) throw new Error('Unexpected RAM fixture RPC');
    const rows =
      body.table === 'rammigrate'
        ? migrating
          ? [{ active: true, globals_complete: false, advanced: false, dao_cursor: '0' }]
          : []
        : body.table === 'ramholds'
          ? held
            ? [{ id: '1', recipient: '1', ready: true, padding: '00'.repeat(512) }]
            : []
          : body.table === 'ramobs'
            ? observing
              ? [{ meter_bytes: '900', runtime_hash: RuntimeCodeHash }]
              : []
            : body.table === 'ramstats' && body.scope === '1'
              ? [
                  {
                    payer: 'daclifycore',
                    identity: '1000',
                    activity: '200',
                    retained: '300',
                    platform: '0',
                  },
                  {
                    payer: 'decide',
                    identity: '0',
                    activity: '400',
                    retained: '50',
                    platform: '0',
                  },
                ]
              : body.table === 'ramalloc'
                ? [{ payer: 'decide', purchased_bytes: '4096' }]
                : body.table === 'ramentitle'
                  ? [
                      {
                        payer: 'daclifycore',
                        policy_revision: '1',
                        identity_per_slot: '2048',
                        slots: 10,
                      },
                    ]
                  : body.table === 'ramlimits'
                    ? [
                        {
                          payer: 'daclifycore',
                          activity: '262144',
                          identity: '20480',
                          completion: '32768',
                        },
                      ]
                    : body.table === 'ramsources'
                      ? [{ account: 'decide', code_hash: 'cd'.repeat(32) }]
                      : body.table === 'modules'
                        ? [
                            {
                              account: 'decide',
                              version: 1,
                              actions: [],
                              grants: [],
                              code_hash: 'cd'.repeat(32),
                            },
                          ]
                        : [];
    return Response.json({
      rows:
        tooManyHolds && body.table === 'ramholds'
          ? Array.from({ length: 5001 }, (_, i) => ({
              id: String(i + 1),
              recipient: '1',
              ready: true,
              padding: '00'.repeat(512),
            }))
          : rows,
      more: truncated && body.table === 'ramstats',
      next_key: '100',
    });
  });
  const gateway = new NativeChainGateway({
    rpcUrl: 'http://localhost:18888',
    chainId,
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
    modules: [{ id: 'decide', account: 'decide' }],
  });
  return {
    gateway,
    migrate: () => (migrating = true),
    disable: () => (observing = false),
    change: () => (changed = true),
    truncate: () => (truncated = true),
    hold: () => (held = true),
    excessHolds: () => (tooManyHolds = true),
  };
}
it('separates DAO counters/purchased credits from the whole payer account usage', async () => {
  const { gateway } = fixture(),
    result = await gateway.ramUsage('1');
  expect(result).toMatchObject({
    observation: 'active',
    enforcement: 'disabled',
    totalObservedBytes: '1950',
    purchasedBytes: '4096',
  });
  expect(result.payers.find((p) => p.payer === 'decide')).toMatchObject({
    sourceVerified: true,
    globalUsedBytes: '10000',
    globalQuotaBytes: '1000000',
    usage: { activity: '400' },
    purchasedBytes: '4096',
  });
  expect(result.payers.find((p) => p.payer === 'daclifycore')?.entitlement).toEqual({
    policy_revision: '1',
    identity_per_slot: '2048',
    slots: 10,
  });
  expect(() => RamUsageSchema.parse({ ...result, totalObservedBytes: '1951' })).toThrow();
  expect(() => RamUsageSchema.parse({ ...result, observation: 'disabled' })).toThrow();
  expect(() => RamUsageSchema.parse({ ...result, purchasedBytes: '4097' })).toThrow();
  expect(result.payers.find((p) => p.payer === 'daclifycore')?.allocation).toEqual({
    activity: '262144',
    identity: '20480',
    completion: '32768',
  });
});
it('reports physically occupied completion holds without adding them to usage twice', async () => {
  const { gateway } = fixture();
  const value = await gateway.ramUsage('1');
  expect(value).toMatchObject({
    completionHolds: { rows: 0, bytes: '0' },
    totalObservedBytes: '1950',
  });
  const withHold = fixture();
  withHold.hold();
  expect(await withHold.gateway.ramUsage('1')).toMatchObject({
    completionHolds: { rows: 1, bytes: '883' },
    totalObservedBytes: '1950',
  });
  const excessive = fixture();
  excessive.excessHolds();
  await expect(excessive.gateway.ramUsage('1')).rejects.toThrow('RESOURCE_SCOPE_LIMIT');
});
it('requires active membership of the exact DAO before reading resource details', async () => {
  const fixtureData = fixture(),
    value = await fixtureData.gateway.ramUsage('1'),
    account = AccountSchema.parse({
      id: crypto.randomUUID(),
      signingKey: null,
      encryptionKey: null,
      custody: 'user-controlled',
    }),
    dao = DaoSummarySchema.parse({
      reference: value.dao,
      title: 'RAM fixture',
      description: '',
      privacy: 'public',
      owner: 'alice',
      token: { chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      members: 1,
      available: '0',
      reserved: '0',
      claims: '0',
      keyEpoch: '1',
    }),
    member = UserMembershipSchema.parse({
      dao: value.dao,
      memberId: '1',
      nonce: '0',
      active: true,
      admin: false,
      reviewer: false,
      credits: '0',
      claim: '0',
      stake: '0',
      nativeAccount: 'alice',
      custody: 'user-controlled',
    }),
    read = vi.fn(async () => value),
    chain = {
      dao: async () => dao,
      network: async () =>
        NetworkSchema.parse({
          chainId,
          rpcUrl: 'http://localhost:18888',
          runtime: 'daclifycore',
          hub: null,
          environment: 'local',
          interfaceVersion: 1,
          coreVersion: '0.7.0-alpha.1',
          capabilities: [],
        }),
      memberships: async () => [member],
      ramUsage: read,
    };
  expect(await ramUsage(chain, account, '1')).toEqual(value);
  member.active = false;
  await expect(ramUsage(chain, account, '1')).rejects.toThrow('MEMBER_REQUIRED');
  member.active = true;
  member.dao = { ...member.dao, contract: 'daoother' };
  await expect(ramUsage(chain, account, '1')).rejects.toThrow('MEMBER_REQUIRED');
  expect(read).toHaveBeenCalledOnce();
  member.dao = value.dao;
  read.mockResolvedValueOnce({ ...value, dao: { ...value.dao, daoId: '2' } });
  await expect(ramUsage(chain, account, '1')).rejects.toThrow('CHAIN_RESPONSE_INVALID');
});
it('does not present disabled or unqualified observation as a zero-byte DAO', async () => {
  const disabled = fixture();
  disabled.disable();
  const result = await disabled.gateway.ramUsage('1');
  expect(result.observation).toBe('disabled');
  expect(result.totalObservedBytes).toBeNull();
  expect(result.payers.every((p) => p.usage === null)).toBe(true);
  const changed = fixture();
  changed.change();
  expect((await changed.gateway.ramUsage('1')).totalObservedBytes).toBeNull();
  const truncated = fixture();
  truncated.truncate();
  await expect(truncated.gateway.ramUsage('1')).rejects.toThrow('RESOURCE_SCOPE_LIMIT');
});

it('does not publish partial RAM totals while legacy backfill is active', async () => {
  const current = fixture();
  current.migrate();
  await expect(current.gateway.ramUsage('1')).rejects.toThrow('RAM_MIGRATION_ACTIVE');
});
