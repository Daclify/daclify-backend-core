import { writeFileSync } from 'node:fs';
import { ABI, Authority, Serializer } from '@wharfkit/antelope';
import { loadEnvironment } from './environment.js';
import { createRpcClient } from '../../services/api/src/rpc.js';
import {
  nativeOwnershipAccount,
  nativeOwnershipAuthorities,
  assertNativeOwnershipRuntime,
} from '../../sdk/executives.js';
import {
  relayActionLinks,
  serviceAccountPermissionActions,
  type ServiceAccountConfiguration,
} from '../../sdk/service-accounts.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { VERSION } from '../../protocol/base.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/generated/releases.js';

const output = process.argv[2];
const withRuntimeUpgrade = process.argv[3] === '--with-runtime-upgrade';
if (
  (process.argv.length !== 3 && !(process.argv.length === 4 && withRuntimeUpgrade)) ||
  !output?.endsWith('.json')
)
  throw new Error('Usage: npm run prepare:service-accounts -- <output.json>');
const env = await loadEnvironment('testnet');
const runtime = env.accounts[0],
  relay = env.accounts[5],
  treasury = env.accounts[6];
if (!runtime || !relay || !treasury) throw new Error('SERVICE_DEPLOYMENT_REQUIRED');
const client = createRpcClient(env.rpcUrl),
  info = await client.v1.chain.get_info();
if (info.chain_id.toString() !== env.chainId) throw new Error('CHAIN_ID_MISMATCH');
const rows = await client.v1.chain.get_table_rows({
  code: runtime.name,
  scope: runtime.name,
  table: 'nativegov',
  limit: 1,
});
const gov = RuntimeTableSchemas.nativegov.parse(rows.rows[0]);
if (
  rows.more ||
  !gov.handed_over ||
  gov.ownership?.policy_version !== 2 ||
  gov.ownership.creator !== env.creatorAccount
)
  throw new Error('NATIVE_OWNERSHIP_REVIEW_REQUIRED');
const runtimeRelease = await client.v1.chain.get_raw_abi(runtime.name);
const observedRuntimeHash = runtimeRelease.code_hash.toString();
if (withRuntimeUpgrade) {
  if (
    observedRuntimeHash !== '0943069c7a09dcde50ce36037671bd2487289d392dbe334bf08d4251952e0bad' ||
    runtimeRelease.abi_hash.toString() !== RuntimeRawAbiHash
  )
    throw new Error('RUNTIME_BASELINE_REVIEW_REQUIRED');
} else assertNativeOwnershipRuntime(runtimeRelease);
const account = async (name: string) =>
  nativeOwnershipAccount(
    await client.call({ path: '/v1/chain/get_account', params: { account_name: name } }),
  );
const [core, relayer, fees] = await Promise.all([
  account(runtime.name),
  account(relay.name),
  account(treasury.name),
]);
const expected = nativeOwnershipAuthorities(
  runtime.name,
  { contracts: gov.contracts, ...gov.ownership },
  gov.signers,
  gov.threshold,
)[0];
if (
  !expected ||
  ['owner', 'active'].some(
    (permission) =>
      !core.permissions
        .find((p) => p.perm_name.toString() === permission)
        ?.required_auth.equals(
          Authority.from(permission === 'owner' ? expected.owner : expected.active),
        ),
  )
)
  throw new Error('NATIVE_AUTHORITY_MISMATCH');
for (const service of [relayer, fees]) {
  const hash = await client.v1.chain.get_raw_abi(service.account_name);
  if (hash.code_hash.toString() !== '00'.repeat(32))
    throw new Error('SERVICE_ACCOUNT_CODE_REVIEW_REQUIRED');
  if (
    service.permissions.some(
      (p) =>
        ![
          'owner',
          'active',
          ...(service.account_name.toString() === relay.name ? ['operator'] : []),
        ].includes(p.perm_name.toString()),
    )
  )
    throw new Error('SERVICE_PERMISSION_REVIEW_REQUIRED');
}
const key = gov.service_key;
const operator = relayer.permissions.find((p) => p.perm_name.toString() === 'operator'),
  active = relayer.permissions.find((p) => p.perm_name.toString() === 'active');
const currentKey = (operator ?? active)?.required_auth;
if (
  !currentKey ||
  currentKey.threshold.toNumber() !== 1 ||
  currentKey.keys.length !== 1 ||
  currentKey.accounts.length ||
  currentKey.waits.length ||
  !currentKey.keys[0]?.key.equals(key)
)
  throw new Error('RELAY_KEY_REVIEW_REQUIRED');
const configuration: ServiceAccountConfiguration = {
  runtime: runtime.name,
  relay: relay.name,
  treasury: treasury.name,
  relayKey: key,
  ...(env.namesAccount ? { names: env.namesAccount.name } : {}),
  ...(env.accounts[2] ? { decide: env.accounts[2].name } : {}),
  ...(env.accounts[4] ? { payroll: env.accounts[4].name } : {}),
};
const links = relayActionLinks(configuration);
for (const service of [relayer, fees])
  for (const permission of service.permissions)
    for (const link of permission.linked_actions ?? []) {
      const isUpgrade =
        link.account.toString() === 'eosio' &&
        ['setcode', 'setabi'].includes(link.action?.toString() ?? '') &&
        permission.perm_name.toString() === 'owner';
      const isOperation =
        service.account_name.toString() === relay.name &&
        permission.perm_name.toString() === 'operator' &&
        links.some(
          (expected) =>
            expected.code === link.account.toString() && expected.type === link.action?.toString(),
        );
      if (!isUpgrade && !isOperation) throw new Error('SERVICE_LINK_REVIEW_REQUIRED');
    }
const scopes = new Map<string, string[]>();
for (const link of links) scopes.set(link.code, [...(scopes.get(link.code) ?? []), link.type]);
for (const [code, actions] of scopes) {
  const response = await client.v1.chain.get_abi(code);
  const abi = response.abi ? ABI.from(response.abi) : undefined;
  if (!abi || actions.some((action) => !abi.actions.some((row) => row.name.toString() === action)))
    throw new Error('SERVICE_TARGET_ABI_REVIEW_REQUIRED');
}
const actions = serviceAccountPermissionActions(configuration);
const result = {
  mode: 'unsigned, read-only preparation; no signing or broadcast',
  version: VERSION,
  chainId: env.chainId,
  checkedAt: new Date().toISOString(),
  observedBlock: info.head_block_num.toString(),
  runtimePrerequisite: {
    observedCodeHash: observedRuntimeHash,
    requiredCodeHash: RuntimeCodeHash,
    upgradeRequired: withRuntimeUpgrade,
  },
  governingDao: gov.dao_id,
  executives: gov.signers,
  threshold: gov.threshold,
  currentAccounts: [relayer, fees].map((row) => ({
    account: row.account_name.toString(),
    permissions: Serializer.objectify(row.permissions),
  })),
  proposed: {
    ownerAndActiveDelegate: `${runtime.name}@active`,
    relayOperator: { parent: 'active', publicKey: key, links },
    ownCodeGrants: [],
    requiredSigningPermissions: [`${relay.name}@owner`, `${treasury.name}@owner`],
  },
  runtimeConfigurationAfterApply: { RELAY_PERMISSION: 'operator' },
  actions: actions.map((action) => Serializer.objectify(action)),
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
console.log(
  JSON.stringify({
    output,
    unsigned: true,
    actionCount: actions.length,
    relayScopes: links.length,
    executives: gov.signers,
    threshold: gov.threshold,
  }),
);
