// Actual native population and core-payer allocation measurement; not throughput or live payment qualification.
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
} from '../../sdk/index.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { Uint64Schema } from '../../protocol/base.js';
import { fixtureNetwork } from '../native/network.js';
import { fixtureKey } from '../native/keys.js';
import { unlockFixtureWallet } from '../native/wallet.js';
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
async function measure(stage: string) {
  const bytes = (await api.v1.chain.get_account(runtime)).ram_usage.toString();
  samples.push({ stage, bytes });
  process.stdout.write(`${stage}: ${bytes} billed bytes\n`);
  return BigInt(bytes);
}
async function counters(scope: string) {
  const page = await api.v1.chain.get_table_rows({
    code: runtime,
    scope,
    table: 'ramstats',
    json: true,
    limit: 2,
  });
  assert.equal(page.more, false);
  return z.array(RuntimeTableSchemas.ramstats).max(1).parse(page.rows);
}
const info = await api.v1.chain.get_info();
assert.equal(info.chain_id.toString(), network.chainId);
unlockFixtureWallet(network.container);
// Increase only this owned fixture's synthetic market supply; no price conclusion is drawn from it.
const market = await api.v1.chain.get_table_rows({
  code: 'eosio',
  scope: 'eosio',
  table: 'rammarket',
  json: true,
  limit: 1,
});
const reserve = z
  .object({ base: z.object({ balance: z.string().regex(/^[0-9]+ RAM$/) }) })
  .parse(market.rows[0]).base.balance;
if (BigInt(reserve.split(' ')[0] ?? '') < 536870912n) {
  const global = await api.v1.chain.get_table_rows({
    code: 'eosio',
    scope: 'eosio',
    table: 'global',
    json: true,
    limit: 1,
  });
  const current = z.object({ max_ram_size: Uint64Schema }).parse(global.rows[0]);
  const expanded = Uint64Schema.parse((BigInt(current.max_ram_size) + 2147483648n).toString());
  cleos([
    'push',
    'action',
    'eosio',
    'setram',
    JSON.stringify([expanded]),
    '-p',
    'eosio@active',
    '--force-unique',
  ]);
}
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
configureFixtureContext(network.container, runtime);
const code = await api.v1.chain.get_raw_abi(runtime);
assert.equal(code.code_hash.toString(), RuntimeCodeHash);
await push([action('init', { chain_id: network.chainId })]);
const baseline = await measure('code-permissions-initial-settings');
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
const grants = [];
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
  const grant = action('grantdaoram', {
    dao_id: String(id),
    payer: runtime,
    reference: '1',
    activity: '262144',
    identity: '409600',
    completion: '32768',
  });
  await push([grant]);
  grants.push(grant);
}
await measure('200-daos-and-funded-core-allocations');
const keys = Array.from({ length: population.membersPerDao }, () => ({
  signing: PrivateKey.generate('K1').toPublic().toString(),
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
        signing_key: key.signing,
        encryption_key: key.encryption,
        custody: 0,
      }),
    ),
  );
  if (dao % 25 === 0) process.stdout.write(`Verified writes submitted for ${dao} DAOs\n`);
}
const populated = await measure('40000-active-memberships');
let membershipCount = 0,
  tracked = 0n,
  allocated = 0n;
for (let dao = 1; dao <= population.daos; dao++) {
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
    tracked += BigInt(r.identity) + BigInt(r.activity) + BigInt(r.retained) + BigInt(r.platform);
  const limits = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: String(dao),
    table: 'ramlimits',
    json: true,
    limit: 2,
  });
  assert.equal(limits.more, false);
  const limit = z.array(RuntimeTableSchemas.ramlimits).length(1).parse(limits.rows)[0];
  if (!limit || limit.payer !== runtime) throw new Error('ALLOCATOR_PAYER_REQUIRED');
  allocated += BigInt(limit.activity) + BigInt(limit.identity) + BigInt(limit.completion);
}
for (const r of await counters('0'))
  tracked += BigInt(r.identity) + BigInt(r.activity) + BigInt(r.retained) + BigInt(r.platform);
const observer = await api.v1.chain.get_table_rows({
  code: runtime,
  scope: runtime,
  table: 'ramobs',
  json: true,
  limit: 1,
});
const observed = z.array(RuntimeTableSchemas.ramobs).length(1).parse(observer.rows)[0];
if (!observed) throw new Error('OBSERVER_REQUIRED');
tracked += BigInt(observed.meter_bytes);
assert.equal(populated - baseline, tracked);
assert.equal(membershipCount, 40000);
await batches(grants);
assert.equal(await measure('replayed-200-grants'), populated);
const final = await api.v1.chain.get_account(runtime);
assert.ok(allocated + baseline + 1048576n <= BigInt(final.ram_quota.toString()));
const report = {
  schemaVersion: 1,
  runtime,
  chainId: network.chainId,
  coreCodeHash: RuntimeCodeHash,
  population,
  membershipCount,
  actualQuotaBytes: final.ram_quota.toString(),
  allocatedCoreBytes: allocated.toString(),
  nativeDeltaBytes: (populated - baseline).toString(),
  accountedDeltaBytes: tracked.toString(),
  samples,
  limits: [
    'Core payer only; five-module mutation conservation has separate native tests.',
    '200 disposable identities reused across DAOs model memberships, not 40000 distinct people.',
    'No enforcement, completion holds, legacy backfill or live billing qualification.',
    'Free capacity and market RAM supply are overridden only on this owned local fixture.',
  ],
  runtimeScope: Name.from(runtime).value.toString(),
};
writeFileSync('.artifacts/resources-population.json', JSON.stringify(report, null, 2));
process.stdout.write('Owned native population and allocation conservation passed.\n');
