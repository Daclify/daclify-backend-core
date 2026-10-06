import { activateFixtureFeatures } from './features.js';
import { configureFixtureContext } from './permissions.js';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
const root = resolve(process.cwd());
const name = z
  .enum(['daclify-v2-native', 'daclify-dao-presets-native'])
  .parse(process.env.DACLIFY_NATIVE_CONTAINER ?? 'daclify-v2-native');
const port = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .parse(process.env.DACLIFY_NATIVE_PORT ?? 18888);
const url = 'http://127.0.0.1:' + port;
function docker(args: string[]): string {
  try {
    return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    throw new Error(
      'Local native harness command failed; secret-bearing process arguments are redacted',
    );
  }
}
try {
  docker(['inspect', name]);
  throw new Error('Existing test container must be inspected and stopped before a fresh run');
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Existing')) throw error;
}
const key = PrivateKey.generate('K1');
const accountNames = [
  'alice',
  'bob',
  'relay',
  'daclifycore',
  'daclifyhub',
  'eosio.token',
  'decide',
  'works',
  'payroll',
  'permprobe',
] as const;
const accountKeys = Object.fromEntries(
  accountNames.map((account) => {
    const signer = PrivateKey.generate('K1');
    return [account, { privateKey: signer.toString(), publicKey: signer.toPublic().toString() }];
  }),
);
mkdirSync('.artifacts/native', { recursive: true });
writeFileSync(
  '.artifacts/native/test-key.json',
  JSON.stringify({ privateKey: key.toString(), publicKey: key.toPublic().toString() }),
  { mode: 0o600 },
);
writeFileSync('.artifacts/native/accounts.json', JSON.stringify(accountKeys), { mode: 0o600 });
writeFileSync(
  '.artifacts/native/genesis.json',
  JSON.stringify({
    initial_timestamp: new Date().toISOString().replace(/Z$/, ''),
    initial_key: key.toPublic().toString(),
  }),
);
docker([
  'run',
  '-d',
  '--platform',
  'linux/amd64',
  '--name',
  name,
  '-p',
  '127.0.0.1:' + port + ':8888',
  '-v',
  `${root}:/work`,
  'daclify-v2-toolchain:4.1.1-spring1.2.2',
  'nodeos',
  '--data-dir',
  '/tmp/chain',
  '--config-dir',
  '/tmp/config',
  '--genesis-json',
  '/work/.artifacts/native/genesis.json',
  '--http-server-address',
  '0.0.0.0:8888',
  '--http-validate-host',
  'false',
  '--plugin',
  'eosio::chain_api_plugin',
  '--plugin',
  'eosio::producer_plugin',
  '--plugin',
  'eosio::producer_api_plugin',
  '--producer-name',
  'eosio',
  '--signature-provider',
  `${key.toPublic()}=KEY:${key}`,
  '--enable-stale-production',
  '--wasm-runtime',
  'eos-vm',
  '--chain-state-db-size-mb',
  '128',
  '--chain-state-db-guard-size-mb',
  '8',
]);
const InfoSchema = z.object({ chain_id: z.string(), head_block_num: z.number() });
let info: z.infer<typeof InfoSchema> | undefined;
for (let i = 0; i < 100; i++) {
  try {
    const response = await fetch(url + '/v1/chain/get_info', {
      method: 'POST',
      body: '{}',
    });
    if (response.ok) {
      info = InfoSchema.parse(await response.json());
      if (info.head_block_num > 1) break;
    }
  } catch {
    /* Startup can take a few seconds. */
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 250));
}
if (!info || info.head_block_num < 2)
  throw new Error('Native chain did not become ready; inspect local container logs');
docker([
  'exec',
  '-d',
  name,
  'keosd',
  '--http-server-address',
  '127.0.0.1:8900',
  '--wallet-dir',
  '/tmp/wallet',
]);
await new Promise((resolveWait) => setTimeout(resolveWait, 300));
function cleos(args: string[]): string {
  return docker([
    'exec',
    name,
    'cleos',
    '--url',
    'http://127.0.0.1:8888',
    '--wallet-url',
    'http://127.0.0.1:8900',
    ...args,
  ]);
}
cleos(['wallet', 'create', '--file', '/tmp/wallet-password']);
cleos(['wallet', 'import', '--private-key', key.toString()]);
for (const account of accountNames) {
  const signer = accountKeys[account];
  if (!signer) throw new Error('Missing local fixture signer');
  cleos(['wallet', 'import', '--private-key', signer.privateKey]);
  cleos(['create', 'account', 'eosio', account, signer.publicKey, signer.publicKey]);
}
await activateFixtureFeatures(name, url);
cleos([
  'set',
  'contract',
  'daclifycore',
  '/work/.artifacts/contracts',
  'runtime.wasm',
  'runtime.abi',
  '-p',
  'daclifycore@active',
]);
cleos([
  'set',
  'account',
  'permission',
  'daclifycore',
  'active',
  '--add-code',
  '-p',
  'daclifycore@active',
]);
configureFixtureContext(name);
cleos([
  'push',
  'action',
  'daclifycore',
  'init',
  JSON.stringify([info.chain_id]),
  '-p',
  'daclifycore@active',
]);
for (const [account, artifact] of [
  ['daclifyhub', 'hub'],
  ['eosio.token', 'testtoken'],
]) {
  if (!account || !artifact) throw new Error('Invalid fixture');
  cleos([
    'set',
    'contract',
    account,
    '/work/.artifacts/contracts',
    `${artifact}.wasm`,
    `${artifact}.abi`,
    '-p',
    `${account}@active`,
  ]);
}
cleos([
  'push',
  'action',
  'eosio.token',
  'create',
  JSON.stringify(['alice', '1000000.0000 TLOS']),
  '-p',
  'eosio.token@active',
]);
cleos([
  'push',
  'action',
  'eosio.token',
  'issue',
  JSON.stringify(['alice', '1000.0000 TLOS', 'Local test fixture']),
  '-p',
  'alice@active',
]);
writeFileSync(
  '.artifacts/native/network.json',
  JSON.stringify({ url, chainId: info.chain_id, container: name }, null, 2),
);
console.log('Local native runtime ready; core artifact deployed only to the isolated test chain.');
