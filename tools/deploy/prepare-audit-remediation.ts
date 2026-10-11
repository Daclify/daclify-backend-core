import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { Action, Authority, ABI, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadEnvironment } from './environment.js';
import { encodeSystem, encodeContractAbi } from './actions.js';
import { createRpcClient } from '../../services/api/src/rpc.js';
import { readChainRows, classifyTelosName } from '../../services/api/src/market/read.js';
import { nativeOwnershipAccount } from '../../sdk/executives.js';
import { NamesCodeHash } from '../../sdk/names.js';
import { NamesTableSchemas } from '../../sdk/generated/names-schemas.js';
import { VERSION } from '../../protocol/base.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/generated/releases.js';
import { HubDeploymentRowSchema } from '../../protocol/directory.js';

const output = process.argv[2];
if (process.argv.length !== 3 || !output?.endsWith('.json'))
  throw new Error('Usage: npm run prepare:audit-remediation -- <output.json>');
const env = await loadEnvironment('testnet');
const names = env.namesAccount?.name,
  runtime = env.accounts[0]?.name;
if (!names || !runtime) throw new Error('NAMES_DEPLOYMENT_REQUIRED');
const servicesOutput = output.replace(/\.json$/, '-services.json');
execFileSync(
  process.execPath,
  [
    '--import',
    'tsx',
    'tools/deploy/prepare-service-accounts.ts',
    servicesOutput,
    '--with-runtime-upgrade',
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
const services = z
  .object({ chainId: z.literal(env.chainId), actions: z.array(z.unknown()) })
  .passthrough()
  .parse(JSON.parse(readFileSync(servicesOutput, 'utf8')));
const client = createRpcClient(env.rpcUrl);
const resources = await Promise.all(
  [runtime, names, env.accounts[5]?.name, env.accounts[6]?.name].map(async (name) => {
    if (!name) throw new Error('SERVICE_DEPLOYMENT_REQUIRED');
    const current = await client.v1.chain.get_account(name);
    return {
      account: name,
      ramQuota: current.ram_quota.toString(),
      ramUsage: current.ram_usage.toString(),
    };
  }),
);
const hub = env.accounts[1]?.name;
if (!hub) throw new Error('HUB_DEPLOYMENT_REQUIRED');
const hubRelease = await client.v1.chain.get_raw_abi(hub);
const hubAbi = ABI.from(readFileSync('.artifacts/contracts/hub.abi', 'utf8'));
if (
  createHash('sha256').update(readFileSync('.artifacts/contracts/hub.wasm')).digest('hex') !==
  hubRelease.code_hash.toString()
)
  throw new Error('HUB_RELEASE_REVIEW_REQUIRED');
const registrations = await readChainRows({
  rpcUrl: env.rpcUrl,
  code: hub,
  scope: hub,
  table: 'deployments',
  indexPosition: 2,
  keyType: 'name',
  lowerBound: runtime,
  upperBound: runtime,
  limit: 1,
});
const registration = HubDeploymentRowSchema.parse(registrations.rows[0]);
if (
  registration.runtime !== runtime ||
  registration.owner !== runtime ||
  registration.chain_id !== env.chainId
)
  throw new Error('HUB_REGISTRATION_REVIEW_REQUIRED');
const ramObserver = await readChainRows({
  rpcUrl: env.rpcUrl,
  code: runtime,
  scope: runtime,
  table: 'ramobs',
  limit: 1,
});
if (ramObserver.rows.length) throw new Error('RAM_OBSERVER_REBIND_REVIEW_REQUIRED');
const [live, account] = await Promise.all([
  client.v1.chain.get_raw_abi(names),
  client.call({ path: '/v1/chain/get_account', params: { account_name: names } }),
]);
const priorCodeHash = 'f23bbd7f9dd7643a3cfcbe06bf39545e01a522434502d0857e08611d16121902';
if (live.code_hash.toString() !== priorCodeHash) throw new Error('NAMES_BASELINE_REVIEW_REQUIRED');
const wasm = readFileSync('.artifacts/contracts/names.wasm'),
  abiText = readFileSync('.artifacts/contracts/names.abi', 'utf8');
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const runtimeWasm = readFileSync('.artifacts/contracts/runtime.wasm');
if (
  hash(runtimeWasm) !== RuntimeCodeHash ||
  hash(encodeContractAbi(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'))) !==
    RuntimeRawAbiHash
)
  throw new Error('RUNTIME_ARTIFACT_PIN');
if (hash(wasm) !== NamesCodeHash) throw new Error('NAMES_ARTIFACT_PIN');
if (hash(encodeContractAbi(abiText)) !== live.abi_hash.toString())
  throw new Error('NAMES_ABI_LAYOUT_CHANGED');
const permissions = nativeOwnershipAccount(account).permissions;
const governingOwner = Authority.from({
  threshold: 1,
  keys: [],
  waits: [],
  accounts: [{ permission: { actor: runtime, permission: 'active' }, weight: 1 }],
});
if (
  !permissions.find((p) => p.perm_name.toString() === 'owner')?.required_auth.equals(governingOwner)
)
  throw new Error('NAMES_OWNER_REVIEW_REQUIRED');
const tables = [];
for (const table of ABI.from(abiText).tables) {
  const rows: unknown[] = [];
  let cursor = '0';
  for (let page = 0; ; page++) {
    if (page >= 50) throw new Error('NAMES_SNAPSHOT_REVIEW_LIMIT');
    const response = await readChainRows({
      rpcUrl: env.rpcUrl,
      code: names,
      scope: names,
      table: table.name.toString(),
      limit: 100,
      paginate: true,
      lowerBound: cursor,
    });
    rows.push(...response.rows);
    if (!response.next) break;
    cursor = response.next;
  }
  tables.push({
    table: table.name.toString(),
    count: rows.length,
    sha256: hash(JSON.stringify(rows)),
    rows,
  });
}
const invalidBasicListings = (tables.find((t) => t.table === 'namelist')?.rows ?? [])
  .map((row) => NamesTableSchemas.namelist.parse(row))
  .filter((row) => classifyTelosName(row.account_name) === 'basic')
  .map((row) => ({ accountName: row.account_name, seller: row.seller, sold: row.sold }));
const setcode = Action.from({
  account: 'eosio',
  name: 'setcode',
  authorization: [{ actor: names, permission: 'owner' }],
  data: encodeSystem('setcode', { account: names, vmtype: 0, vmversion: 0, code: wasm }),
});
const runtimeSetcode = Action.from({
  account: 'eosio',
  name: 'setcode',
  authorization: [{ actor: runtime, permission: 'active' }],
  data: encodeSystem('setcode', { account: runtime, vmtype: 0, vmversion: 0, code: runtimeWasm }),
});
const feeBalance = await client.v1.chain.get_currency_balance(
  'eosio.token',
  env.accounts[6]?.name ?? '',
  'TLOS',
);
const registryRefresh = Action.from(
  {
    account: hub,
    name: 'regdeploy',
    authorization: [{ actor: runtime, permission: 'active' }],
    data: { ...registration, code_hash: RuntimeCodeHash, abi_hash: RuntimeRawAbiHash },
  },
  hubAbi,
);
writeFileSync(
  output,
  JSON.stringify(
    {
      mode: 'unsigned, read-only; no signing, broadcast, asset transfer or runtime cutover',
      version: VERSION,
      chainId: env.chainId,
      checkedAt: new Date().toISOString(),
      resources,
      names: {
        account: names,
        priorCodeHash,
        proposedCodeHash: NamesCodeHash,
        unchangedAbiHash: live.abi_hash.toString(),
        permissions: Serializer.objectify(permissions),
        invalidBasicListings,
        tables,
      },
      feeBalance: feeBalance.map(String),
      services,
      hubRegistration: {
        before: registration,
        proposedCodeHash: RuntimeCodeHash,
        proposedAbiHash: RuntimeRawAbiHash,
      },
      runtime: {
        account: runtime,
        priorCodeHash: '0943069c7a09dcde50ce36037671bd2487289d392dbe334bf08d4251952e0bad',
        proposedCodeHash: RuntimeCodeHash,
        unchangedAbiHash: RuntimeRawAbiHash,
        ramObserverRows: ramObserver.rows.length,
      },
      actions: [
        Serializer.objectify(runtimeSetcode),
        Serializer.objectify(setcode),
        Serializer.objectify(registryRefresh),
        ...services.actions,
      ],
      transactions: [
        {
          stage: 'Runtime guard upgrade',
          actions: [Serializer.objectify(runtimeSetcode)],
          confirmIrreversibleBeforeNext: true,
        },
        {
          stage: 'Names, Hub and service-authority cutover',
          actions: [
            Serializer.objectify(setcode),
            Serializer.objectify(registryRefresh),
            ...services.actions,
          ],
        },
      ],
      runtimeConfigurationAfterApply: {
        RELAY_PERMISSION: 'operator',
        SHARED_PROXY_IPS: '["192.168.5.1"]',
        TRUSTED_PROXY_IPS: '[]',
      },
      requiredApprovals: [
        'Runtime and Names code upgrades and Hub hash refresh',
        'Relay/Fees owner and active delegation',
        'Coordinated API/frontend cutover',
      ],
      limitations: [
        'The unchanged external proxy supplies no trustworthy visitor IP; anonymous requests share existing aggregate limits',
        'Shared proxy forwarding headers remain untrusted; authenticated account limits are unchanged',
      ],
    },
    null,
    2,
  ) + '\n',
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    output,
    unsigned: true,
    actionCount: 3 + services.actions.length,
    transactionCount: 2,
    namesCodeHash: NamesCodeHash,
    invalidBasicListings: invalidBasicListings.length,
    feeBalance: feeBalance.map(String),
  }),
);
