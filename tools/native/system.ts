// Owned loopback fixture only. Downloads public Telos code; never signs on a public chain.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ABI, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { HostedBytesSchema } from '../../protocol/storage.js';
import { readBoundedResponse } from '../../services/api/src/http.js';
import { fixtureNetwork } from './network.js';
import { fixtureKey } from './keys.js';
import { unlockFixtureWallet } from './wallet.js';
import { activateFixtureFeatures } from './features.js';

const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const source = 'https://testnet.telos.caleos.io';
const expectedCode = '48d74c3df9f5c9952c0f87ab6c01e1c6dfe621429f59932ecf609b5d81e668e4';
const expectedAbi = 'fccb1a515b98d2232a1227279666d9a3fcd41f67fafa0d75212cc0a282564361';
const response = await fetch(source + '/v1/chain/get_raw_code_and_abi', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ account_name: 'eosio' }),
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error('PUBLIC_SYSTEM_SOURCE_UNAVAILABLE');
const raw = z
  .object({ account_name: z.literal('eosio'), wasm: HostedBytesSchema, abi: HostedBytesSchema })
  .parse(
    JSON.parse(new TextDecoder().decode(await readBoundedResponse(response, 4 * 1024 * 1024))),
  );
const wasm = Buffer.from(raw.wasm, 'base64'),
  abi = Buffer.from(raw.abi, 'base64');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
if (
  hash(wasm) !== expectedCode ||
  hash(abi) !== expectedAbi ||
  wasm.subarray(0, 4).toString('hex') !== '0061736d'
)
  throw new Error('PUBLIC_SYSTEM_PIN_CHANGED');
mkdirSync('.artifacts/system', { recursive: true });
writeFileSync('.artifacts/system/eosio.system.wasm', wasm);
writeFileSync(
  '.artifacts/system/eosio.system.abi',
  JSON.stringify(Serializer.decode({ data: abi, type: ABI })),
);
writeFileSync(
  '.artifacts/system/provenance.json',
  JSON.stringify(
    {
      source,
      account: 'eosio',
      codeHash: expectedCode,
      rawAbiHash: expectedAbi,
      downloadedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
function cleos(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('OWNED_SYSTEM_SETUP_REJECTED');
  }
}
const info = z.object({ chain_id: z.string() }).parse(JSON.parse(cleos(['get', 'info'])));
if (info.chain_id !== network.chainId) throw new Error('OWNED_RESOURCE_CHAIN_CHANGED');
unlockFixtureWallet(network.container);
await activateFixtureFeatures(network.container, network.url, [
  'BLOCKCHAIN_PARAMETERS',
  'CONFIGURABLE_WASM_LIMITS2',
  'SAVANNA',
]);
for (const account of [
  'eosio.ram',
  'eosio.ramfee',
  'eosio.stake',
  'eosio.bpay',
  'eosio.vpay',
  'eosio.saving',
  'eosio.names',
  'eosio.rex',
  'eosio.tedp',
]) {
  let exists = true;
  try {
    cleos(['get', 'account', account]);
  } catch {
    exists = false;
  }
  if (!exists)
    cleos(['create', 'account', 'eosio', account, fixtureKey('alice').toPublic().toString()]);
}
cleos([
  'set',
  'contract',
  'eosio',
  '/work/.artifacts/system',
  'eosio.system.wasm',
  'eosio.system.abi',
  '-p',
  'eosio@active',
]);
const market = z
  .object({ rows: z.array(z.unknown()) })
  .parse(JSON.parse(cleos(['get', 'table', 'eosio', 'eosio', 'rammarket'])));
if (market.rows.length === 0)
  cleos(['push', 'action', 'eosio', 'init', '[0,"4,TLOS"]', '-p', 'eosio@active']);
console.log(
  'Pinned Telos system contract installed on the owned loopback fixture. Public chain unchanged.',
);
