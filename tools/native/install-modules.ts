import { activateFixtureFeatures } from './features.js';
import { configureFixtureContext } from './permissions.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Checksum256, PrivateKey } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { unlockFixtureWallet } from './wallet.js';
import { z } from 'zod';
const network = z
  .object({
    container: z.enum([
      'daclify-v2-native',
      'daclify-dao-presets-native',
      'daclify-platform-native',
      'daclify-access-native',
      'daclify-research-native',
      'daclify-research-paid-native',
    ]),
    chainId: z.string(),
    url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const response = await fetch(`${network.url}/v1/chain/get_info`, { method: 'POST', body: '{}' });
const info = z.object({ chain_id: z.literal(network.chainId) }).parse(await response.json());
if (!info.chain_id) throw new Error('Local fixture chain mismatch');
function cleos(args: string[]) {
  try {
    execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--url',
        'http://127.0.0.1:8888',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('Local fixture deployment failed; inspect the disposable node.');
  }
}
unlockFixtureWallet(network.container);
await activateFixtureFeatures(network.container, network.url);
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
mkdirSync('.artifacts/modules-release', { recursive: true });
for (const [id, name] of [
  ['decide', 'decide'],
  ['works', 'works'],
  ['payroll', 'payroll'],
  ['grants-rounds', 'grants'],
  ['endorsement-admission', 'endorse'],
] as const) {
  const account = await fetch(`${network.url}/v1/chain/get_account`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: name }),
  });
  if (!account.ok) {
    const signer = PrivateKey.generate('K1'),
      accounts = z
        .record(z.string(), z.object({ privateKey: z.string(), publicKey: z.string() }))
        .parse(JSON.parse(readFileSync('.artifacts/native/accounts.json', 'utf8')));
    cleos(['wallet', 'import', '--private-key', signer.toString()]);
    cleos(['create', 'account', 'eosio', name, signer.toPublic().toString()]);
    accounts[name] = { privateKey: signer.toString(), publicKey: signer.toPublic().toString() };
    writeFileSync('.artifacts/native/accounts.json', JSON.stringify(accounts), { mode: 0o600 });
  }
  const source = `../daclify-backend-modules/.artifacts/contracts/${name}`;
  if (Checksum256.hash(readFileSync(`${source}.wasm`)).toString() !== ModuleCodeHashes[id])
    throw new Error('Module artifact differs from the public SDK build hash');
  for (const ext of ['wasm', 'abi'])
    copyFileSync(`${source}.${ext}`, `.artifacts/modules-release/${name}.${ext}`);
  cleos([
    'set',
    'contract',
    name,
    '/work/.artifacts/modules-release',
    `${name}.wasm`,
    `${name}.abi`,
    '-p',
    `${name}@active`,
  ]);
  cleos(['set', 'account', 'permission', name, 'active', '--add-code', '-p', `${name}@active`]);
}
configureFixtureContext(network.container);
console.log('Updated core and first-party modules only on the isolated local native fixture.');
