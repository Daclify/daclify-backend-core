import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { ABI, Action, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { VERSION, parseUnits } from '../../protocol/base.js';
import { ramMarketCost, tlosAsset } from '../../protocol/resources.js';
import { HubDeploymentRowSchema } from '../../protocol/directory.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { encodeAction, RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/index.js';
import { createRpcClient } from '../../services/api/src/rpc.js';
import { readChainRows } from '../../services/api/src/market/read.js';
import {
  TELOS_RAM_SYSTEM_CODE,
  TELOS_RAM_SYSTEM_ABI,
} from '../../services/api/src/resources/native-quote.js';
import { encodeContractAbi, encodeSystem } from './actions.js';
import { loadEnvironment } from './environment.js';
import { activityInitializationBatches } from './member-activity.js';

const output = process.argv[2];
const withRam = process.argv[3] === '--with-ram';
if (process.argv.length !== (withRam ? 4 : 3) || !output?.endsWith('.json'))
  throw new Error('Usage: npm run prepare:unified-users -- <output.json> [--with-ram]');
const env = await loadEnvironment('testnet'),
  runtime = env.accounts[0]?.name,
  hub = env.accounts[1]?.name;
if (!runtime || !hub) throw new Error('DEPLOYMENT_REQUIRED');
const client = createRpcClient(env.rpcUrl);
const [info, live, resource] = await Promise.all([
  client.v1.chain.get_info(),
  client.v1.chain.get_raw_abi(runtime),
  client.v1.chain.get_account(runtime),
]);
if (info.chain_id.toString() !== env.chainId) throw new Error('CHAIN_ID_MISMATCH');
const priorCodeHash = 'a05da7ad1cf616db6af7129fa036ddbc4ae03423f81c87f5eae17d3c78878213';
const priorAbiHash = '50ab00d5e3e61a5e1fa4339a2edecaa005cd1edd7f28268aa87c7d8195fa4e63';
if (live.code_hash.toString() !== priorCodeHash || live.abi_hash.toString() !== priorAbiHash)
  throw new Error('RUNTIME_BASELINE_REVIEW_REQUIRED');
const wasm = readFileSync('.artifacts/contracts/runtime.wasm'),
  abi = readFileSync('.artifacts/contracts/runtime.abi', 'utf8');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
if (hash(wasm) !== RuntimeCodeHash || hash(encodeContractAbi(abi)) !== RuntimeRawAbiHash)
  throw new Error('RUNTIME_ARTIFACT_PIN');
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
  registration.chain_id !== env.chainId ||
  registration.code_hash !== priorCodeHash ||
  registration.abi_hash !== priorAbiHash
)
  throw new Error('HUB_REGISTRATION_REVIEW_REQUIRED');
const observer = await readChainRows({
  rpcUrl: env.rpcUrl,
  code: runtime,
  scope: runtime,
  table: 'ramobs',
  limit: 1,
});
if (observer.rows.length) throw new Error('RAM_OBSERVER_REBIND_REVIEW_REQUIRED');
const daos = await readChainRows({
  rpcUrl: env.rpcUrl,
  code: runtime,
  scope: runtime,
  table: 'daos',
  limit: 5000,
});
if (daos.status !== 'rows' || daos.next) throw new Error('ACTIVITY_DAO_LIMIT');
const actions: Action[] = [
  Action.from({
    account: 'eosio',
    name: 'setcode',
    authorization: [{ actor: runtime, permission: 'active' }],
    data: encodeSystem('setcode', { account: runtime, vmtype: 0, vmversion: 0, code: wasm }),
  }),
  Action.from({
    account: 'eosio',
    name: 'setabi',
    authorization: [{ actor: runtime, permission: 'active' }],
    data: encodeSystem('setabi', { account: runtime, abi: encodeContractAbi(abi) }),
  }),
  Action.from(
    {
      account: hub,
      name: 'regdeploy',
      authorization: [{ actor: runtime, permission: 'active' }],
      data: { ...registration, code_hash: RuntimeCodeHash, abi_hash: RuntimeRawAbiHash },
    },
    ABI.from(readFileSync('.artifacts/contracts/hub.abi', 'utf8')),
  ),
];
const communities = [];
let ramPurchase = null;
if (withRam) {
  const [system, systemAbi] = await Promise.all([
    client.v1.chain.get_raw_abi('eosio'),
    client.v1.chain.get_abi('eosio'),
  ]);
  if (
    !systemAbi.abi ||
    system.code_hash.toString() !== TELOS_RAM_SYSTEM_CODE ||
    system.abi_hash.toString() !== TELOS_RAM_SYSTEM_ABI
  )
    throw new Error('RAM_SYSTEM_REVIEW_REQUIRED');
  const market = await client.v1.chain.get_table_rows({
    code: 'eosio',
    scope: 'eosio',
    table: 'rammarket',
    limit: 2,
  });
  const rows = z
    .array(
      z.object({
        base: z.object({ balance: z.string().regex(/^[1-9][0-9]* RAM$/) }),
        quote: z.object({ balance: z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{4} TLOS$/) }),
      }),
    )
    .length(1)
    .parse(market.rows);
  const row = rows[0];
  if (market.more || !row) throw new Error('RAM_MARKET_REVIEW_REQUIRED');
  const cost = ramMarketCost(
    65536n,
    BigInt(row.base.balance.split(' ')[0] ?? ''),
    parseUnits(row.quote.balance.split(' ')[0] ?? '', 4),
  );
  if (cost > 40000n) throw new Error('RAM_COST_EXCEEDS_PROPOSED_CAP');
  ramPurchase = {
    payer: env.creatorAccount,
    receiver: runtime,
    bytes: 65536,
    estimatedCost: tlosAsset(cost),
    proposedSpendingCap: '4.0000 TLOS',
  };
  actions.unshift(
    Action.from(
      {
        account: 'eosio',
        name: 'buyram',
        authorization: [{ actor: env.creatorAccount, permission: 'active' }],
        data: {
          payer: env.creatorAccount,
          receiver: runtime,
          quant: tlosAsset(cost),
        },
      },
      systemAbi.abi,
    ),
  );
}
for (const value of daos.rows) {
  const dao = RuntimeTableSchemas.daos.parse(value);
  const members = await readChainRows({
    rpcUrl: env.rpcUrl,
    code: runtime,
    scope: dao.id,
    table: 'members',
    limit: 5000,
  });
  if (members.status !== 'rows' || members.next) throw new Error('ACTIVITY_MEMBER_LIMIT');
  const ids = members.rows.map((value) => RuntimeTableSchemas.members.parse(value).id);
  const batches = activityInitializationBatches(dao.id, ids);
  communities.push({ daoId: dao.id, members: ids.length, batches: batches.length });
  for (const batch of batches)
    actions.push(
      Action.from({
        account: runtime,
        name: 'initactivity',
        authorization: [{ actor: runtime, permission: 'active' }],
        data: encodeAction('initactivity', batch),
      }),
    );
}
writeFileSync(
  output,
  JSON.stringify(
    {
      mode: 'Unsigned read-only review; no signing, broadcast, asset transfer or service cutover',
      version: VERSION,
      chainId: env.chainId,
      checkedAt: new Date().toISOString(),
      headBlock: info.head_block_num,
      runtime: {
        account: runtime,
        priorCodeHash,
        priorAbiHash,
        proposedCodeHash: RuntimeCodeHash,
        proposedAbiHash: RuntimeRawAbiHash,
        wasmBytes: wasm.length,
        abiBytes: encodeContractAbi(abi).length,
        ramObserverRows: observer.rows.length,
      },
      resources: {
        ramQuota: resource.ram_quota.toString(),
        ramUsage: resource.ram_usage.toString(),
      },
      ramPurchase,
      communities,
      actions: actions.map((action) => Serializer.objectify(action)),
      requiredApprovals: [
        ...(withRam ? ['Spend up to 4 testnet TLOS for 64 KiB runtime RAM'] : []),
        'Runtime code/ABI and Hub registration update, bounded activity initialization',
        'Coordinated API/frontend and immutable Names-oracle runtime-pin cutover',
      ],
      limitations: [
        'Historical activity remains unrecorded; current public keys/native accounts are the only directory grouping evidence',
        'Resource simulation is not proof of signature authority or action minimum permissions',
        'Observed-RAM deployments require a separately reviewed observer pin/rebind plan',
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
    actions: actions.length,
    communities: communities.length,
    proposedCodeHash: RuntimeCodeHash,
    proposedAbiHash: RuntimeRawAbiHash,
  }),
);
