import { expect, it } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { APIClient, ABI } from '@wharfkit/antelope';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { ModulePermissions } from '@daclify/modules';
import { DaoRefSchema } from '../../protocol/index.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import {
  RuntimeTableSchemas,
  encodeAction,
  nativeRamActions,
  makeInstruction,
  instructionDigest,
  type RuntimeActions,
} from '../../sdk/index.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const api = new APIClient({ url: network.url });
const suffix = () =>
  Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join('');
let runtime = 'ramctl' + suffix();
const makeSources = () =>
  ['decide', 'works', 'payroll', 'grants', 'endorse'].map((artifact, i) => ({
    account: 'ramsrc' + suffix(),
    artifact,
    kind: i + 1,
    code_hash: createHash('sha256')
      .update(readFileSync(`.artifacts/controller-modules/${artifact}.wasm`))
      .digest('hex'),
  }));
let modules = makeSources();
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (cause) {
    const detail =
      typeof cause === 'object' &&
      cause !== null &&
      'stderr' in cause &&
      typeof cause.stderr === 'string'
        ? cause.stderr.match(/assertion failure with message: ([A-Z_]{1,80})/)?.[1]
        : undefined;
    throw new Error('OWNED_RAM_CONTROLLER_ACTION_REJECTED' + (detail ? ':' + detail : ''));
  }
}
function push(account: string, name: string, data: unknown, actor = account) {
  const result: unknown = JSON.parse(
    cleos([
      'push',
      'action',
      account,
      name,
      JSON.stringify(data),
      '-p',
      actor + '@active',
      '--force-unique',
      '-j',
    ]),
  );
  executedChainResult(
    result,
    z.object({ transaction_id: z.string() }).parse(result).transaction_id,
  );
}
async function rows(code: string, table: string, scope = code) {
  const value = await api.v1.chain.get_table_rows({ code, table, scope, json: true, limit: 100 });
  if (value.more) throw new Error('CONTROLLER_FIXTURE_COVERAGE');
  return value.rows;
}
async function used(account: string) {
  return BigInt((await api.v1.chain.get_account(account)).ram_usage.toString());
}
async function govern<K extends keyof RuntimeActions>(
  action: K,
  data: RuntimeActions[K],
  daoId = '1',
  signer = fixtureKey('alice'),
) {
  const member = z
    .array(RuntimeTableSchemas.members)
    .parse(await rows(runtime, 'members', daoId))[0];
  if (!member) throw new Error('CONTROLLER_MEMBER_REQUIRED');
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  const request = makeInstruction(
    { chainId: network.chainId, contract: runtime, daoId, interfaceVersion: 1 },
    '1',
    member.nonce,
    now + 120,
    runtime,
    action,
    encodeAction(action, data),
  );
  push(runtime, 'submit', {
    request,
    sig: signer.signDigest(instructionDigest(request)).toString(),
  });
}
async function ordinaryRemaining(daoId = '1') {
  const usage = z
    .array(RuntimeTableSchemas.ramstats)
    .parse(await rows(runtime, 'ramstats', daoId))
    .find((value) => value.payer === runtime);
  const limit = z
    .array(RuntimeTableSchemas.ramlimits)
    .parse(await rows(runtime, 'ramlimits', daoId))
    .find((value) => value.payer === runtime);
  if (!usage || !limit) throw new Error('CONTROLLER_CAPACITY_REQUIRED');
  const bought = z
    .array(RuntimeTableSchemas.ramalloc)
    .parse(await rows(runtime, 'ramalloc', daoId))
    .find((value) => value.payer === runtime);
  return (
    BigInt(limit.identity) +
    BigInt(limit.activity) +
    BigInt(bought?.purchased_bytes ?? '0') -
    BigInt(usage.identity) -
    BigInt(usage.activity) -
    BigInt(usage.retained) -
    BigInt(usage.platform)
  );
}
async function fillOrdinary() {
  const available = Number(await ordinaryRemaining());
  const dao = z
    .array(RuntimeTableSchemas.daos)
    .parse(await rows(runtime, 'daos'))
    .find((row) => row.id === '1');
  if (!dao) throw new Error('CONTROLLER_DAO_REQUIRED');
  const before: unknown = JSON.parse(dao.metadata);
  const shape = z.object({ pad: z.string() }).parse(before);
  const metadata = JSON.stringify({ pad: shape.pad + 'x'.repeat(available) });
  expect(metadata.length).toBeLessThanOrEqual(4096);
  await govern('setmeta', { runtime, dao_id: '1', member_id: '1', metadata });
  expect(await ordinaryRemaining()).toBe(0n);
}
it.each([false, true])(
  'seals six native payers and preserves rights, old core=%s',
  async (legacy) => {
    runtime = 'ramctl' + suffix();
    modules = makeSources();
    if ((await api.v1.chain.get_info()).chain_id.toString() !== network.chainId)
      throw new Error('FIXTURE_CHAIN_CHANGED');
    unlockFixtureWallet(network.container);
    const pub = fixtureKey('alice').toPublic().toString();
    const baseline = new Map<string, bigint>();
    for (const source of [{ account: runtime, artifact: 'runtime' }, ...modules]) {
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
      if (source.account !== runtime) {
        cleos([
          'set',
          'code',
          source.account,
          `/work/.artifacts/controller-modules/${source.artifact}.wasm`,
          '-p',
          source.account + '@active',
        ]);
        cleos([
          'set',
          'abi',
          source.account,
          `/work/.artifacts/controller-modules/${source.artifact}.abi`,
          '-p',
          source.account + '@active',
        ]);
      } else
        cleos([
          'set',
          'contract',
          runtime,
          legacy ? '/work/.artifacts/upgrade/core' : '/work/.artifacts/contracts',
          'runtime.wasm',
          'runtime.abi',
          '-p',
          runtime + '@active',
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
          accounts: [
            { permission: { actor: source.account, permission: 'eosio.code' }, weight: 1 },
          ],
          waits: [],
        }),
        'owner',
        '-p',
        source.account + '@owner',
      ]);
      baseline.set(source.account, await used(source.account));
    }
    const accountFor = (artifact: string) => {
      const source = modules.find((value) => value.artifact === artifact);
      if (!source) throw new Error('CONTROLLER_MODULE_REQUIRED');
      return source.account;
    };
    configureFixtureContext(network.container, runtime, {
      decide: accountFor('decide'),
      works: accountFor('works'),
      payroll: accountFor('payroll'),
      grants: accountFor('grants'),
      endorse: accountFor('endorse'),
    });
    baseline.set(runtime, await used(runtime));
    push(runtime, 'init', { chain_id: network.chainId });
    for (const id of [1, 2]) {
      push(
        runtime,
        'createdao',
        {
          dao_id: id,
          owner: 'alice',
          metadata: '{}',
          privacy: 0,
          token_contract: 'eosio.token',
          token_symbol: '4,TLOS',
        },
        'alice',
      );
      push(
        runtime,
        'enroll',
        {
          dao_id: id,
          member_id: 1,
          signing_key: pub,
          encryption_key: 'legacy-encryption-key',
          custody: 0,
          native_account: '',
        },
        'alice',
      );
    }
    const payroll = modules.find((source) => source.artifact === 'payroll');
    if (!payroll) throw new Error('CONTROLLER_PAYROLL_REQUIRED');
    push(runtime, 'setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', '']);
    push(runtime, 'listmod', [
      payroll.account,
      'alice',
      0,
      1,
      '0.0000 TLOS',
      payroll.code_hash,
      'Legacy payroll',
    ]);
    push(
      runtime,
      'setmodule',
      [
        1,
        payroll.account,
        1,
        ModulePermissions.payroll.actions,
        ModulePermissions.payroll.grants,
        payroll.code_hash,
      ],
      'alice',
    );
    push('eosio.token', 'transfer', ['alice', runtime, '10.0000 TLOS', 'dao:1'], 'alice');
    const starts =
      3 + Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
    push(
      payroll.account,
      'commit',
      {
        runtime,
        dao_id: 1,
        member_id: 1,
        schedule_id: 1,
        recipient: 1,
        quantity: '1.0000 TLOS',
        periods: 2,
        interval: 86400,
        starts,
      },
      runtime,
    );
    push(
      payroll.account,
      'commit',
      {
        runtime,
        dao_id: 1,
        member_id: 1,
        schedule_id: 2,
        recipient: 1,
        quantity: '1.0000 TLOS',
        periods: 1,
        interval: 86400,
        starts,
      },
      runtime,
    );
    for (
      let retries = 0;
      Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000) < starts;
      retries++
    ) {
      if (retries > 40) throw new Error('CONTROLLER_FIXTURE_CLOCK');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    push(runtime, 'payob', { dao_id: 1, source: payroll.account, source_id: 1 });
    if (legacy)
      expect(
        ABI.from(readFileSync('.artifacts/upgrade/core/runtime.abi', 'utf8')).tables.some(
          (table) => table.name.toString() === 'ramholds',
        ),
      ).toBe(false);
    else expect(await rows(runtime, 'ramholds', '1')).toEqual([]);
    const decide = modules.find((source) => source.artifact === 'decide');
    if (!decide) throw new Error('CONTROLLER_DECIDE_REQUIRED');
    push(runtime, 'listmod', [
      decide.account,
      'alice',
      0,
      1,
      '0.0000 TLOS',
      decide.code_hash,
      'Legacy poll',
    ]);
    push(
      runtime,
      'setmodule',
      [
        1,
        decide.account,
        1,
        ModulePermissions.decide.actions,
        ModulePermissions.decide.grants,
        decide.code_hash,
      ],
      'alice',
    );
    push(
      decide.account,
      'open',
      {
        runtime,
        dao_id: 1,
        member_id: 1,
        ballot_id: 10,
        kind: 0,
        choices: 2,
        duration: 300,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      },
      runtime,
    );
    for (const source of modules) push(source.account, 'bindrampool', { runtime });
    if (legacy) {
      const original = z
        .array(RuntimeTableSchemas.members)
        .parse(await rows(runtime, 'members', '1'));
      expect(await rows(runtime, 'actors', '1')).toEqual([]);
      const previousUsed = await used(runtime);
      cleos([
        'set',
        'contract',
        runtime,
        '/work/.artifacts/contracts',
        'runtime.wasm',
        'runtime.abi',
        '-p',
        runtime + '@active',
      ]);
      const originalBaseline = baseline.get(runtime);
      if (originalBaseline === undefined) throw new Error('CONTROLLER_BASELINE_REQUIRED');
      baseline.set(runtime, originalBaseline + (await used(runtime)) - previousUsed);
      expect(
        z.array(RuntimeTableSchemas.members).parse(await rows(runtime, 'members', '1')),
      ).toEqual(original);
    }
    await expect(async () =>
      push(runtime, 'beginram', {
        sources: modules.map(({ account, kind, code_hash }) => ({
          account,
          kind: kind === 1 ? 2 : kind,
          code_hash,
        })),
      }),
    ).rejects.toThrow('OWNED_RAM_CONTROLLER_ACTION_REJECTED');
    expect(await rows(runtime, 'ramobs')).toEqual([]);
    push(runtime, 'beginram', {
      sources: modules.map(({ account, kind, code_hash }) => ({ account, kind, code_hash })),
    });
    await expect(async () => push(runtime, 'sealram', { limit: 1 })).rejects.toThrow(
      'OWNED_RAM_CONTROLLER_ACTION_REJECTED',
    );
    const manifest = readFileSync('contracts/common/ram_families.hpp', 'utf8');
    const global = manifest
      .split('#define DACLIFY_RAM_GLOBALS(X)')[1]
      ?.split('#define DACLIFY_RAM_SCOPED(X)')[0];
    const scoped = manifest
      .split('#define DACLIFY_RAM_SCOPED(X)')[1]
      ?.split('inline std::vector')[0];
    if (!global || !scoped) throw new Error('CONTROLLER_FAMILY_MANIFEST');
    const labels = (text: string) => [...text.matchAll(/X\("([a-z]+)",/g)].map((m) => m[1]);
    for (const table of labels(global)) push(runtime, 'scanram', { dao_id: 0, table, limit: 1 });
    for (const id of [1, 2])
      for (const table of labels(scoped))
        push(runtime, 'scanram', { dao_id: id, table, limit: 25 });
    for (const table of labels(global)) {
      for (let page = 0; page < 5; page++) {
        const progress = z
          .array(RuntimeTableSchemas.ramcursors)
          .parse(await rows(runtime, 'ramcursors'))
          .find((value) => value.table === table);
        if (progress?.complete) break;
        if (page === 4) throw new Error('CONTROLLER_GLOBAL_SCAN_LIMIT');
        push(runtime, 'scanram', { dao_id: 0, table, limit: 1 });
      }
    }
    for (const source of modules) {
      const declaration = manifest.match(
        new RegExp(`case ${source.kind}:return \\{([^}]+)\\}`),
      )?.[1];
      if (!declaration) throw new Error('CONTROLLER_MODULE_MANIFEST');
      const tables = ['rampayer', ...[...declaration.matchAll(/"([a-z]+)"_n/g)].map((m) => m[1])];
      for (const table of tables)
        push(source.account, 'scanram', { runtime, table, limit: 25 }, runtime);
    }
    for (const dao_id of [1, 2])
      for (const claims of [false, true]) push(runtime, 'adoptram', { dao_id, claims, limit: 25 });
    push(runtime, 'sealram', { limit: 1 });
    push(runtime, 'sealram', { limit: 1 });
    const progress = z
      .array(RuntimeTableSchemas.rammigrate)
      .parse(await rows(runtime, 'rammigrate'));
    expect(progress).toMatchObject([{ active: false, dao_cursor: '2' }]);
    expect(
      z.array(RuntimeTableSchemas.actors).parse(await rows(runtime, 'actors', '1')),
    ).toMatchObject([{ kind: 0, credential_epoch: '1' }]);
    const totals = new Map<string, bigint>();
    for (const scope of ['0', '1', '2']) {
      for (const value of z
        .array(RuntimeTableSchemas.ramstats)
        .parse(await rows(runtime, 'ramstats', scope)))
        totals.set(
          value.payer,
          (totals.get(value.payer) ?? 0n) +
            BigInt(value.identity) +
            BigInt(value.activity) +
            BigInt(value.retained) +
            BigInt(value.platform),
        );
    }
    const observer = z.array(RuntimeTableSchemas.ramobs).parse(await rows(runtime, 'ramobs'))[0];
    if (!observer) throw new Error('CONTROLLER_OBSERVER_REQUIRED');
    totals.set(runtime, (totals.get(runtime) ?? 0n) + BigInt(observer.meter_bytes));
    for (const [account, before] of baseline)
      expect((await used(account)) - before).toBe(totals.get(account));
    const members = z.array(RuntimeTableSchemas.members).parse(await rows(runtime, 'members', '1'));
    expect(members).toMatchObject([
      { nonce: '0', claim: '10000', encryption_key: 'legacy-encryption-key', signing_key: pub },
    ]);
    expect(
      z.array(RuntimeTableSchemas.ramclmholds).parse(await rows(runtime, 'ramclmholds', '1')),
    ).toMatchObject([{ recipient: '1', ready: true }]);
    expect(
      z.array(RuntimeTableSchemas.ramholds).parse(await rows(runtime, 'ramholds', '1')),
    ).toMatchObject([
      { id: '2', recipient: '1', ready: false },
      { id: '3', recipient: '1', ready: false },
    ]);
    const beforeRetry = await used(runtime);
    push(runtime, 'sealram', { limit: 1 });
    expect(await used(runtime)).toBe(beforeRetry);
    for (const [account, before] of baseline) {
      const quota = (await api.v1.chain.get_account(account)).ram_quota.toString();
      push(runtime, 'setrampool', {
        payer: account,
        expected_quota: quota,
        baseline_bytes: before.toString(),
        platform_headroom: 32768,
      });
    }
    const inherited = {
      dao_id: 1,
      payer: runtime,
      activity_headroom: 4096,
      identity_headroom: 2048,
      completion_headroom: 32768,
    };
    push(runtime, 'inheritram', inherited);
    const capacity = z
      .array(RuntimeTableSchemas.raminherit)
      .parse(await rows(runtime, 'raminherit', '1'));
    expect(capacity).toMatchObject([
      {
        payer: runtime,
        activity_headroom: '4096',
        identity_headroom: '2048',
        completion_headroom: '32768',
      },
    ]);
    const afterInheritance = await used(runtime);
    push(runtime, 'inheritram', inherited);
    expect(await used(runtime)).toBe(afterInheritance);
    await expect(async () =>
      push(runtime, 'inheritram', { ...inherited, activity_headroom: 8192 }),
    ).rejects.toThrow('OWNED_RAM_CONTROLLER_ACTION_REJECTED');
    expect(await used(runtime)).toBe(afterInheritance);
    for (const payer of [payroll.account, decide.account])
      push(runtime, 'inheritram', { ...inherited, payer, identity_headroom: 0 });
    push(runtime, 'inheritram', { ...inherited, dao_id: 2 });
    push(runtime, 'setdaoquota', { dao_id: 1, enabled: true });
    push(runtime, 'setdaoquota', { dao_id: 2, enabled: true });
    await govern('setprofile', {
      runtime,
      dao_id: '1',
      member_id: '1',
      account_name: 'capdao',
      profile: JSON.stringify({ name: 'capdao', introduction: 'x'.repeat(1200) }),
    });
    const remaining = Number(await ordinaryRemaining());
    expect(remaining).toBeGreaterThan(10);
    expect(remaining).toBeLessThan(4095);
    // Legacy metadata is two bytes; crossing the varuint length prefix adds one more byte.
    const metadata = JSON.stringify({ pad: 'x'.repeat(remaining + 1 - 10) });
    await govern('setmeta', { runtime, dao_id: '1', member_id: '1', metadata });
    expect(await ordinaryRemaining()).toBe(0n);
    const beforeRecovery = await used(runtime);
    await govern('rotatekey', {
      runtime,
      dao_id: '1',
      member_id: '1',
      signing_key: fixtureKey('bob').toPublic().toString(),
    });
    await govern(
      'rotatekey',
      {
        runtime,
        dao_id: '1',
        member_id: '1',
        signing_key: fixtureKey('alice').toPublic().toString(),
      },
      '1',
      fixtureKey('bob'),
    );
    expect(await used(runtime)).toBe(beforeRecovery);
    expect(await ordinaryRemaining()).toBe(0n);
    const beforeFailure = await rows(runtime, 'members', '1');
    const beforeRam = await used(runtime);
    await expect(
      govern('setmeta', {
        runtime,
        dao_id: '1',
        member_id: '1',
        metadata: JSON.stringify({ pad: 'x'.repeat(remaining + 2 - 10) }),
      }),
    ).rejects.toThrow('OWNED_RAM_CONTROLLER_ACTION_REJECTED');
    await expect(
      govern('withdraw', {
        runtime,
        dao_id: '1',
        member_id: '1',
        destination: 'bob',
        quantity: '0.5000 TLOS',
      }),
    ).rejects.toThrow('OWNED_RAM_CONTROLLER_ACTION_REJECTED');
    expect(await rows(runtime, 'members', '1')).toEqual(beforeFailure);
    expect(await used(runtime)).toBe(beforeRam);
    expect(await rows(runtime, 'ramclmholds', '1')).toHaveLength(1);
    await govern(
      'setmeta',
      { runtime, dao_id: '2', member_id: '1', metadata: '{"other":"still writable"}' },
      '2',
    );
    push(runtime, 'payob', { dao_id: 1, source: payroll.account, source_id: 3 });
    expect(
      z.array(RuntimeTableSchemas.members).parse(await rows(runtime, 'members', '1')),
    ).toMatchObject([{ claim: '20000' }]);
    await fillOrdinary();
    const beforeExit = await used(runtime);
    await govern('withdraw', {
      runtime,
      dao_id: '1',
      member_id: '1',
      destination: 'bob',
      quantity: '2.0000 TLOS',
    });
    expect(
      z.array(RuntimeTableSchemas.members).parse(await rows(runtime, 'members', '1')),
    ).toMatchObject([{ claim: '0', nonce: '6', encryption_key: 'legacy-encryption-key' }]);
    expect(await rows(runtime, 'ramclmholds', '1')).toEqual([]);
    expect(
      z.array(RuntimeTableSchemas.ramholds).parse(await rows(runtime, 'ramholds', '1')),
    ).toMatchObject([{ id: '2', ready: false }]);
    expect(await used(runtime)).toBeLessThan(beforeExit);
    await fillOrdinary();
    push(runtime, 'setresources', [
      500,
      2000,
      '262144',
      '2048',
      300,
      '100000000',
      '1000000000',
      100,
    ]);
    const gateway = new NativeChainGateway({
      rpcUrl: network.url,
      chainId: network.chainId,
      runtime,
      hub: null,
      environment: 'local',
      relayActor: runtime,
      relayKey: fixtureKey('alice'),
      modules: [
        { id: 'decide', account: decide.account },
        { id: 'payroll', account: payroll.account },
      ],
    });
    const dao = DaoRefSchema.parse({
      chainId: network.chainId,
      contract: runtime,
      daoId: '1',
      interfaceVersion: 1,
    });
    const quote = await gateway.ramQuote({
      dao,
      payer: 'alice',
      allocations: [{ receiver: runtime, minimumBytes: '65536' }],
    });
    const quotaBefore = BigInt((await api.v1.chain.get_account(runtime)).ram_quota.toString());
    const purchase: unknown = JSON.parse(
      cleos([
        'push',
        'transaction',
        JSON.stringify({ actions: nativeRamActions(quote) }),
        '--force-unique',
        '-j',
      ]),
    );
    executedChainResult(
      purchase,
      z.object({ transaction_id: z.string() }).parse(purchase).transaction_id,
    );
    const quotaAfter = BigInt((await api.v1.chain.get_account(runtime)).ram_quota.toString());
    expect(quotaAfter - quotaBefore).toBeGreaterThanOrEqual(65536n);
    expect(await ordinaryRemaining()).toBeGreaterThan(0n);
    await govern('setmeta', {
      runtime,
      dao_id: '1',
      member_id: '1',
      metadata: '{"after":"funded RAM purchase"}',
    });
  },
  120000,
);
