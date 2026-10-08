// This configuration is only for the owned local resource/browser fixture.
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { RuntimeCodeHash } from '../../sdk/index.js';
import { APIClient } from '@wharfkit/antelope';
import { fixtureNetwork } from './network.js';
import { unlockFixtureWallet } from './wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const info = await new APIClient({ url: network.url }).v1.chain.get_info();
if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
unlockFixtureWallet(network.container);
const currentResponse = await fetch(network.url + '/v1/chain/get_code_hash', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ account_name: 'daclifycore' }),
});
if (!currentResponse.ok) throw new Error('FIXTURE_CODE_QUERY_FAILED');
const current = z.object({ code_hash: z.string() }).parse(await currentResponse.json());
if (current.code_hash !== RuntimeCodeHash) {
  try {
    const value: unknown = JSON.parse(
      execFileSync(
        'docker',
        [
          'exec',
          network.container,
          'cleos',
          '--wallet-url',
          'http://127.0.0.1:8900',
          'set',
          'contract',
          'daclifycore',
          '/work/.artifacts/contracts',
          'runtime.wasm',
          'runtime.abi',
          '-p',
          'daclifycore@active',
          '--force-unique',
          '-j',
        ],
        { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
      ),
    );
    executedChainResult(
      value,
      z.object({ transaction_id: z.string() }).parse(value).transaction_id,
    );
  } catch {
    throw new Error('RESOURCE_FIXTURE_DEPLOYMENT_REJECTED');
  }
}
for (const [name, data] of [
  ['setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', '']],
  ['sethosted', [10, 'relay']],
  ...Object.entries(ModuleCodeHashes).map(
    ([id, code]) =>
      [
        'listmod',
        [
          id === 'grants-rounds' ? 'grants' : id === 'endorsement-admission' ? 'endorse' : id,
          'alice',
          0,
          1,
          '0.0000 TLOS',
          code,
          id,
        ],
      ] as const,
  ),
] as const) {
  try {
    const value: unknown = JSON.parse(
      execFileSync(
        'docker',
        [
          'exec',
          network.container,
          'cleos',
          '--wallet-url',
          'http://127.0.0.1:8900',
          'push',
          'action',
          'daclifycore',
          name,
          JSON.stringify(data),
          '-p',
          'daclifycore@active',
          '--force-unique',
          '-j',
        ],
        { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
      ),
    );
    executedChainResult(
      value,
      z.object({ transaction_id: z.string() }).parse(value).transaction_id,
    );
  } catch {
    throw new Error('RESOURCE_FIXTURE_CONFIGURATION_REJECTED');
  }
}
process.stdout.write('Owned resource fixture configured for free shared creation.\n');
