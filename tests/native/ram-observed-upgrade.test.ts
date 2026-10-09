import { expect, it } from 'vitest';
import { APIClient, PrivateKey, ABI, Serializer } from '@wharfkit/antelope';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { fundResourceFixture } from '../../tools/native/resource-funding.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
  type RuntimeActions,
  runtimeAbi,
} from '../../sdk/index.js';
import { ModulePermissions } from '@daclify/modules';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const api = new APIClient({ url: network.url });
const suffix = Array.from(randomBytes(6), (byte) =>
  '12345abcdefghijklmnopqrstuvwxyz'.charAt(byte % 31),
).join('');
const runtime = 'ramobs' + suffix;
const sources = ['works', 'payroll', 'decide'].map((artifact, index) => ({
  artifact,
  account: 'obs' + (index + 1) + 'aa' + suffix,
}));
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 },
    );
  } catch (cause) {
    const output = z
      .object({ stderr: z.string().optional(), stdout: z.string().optional() })
      .safeParse(cause);
    let code = output.success
      ? [output.data.stdout, output.data.stderr]
          .filter((value) => value !== undefined)
          .join('\n')
          .match(/assertion failure with message: ([A-Z_]+)/)?.[1]
      : undefined;
    if (!code && output.success && output.data.stdout) {
      try {
        const value: unknown = JSON.parse(output.data.stdout);
        const result = z
          .object({
            processed: z.object({
              except: z.object({
                stack: z.array(z.object({ data: z.object({ s: z.string().optional() }) })),
              }),
            }),
          })
          .safeParse(value);
        if (result.success)
          code = result.data.processed.except.stack
            .map((entry) => entry.data.s)
            .find((value) => value !== undefined && /^[A-Z_]{1,80}$/.test(value));
      } catch {
        /* Unparseable fixture failures remain redacted. */
      }
    }
    throw new Error('OWNED_OBSERVED_UPGRADE_REJECTED' + (code ? ':' + code : ''));
  }
}
function push(account: string, action: string, data: unknown, actor = account) {
  const value: unknown = JSON.parse(
    cleos([
      'push',
      'action',
      account,
      action,
      JSON.stringify(data),
      '-p',
      actor + '@active',
      '--force-unique',
      '-j',
    ]),
  );
  executedChainResult(value, z.object({ transaction_id: z.string() }).parse(value).transaction_id);
}
async function rows(account: string, table: string, scope = account) {
  const result = await api.v1.chain.get_table_rows({
    code: account,
    scope,
    table,
    json: true,
    limit: 100,
  });
  if (result.more) throw new Error('OBSERVED_UPGRADE_COVERAGE_REQUIRED');
  return result.rows;
}
async function used(account: string) {
  return BigInt((await api.v1.chain.get_account(account)).ram_usage.toString());
}
const hash = (directory: string, name: string) =>
  createHash('sha256')
    .update(readFileSync(directory + '/' + name + '.wasm'))
    .digest('hex');
async function govern<K extends 'setmeta' | 'rotatekey' | 'withdraw'>(
  action: K,
  data: RuntimeActions[K],
  memberId: string,
  signer: PrivateKey,
) {
  const person = z
    .array(RuntimeTableSchemas.members)
    .parse(await rows(runtime, 'members', '1'))
    .find((person) => person.id === memberId);
  if (!person) throw new Error('OBSERVED_UPGRADE_MEMBER_REQUIRED');
  const info = await api.v1.chain.get_info();
  const request = makeInstruction(
    { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    memberId,
    person.nonce,
    Math.floor(info.head_block_time.toMilliseconds() / 1000) + 120,
    runtime,
    action,
    encodeAction(action, data),
  );
  push(runtime, 'submit', {
    request,
    sig: signer.signDigest(instructionDigest(request)).toString(),
  });
}

it('reconciles actual old observed core/module adoption without resetting existing counters or changing liabilities', async () => {
  expect((await api.v1.chain.get_info()).chain_id.toString()).toBe(network.chainId);
  unlockFixtureWallet(network.container);
  await fundResourceFixture();
  const pub = fixtureKey('alice').toPublic().toString(),
    baseline = new Map<string, bigint>();
  const contracts = [{ account: runtime, artifact: 'runtime' }, ...sources];
  for (const source of contracts) {
    cleos([
      'system',
      'newaccount',
      'alice',
      source.account,
      pub,
      pub,
      '--stake-net',
      '0.1000 TLOS',
      '--stake-cpu',
      '0.1000 TLOS',
      '--buy-ram-kbytes',
      '12288',
    ]);
    cleos([
      'set',
      'contract',
      source.account,
      '/work/.artifacts/observed-upgrade',
      source.artifact + '.wasm',
      source.artifact + '.abi',
      '-p',
      source.account + '@active',
    ]);
    cleos([
      'set',
      'account',
      'permission',
      source.account,
      'active',
      JSON.stringify({
        threshold: 1,
        keys: [{ key: pub, weight: 1 }],
        waits: [],
        accounts: [{ permission: { actor: source.account, permission: 'eosio.code' }, weight: 1 }],
      }),
      'owner',
      '-p',
      source.account + '@owner',
    ]);
    baseline.set(source.account, await used(source.account));
  }
  const works = sources[0],
    payroll = sources[1],
    decide = sources[2];
  if (!works || !payroll || !decide) throw new Error('OBSERVED_UPGRADE_SOURCES_REQUIRED');
  configureFixtureContext(network.container, runtime, {
    works: works.account,
    payroll: payroll.account,
    decide: decide.account,
  });
  baseline.set(runtime, await used(runtime));
  push(runtime, 'init', { chain_id: network.chainId });
  // Configuration created before observation belongs to the native baseline.
  baseline.set(runtime, await used(runtime));
  push(runtime, 'initramobs', {});
  for (const source of sources)
    push(runtime, 'setramcode', [
      source.account,
      hash('.artifacts/observed-upgrade', source.artifact),
    ]);
  push(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice');
  for (const id of [1, 2])
    push(
      runtime,
      'enroll',
      [
        1,
        id,
        '',
        fixtureKey(id === 1 ? 'alice' : 'bob')
          .toPublic()
          .toString(),
        'original recovery identity',
        0,
      ],
      'alice',
    );
  push(runtime, 'setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', '']);
  for (const source of sources) {
    const permissions =
      source.artifact === 'works'
        ? ModulePermissions.works
        : source.artifact === 'payroll'
          ? ModulePermissions.payroll
          : ModulePermissions.decide;
    const code = hash('.artifacts/observed-upgrade', source.artifact);
    push(runtime, 'listmod', [
      source.account,
      'alice',
      0,
      1,
      '0.0000 TLOS',
      code,
      'Historical module',
    ]);
    push(
      runtime,
      'setmodule',
      [1, source.account, 1, permissions.actions, permissions.grants, code],
      'alice',
    );
    if (source.artifact !== 'decide') push(source.account, 'bindrampool', [runtime]);
  }
  push('eosio.token', 'transfer', ['alice', runtime, '10.0000 TLOS', 'dao:1'], 'alice');
  push(runtime, 'putjson', [runtime, 1, 1, 1, 1, '{}', 0, 0]);
  push(
    works.account,
    'propose',
    [runtime, 1, 1, 1, 2, 1, 1, ['1.0000 TLOS', '1.0000 TLOS'], [0, 0]],
    runtime,
  );
  push(works.account, 'accept', [runtime, 1, 1, 1], runtime);
  push(works.account, 'submitwork', [runtime, 1, 2, 1, 1, 1], runtime);
  push(works.account, 'review', [runtime, 1, 1, 1, true, 1, 1], runtime);
  push(runtime, 'payob', [1, works.account, 1]);
  const starts =
    30 + Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  push(payroll.account, 'commit', [runtime, 1, 1, 1, 2, '1.0000 TLOS', 1, 86400, starts], runtime);
  push(decide.account, 'open', [runtime, 1, 1, 1, 0, 2, 300, 5000, 5001, '{}'], runtime);
  const preserved = async () =>
    Promise.all([
      rows(runtime, 'members', '1'),
      rows(runtime, 'obligations', '1'),
      rows(works.account, 'milestones', runtime),
      rows(payroll.account, 'schedules', runtime),
      rows(decide.account, 'ballots', runtime),
    ]);
  const original = await preserved();
  const beforeUpgrade = await Promise.all(
    contracts.map(async (source) => ({
      ...source,
      native: String((await used(source.account)) - (baseline.get(source.account) ?? 0n)),
      counters: await rows(runtime, 'ramstats', '0'),
      daoCounters: await rows(runtime, 'ramstats', '1'),
      observer: await rows(runtime, 'ramobs'),
    })),
  );
  for (const source of contracts) {
    const before = await used(source.account);
    cleos([
      'set',
      'contract',
      source.account,
      source.account === runtime
        ? '/work/.artifacts/contracts'
        : '/work/.artifacts/controller-modules',
      source.artifact + '.wasm',
      source.artifact + '.abi',
      '-p',
      source.account + '@active',
    ]);
    baseline.set(
      source.account,
      (baseline.get(source.account) ?? 0n) + (await used(source.account)) - before,
    );
  }
  push(runtime, 'rebindramobs', [
    hash('.artifacts/observed-upgrade', 'runtime'),
    hash('.artifacts/contracts', 'runtime'),
  ]);
  for (const source of sources) {
    const permissions =
      source.artifact === 'works'
        ? ModulePermissions.works
        : source.artifact === 'payroll'
          ? ModulePermissions.payroll
          : ModulePermissions.decide;
    const code = hash('.artifacts/controller-modules', source.artifact);
    push(runtime, 'setramcode', [source.account, code]);
    push(source.account, 'bindrampool', [runtime]);
    push(runtime, 'listmod', [
      source.account,
      'alice',
      0,
      1,
      '0.0000 TLOS',
      code,
      'Reviewed current module',
    ]);
    push(
      runtime,
      'setmodule',
      [1, source.account, 1, permissions.actions, permissions.grants, code],
      'alice',
    );
  }
  for (const claims of [false, true])
    for (let page = 0; page < 3; page++) push(runtime, 'adoptram', [1, claims, 1]);
  for (const [source, table] of [
    [works, 'adoptwork'],
    [payroll, 'adoptpay'],
    [decide, 'adoptpolls'],
  ] as const) {
    for (let page = 0; page < 2; page++)
      push(source.account, 'scanram', [runtime, table, 1], runtime);
    push(source.account, 'checkquota', [runtime, 1], runtime);
  }
  expect(await preserved()).toEqual(original);
  const totals = new Map<string, bigint>();
  for (const scope of ['0', '1'])
    for (const counter of z
      .array(RuntimeTableSchemas.ramstats)
      .parse(await rows(runtime, 'ramstats', scope)))
      totals.set(
        counter.payer,
        (totals.get(counter.payer) ?? 0n) +
          BigInt(counter.identity) +
          BigInt(counter.activity) +
          BigInt(counter.retained) +
          BigInt(counter.platform),
      );
  const observer = z.array(RuntimeTableSchemas.ramobs).parse(await rows(runtime, 'ramobs'))[0];
  if (!observer) throw new Error('OBSERVED_UPGRADE_METER_REQUIRED');
  totals.set(runtime, (totals.get(runtime) ?? 0n) + BigInt(observer.meter_bytes));
  const afterUpgrade = await Promise.all(
    contracts.map(async (source) => ({
      ...source,
      native: String((await used(source.account)) - (baseline.get(source.account) ?? 0n)),
      accounted: String(totals.get(source.account) ?? 0n),
    })),
  );
  writeFileSync(
    '.artifacts/observed-upgrade-latest.json',
    JSON.stringify({ beforeUpgrade, afterUpgrade }, null, 2),
  );
  for (const source of contracts)
    expect(
      (await used(source.account)) - (baseline.get(source.account) ?? 0n),
      source.artifact,
    ).toBe(totals.get(source.account));
  const beforeRetry = await rows(runtime, 'ramstats', '1');
  for (const claims of [false, true]) push(runtime, 'adoptram', [1, claims, 1]);
  expect(await rows(runtime, 'ramstats', '1')).toEqual(beforeRetry);
  for (const source of contracts) {
    const account = await api.v1.chain.get_account(source.account);
    push(runtime, 'setrampool', [
      source.account,
      account.ram_quota.toString(),
      String(baseline.get(source.account) ?? 0n),
      32768,
    ]);
    push(runtime, 'inheritram', [1, source.account, 4096, 0, 32768]);
  }
  push(runtime, 'setdaoquota', [1, true]);
  const limits = z
    .array(RuntimeTableSchemas.ramlimits)
    .parse(await rows(runtime, 'ramlimits', '1'))
    .find((limit) => limit.payer === runtime);
  const usage = z
    .array(RuntimeTableSchemas.ramstats)
    .parse(await rows(runtime, 'ramstats', '1'))
    .find((counter) => counter.payer === runtime);
  if (!limits || !usage) throw new Error('OBSERVED_UPGRADE_CAPACITY_REQUIRED');
  const remaining =
    BigInt(limits.identity) +
    BigInt(limits.activity) -
    BigInt(usage.identity) -
    BigInt(usage.activity) -
    BigInt(usage.retained) -
    BigInt(usage.platform);
  const community = z
    .array(RuntimeTableSchemas.daos)
    .parse(await rows(runtime, 'daos'))
    .find((dao) => dao.id === '1');
  const abi = ABI.from(runtimeAbi),
    type = abi.tables.find((table) => table.name.toString() === 'daos')?.type;
  if (!community || !type) throw new Error('OBSERVED_UPGRADE_ROW_REQUIRED');
  const size = (metadata: string) =>
    Serializer.encode({ abi, type, object: { ...community, metadata } }).array.length;
  let metadata = JSON.stringify({ pad: 'x'.repeat(Number(remaining) - 8) });
  const excess = size(metadata) - size(community.metadata) - Number(remaining);
  metadata = JSON.stringify({ pad: 'x'.repeat(Number(remaining) - 8 - excess) });
  expect(size(metadata) - size(community.metadata)).toBe(Number(remaining));
  expect(metadata.length).toBeLessThanOrEqual(4096);
  await govern(
    'setmeta',
    { runtime, dao_id: '1', member_id: '1', metadata },
    '1',
    fixtureKey('alice'),
  );
  const nextKey = PrivateKey.generate('K1');
  await govern(
    'rotatekey',
    { runtime, dao_id: '1', member_id: '2', signing_key: nextKey.toPublic().toString() },
    '2',
    fixtureKey('bob'),
  );
  await expect(
    govern(
      'withdraw',
      { runtime, dao_id: '1', member_id: '2', destination: 'bob', quantity: '0.5000 TLOS' },
      '2',
      nextKey,
    ),
  ).rejects.toThrow('RAM_ORDINARY_EXHAUSTED');
  await govern(
    'withdraw',
    { runtime, dao_id: '1', member_id: '2', destination: 'bob', quantity: '1.0000 TLOS' },
    '2',
    nextKey,
  );
  expect(
    z
      .array(RuntimeTableSchemas.members)
      .parse(await rows(runtime, 'members', '1'))
      .find((member) => member.id === '2'),
  ).toMatchObject({ claim: '0', nonce: '2', encryption_key: 'original recovery identity' });
  expect(await rows(runtime, 'ramclmholds', '1')).toEqual([]);
  expect(
    z
      .array(RuntimeTableSchemas.obligations)
      .parse(await rows(runtime, 'obligations', '1'))
      .filter((debt) => debt.status <= 1),
  ).toHaveLength(2);
  writeFileSync(
    '.artifacts/observed-upgrade-latest.json',
    JSON.stringify(
      {
        historical: {
          coreCommit: '6145da8',
          worksPayrollCommit: '4a43786',
          decideCommit: '2d44085',
          decideCoreHeadersCommit: 'c6e713e',
          codeHashes: Object.fromEntries(
            contracts.map((source) => [
              source.artifact,
              hash('.artifacts/observed-upgrade', source.artifact),
            ]),
          ),
        },
        currentCoreCodeHash: hash('.artifacts/contracts', 'runtime'),
        beforeUpgrade,
        afterUpgrade,
        preservedRows: true,
        retryCountersUnchanged: true,
        quotaEnabled: true,
        ordinaryCapacityExhausted: true,
        originalKeyRecovery: true,
        partialExitRejected: true,
        fullClaimExited: true,
        remainingPendingObligations: 2,
        limits: [
          'Owned native fixture and three historical module producers; not the complete old-release lifecycle matrix.',
          'Exact native/counter reconciliation is before token exit; external token-row ownership remains separately unqualified.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
}, 120000);
