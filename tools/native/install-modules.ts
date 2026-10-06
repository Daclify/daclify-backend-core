import { activateFixtureFeatures } from './features.js';
import { configureFixtureContext } from './permissions.js';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Checksum256 } from '@wharfkit/antelope';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { unlockFixtureWallet } from './wallet.js';
import { z } from 'zod';
const network = z
  .object({
    container: z.enum([
      'daclify-v2-native',
      'daclify-dao-presets-native',
      'daclify-platform-native',
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
for (const name of ['decide', 'works', 'payroll'] as const) {
  const source = `../daclify-backend-modules/.artifacts/contracts/${name}`;
  if (Checksum256.hash(readFileSync(`${source}.wasm`)).toString() !== ModuleCodeHashes[name])
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
