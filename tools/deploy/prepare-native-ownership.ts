import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ABI, Action, Serializer } from '@wharfkit/antelope';
import { createRpcClient } from '../../services/api/src/rpc.js';
import { deploymentAccounts, loadEnvironment } from './environment.js';
import {
  auditContextPermission,
  contextLinkRepairActions,
  deploymentContextPermissionPlan,
} from './permissions.js';
import {
  nativeOwnershipAccount,
  nativeOwnershipSetupActions,
  NativeOwnershipPolicyVersion,
  NativeServiceActions,
} from '../../sdk/executives.js';
import { RuntimeCodeHash, RuntimeRawAbiHash, RuntimeTableSchemas } from '../../sdk/index.js';
import { encodeSystem } from './actions.js';
import { VERSION } from '../../protocol/base.js';
const output = process.argv[2];
if (process.argv.length !== 3 || !output?.endsWith('.json'))
  throw new Error('Usage: npm run prepare:native-ownership -- <output.json>');
// Public profile and read-only RPC only. This command has no key loader or broadcaster.
const environment = await loadEnvironment('testnet'),
  definitions = deploymentAccounts(environment);
const runtime = definitions.find((account) => account.contract === 'runtime');
if (!runtime || environment.creatorAccount !== '3boidanimus3')
  throw new Error('NATIVE_CREATOR_REVIEW_REQUIRED');
const client = createRpcClient(environment.rpcUrl),
  info = await client.v1.chain.get_info();
if (info.chain_id.toString() !== environment.chainId) throw new Error('CHAIN_ID_MISMATCH');
const names = [...definitions.map((account) => account.name), environment.creatorAccount];
const accounts = await Promise.all(
  names.map(async (name) => {
    const account = nativeOwnershipAccount(
      await client.call({ path: '/v1/chain/get_account', params: { account_name: name } }),
    );
    if (account.account_name.toString() !== name) throw new Error('PERMISSION_ACCOUNT_MISMATCH');
    return account;
  }),
);
const releases = await Promise.all(
  definitions.map(async (definition) => ({
    account: definition.name,
    ...Serializer.objectify(await client.v1.chain.get_raw_abi(definition.name)),
  })),
);
const rows = async <K extends keyof typeof RuntimeTableSchemas>(table: K) => {
  const page = await client.v1.chain.get_table_rows({
    code: runtime.name,
    scope: runtime.name,
    table,
    limit: 2,
  });
  if (page.more) throw new Error('NATIVE_STATE_REVIEW_REQUIRED');
  return page.rows.map((row) => RuntimeTableSchemas[table].parse(row));
};
const [nativeRows, marketRows] = await Promise.all([rows('nativegov'), rows('mktcfg')]);
if (nativeRows.length) throw new Error('NATIVE_EXISTING_POLICY_REVIEW_REQUIRED');
const market = RuntimeTableSchemas.mktcfg.parse(marketRows[0]);
if (market.dao_id === '0') throw new Error('NATIVE_GOVERNING_DAO_REQUIRED');
const relay = definitions[5],
  relayAccount = accounts.find((account) => account.account_name.toString() === relay?.name);
const relayActive = relayAccount?.permissions.find(
  (permission) => permission.perm_name.toString() === 'active',
)?.required_auth;
if (
  !relayActive ||
  relayActive.threshold.toNumber() !== 1 ||
  relayActive.keys.length !== 1 ||
  relayActive.keys[0]?.weight.toNumber() !== 1 ||
  relayActive.accounts.length ||
  relayActive.waits.length
)
  throw new Error('NATIVE_SERVICE_KEY_REVIEW_REQUIRED');
const serviceKey = relayActive.keys[0].key.toString();
const managed = definitions.filter((account) => account.contract && account.contract !== 'runtime');
for (const account of managed) {
  const observed = await client.v1.chain.get_raw_abi(account.name);
  if (observed.code_hash.toString() === '00'.repeat(32))
    throw new Error('NATIVE_MANAGED_CODE_REQUIRED');
}
const setup = {
  dao_id: market.dao_id,
  contracts: managed.map((account) => account.name),
  creator: environment.creatorAccount,
  inline_code: managed.filter((account) => account.inlineCode).map((account) => account.name),
  service_key: serviceKey,
};
const runtimeAccount = accounts.find((account) => account.account_name.toString() === runtime.name);
if (!runtimeAccount) throw new Error('DEPLOY_RUNTIME');
const contextPlan = deploymentContextPermissionPlan(environment),
  context = auditContextPermission(contextPlan, runtimeAccount);
const repairs = contextLinkRepairActions(contextPlan, runtimeAccount);
const wasm = readFileSync('.artifacts/contracts/runtime.wasm'),
  abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
const wireAbi = Serializer.encode({ object: abi });
if (
  createHash('sha256').update(wasm).digest('hex') !== RuntimeCodeHash ||
  createHash('sha256').update(wireAbi.array).digest('hex') !== RuntimeRawAbiHash
)
  throw new Error('NATIVE_ARTIFACT_RELEASE_MISMATCH');
const authorization = [{ actor: runtime.name, permission: 'owner' }];
const upgrades = [
  Action.from({
    account: 'eosio',
    name: 'setcode',
    authorization,
    data: encodeSystem('setcode', { account: runtime.name, vmtype: 0, vmversion: 0, code: wasm }),
  }),
  Action.from({
    account: 'eosio',
    name: 'setabi',
    authorization,
    data: encodeSystem('setabi', { account: runtime.name, abi: wireAbi }),
  }),
];
const policies = await client.v1.chain.get_table_rows({
  code: runtime.name,
  scope: runtime.name,
  table: 'execpols',
  limit: 64,
});
if (policies.more) throw new Error('NATIVE_STATE_REVIEW_REQUIRED');
const policy = policies.rows
  .map((row) => RuntimeTableSchemas.execpols.parse(row))
  .find((row) => row.dao_id === market.dao_id);
const executives = await client.v1.chain.get_table_rows({
  code: runtime.name,
  scope: market.dao_id,
  table: 'executives',
  limit: 9,
});
if (executives.more) throw new Error('NATIVE_STATE_REVIEW_REQUIRED');
const offices = executives.rows.map((row) => RuntimeTableSchemas.executives.parse(row));
const observers = await client.v1.chain.get_table_rows({
  code: runtime.name,
  scope: runtime.name,
  table: 'ramobs',
  limit: 2,
});
const packet = {
  mode: 'read-only; development review artifact; unsigned; no broadcast',
  chainId: environment.chainId,
  rpcUrl: environment.rpcUrl,
  checkedAt: new Date().toISOString(),
  observedBlock: info.head_block_num.toString(),
  release: {
    version: VERSION,
    policyVersion: NativeOwnershipPolicyVersion,
    runtimeCodeHash: RuntimeCodeHash,
    runtimeRawAbiHash: RuntimeRawAbiHash,
    qualification: 'local development; production release qualification remains separate',
  },
  observedReleases: releases,
  before: accounts.map((account) => Serializer.objectify(account)),
  context,
  setup,
  serviceActions: NativeServiceActions,
  upgradePolicy: {
    runtimeAfterHandover: 'active',
    managedAfterHandover: 'owner',
    creatorOverride: 'owner',
  },
  governingDao: market.dao_id,
  currentExecutivePolicy: policy ?? null,
  currentExecutives: offices,
  excludedAccounts: definitions
    .filter((account) => !account.contract)
    .map((account) => ({
      account: account.name,
      reason: 'No deployed contract; separate settler/treasury role',
    })),
  handoverReady: false,
  unsignedHandover: null,
  unmetPreconditions: [
    'Review and qualify the new runtime release and this owner-authorized upgrade/setup bundle.',
    'Re-read chain, creator and every account authority before signing.',
    'Configure the API bootstrap signer to the packet service public key before handover; the API refuses a mismatched signer once service exists.',
    'Appoint eligible executive members and obtain each paired wallet consent.',
    'Re-read effective signers, configurable quorum and revision, then prepare nativeHandoverActions as a separate atomic owner transaction.',
    ...(observers.rows.length
      ? [
          'Existing RAM observer configuration requires a reviewed code-hash/source migration before operational cutover.',
        ]
      : []),
  ],
  unsignedUpgradeAndSetup: {
    chainId: environment.chainId,
    unsigned: true,
    actions: [...upgrades, ...repairs, ...nativeOwnershipSetupActions(runtime.name, setup)].map(
      (action) => Serializer.objectify(action),
    ),
  },
};
writeFileSync(output, JSON.stringify(packet, null, 2) + '\n', { flag: 'wx' });
console.log(
  `Prepared unsigned ownership review at ${output}; creator ${setup.creator}@active; ${managed.length} managed contracts; handover awaits a fresh paired roster.`,
);
