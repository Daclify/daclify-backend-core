// Configure only the owned disposable platform fixture. Never a deployment tool.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { APIClient } from '@wharfkit/antelope';
import { z } from 'zod';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { fixtureKey } from './keys.js';
import { unlockFixtureWallet } from './wallet.js';
const network = z
  .object({
    container: z.enum([
      'daclify-platform-native',
      'daclify-access-native',
      'daclify-research-paid-native',
    ]),
    url: z.enum(['http://127.0.0.1:19988', 'http://127.0.0.1:20088', 'http://127.0.0.1:20288']),
    chainId: z.string(),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const api = new APIClient({ url: network.url });
const info = await api.v1.chain.get_info();
if (String(info.chain_id) !== network.chainId) throw new Error('Fixture chain mismatch');
unlockFixtureWallet(network.container);
function cleos(args: string[]) {
  try {
    execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('Owned platform fixture configuration rejected');
  }
}
function action(account: string, name: string, data: unknown[], actor = account) {
  cleos(['push', 'action', account, name, JSON.stringify(data), '-p', actor + '@active']);
}
let namesExist = true;
try {
  await api.v1.chain.get_account('names');
} catch {
  namesExist = false;
}
if (!namesExist) {
  const publicKey = fixtureKey('alice').toPublic().toString();
  cleos(['create', 'account', 'eosio', 'names', publicKey, publicKey]);
}
cleos([
  'set',
  'contract',
  'names',
  '/work/.artifacts/contracts',
  'names.wasm',
  'names.abi',
  '-p',
  'names@active',
]);
const configuration = await api.v1.chain.get_table_rows({
  code: 'names',
  scope: 'names',
  table: 'namescfg',
  json: true,
  limit: 1,
});
if (!configuration.rows.length)
  action('names', 'init', ['daclifycore', 'relay', 'eosio.token', '4,TLOS']);
action('daclifycore', 'setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', 'names']);
action('names', 'settier', [0, '0.0000 TLOS', 500, 30720, '1.0000 TLOS', '1.0000 TLOS']);
action('names', 'settier', [1, '10.0000 TLOS', 1000, 30720, '1.0000 TLOS', '1.0000 TLOS']);
for (const [id, title, summary] of [
  ['decide', 'Decide', 'Ballots and proposals for a DAO.'],
  ['works', 'Works', 'Proposals, milestones and review.'],
  ['payroll', 'Payroll', 'Funded payment schedules.'],
  ['grants', 'Grants rounds', 'Applications and DAO-approved milestone awards.'],
  ['endorse', 'Endorsement admission', 'Opt-in member endorsement admission.'],
] as const) {
  action('daclifycore', 'listmod', [
    id,
    'alice',
    0,
    1,
    '0.0000 TLOS',
    ModuleCodeHashes[
      id === 'grants' ? 'grants-rounds' : id === 'endorse' ? 'endorsement-admission' : id
    ],
    title,
  ]);
  action('daclifycore', 'setmodcopy', [id, summary, '']);
}
action('daclifycore', 'setcreate', [2000, 5000, 2000, 'relay']);
const head = String((await api.v1.chain.get_info()).head_block_time);
action('daclifycore', 'setcrrate', [10000, 4, Math.floor(new Date(head + 'Z').getTime() / 1000)]);
console.log(
  'Owned platform fixture configured with synthetic fees, $1/TLOS observation and name tiers. No DAO governance link was changed.',
);
