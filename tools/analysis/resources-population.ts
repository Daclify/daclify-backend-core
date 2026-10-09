// Actual six-payer population/accounting measurement; not throughput or live payment qualification.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes, generateKeyPairSync, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  ABI,
  APIClient,
  Action,
  Transaction,
  SignedTransaction,
  PrivateKey,
  Name,
} from '@wharfkit/antelope';
import { z } from 'zod';
import {
  RuntimeActionSchemas,
  RuntimeTableSchemas,
  runtimeAbi,
  RuntimeCodeHash,
  makeInstruction,
  instructionDigest,
  encodeAction,
} from '../../sdk/index.js';
import { ModulePermissions } from '@daclify/modules';
import {
  ModuleCodeHashes,
  WorksTableSchemas,
  encodeWorks,
  encodeGrants,
  encodePayroll,
  encodeEndorse,
  encodeDecide,
} from '@daclify/modules/sdk';
import { Uint64Schema } from '../../protocol/base.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { fixtureNetwork } from '../native/network.js';
import { fixtureKey } from '../native/keys.js';
import { unlockFixtureWallet } from '../native/wallet.js';
import { fundResourceFixture } from '../native/resource-funding.js';
import { configureFixtureContext } from '../native/permissions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const api = new APIClient({ url: network.url }),
  abi = ABI.from(runtimeAbi),
  signer = fixtureKey('alice');
const runtime =
  'ramobs' +
  Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join('');
const population = { daos: 200, membersPerDao: 200 },
  samples: { stage: string; bytes: string }[] = [];
const modules = [
  { id: 'decide', file: 'decide', account: 'rdecid' + runtime.slice(6), activity: 32768 },
  { id: 'works', file: 'works', account: 'rworks' + runtime.slice(6), activity: 32768 },
  { id: 'payroll', file: 'payroll', account: 'rpayrl' + runtime.slice(6), activity: 16384 },
  { id: 'grants-rounds', file: 'grants', account: 'rgrant' + runtime.slice(6), activity: 32768 },
  {
    id: 'endorsement-admission',
    file: 'endorse',
    account: 'rendor' + runtime.slice(6),
    activity: 16384,
  },
] as const;
const moduleAccounts = Object.fromEntries(modules.map((m) => [m.file, m.account]));
const baselines = new Map<string, bigint>();
let sequence = 0;
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (cause) {
    const stderr = z
      .union([z.string(), z.instanceof(Buffer)])
      .safeParse(cause instanceof Error && 'stderr' in cause ? cause.stderr : undefined);
    const detail = stderr.success
      ? stderr.data.toString().match(/assertion failure with message: ([^\n]+)/)?.[1]
      : undefined;
    throw new Error(`OWNED_POPULATION_SETUP_REJECTED${detail ? ': ' + detail.slice(0, 200) : ''}`);
  }
}
function action<K extends keyof typeof RuntimeActionSchemas>(
  name: K,
  value: z.input<(typeof RuntimeActionSchemas)[K]>,
) {
  return Action.from(
    {
      account: runtime,
      name,
      authorization: [{ actor: runtime, permission: 'active' }],
      data: RuntimeActionSchemas[name].parse(value),
    },
    abi,
  );
}
async function push(actions: Action[]) {
  const info = await api.v1.chain.get_info();
  assert.equal(info.chain_id.toString(), network.chainId);
  const tx = Transaction.from({ ...info.getTransactionHeader(60 + (sequence++ % 60)), actions });
  const result = await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...tx,
      signatures: [signer.signDigest(tx.signingDigest(network.chainId))],
    }),
  );
  executedChainResult(result, tx.id.toString());
}
async function batches(actions: Action[]) {
  for (let offset = 0; offset < actions.length; offset += 25)
    await push(actions.slice(offset, offset + 25));
}
async function measure(stage: string, payer = runtime) {
  const bytes = (await api.v1.chain.get_account(payer)).ram_usage.toString();
  samples.push({ stage: payer + ':' + stage, bytes });
  process.stdout.write(`${payer} ${stage}: ${bytes} billed bytes\n`);
  return BigInt(bytes);
}
async function counters(scope: string) {
  const page = await api.v1.chain.get_table_rows({
    code: runtime,
    scope,
    table: 'ramstats',
    json: true,
    limit: 7,
  });
  assert.equal(page.more, false);
  return z.array(RuntimeTableSchemas.ramstats).max(6).parse(page.rows);
}
const info = await api.v1.chain.get_info();
assert.equal(info.chain_id.toString(), network.chainId);
unlockFixtureWallet(network.container);
// Synthetic market expansion preserves the finite token supply and existing account quotas.
const global = await api.v1.chain.get_table_rows({
  code: 'eosio',
  scope: 'eosio',
  table: 'global',
  json: true,
  limit: 1,
});
assert.equal(global.more, false);
const marketState = z
  .array(z.object({ max_ram_size: Uint64Schema }))
  .length(1)
  .parse(global.rows)[0];
assert.ok(marketState);
const targetMarketBytes = 1099511627776n;
if (BigInt(marketState.max_ram_size) < targetMarketBytes)
  cleos([
    'push',
    'action',
    'eosio',
    'setram',
    JSON.stringify([targetMarketBytes.toString()]),
    '-p',
    'eosio@active',
    '--force-unique',
  ]);
await fundResourceFixture();
const fixtureMarket = {
  beforeMaxBytes: marketState.max_ram_size,
  minimumMaxBytes: targetMarketBytes.toString(),
  synthetic: true,
};
cleos([
  'system',
  'newaccount',
  'alice',
  runtime,
  signer.toPublic().toString(),
  signer.toPublic().toString(),
  '--buy-ram-bytes',
  '268435456',
  '--stake-net',
  '50.0000 TLOS',
  '--stake-cpu',
  '50.0000 TLOS',
]);
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
cleos(['set', 'account', 'permission', runtime, 'active', '--add-code', '-p', runtime + '@active']);
for (const m of modules) {
  cleos([
    'system',
    'newaccount',
    'alice',
    m.account,
    signer.toPublic().toString(),
    signer.toPublic().toString(),
    '--buy-ram-bytes',
    '33554432',
    '--stake-net',
    '50.0000 TLOS',
    '--stake-cpu',
    '50.0000 TLOS',
  ]);
  cleos([
    'set',
    'contract',
    m.account,
    '/work/.artifacts/modules-release',
    m.file + '.wasm',
    m.file + '.abi',
    '-p',
    m.account + '@active',
  ]);
  cleos([
    'set',
    'account',
    'permission',
    m.account,
    'active',
    '--add-code',
    '-p',
    m.account + '@active',
  ]);
  const deployed = await api.v1.chain.get_raw_abi(m.account);
  assert.equal(deployed.code_hash.toString(), ModuleCodeHashes[m.id]);
  baselines.set(m.account, await measure('exclusive-code-binding-baseline', m.account));
}
configureFixtureContext(network.container, runtime, moduleAccounts);
const code = await api.v1.chain.get_raw_abi(runtime);
assert.equal(code.code_hash.toString(), RuntimeCodeHash);
await push([action('init', { chain_id: network.chainId })]);
const baseline = await measure('code-permissions-initial-settings');
baselines.set(runtime, baseline);
await push([action('initramobs', {})]);
await push([action('sethosted', { free_members: 200, settler: runtime })]);
await push([
  action('setfees', {
    third_party_bps: 500,
    first_party_bps: 10000,
    treasury: 'alice',
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
    names: '',
  }),
]);
const account = await api.v1.chain.get_account(runtime);
await push([
  action('setrampool', {
    payer: runtime,
    expected_quota: account.ram_quota.toString(),
    baseline_bytes: baseline.toString(),
    platform_headroom: '1048576',
  }),
]);
await push([
  action('setresources', {
    native_ram_bps: 500,
    card_ram_bps: 2000,
    included_activity_bytes: '262144',
    identity_bytes_per_slot: '2048',
    quote_lifetime_seconds: 300,
    storage_free_bytes: '100000000',
    storage_unit_bytes: '1000000000',
    storage_monthly_usd: 100,
  }),
]);
for (const m of modules) {
  await push([
    action('setramcode', { account: m.account, code_hash: ModuleCodeHashes[m.id] }),
    action('listmod', {
      account: m.account,
      publisher: 'alice',
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: ModuleCodeHashes[m.id],
      title: 'Owned population fixture',
    }),
  ]);
  cleos([
    'push',
    'action',
    m.account,
    'bindrampool',
    JSON.stringify({ runtime }),
    '-p',
    m.account + '@active',
  ]);
  const payer = await api.v1.chain.get_account(m.account);
  await push([
    action('setrampool', {
      payer: m.account,
      expected_quota: payer.ram_quota.toString(),
      baseline_bytes: String(baselines.get(m.account)),
      platform_headroom: '1048576',
    }),
  ]);
}
await push([
  action('setramauto', {
    enabled: true,
    offers: [
      { payer: runtime, activity: '131072', completion: '32768' },
      ...modules.map((m) => ({
        payer: m.account,
        activity: String(m.activity),
        completion: '32768',
      })),
    ],
  }),
]);
for (let id = 1; id <= population.daos; id++) {
  const reference = createHash('sha256').update(`${runtime}:${id}`).digest('hex');
  await push([
    action('orderfree', { reference, creator: signer.toPublic().toString() }),
    action('createpaid', {
      dao_id: String(id),
      owner: runtime,
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      reference,
      creator: signer.toPublic().toString(),
    }),
  ]);
  await push(
    modules.map((m) =>
      action('setmodule', {
        dao_id: String(id),
        account: m.account,
        version: 1,
        actions: [...ModulePermissions[m.id].actions],
        grants: [...ModulePermissions[m.id].grants],
        code_hash: ModuleCodeHashes[m.id],
      }),
    ),
  );
}
await measure('200-daos-and-automatic-six-payer-allocations');
const keys = Array.from({ length: population.membersPerDao }, () => ({
  signing: PrivateKey.generate('K1'),
  encryption: JSON.stringify(
    EncryptionPublicKeySchema.parse(
      generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
    ),
  ),
}));
for (let dao = 1; dao <= population.daos; dao++) {
  await batches(
    keys.map((key, index) =>
      action('enroll', {
        dao_id: String(dao),
        member_id: String(index + 1),
        native_account: '',
        signing_key: key.signing.toPublic().toString(),
        encryption_key: key.encryption,
        custody: 0,
      }),
    ),
  );
  if (dao % 25 === 0) process.stdout.write(`Verified writes submitted for ${dao} DAOs\n`);
}
await measure('40000-active-memberships');
for (let dao = 1; dao <= population.daos; dao++)
  await push([action('setdaoquota', { dao_id: String(dao), enabled: true })]);
await measure('200-explicitly-enforced-daos');
const member = keys[0];
if (!member) throw new Error('POPULATION_MEMBER_REQUIRED');
const works = modules[1].account,
  grants = modules[3].account,
  payroll = modules[2].account,
  endorse = modules[4].account,
  decide = modules[0].account;
for (let id = 1; id <= population.daos; id++) {
  const dao_id = String(id),
    context = { runtime, dao_id, member_id: '1' };
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  cleos([
    'push',
    'action',
    'eosio.token',
    'transfer',
    JSON.stringify(['alice', runtime, '10.0000 TLOS', 'dao:' + id]),
    '-p',
    'alice@active',
    '--force-unique',
  ]);
  const operations = [
    {
      target: runtime,
      name: 'putjson',
      data: encodeAction('putjson', {
        ...context,
        document_id: '1',
        version: 1,
        value: '{}',
        envelope_version: 0,
        key_epoch: '0',
      }),
    },
    {
      target: works,
      name: 'propose',
      data: encodeWorks('propose', {
        ...context,
        project_id: dao_id,
        contributor: '1',
        document_id: '1',
        document_version: 1,
        payments: ['1.0000 TLOS'],
        dues: [0],
      }),
    },
    {
      target: works,
      name: 'accept',
      data: encodeWorks('accept', { ...context, project_id: dao_id }),
    },
    {
      target: grants,
      name: 'newround',
      data: encodeGrants('newround', {
        ...context,
        round_id: dao_id,
        document_id: '1',
        document_version: 1,
        applications_close: now + 3600,
        review_close: now + 7200,
        awards_close: now + 10800,
        maximum: '10.0000 TLOS',
        allow_agents: false,
        works,
      }),
    },
    {
      target: payroll,
      name: 'commit',
      data: encodePayroll('commit', {
        ...context,
        schedule_id: dao_id,
        recipient: '1',
        quantity: '1.0000 TLOS',
        periods: 2,
        interval: 86400,
        starts: now + 60,
      }),
    },
    {
      target: payroll,
      name: 'edit',
      data: encodePayroll('edit', {
        ...context,
        schedule_id: dao_id,
        paused: 0,
        label: 'x'.repeat(80),
      }),
    },
    {
      target: payroll,
      name: 'edit',
      data: encodePayroll('edit', { ...context, schedule_id: dao_id, paused: 0, label: 'x' }),
    },
    {
      target: runtime,
      name: 'setadmit',
      data: encodeAction('setadmit', {
        ...context,
        enabled: true,
        source: endorse,
        threshold: 1,
        allow_agents: false,
        admin_override: false,
      }),
    },
    {
      target: endorse,
      name: 'applyjoin',
      data: encodeEndorse('applyjoin', {
        ...context,
        application_id: dao_id,
        signing_key: PrivateKey.generate('K1').toPublic().toString(),
        encryption_key: 'fixture-key',
        custody: 0,
        kind: 0,
        operator_label: '',
        document_id: '1',
        document_version: 1,
        expires: now + 3600,
      }),
    },
    {
      target: decide,
      name: 'open',
      data: encodeDecide('open', {
        ...context,
        ballot_id: dao_id,
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    },
    {
      target: decide,
      name: 'vote',
      data: encodeDecide('vote', { ...context, ballot_id: dao_id, choice: 0 }),
    },
  ];
  await push(
    operations.map((op, nonce) => {
      const request = makeInstruction(
        { chainId: network.chainId, contract: runtime, daoId: dao_id, interfaceVersion: 1 },
        '1',
        String(nonce),
        now + 120,
        op.target,
        op.name,
        op.data,
      );
      return action('submit', {
        request,
        sig: member.signing.signDigest(instructionDigest(request)).toString(),
      });
    }),
  );
  if (id % 25 === 0) process.stdout.write(`Module writes submitted for ${id} DAOs\n`);
}
const payers = [runtime, ...modules.map((m) => m.account)];
const tracked = new Map(payers.map((payer) => [payer, 0n])),
  allocations = new Map(payers.map((payer) => [payer, 0n]));
let membershipCount = 0;
for (let dao = 1; dao <= population.daos; dao++) {
  const quota = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: String(dao),
    table: 'ramquota',
    json: true,
    limit: 1,
  });
  assert.equal(quota.more, false);
  assert.deepEqual(z.array(RuntimeTableSchemas.ramquota).parse(quota.rows), [{ enabled: true }]);
  const refs = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: String(dao),
    table: 'docrefs',
    json: true,
    limit: 10,
  });
  assert.equal(refs.more, false);
  const slots = z
    .array(RuntimeTableSchemas.docrefs)
    .parse(refs.rows)
    .filter((row) => row.source === works && row.table === 'milestones');
  assert.deepEqual(
    slots.map((row) => [row.slot, row.document_id, row.version]),
    [
      [0, '0', 0],
      [1, '0', 0],
    ],
  );
  const members = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: String(dao),
    table: 'members',
    json: true,
    limit: 201,
  });
  assert.equal(members.more, false);
  const rows = z.array(RuntimeTableSchemas.members).length(200).parse(members.rows);
  assert.ok(rows.every((r) => r.active));
  membershipCount += rows.length;
  for (const r of await counters(String(dao)))
    tracked.set(
      r.payer,
      (tracked.get(r.payer) ?? 0n) +
        BigInt(r.identity) +
        BigInt(r.activity) +
        BigInt(r.retained) +
        BigInt(r.platform),
    );
  const limits = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: String(dao),
    table: 'ramlimits',
    json: true,
    limit: 7,
  });
  assert.equal(limits.more, false);
  for (const limit of z.array(RuntimeTableSchemas.ramlimits).length(6).parse(limits.rows)) {
    assert.ok(payers.includes(limit.payer));
    allocations.set(
      limit.payer,
      (allocations.get(limit.payer) ?? 0n) +
        BigInt(limit.activity) +
        BigInt(limit.identity) +
        BigInt(limit.completion),
    );
  }
  const entitlement = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: String(dao),
    table: 'ramentitle',
    json: true,
    limit: 7,
  });
  assert.equal(entitlement.more, false);
  const entitled = z.array(RuntimeTableSchemas.ramentitle).length(6).parse(entitlement.rows);
  assert.ok(entitled.every((row) => row.slots === 200));
  assert.equal(entitled.find((row) => row.payer === runtime)?.identity_per_slot, '2048');
  assert.ok(
    entitled.filter((row) => row.payer !== runtime).every((row) => row.identity_per_slot === '0'),
  );
}
for (const r of await counters('0'))
  tracked.set(
    r.payer,
    (tracked.get(r.payer) ?? 0n) +
      BigInt(r.identity) +
      BigInt(r.activity) +
      BigInt(r.retained) +
      BigInt(r.platform),
  );
const observer = await api.v1.chain.get_table_rows({
  code: runtime,
  scope: runtime,
  table: 'ramobs',
  json: true,
  limit: 1,
});
const observed = z.array(RuntimeTableSchemas.ramobs).length(1).parse(observer.rows)[0];
if (!observed) throw new Error('OBSERVER_REQUIRED');
tracked.set(runtime, (tracked.get(runtime) ?? 0n) + BigInt(observed.meter_bytes));
assert.equal(membershipCount, 40000);
const worksRows = await api.v1.chain.get_table_rows({
  code: works,
  scope: runtime,
  table: 'projects',
  json: true,
  limit: 201,
});
assert.equal(worksRows.more, false);
assert.ok(
  z
    .array(WorksTableSchemas.projects)
    .length(200)
    .parse(worksRows.rows)
    .every((row) => row.status === 1),
);
const measurements = [];
for (const payer of payers) {
  const before = baselines.get(payer),
    accounted = tracked.get(payer),
    allocated = allocations.get(payer);
  assert.ok(before !== undefined && accounted !== undefined && allocated !== undefined);
  const used = await measure('all-module-mutations-complete', payer),
    quota = BigInt((await api.v1.chain.get_account(payer)).ram_quota.toString());
  assert.equal(used - before, accounted);
  assert.ok(allocated + before + 1048576n <= quota);
  measurements.push({
    payer,
    baselineBytes: String(before),
    usedBytes: String(used),
    quotaBytes: String(quota),
    allocatedBytes: String(allocated),
    nativeDeltaBytes: String(used - before),
    accountedDeltaBytes: String(accounted),
  });
}
const report = {
  schemaVersion: 2,
  runtime,
  chainId: network.chainId,
  coreCodeHash: RuntimeCodeHash,
  moduleCodeHashes: ModuleCodeHashes,
  population,
  fixtureMarket,
  membershipCount,
  enforcedDaos: population.daos,
  measurements,
  samples,
  representativeOperationsPerDao: 11,
  limits: [
    '200 disposable identities reused across DAOs model memberships, not 40000 distinct people.',
    'One representative workflow per DAO; not throughput, complete lifecycle or projected activity volumes.',
    'Representative writes use active per-DAO guards and receipt/reference holds; exhaustion, legacy backfill and live billing are qualified separately, not by this population run.',
    'Free capacity, included payer split and expanded 1 TiB market supply are synthetic owned-fixture settings; acquisition costs are not production price evidence.',
    'Archive pruning, private-file recovery and historical completion are separate native drills, not simulated by this population run.',
  ],
  runtimeScope: Name.from(runtime).value.toString(),
};
writeFileSync('.artifacts/resources-population.json', JSON.stringify(report, null, 2));
process.stdout.write('Owned six-payer population, automatic backing and conservation passed.\n');
