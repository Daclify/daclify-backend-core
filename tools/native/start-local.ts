// Start an owned Spring fixture when Docker is unavailable. Never contacts a public chain.
import { mkdirSync, readFileSync, writeFileSync, openSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { ABI, PrivateKey, Serializer } from '@wharfkit/antelope';
import { localFixture, localFixtureRoot } from './local.js';
import { contextPermissionPlan } from '../deploy/permissions.js';
import { encodeAction } from '../../sdk/index.js';
const binary = z.string().min(1).parse(process.env.DACLIFY_NODEOS_BINARY),
  root = resolve(localFixtureRoot),
  url = 'http://127.0.0.1:21388';
if (existsSync(root + '/pid'))
  throw Error('Inspect and stop the existing local fixture before restarting');
mkdirSync(root, { recursive: true, mode: 0o700 });
mkdirSync(root + '/config', { mode: 0o700 });
const names = [
  'eosio',
  'alice',
  'bob',
  'carol',
  'relay',
  'daclifycore',
  'eosio.token',
  'decide',
  'works',
  'payroll',
  'grants',
  'endorse',
] as const;
const keys = Object.fromEntries(
    names.map((name) => {
      const key = PrivateKey.generate('K1');
      return [name, { privateKey: key.toString(), publicKey: key.toPublic().toString() }];
    }),
  ),
  producer = keys.eosio;
if (!producer) throw Error('Fixture producer');
writeFileSync(root + '/keys.json', JSON.stringify(keys), { mode: 0o600 });
writeFileSync(
  root + '/genesis.json',
  JSON.stringify({
    initial_timestamp: new Date().toISOString().replace(/Z$/, ''),
    initial_key: producer.publicKey,
  }),
  { mode: 0o600 },
);
writeFileSync(
  root + '/config/config.ini',
  `http-server-address = 127.0.0.1:21388\nhttp-validate-host = false\nplugin = eosio::chain_api_plugin\nplugin = eosio::producer_plugin\nplugin = eosio::producer_api_plugin\nproducer-name = eosio\nsignature-provider = ${producer.publicKey}=KEY:${producer.privateKey}\nenable-stale-production = true\nwasm-runtime = eos-vm\nchain-state-db-size-mb = 256\nchain-state-db-guard-size-mb = 8\nresource-monitor-space-absolute-gb = 1\n`,
  { mode: 0o600 },
);
const log = openSync(root + '/nodeos.log', 'a', 0o600),
  child = spawn(
    binary,
    [
      '--data-dir',
      root + '/chain',
      '--config-dir',
      root + '/config',
      '--genesis-json',
      root + '/genesis.json',
    ],
    { detached: true, stdio: ['ignore', log, log], env: process.env },
  );
child.unref();
if (!child.pid) throw Error('Local node startup');
writeFileSync(root + '/pid', String(child.pid), { mode: 0o600 });
async function call(path: string, body: object): Promise<unknown> {
  const response = await fetch(url + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error('Local fixture RPC');
  return response.json();
}
let chainId = '';
for (let i = 0; i < 100; i++) {
  try {
    chainId = z
      .object({ chain_id: z.string(), head_block_num: z.number().min(2) })
      .parse(await call('/v1/chain/get_info', {})).chain_id;
    break;
  } catch {
    await new Promise((done) => setTimeout(done, 250));
  }
}
if (!chainId) throw Error('Local fixture startup timed out');
writeFileSync(root + '/network.json', JSON.stringify({ url, chainId }), { mode: 0o600 });
const fixture = localFixture();
for (const name of names.filter((name) => name !== 'eosio')) {
  const record = keys[name];
  if (!record) throw Error('Fixture account');
  const auth = {
    threshold: 1,
    keys: [{ key: record.publicKey, weight: 1 }],
    accounts: [],
    waits: [],
  };
  await fixture.push([
    fixture.system('newaccount', { creator: 'eosio', name, owner: auth, active: auth }, 'eosio'),
  ]);
}
const supported = z
  .array(
    z.object({
      feature_digest: z.string(),
      dependencies: z.array(z.string()),
      specification: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  )
  .parse(await call('/v1/producer/get_supported_protocol_features', {}));
const features = new Map(
  supported.flatMap((row) =>
    row.specification
      .filter((value) => value.name === 'builtin_feature_codename')
      .map((value) => [value.value, row.feature_digest] as const),
  ),
);
async function active(digest: string) {
  return z
    .object({ activated_protocol_features: z.array(z.object({ feature_digest: z.string() })) })
    .parse(await call('/v1/chain/get_activated_protocol_features', { limit: 100 }))
    .activated_protocol_features.some((row) => row.feature_digest === digest);
}
async function wait(digest: string) {
  for (let i = 0; i < 60; i++) {
    if (await active(digest)) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw Error('Local feature activation timed out');
}
const preactivate = features.get('PREACTIVATE_FEATURE');
if (!preactivate) throw Error('Missing native feature');
await call('/v1/producer/schedule_protocol_feature_activations', {
  protocol_features_to_activate: [preactivate],
});
await wait(preactivate);
await fixture.deploy('eosio', '.artifacts/contracts/boot');
const boot = ABI.from(readFileSync('.artifacts/contracts/boot.abi', 'utf8'));
async function activate(digest: string) {
  if (await active(digest)) return;
  const feature = supported.find((row) => row.feature_digest === digest);
  if (!feature) throw Error('Missing native feature');
  for (const dependency of feature.dependencies) await activate(dependency);
  await fixture.push([
    fixture.action(
      'eosio',
      'activate',
      Serializer.encode({ abi: boot, type: 'activate', object: { feature_digest: digest } }).array,
    ),
  ]);
  await wait(digest);
}
for (const name of [
  'GET_SENDER',
  'GET_CODE_HASH',
  'CRYPTO_PRIMITIVES',
  'RAM_RESTRICTIONS',
  'RESTRICT_ACTION_TO_SELF',
  'CONFIGURABLE_WASM_LIMITS2',
]) {
  const digest = features.get(name);
  if (!digest) throw Error('Missing native feature');
  await activate(digest);
}
for (const [account, path] of [
  ['daclifycore', '.artifacts/contracts/runtime'],
  ['eosio.token', '.artifacts/contracts/testtoken'],
  ...['decide', 'works', 'payroll', 'grants', 'endorse'].map((name) => [
    name,
    `../daclify-backend-modules/.artifacts/contracts/${name}`,
  ]),
]) {
  if (!account || !path) throw Error('Fixture artifact');
  await fixture.deploy(account, path);
}
for (const account of ['daclifycore', 'decide', 'works', 'payroll', 'grants', 'endorse']) {
  const record = keys[account];
  if (!record) throw Error('Fixture account');
  await fixture.push([
    fixture.system(
      'updateauth',
      {
        account,
        permission: 'active',
        parent: 'owner',
        auth: {
          threshold: 1,
          keys: [{ key: record.publicKey, weight: 1 }],
          accounts: [{ permission: { actor: account, permission: 'eosio.code' }, weight: 1 }],
          waits: [],
        },
      },
      account,
    ),
  ]);
}
const plan = contextPermissionPlan('daclifycore', [
  { id: 'decide', account: 'decide' },
  { id: 'works', account: 'works' },
  { id: 'payroll', account: 'payroll' },
  { id: 'grants-rounds', account: 'grants' },
  { id: 'endorsement-admission', account: 'endorse' },
]);
await fixture.push([
  fixture.system(
    'updateauth',
    {
      account: plan.account,
      permission: plan.permission,
      parent: plan.parent,
      auth: plan.authority,
    },
    plan.account,
  ),
]);
for (const link of plan.links)
  await fixture.push([
    fixture.system(
      'linkauth',
      {
        account: plan.account,
        code: link.account,
        type: link.action,
        requirement: plan.permission,
      },
      plan.account,
    ),
  ]);
await fixture.push([
  fixture.action('daclifycore', 'init', encodeAction('init', { chain_id: chainId })),
]);
const token = ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8'));
for (const [name, data, actor] of [
  ['create', { issuer: 'alice', maximum: '1000000.0000 TLOS' }, 'eosio.token'],
  ['issue', { to: 'alice', quantity: '1000.0000 TLOS', memo: 'Disposable qualification' }, 'alice'],
] as const)
  await fixture.push([
    fixture.action(
      'eosio.token',
      name,
      Serializer.encode({ abi: token, type: name, object: data }).array,
      actor,
    ),
  ]);
console.log(JSON.stringify({ url, chainId, pid: child.pid, nodeos: dirname(binary) }));
