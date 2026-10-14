// Existing testnet accounts only. Keep module code and its accepted pins atomic.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  ABI,
  APIClient,
  Action,
  CompressionType,
  Name,
  PackedTransaction,
  PrivateKey,
  PublicKey,
  Serializer,
  SignedTransaction,
  Transaction,
  type ABISerializable,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import {
  NamesCodeHash,
  RuntimeCodeHash,
  RuntimeRawAbiHash,
  RuntimeTableSchemas,
} from '../../sdk/index.js';
import { parseEnvFile } from '../../services/api/src/env-file.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
import { encodeContractAbi, encodeSystem } from './actions.js';
import { deploymentContextPermissionPlan, contextLinkRepairActions } from './permissions.js';
import { loadEnvironment } from './environment.js';
import { relayActionLinks } from '../../sdk/service-accounts.js';
import { DecideTableSchemas } from '@daclify/modules/sdk';
import { reviewLegacyBallots, completionActions } from './module-completion-review.js';
import { SYSTEM_ABI } from '../../sdk/system-abi.js';

const root = '/data/daclify-upgrades/testnet';
const moduleCompletion = process.argv.includes('--module-completion');
const chainId = '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f';
const api = new APIClient({ url: 'https://testnet.telos.net' });
const snapshot = readFileSync(path.join(root, 'current-snapshot.txt'), 'utf8').trim();
assert.ok(snapshot.startsWith(root + '/snapshot-'), 'TESTNET_SNAPSHOT_PATH');
assert.equal(statSync(snapshot).mode & 0o077, 0, 'PRIVATE_SNAPSHOT_REQUIRED');
const keyFile = '/data/daclify-env/deploy.testnet.env';
assert.equal(statSync(keyFile).mode & 0o077, 0, 'PRIVATE_DEPLOY_KEY_REQUIRED');
const key = PrivateKey.from(
  z
    .string()
    .min(1)
    .parse(parseEnvFile(readFileSync(keyFile, 'utf8')).DEPLOYER_PRIVATE_KEY),
);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const TableSchema = z.object({
  scope: z.string(),
  table: z.string(),
  rows: z.array(z.string().regex(/^(?:[0-9a-f]{2})*$/)),
});
const SummarySchema = z.object({
  chainId: z.literal(chainId),
  accounts: z.array(
    z.object({
      account: z.string(),
      codeHash: z.string().length(64),
      rawAbiHash: z.string().length(64),
    }),
  ),
});
const summary = SummarySchema.parse(
  JSON.parse(readFileSync(path.join(snapshot, 'snapshot.json'), 'utf8')),
);
const definitions = [
  ['daclifycore1', 'runtime', '.artifacts/contracts', RuntimeCodeHash],
  [
    'daclifyhubv1',
    'hub',
    '.artifacts/contracts',
    moduleCompletion
      ? '81ffd1545d365d94068bacc2665915abb1c9c74e8880b4a5d5d410d194883bc6'
      : '5f05cac05cd0bc3ea057402df7aef3e0c3fb3f9373094d1ad47605b377ab6bee',
  ],
  [
    'daclifydecid',
    'decide',
    '../daclify-backend-modules/.artifacts/contracts',
    ModuleCodeHashes.decide,
  ],
  [
    'daclifyworks',
    'works',
    '../daclify-backend-modules/.artifacts/contracts',
    ModuleCodeHashes.works,
  ],
  [
    'daclifypayr1',
    'payroll',
    '../daclify-backend-modules/.artifacts/contracts',
    ModuleCodeHashes.payroll,
  ],
  [
    'daclifygrant',
    'grants',
    '../daclify-backend-modules/.artifacts/contracts',
    ModuleCodeHashes['grants-rounds'],
  ],
  [
    'daclifyendor',
    'endorse',
    '../daclify-backend-modules/.artifacts/contracts',
    ModuleCodeHashes['endorsement-admission'],
  ],
  ...(moduleCompletion
    ? [
        [
          'daclifyactiv',
          'activity',
          '../daclify-backend-modules/.artifacts/contracts',
          ModuleCodeHashes.activity,
        ] as const,
      ]
    : []),
  ['daclifynames', 'names', '.artifacts/contracts', NamesCodeHash],
] as const;
const targets = definitions.map(([account, contract, directory, codeHash]) => {
  const prior = summary.accounts.find((item) => item.account === account);
  assert.ok(prior, 'SNAPSHOT_ACCOUNT_MISSING');
  const oldWasm = readFileSync(path.join(snapshot, account, 'contract.wasm'));
  const oldAbi = readFileSync(path.join(snapshot, account, 'contract.abi.bin'));
  assert.equal(hash(oldWasm), prior.codeHash, 'SNAPSHOT_CODE_CHANGED');
  assert.equal(hash(oldAbi), prior.rawAbiHash, 'SNAPSHOT_ABI_CHANGED');
  const wasm = readFileSync(path.join(directory, contract + '.wasm'));
  const abi = ABI.from(readFileSync(path.join(directory, contract + '.abi'), 'utf8'));
  const rawAbi = encodeContractAbi(JSON.stringify(abi));
  assert.equal(hash(wasm), codeHash, 'ARTIFACT_CODE_PIN');
  if (contract === 'runtime') assert.equal(hash(rawAbi), RuntimeRawAbiHash, 'ARTIFACT_ABI_PIN');
  const tables = z
    .array(TableSchema)
    .parse(JSON.parse(readFileSync(path.join(snapshot, account, 'tables.json'), 'utf8')));
  for (const table of tables) {
    const type = abi.tables.find((item) => item.name.toString() === table.table)?.type;
    assert.ok(type, 'EXISTING_TABLE_REMOVED');
    for (const row of table.rows) {
      const decoded: ABISerializable = Serializer.decode({ abi, type, data: row });
      assert.equal(
        Serializer.encode({ abi, type, object: decoded }).hexString,
        row,
        'EXISTING_ROW_LAYOUT_CHANGED',
      );
    }
  }
  return { account, contract, prior, wasm, abi, rawAbi, oldWasm, oldAbi, tables };
});
assert.equal(summary.accounts.length, targets.length, 'SNAPSHOT_ACCOUNT_SET');
const runtime = targets[0];
assert.ok(runtime, 'RUNTIME_REQUIRED');
type Target = (typeof targets)[number];
assert.ok(
  !runtime.tables.some((table) => ['ramobs', 'rammig', 'rammigsrc'].includes(table.table)),
  'REVIEWED_RAM_MIGRATION_REQUIRED',
);
assert.ok(
  targets
    .filter(
      (target) =>
        !['runtime', 'hub', 'names', ...(moduleCompletion ? ['decide', 'activity'] : [])].includes(
          target.contract,
        ),
    )
    .every((target) => target.tables.length === 0),
  'PENDING_MODULE_STATE_REQUIRES_REVIEW',
);
if (moduleCompletion) {
  assert.equal(
    runtime.prior.codeHash,
    '2b2755e64462a1e43a4b530e2f602f06479d8c3f85214feb8443d663a80fe3c3',
    'QUALIFIED_CORE_BASELINE',
  );
  const decide = targets.find((target) => target.contract === 'decide'),
    activity = targets.find((target) => target.contract === 'activity');
  assert.ok(decide && activity);
  assert.equal(
    decide.prior.codeHash,
    'be206e53fb5580c238e48536dc4dd9ff74ce0de61d2a9ec089512667823c7fe5',
    'QUALIFIED_DECIDE_BASELINE',
  );
  assert.equal(hash(activity.wasm), activity.prior.codeHash, 'ACTIVITY_STATE_REQUIRES_REVIEW');
  assert.ok(
    decide.tables.every((table) =>
      ['ballots', 'votes', 'voteids', 'pollends'].includes(table.table),
    ),
    'PENDING_MODULE_STATE_REQUIRES_REVIEW',
  );
  const proof = z
    .object({
      coreHash: z.literal(runtime.prior.codeHash),
      decideHash: z.literal(decide.prior.codeHash),
      upgradedCore: z.literal(RuntimeCodeHash),
      upgradedDecide: z.literal(ModuleCodeHashes.decide),
      preservedTables: z.number().min(6),
      preservedRows: z.number().positive(),
      permissionsUnchanged: z.literal(true),
      legacyVoteAfterUpgrade: z.literal(true),
    })
    .parse(
      JSON.parse(readFileSync('.artifacts/module-completion-native/legacy-upgrade.json', 'utf8')),
    );
  assert.ok(proof);
}
for (const repository of ['.', '../daclify-backend-modules'])
  assert.equal(
    execFileSync('git', ['diff', 'HEAD', '--', 'contracts', 'sdk/generated'], {
      cwd: repository,
      encoding: 'utf8',
    }),
    '',
    'CONTRACT_SOURCE_DIRTY',
  );

async function verifyTables(target: Target, expected = target.tables) {
  const scopes: string[] = [];
  let lower = '';
  for (let page = 0; page < 100; page++) {
    const response = await api.v1.chain.get_table_by_scope({
      code: target.account,
      lower_bound: lower,
      limit: 100,
    });
    for (const row of response.rows) {
      const scope = row.scope.toString(),
        table = row.table.toString();
      const primary = target.abi.tables.some((item) => item.name.toString() === table);
      if (!primary) {
        assert.ok(
          (BigInt(Name.from(table).value.toString()) & 15n) !== 0n,
          'UNKNOWN_PRIMARY_TABLE',
        );
        continue;
      }
      scopes.push(scope + '/' + table);
      const saved = expected.find((item) => item.scope === scope && item.table === table);
      assert.ok(saved, 'NEW_TABLE_STATE_REQUIRES_SNAPSHOT');
      let data = await api.v1.chain.get_table_rows({
        code: target.account,
        scope,
        table,
        json: false,
        limit: 100,
      });
      assert.ok(!data.more, 'TABLE_PAGINATION_REQUIRES_REVIEW');
      // Public RPC replicas can briefly return pre-upgrade rows after another confirms LIB.
      for (
        let retry = 0;
        retry < 10 && JSON.stringify(data.rows) !== JSON.stringify(saved.rows);
        retry++
      ) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        data = await api.v1.chain.get_table_rows({
          code: target.account,
          scope,
          table,
          json: false,
          limit: 100,
        });
        assert.ok(!data.more, 'TABLE_PAGINATION_REQUIRES_REVIEW');
      }
      assert.deepEqual(z.array(z.string()).parse(data.rows), saved.rows, 'CHAIN_ROWS_CHANGED');
    }
    if (!response.more) break;
    assert.notEqual(response.more, lower, 'SCOPE_PAGINATION_LOOP');
    lower = response.more;
    assert.ok(page < 99, 'SCOPE_PAGINATION_LIMIT');
  }
  assert.deepEqual(
    scopes.sort(),
    expected.map((table) => table.scope + '/' + table.table).sort(),
    'CHAIN_SCOPES_CHANGED',
  );
}
function hasKey(account: Awaited<ReturnType<typeof api.v1.chain.get_account>>, permission: string) {
  return account.permissions.some(
    (entry) =>
      entry.perm_name.toString() === permission &&
      entry.required_auth.keys.some(
        (item) =>
          PublicKey.from(item.key).equals(key.toPublic()) &&
          Number(item.weight) >= Number(entry.required_auth.threshold),
      ),
  );
}
async function execute() {
  const reviewedRuntime = targets[0];
  assert.ok(reviewedRuntime, 'RUNTIME_REQUIRED');
  const runtime = reviewedRuntime;
  const info = await api.v1.chain.get_info();
  assert.equal(info.chain_id.toString(), chainId, 'TESTNET_CHAIN_REQUIRED');
  const creator = await api.v1.chain.get_account('3boidanimus3');
  assert.ok(hasKey(creator, 'active'), 'TESTNET_CREATOR_KEY_REQUIRED');
  const actions: Action[] = [],
    runtimeActions: Action[] = [],
    ram: { account: string; bytes: number }[] = [];
  const originalPermissions = new Map<string, unknown>();
  for (const target of targets) {
    const targetActions = target === runtime ? runtimeActions : actions;
    const live = await api.v1.chain.get_raw_abi(target.account);
    assert.equal(live.code_hash.toString(), target.prior.codeHash, 'CHAIN_CODE_CHANGED');
    assert.equal(live.abi_hash.toString(), target.prior.rawAbiHash, 'CHAIN_ABI_CHANGED');
    await verifyTables(target);
    const account = await api.v1.chain.get_account(target.account);
    if (!moduleCompletion) assert.ok(hasKey(account, 'owner'), 'CONTRACT_OWNER_KEY_REQUIRED');
    originalPermissions.set(target.account, Serializer.objectify(account.permissions));
    const required =
      Number(account.ram_usage) +
      (target.wasm.length - target.oldWasm.length) * 10 +
      target.rawAbi.length -
      target.oldAbi.length;
    const extra = Math.max(
      0,
      Math.ceil((required + 65536 - Number(account.ram_quota)) / 4096) * 4096,
    );
    assert.ok(extra <= (moduleCompletion ? 1310720 : 1048576), 'RAM_PLAN_REQUIRES_REVIEW');
    if (extra) {
      ram.push({ account: target.account, bytes: extra });
      targetActions.push(
        Action.from({
          account: 'eosio',
          name: 'buyrambytes',
          authorization: [{ actor: '3boidanimus3', permission: 'active' }],
          data: encodeSystem('buyrambytes', {
            payer: '3boidanimus3',
            receiver: target.account,
            bytes: extra,
          }),
        }),
      );
    }
    if (hash(target.wasm) !== target.prior.codeHash)
      targetActions.push(
        Action.from({
          account: 'eosio',
          name: 'setcode',
          authorization: [{ actor: target.account, permission: 'owner' }],
          data: encodeSystem('setcode', {
            account: target.account,
            vmtype: 0,
            vmversion: 0,
            code: target.wasm,
          }),
        }),
      );
    if (hash(target.rawAbi) !== target.prior.rawAbiHash)
      targetActions.push(
        Action.from({
          account: 'eosio',
          name: 'setabi',
          authorization: [{ actor: target.account, permission: 'owner' }],
          data: encodeSystem('setabi', { account: target.account, abi: target.rawAbi }),
        }),
      );
  }
  const expectedTables = runtime.tables.map((table) => ({ ...table, rows: [...table.rows] }));
  const savedDaos = runtime.tables
    .filter((table) => table.table === 'daos')
    .flatMap((table) =>
      table.rows.map((row) =>
        RuntimeTableSchemas.daos.parse(
          Serializer.objectify(
            Serializer.decode({ abi: runtime.abi, type: 'dao_record', data: row }),
          ),
        ),
      ),
    );
  if (moduleCompletion) {
    const decide = targets.find((target) => target.contract === 'decide');
    assert.ok(decide);
    const ballots = decide.tables
      .filter((table) => table.table === 'ballots')
      .flatMap((table) =>
        table.rows.map((row) =>
          DecideTableSchemas.ballots.parse(
            Serializer.objectify(
              Serializer.decode({ abi: decide.abi, type: 'ballot_record', data: row }),
            ),
          ),
        ),
      );
    reviewLegacyBallots(ballots, savedDaos);
  }
  const daos = new Map(
    runtime.tables
      .filter((table) => table.table === 'daos')
      .flatMap((table) =>
        table.rows.map((row) => {
          const dao = RuntimeTableSchemas.daos.parse(
            Serializer.objectify(
              Serializer.decode({ abi: runtime.abi, type: 'dao_record', data: row }),
            ),
          );
          assert.equal(dao.owner, runtime.account, 'DAO_CONTROLLER_REQUIRES_REVIEW');
          if (!moduleCompletion)
            assert.equal(String(dao.active_ballots), '0', 'PENDING_VOTE_REQUIRES_REVIEW');
          return [String(dao.id), dao.owner] as const;
        }),
      ),
  );
  // Installed modules compare the catalogue pin, so update listings first.
  for (const table of expectedTables
    .filter((item) => ['catalogue', 'modules'].includes(item.table))
    .sort((left, right) => left.table.localeCompare(right.table))) {
    const type = runtime.abi.tables.find((entry) => entry.name.toString() === table.table)?.type;
    assert.ok(type, 'MODULE_TABLE_TYPE');
    for (let index = 0; index < table.rows.length; index++) {
      const row = table.rows[index];
      assert.ok(row, 'MODULE_ROW_REQUIRED');
      const data = Serializer.objectify(Serializer.decode({ abi: runtime.abi, type, data: row }));
      const saved =
        table.table === 'catalogue'
          ? RuntimeTableSchemas.catalogue.parse(data)
          : RuntimeTableSchemas.modules.parse(data);
      const target = targets.find((item) => item.account === saved.account);
      assert.ok(target, 'UNKNOWN_INSTALLED_MODULE');
      assert.equal(saved.code_hash, target.prior.codeHash, 'MODULE_PIN_CHANGED');
      const next =
        table.table === 'modules' && moduleCompletion
          ? {
              ...RuntimeTableSchemas.modules.parse(saved),
              actions: completionActions(
                target.contract,
                RuntimeTableSchemas.modules.parse(saved).actions,
              ),
              code_hash: hash(target.wasm),
            }
          : { ...saved, code_hash: hash(target.wasm) };
      if (table.table === 'catalogue') {
        const listing = RuntimeTableSchemas.catalogue.parse(next);
        assert.equal(listing.party, 0, 'THIRD_PARTY_MODULE_REQUIRES_REVIEW');
        actions.push(
          Action.from(
            {
              account: runtime.account,
              name: 'listmod',
              authorization: [{ actor: runtime.account, permission: 'owner' }],
              data: { ...listing, accepts_fee_rule: listing.complies },
            },
            runtime.abi,
          ),
        );
      } else {
        const daoId = Name.from(table.scope).value.toString();
        assert.ok(daos.has(daoId), 'MODULE_DAO_UNKNOWN');
        actions.push(
          Action.from(
            {
              account: runtime.account,
              name: 'setmodule',
              authorization: [{ actor: runtime.account, permission: 'active' }],
              data: { ...next, dao_id: daoId },
            },
            runtime.abi,
          ),
        );
      }
      table.rows[index] = Serializer.encode({ abi: runtime.abi, type, object: next }).hexString;
    }
  }
  // Spring bounds decompressed transactions too: publish runtime first, then modules/pins.
  const batches = [
    runtimeActions.filter((action) => action.name.toString() !== 'setabi'),
    runtimeActions.filter((action) => action.name.toString() === 'setabi'),
    ...targets
      .filter((target) => target !== runtime)
      .map((target) =>
        actions.filter((action) => {
          if (action.account.toString() === 'eosio') {
            const data = z
              .object({ account: z.string().optional(), receiver: z.string().optional() })
              .parse(
                Serializer.objectify(
                  Serializer.decode({
                    abi: ABI.from(SYSTEM_ABI),
                    type: action.name.toString(),
                    data: action.data,
                  }),
                ),
              );
            return (data.account ?? data.receiver) === target.account;
          }
          return (
            z.object({ account: z.string() }).parse(
              Serializer.objectify(
                Serializer.decode({
                  abi: runtime.abi,
                  type: action.name.toString(),
                  data: action.data,
                }),
              ),
            ).account === target.account
          );
        }),
      ),
  ].filter((batch) => batch.length);
  const linkActions: Action[] = [];
  let relay: string | undefined;
  const originalLinks = new Map<string, unknown>();
  if (moduleCompletion) {
    const environment = await loadEnvironment('testnet');
    const account = await api.v1.chain.get_account(runtime.account);
    linkActions.push(
      ...contextLinkRepairActions(deploymentContextPermissionPlan(environment), account),
    );
    const gov = RuntimeTableSchemas.nativegov.parse(
      Serializer.objectify(
        Serializer.decode({
          abi: runtime.abi,
          type: 'native_governance',
          data: runtime.tables.find((table) => table.table === 'nativegov')?.rows[0] ?? '',
        }),
      ),
    );
    assert.ok(
      gov.handed_over &&
        gov.ownership?.policy_version === 2 &&
        gov.ownership.creator === environment.creatorAccount,
      'NATIVE_OWNERSHIP_REVIEW_REQUIRED',
    );
    relay = environment.accounts[5]?.name;
    assert.ok(relay);
    const relayAccount = await api.v1.chain.get_account(relay);
    originalPermissions.set(relay, Serializer.objectify(relayAccount.permissions));
    const operator = relayAccount.permissions.find((p) => p.perm_name.toString() === 'operator');
    assert.ok(
      operator &&
        operator.required_auth.keys.length === 1 &&
        operator.required_auth.accounts.length === 0 &&
        operator.required_auth.waits.length === 0 &&
        Number(operator.required_auth.threshold) === 1 &&
        operator.required_auth.keys[0]?.key.equals(PublicKey.from(gov.service_key)),
      'RELAY_KEY_REVIEW_REQUIRED',
    );
    const treasury = environment.accounts[6]?.name;
    assert.ok(treasury);
    for (const link of relayActionLinks({
      runtime: runtime.account,
      relay,
      treasury,
      names: 'daclifynames',
      decide: 'daclifydecid',
      payroll: 'daclifypayr1',
      relayKey: gov.service_key,
    })) {
      assert.ok(
        relayAccount.permissions.every((p) => p.linked_actions !== undefined),
        'PERMISSION_LINKS_UNAVAILABLE',
      );
      const current = relayAccount.permissions.filter((p) =>
        p.linked_actions?.some(
          (row) => row.account.toString() === link.code && row.action?.toString() === link.type,
        ),
      );
      assert.ok(
        current.length === 0 ||
          (current.length === 1 && current[0]?.perm_name.toString() === 'operator'),
        'ACTION_LINK_REVIEW_REQUIRED',
      );
      if (!current.length)
        linkActions.push(
          Action.from({
            account: 'eosio',
            name: 'linkauth',
            authorization: [{ actor: relay, permission: 'owner' }],
            data: encodeSystem('linkauth', { account: relay, ...link, requirement: 'operator' }),
          }),
        );
    }
    for (const name of [runtime.account, relay])
      originalLinks.set(
        name,
        Serializer.objectify((await api.v1.chain.get_account(name)).permissions),
      );
    if (linkActions.length) batches.push(linkActions);
  }
  const planned = [];
  for (const batch of batches) planned.push(await simulate(batch));
  const costUnits = planned.reduce((total, item) => total + item.costUnits, 0n);
  assert.ok(costUnits <= 2000000n, 'TESTNET_RAM_COST_REQUIRES_REVIEW');
  const plan = {
    chainId,
    coreCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    moduleCommit: execFileSync('git', ['-C', '../daclify-backend-modules', 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    snapshot,
    ram,
    ramCostUnits: costUnits.toString(),
    transactions: planned.map((item) => ({
      simulation: item.result,
      packedBytes: item.packed.packed_trx.array.length,
      ramCostUnits: item.costUnits.toString(),
    })),
    targets: targets.map((target) => ({
      account: target.account,
      oldCodeHash: target.prior.codeHash,
      codeHash: hash(target.wasm),
      rawAbiHash: hash(target.rawAbi),
    })),
  };
  writeFileSync(path.join(snapshot, 'upgrade-plan.json'), JSON.stringify(plan, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(JSON.stringify(plan));
  assert.deepEqual(
    process.argv.slice(2).filter((arg) => arg !== '--send' && arg !== '--module-completion'),
    [],
    'USAGE: optional --module-completion and --send only',
  );
  if (!process.argv.includes('--send')) return;
  const submitted = [];
  const codePins = new Map(targets.map((target) => [target.account, target.prior.codeHash]));
  const abiPins = new Map(targets.map((target) => [target.account, target.prior.rawAbiHash]));
  const installedPins = new Set<string>();
  function stagedTables() {
    return runtime.tables.map((table) => {
      if (!['catalogue', 'modules'].includes(table.table)) return table;
      const type = runtime.abi.tables.find((entry) => entry.name.toString() === table.table)?.type;
      assert.ok(type);
      const next = expectedTables.find(
        (entry) => entry.scope === table.scope && entry.table === table.table,
      );
      assert.ok(next);
      return {
        ...table,
        rows: table.rows.map((row, index) => {
          const saved = z
            .object({ account: z.string() })
            .parse(Serializer.objectify(Serializer.decode({ abi: runtime.abi, type, data: row })));
          return installedPins.has(saved.account) ? (next.rows[index] ?? row) : row;
        }),
      };
    });
  }
  for (const [index, batch] of batches.entries()) {
    for (const target of targets) {
      await verifyTables(target, target === runtime ? stagedTables() : target.tables);
      const live = await api.v1.chain.get_raw_abi(target.account);
      assert.equal(live.code_hash.toString(), codePins.get(target.account), 'CHAIN_CODE_CHANGED');
      assert.equal(live.abi_hash.toString(), abiPins.get(target.account), 'CHAIN_ABI_CHANGED');
    }
    const candidate = await simulate(batch);
    assert.ok(
      candidate.costUnits <= (planned[index]?.costUnits ?? 0n) + 10000n,
      'RAM_QUOTE_CHANGED',
    );
    const receipt = executedChainResult(
      await api.v1.chain.push_transaction(candidate.packed),
      candidate.transaction.id.toString(),
    );
    submitted.push(receipt);
    writeFileSync(
      path.join(snapshot, `upgrade-receipt-${index}.json`),
      JSON.stringify(receipt, null, 2) + '\n',
      { mode: 0o600 },
    );
    console.log('Accepted testnet stage ' + (index + 1) + ': ' + receipt.transactionId);
    await waitForIrreversibleBlock(
      async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
      receipt.blockNum,
    );
    for (const action of batch) {
      if (
        action.account.toString() === 'eosio' &&
        ['setcode', 'setabi'].includes(action.name.toString())
      ) {
        const data = z.object({ account: z.string() }).parse(
          Serializer.objectify(
            Serializer.decode({
              abi: ABI.from(SYSTEM_ABI),
              type: action.name.toString(),
              data: action.data,
            }),
          ),
        );
        const target = targets.find((entry) => entry.account === data.account);
        assert.ok(target);
        (action.name.toString() === 'setcode' ? codePins : abiPins).set(
          target.account,
          hash(action.name.toString() === 'setcode' ? target.wasm : target.rawAbi),
        );
      } else if (
        action.account.toString() === runtime.account &&
        ['listmod', 'setmodule'].includes(action.name.toString())
      ) {
        const data = z.object({ account: z.string() }).parse(
          Serializer.objectify(
            Serializer.decode({
              abi: runtime.abi,
              type: action.name.toString(),
              data: action.data,
            }),
          ),
        );
        installedPins.add(data.account);
      }
    }
    for (const target of targets) {
      const live = await api.v1.chain.get_raw_abi(target.account);
      assert.equal(
        live.code_hash.toString(),
        codePins.get(target.account),
        'POST_UPGRADE_CODE_HASH',
      );
      assert.equal(live.abi_hash.toString(), abiPins.get(target.account), 'POST_UPGRADE_ABI_HASH');
      await verifyTables(target, target === runtime ? stagedTables() : target.tables);
      const current = await api.v1.chain.get_account(target.account);
      const expected = originalPermissions.get(target.account);
      if (batch === linkActions && originalLinks.has(target.account)) {
        const authority = z.array(
          z.object({ perm_name: z.unknown(), parent: z.unknown(), required_auth: z.unknown() }),
        );
        assert.deepEqual(
          authority.parse(Serializer.objectify(current.permissions)),
          authority.parse(expected),
          'AUTHORITY_CHANGED',
        );
      } else {
        assert.deepEqual(Serializer.objectify(current.permissions), expected, 'AUTHORITY_CHANGED');
      }
    }
    if (batch === linkActions && relay) {
      for (const account of [runtime.account, relay]) {
        const current = Serializer.objectify((await api.v1.chain.get_account(account)).permissions);
        const authority = z.array(
          z.object({ perm_name: z.unknown(), parent: z.unknown(), required_auth: z.unknown() }),
        );
        assert.deepEqual(
          authority.parse(current),
          authority.parse(originalPermissions.get(account)),
          'AUTHORITY_CHANGED',
        );
        const permissions = z.array(
          z.object({
            perm_name: z.string(),
            linked_actions: z.array(
              z.object({ account: z.string(), action: z.string().nullable().optional() }),
            ),
          }),
        );
        const tuples = (value: unknown) =>
          permissions
            .parse(value)
            .flatMap((p) =>
              p.linked_actions.map(
                (link) => `${p.perm_name}:${link.account}:${link.action ?? '*'}`,
              ),
            );
        const additions = linkActions.flatMap((action) => {
          const link = z
            .object({
              account: z.string(),
              code: z.string(),
              type: z.string(),
              requirement: z.string(),
            })
            .parse(
              Serializer.objectify(
                Serializer.decode({
                  abi: ABI.from(SYSTEM_ABI),
                  type: 'linkauth',
                  data: action.data,
                }),
              ),
            );
          return link.account === account ? [`${link.requirement}:${link.code}:${link.type}`] : [];
        });
        assert.deepEqual(
          tuples(current).sort(),
          [...tuples(originalPermissions.get(account)), ...additions].sort(),
          'ACTION_LINKS_CHANGED',
        );
      }
    }
  }
  writeFileSync(
    path.join(snapshot, 'upgrade-verified.json'),
    JSON.stringify(
      {
        transactions: submitted,
        irreversible: true,
        dataPreserved: true,
        authoritiesUnchanged: true,
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  console.log(
    `Irreversible; all ${targets.length} code/ABI pins, existing rows and authorities verified.`,
  );
}
async function simulate(actions: Action[]) {
  const info = await api.v1.chain.get_info();
  assert.equal(info.chain_id.toString(), chainId, 'TESTNET_CHAIN_REQUIRED');
  const transaction = Transaction.from({ ...info.getTransactionHeader(300), actions });
  const authorityOnly = Transaction.from({
    ...transaction,
    actions: actions.map((action) => Action.from({ ...action, data: new Uint8Array() })),
  });
  const required = z.object({ required_keys: z.array(z.string()).length(1) }).parse(
    await api.call({
      path: '/v1/chain/get_required_keys',
      params: { transaction: authorityOnly, available_keys: [key.toPublic().toString()] },
    }),
  );
  assert.ok(
    required.required_keys.every((candidate) => PublicKey.from(candidate).equals(key.toPublic())),
    'SIGNING_AUTHORITY_CHANGED',
  );
  assert.ok(
    Serializer.encode({ object: transaction }).array.length < 1048576,
    'TESTNET_DECOMPRESSED_TRANSACTION_SIZE',
  );
  const packed = PackedTransaction.fromSigned(
    SignedTransaction.from({
      ...transaction,
      signatures: [key.signDigest(transaction.signingDigest(chainId))],
    }),
    CompressionType.zlib,
  );
  assert.ok(packed.packed_trx.array.length < 590000, 'TESTNET_TRANSACTION_SIZE');
  const simulation = await api.v1.chain.compute_transaction(packed);
  writeFileSync(
    path.join(snapshot, `simulation-${transaction.id}-result.json`),
    JSON.stringify(simulation, null, 2),
    { mode: 0o600 },
  );
  const result = executedChainResult(simulation, transaction.id.toString());
  const receipt = z
    .object({
      processed: z.object({
        receipt: z.object({ cpu_usage_us: z.number(), net_usage_words: z.number() }),
        action_traces: z.array(
          z.object({
            receiver: z.string(),
            act: z.object({ account: z.string(), name: z.string(), data: z.unknown() }),
          }),
        ),
      }),
    })
    .parse(JSON.parse(JSON.stringify(simulation)));
  assert.ok(receipt.processed.receipt.net_usage_words * 8 <= 600000, 'TESTNET_NET_LIMIT');
  const tokenAbi = await api.v1.chain.get_abi('eosio.token');
  const abi = tokenAbi.abi;
  assert.ok(abi, 'TOKEN_ABI_REQUIRED');
  const costs = receipt.processed.action_traces
    .filter(
      (trace) =>
        trace.receiver === 'eosio.token' &&
        trace.act.account === 'eosio.token' &&
        trace.act.name === 'transfer',
    )
    .map((trace) =>
      z
        .object({
          from: z.enum(['3boidanimus3', 'eosio.ramfee']),
          to: z.enum(['eosio.ram', 'eosio.ramfee', 'eosio.rex']),
          quantity: z.string().regex(/^\d+\.\d{4} TLOS$/),
        })
        .refine(
          (transfer) =>
            transfer.from === '3boidanimus3'
              ? transfer.to !== 'eosio.rex'
              : transfer.to === 'eosio.rex',
          'UNEXPECTED_RAM_TRANSFER',
        )
        .parse(
          typeof trace.act.data === 'string'
            ? Serializer.objectify(
                Serializer.decode({ abi, type: 'transfer', data: trace.act.data }),
              )
            : trace.act.data,
        ),
    )
    .filter((transfer) => transfer.from === '3boidanimus3');
  assert.equal(
    costs.length,
    actions.filter((action) => action.name.toString() === 'buyrambytes').length * 2,
    'RAM_COST_PROOF_REQUIRED',
  );
  const costUnits = costs.reduce(
    (total, cost) => total + BigInt(cost.quantity.split(' ')[0]?.replace('.', '') ?? ''),
    0n,
  );
  assert.ok(costUnits <= 2000000n, 'TESTNET_RAM_COST_REQUIRES_REVIEW');
  return { transaction, packed, result, costUnits };
}
execute().catch((error: unknown) => {
  writeFileSync(
    path.join(snapshot, 'upgrade-error.log'),
    error instanceof Error ? (error.stack ?? error.message) : 'Unknown error',
    { mode: 0o600 },
  );
  const firstLine = error instanceof Error ? error.message.split('\n')[0] : undefined;
  const message = firstLine && /^[A-Z_]+$/.test(firstLine) ? firstLine : 'TESTNET_UPGRADE_FAILED';
  console.error(message);
  process.exitCode = 1;
});
