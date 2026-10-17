// Fixed testnet cohort; preserves keys/thresholds and never purchases RAM or migrates customer content.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  ABI,
  APIClient,
  Action,
  Name,
  PrivateKey,
  PublicKey,
  Serializer,
  Transaction,
  SignedTransaction,
  PackedTransaction,
  CompressionType,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { ModuleCodeHashes, DecideTableSchemas, readBallotMetadata } from '@daclify/modules/sdk';
import { QuickBallotTableSchemas } from '@daclify/modules/quick-ballots';
import {
  RuntimeCodeHash,
  RuntimeRawAbiHash,
  RuntimeTableSchemas,
  QuickAuthCodeHash,
  QuickAuthTableSchemas,
} from '../../sdk/index.js';
import { HubDeploymentRowSchema } from '../../protocol/directory.js';
import { parseEnvFile } from '../../services/api/src/env-file.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
import { encodeSystem, encodeContractAbi } from './actions.js';
import { reviewAppendOnlyAbi, reviewHistoricalRow } from './append-only-abi.js';
import { upgradePosition, assertNoAssetTransfer, contractRamGrowth } from './upgrade-journal.js';
import { NamesTableSchemas } from '../../sdk/generated/names-schemas.js';
import {
  permissionAuditAccount,
  contextPermissionPlan,
  auditContextPermission,
  contextLinkRepairActions,
  assertContextLinkUpgrade,
} from './permissions.js';
const mode = z.enum(['--prepare', '--apply', '--verify', '--rollback']).parse(process.argv[2]);
const directory = z
  .string()
  .regex(/^\/data\/daclify-upgrades\/testnet\/snapshot-private-content-[a-z0-9-]+$/)
  .parse(process.argv[3]);
assert.equal(process.argv.length, 4);
assert.equal(statSync(directory).mode & 0o077, 0, 'PRIVATE_SNAPSHOT_REQUIRED');
const chainId = '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
  runtime = 'daclifycore1';
const api = new APIClient({
  url: 'https://testnet.telos.net',
  fetch: (input, init) =>
    fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) }),
});
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const read = (file: string): unknown => JSON.parse(readFileSync(directory + '/' + file, 'utf8'));
const save = (file: string, value: unknown) =>
  writeFileSync(directory + '/' + file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const Table = z.object({
  scope: z.string(),
  table: z.string(),
  rows: z.array(z.string().regex(/^(?:[0-9a-f]{2})*$/)),
});
const Summary = z.object({
  chainId: z.literal(chainId),
  accounts: z.array(
    z.object({
      account: z.string(),
      codeHash: z.string().length(64),
      rawAbiHash: z.string().length(64),
    }),
  ),
});
const baseline = [
  [
    'daclifycore1',
    'runtime',
    'core',
    'afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d',
    RuntimeCodeHash,
  ],
  [
    'daclifyhubv1',
    'hub',
    'core',
    '81ffd1545d365d94068bacc2665915abb1c9c74e8880b4a5d5d410d194883bc6',
    '81ffd1545d365d94068bacc2665915abb1c9c74e8880b4a5d5d410d194883bc6',
  ],
  [
    'daclifydecid',
    'decide',
    'modules',
    '1dbbd528e111c750e1b33eeef21db2252243de134fede3dea02ebb4341f1b95c',
    ModuleCodeHashes.decide,
  ],
  [
    'daclifyworks',
    'works',
    'modules',
    'f280b45833356855b6744b91d1c8cadda93da5b62d04c1d3e301cc8d4212ee58',
    ModuleCodeHashes.works,
  ],
  [
    'daclifypayr1',
    'payroll',
    'modules',
    'c5b6aa9975709b6094c716df00b7a1c7134b1e9e9597c632090e54bbbb9184fc',
    ModuleCodeHashes.payroll,
  ],
  [
    'daclifygrant',
    'grants',
    'modules',
    '9045f1dc001da77247ace6a2bc639790b9704b8303a605dbb397e9285b259e4d',
    ModuleCodeHashes['grants-rounds'],
  ],
  [
    'daclifyendor',
    'endorse',
    'modules',
    'a45944ea48c13f9d94746641ca18c3709a48790f291532fb63495108cf829bfb',
    ModuleCodeHashes['endorsement-admission'],
  ],
  [
    'daclifyactiv',
    'activity',
    'modules',
    '3c7cac382ba8e9a64eb192ddda7b1c4a68eba52d485ac55fdf6036c1ef778ead',
    ModuleCodeHashes.activity,
  ],
  [
    'daclifynames',
    'names',
    'core',
    '29f3155cc67c86871aa862b0ae9168acfdbaadf899721d4f5ef9a7ccaff86a65',
    '29f3155cc67c86871aa862b0ae9168acfdbaadf899721d4f5ef9a7ccaff86a65',
  ],
  [
    'daclifyqauth',
    'quickauth',
    'core',
    'd2c7102b79cccb2ca020a071cf46c53da825f4ac86dde8b8264fab3a767db953',
    QuickAuthCodeHash,
  ],
  [
    'daclifyquick',
    'quickvote',
    'modules',
    '7bf54521e224f33389a573df970c26074cb96ac72fbe60ba3b8ee80f34798f59',
    ModuleCodeHashes['quick-ballots'],
  ],
] as const;
const summary = Summary.parse(read('snapshot.json'));
assert.deepEqual(
  summary.accounts.map((a) => a.account).sort(),
  baseline.map((a) => a[0]).sort(),
  'SNAPSHOT_COHORT',
);
const targets = baseline.map(([account, contract, repository, oldPin, pin]) => {
  const prior = summary.accounts.find((a) => a.account === account);
  assert.ok(prior);
  assert.equal(prior.codeHash, oldPin, 'UNQUALIFIED_BASELINE');
  const oldCode = readFileSync(directory + '/' + account + '/contract.wasm'),
    oldRaw = readFileSync(directory + '/' + account + '/contract.abi.bin');
  assert.equal(hash(oldCode), oldPin);
  assert.equal(hash(oldRaw), prior.rawAbiHash);
  const source =
    (repository === 'core' ? '.' : '../daclify-backend-modules') +
    '/.artifacts/contracts/' +
    contract;
  const code = readFileSync(source + '.wasm'),
    abi = ABI.from(readFileSync(source + '.abi', 'utf8')),
    raw = encodeContractAbi(JSON.stringify(abi));
  assert.equal(hash(code), pin, 'ARTIFACT_CODE_PIN');
  const savedAccount = z
    .object({
      permissions: z.unknown(),
      ram_usage: z.coerce.number().int().safe().nonnegative(),
      ram_quota: z.coerce.number().int().safe().nonnegative(),
    })
    .parse(read(account + '/account.json'));
  const ramGrowth = contractRamGrowth(code.length, oldCode.length, raw.length, oldRaw.length);
  assert.ok(
    savedAccount.ram_usage + ramGrowth + 65536 <= savedAccount.ram_quota,
    'RAM_SHORTFALL:' +
      account +
      ':' +
      (savedAccount.ram_usage + ramGrowth + 65536 - savedAccount.ram_quota),
  );
  const tables = z.array(Table).parse(read(account + '/tables.json'));
  const previousAbi = Serializer.decode({ type: ABI, data: oldRaw });
  reviewAppendOnlyAbi(previousAbi, abi);
  for (const table of tables)
    for (const row of table.rows) reviewHistoricalRow(previousAbi, abi, table.table, row);
  return {
    account,
    contract,
    pin,
    prior,
    oldCode,
    oldRaw,
    code,
    abi,
    raw,
    tables,
    originalAccount: permissionAuditAccount(read(account + '/account.json')),
    quota: savedAccount.ram_quota,
    ramGrowth,
  };
});
const foundRoot = targets.find((t) => t.account === runtime);
assert.ok(foundRoot);
const root = foundRoot;
assert.equal(hash(root.raw), RuntimeRawAbiHash);
type Target = (typeof targets)[number];
const decode = (target: Target, table: z.infer<typeof Table>, row: string): unknown => {
  const type = target.abi.tables.find((t) => String(t.name) === table.table)?.type;
  assert.ok(type);
  return Serializer.objectify(Serializer.decode({ abi: target.abi, type, data: row }));
};
const values = (target: Target, name: string) =>
  target.tables
    .filter((t) => t.table === name)
    .flatMap((t) => t.rows.map((r) => decode(target, t, r)));
assert.equal(
  RuntimeTableSchemas.rammigrate.parse(values(root, 'rammigrate')[0]).active,
  false,
  'RAM_MIGRATION_ACTIVE',
);
assert.equal(
  RuntimeTableSchemas.ramobs.parse(values(root, 'ramobs')[0]).runtime_hash,
  root.prior.codeHash,
);
const daos = z.array(RuntimeTableSchemas.daos).parse(values(root, 'daos'));
for (const dao of daos) {
  assert.equal(dao.owner, runtime, 'DAO_AUTHORITY_CHANGED');
  assert.equal(dao.reserved, '0', 'PENDING_OBLIGATIONS');
  assert.equal(dao.claims, '0', 'PENDING_CLAIMS');
}
const decide = targets.find((t) => t.contract === 'decide'),
  quick = targets.find((t) => t.contract === 'quickvote'),
  authority = targets.find((t) => t.contract === 'quickauth'),
  hub = targets.find((t) => t.contract === 'hub');
assert.ok(decide && quick && authority && hub);
const ballots = z.array(DecideTableSchemas.ballots).parse(values(decide, 'ballots'));
for (const ballot of ballots) {
  assert.ok([0, 1, 2].includes(ballot.status));
  if (ballot.status === 0) {
    assert.equal(ballot.kind, 0, 'NON_ORDINARY_BALLOT');
    const content = readBallotMetadata(ballot.metadata, ballot.choices);
    assert.ok(content && !content.privateContent, 'UNQUALIFIED_BALLOT_METADATA');
  }
}
for (const dao of daos)
  assert.equal(
    dao.active_ballots,
    ballots.filter((b) => b.dao_id === dao.id && b.status === 0).length,
    'ACTIVE_BALLOT_MISMATCH',
  );
assert.ok(
  z
    .array(DecideTableSchemas.ballotdefs)
    .parse(values(decide, 'ballotdefs'))
    .every((d) => d.version === 1),
  'UNQUALIFIED_DEFINITION',
);
for (const target of targets)
  for (const table of target.tables)
    if (['archives', 'archpos'].includes(table.table))
      assert.equal(table.rows.length, 0, 'LEGACY_ARCHIVE_REQUIRES_REVIEW');
    else if (
      ['votetargets', 'projects', 'entries', 'payterms', 'obligations'].includes(table.table)
    )
      assert.equal(table.rows.length, 0, 'FROZEN_OBLIGATIONS_REQUIRE_REVIEW');
const oldQuick = z.array(QuickBallotTableSchemas.qballots).parse(values(quick, 'qballots'));
assert.ok(
  oldQuick.every((b) => b.definition.protocol === 1),
  'UNQUALIFIED_QUICK_PROTOCOL',
);
const system = (name: 'setcode' | 'setabi', data: object, actor: string) =>
  Action.from({
    account: 'eosio',
    name,
    authorization: [{ actor, permission: 'owner' }],
    data: encodeSystem(name, data),
  });
const core = (name: string, data: object) =>
  Action.from(
    { account: runtime, name, authorization: [{ actor: runtime, permission: 'active' }], data },
    root.abi,
  );
type Patch = { account: string; scope: string; table: string; before: string; after: string };
type Stage = {
  label: string;
  forward: Action[];
  reverse: Action[];
  patches: Patch[];
  changes: { account: string; code: boolean; abi: boolean }[];
};
const stages: Stage[] = [];
function patch(
  stage: Stage,
  target: Target,
  table: z.infer<typeof Table>,
  row: string,
  next: object,
) {
  const type = target.abi.tables.find((t) => String(t.name) === table.table)?.type;
  assert.ok(type);
  stage.patches.push({
    account: target.account,
    scope: table.scope,
    table: table.table,
    before: row,
    after: Serializer.encode({ abi: target.abi, type, object: next }).hexString,
  });
}
function action(stage: Stage, name: string, before: object, after: object) {
  stage.forward.push(core(name, after));
  stage.reverse.push(core(name, before));
}
function stage(label: string): Stage {
  return { label, forward: [], reverse: [], patches: [], changes: [] };
}
function install(stage: Stage, target: Target, abi = true) {
  if (target.pin !== target.prior.codeHash) {
    stage.forward.push(
      system(
        'setcode',
        { account: target.account, vmtype: 0, vmversion: 0, code: target.code },
        target.account,
      ),
    );
    stage.reverse.push(
      system(
        'setcode',
        { account: target.account, vmtype: 0, vmversion: 0, code: target.oldCode },
        target.account,
      ),
    );
    stage.changes.push({ account: target.account, code: true, abi: false });
  }
  if (abi && hash(target.raw) !== target.prior.rawAbiHash) {
    stage.forward.push(
      system('setabi', { account: target.account, abi: target.raw }, target.account),
    );
    stage.reverse.push(
      system('setabi', { account: target.account, abi: target.oldRaw }, target.account),
    );
    stage.changes.push({ account: target.account, code: false, abi: true });
  }
}
const runtimeCode = stage('runtime-code');
install(runtimeCode, root, false);
action(
  runtimeCode,
  'rebindramobs',
  { expected_old_hash: RuntimeCodeHash, expected_new_hash: root.prior.codeHash },
  { expected_old_hash: root.prior.codeHash, expected_new_hash: RuntimeCodeHash },
);
for (const table of root.tables.filter((t) => t.table === 'ramobs'))
  for (const row of table.rows)
    patch(runtimeCode, root, table, row, {
      ...RuntimeTableSchemas.ramobs.parse(decode(root, table, row)),
      runtime_hash: RuntimeCodeHash,
    });
for (const table of root.tables.filter((t) => t.table === 'rampools'))
  for (const row of table.rows) {
    const saved = RuntimeTableSchemas.rampools.parse(decode(root, table, row));
    if (saved.payer !== runtime) continue;
    assert.equal(saved.quota_bytes, String(root.quota), 'RAM_POOL_QUOTA_CHANGED');
    const next = {
      ...saved,
      baseline_bytes: String(BigInt(saved.baseline_bytes) + BigInt(root.ramGrowth)),
      source_hash: RuntimeCodeHash,
    };
    const payload = (value: typeof saved) => ({
      payer: value.payer,
      expected_quota: String(root.quota),
      baseline_bytes: value.baseline_bytes,
      platform_headroom: value.platform_headroom,
    });
    action(runtimeCode, 'setrampool', payload(saved), payload(next));
    patch(runtimeCode, root, table, row, { ...next, quota_bytes: String(root.quota) });
  }
stages.push(runtimeCode);
const runtimeAbi = stage('runtime-abi');
runtimeAbi.forward.push(system('setabi', { account: runtime, abi: root.raw }, runtime));
runtimeAbi.reverse.push(system('setabi', { account: runtime, abi: root.oldRaw }, runtime));
runtimeAbi.changes.push({ account: runtime, code: false, abi: true });
stages.push(runtimeAbi);
function pins(stage: Stage, target: Target) {
  for (const table of root.tables
    .filter((t) =>
      ['ramsources', 'rampools', 'catalogue', 'modules', 'lifehashes'].includes(t.table),
    )
    .sort(
      (a, b) =>
        ['ramsources', 'rampools', 'catalogue', 'lifehashes', 'modules'].indexOf(a.table) -
        ['ramsources', 'rampools', 'catalogue', 'lifehashes', 'modules'].indexOf(b.table),
    )) {
    for (const row of table.rows) {
      const data = decode(root, table, row);
      if (table.table === 'ramsources') {
        const saved = RuntimeTableSchemas.ramsources.parse(data);
        if (saved.account !== target.account) continue;
        assert.equal(saved.code_hash, target.prior.codeHash);
        const next = { ...saved, code_hash: target.pin };
        action(stage, 'setramcode', saved, next);
        patch(stage, root, table, row, next);
      }
      if (table.table === 'rampools') {
        const saved = RuntimeTableSchemas.rampools.parse(data);
        if (saved.payer !== target.account) continue;
        assert.equal(saved.quota_bytes, String(target.quota), 'RAM_POOL_QUOTA_CHANGED');
        const next = {
          ...saved,
          baseline_bytes: String(BigInt(saved.baseline_bytes) + BigInt(target.ramGrowth)),
          source_hash: target.pin,
        };
        const payload = (value: typeof saved) => ({
          payer: value.payer,
          expected_quota: value.quota_bytes,
          baseline_bytes: value.baseline_bytes,
          platform_headroom: value.platform_headroom,
        });
        action(stage, 'setrampool', payload(saved), payload(next));
        patch(stage, root, table, row, next);
      }
      if (table.table === 'catalogue') {
        const saved = RuntimeTableSchemas.catalogue.parse(data);
        if (saved.account !== target.account) continue;
        assert.equal(saved.party, 0);
        assert.equal(saved.code_hash, target.prior.codeHash);
        const next = { ...saved, code_hash: target.pin };
        action(
          stage,
          'listmod',
          { ...saved, accepts_fee_rule: saved.complies },
          { ...next, accepts_fee_rule: saved.complies },
        );
        patch(stage, root, table, row, next);
      }
      if (table.table === 'modules') {
        const saved = RuntimeTableSchemas.modules.parse(data);
        if (saved.account !== target.account) continue;
        assert.equal(saved.code_hash, target.prior.codeHash);
        const daoId = String(Name.from(table.scope).value);
        assert.ok(daos.some((d) => d.id === daoId));
        const next = { ...saved, code_hash: target.pin };
        action(stage, 'setmodule', { ...saved, dao_id: daoId }, { ...next, dao_id: daoId });
        patch(stage, root, table, row, next);
      }
      if (table.table === 'lifehashes') {
        const saved = RuntimeTableSchemas.lifehashes.parse(data);
        if (saved.account !== target.account) continue;
        assert.equal(saved.code_hash, target.prior.codeHash);
        const next = { ...saved, code_hash: target.pin };
        action(stage, 'setlifecode', saved, next);
        patch(stage, root, table, row, next);
      }
    }
  }
}
for (const target of targets.filter(
  (t) => !['runtime', 'hub', 'names', 'quickauth', 'quickvote'].includes(t.contract),
)) {
  const next = stage(target.contract);
  install(next, target);
  pins(next, target);
  stages.push(next);
}
const quickStage = stage('quick-cohort');
install(quickStage, authority);
install(quickStage, quick);
pins(quickStage, authority);
pins(quickStage, quick);
for (const table of authority.tables.filter((t) => t.table === 'qcfg'))
  for (const row of table.rows) {
    const saved = QuickAuthTableSchemas.qcfg.parse(decode(authority, table, row));
    assert.equal(saved.source, quick.account);
    assert.equal(saved.code_hash, quick.prior.codeHash);
    const next = { ...saved, code_hash: quick.pin };
    const payload = (code_hash: string) => ({
      runtime,
      source: saved.source,
      code_hash,
      gateway: saved.gateway,
      maximum: saved.maximum,
    });
    for (const [list, pin] of [
      [quickStage.forward, quick.pin],
      [quickStage.reverse, quick.prior.codeHash],
    ] as const)
      list.push(
        Action.from(
          {
            account: authority.account,
            name: 'qconfig',
            authorization: [
              { actor: runtime, permission: 'active' },
              { actor: authority.account, permission: 'active' },
            ],
            data: payload(pin),
          },
          authority.abi,
        ),
      );
    patch(quickStage, authority, table, row, next);
  }
for (const table of quick.tables.filter((t) => t.table === 'qclock'))
  for (const row of table.rows) {
    const saved = QuickBallotTableSchemas.qclock.parse(decode(quick, table, row));
    assert.equal(saved.authority, authority.account);
    assert.equal(saved.authority_hash, authority.prior.codeHash);
    for (const [list, pin] of [
      [quickStage.forward, authority.pin],
      [quickStage.reverse, authority.prior.codeHash],
    ] as const)
      list.push(
        Action.from(
          {
            account: quick.account,
            name: 'init',
            authorization: [
              { actor: runtime, permission: 'active' },
              { actor: quick.account, permission: 'active' },
            ],
            data: { runtime, authority: authority.account, authority_hash: pin },
          },
          quick.abi,
        ),
      );
    patch(quickStage, quick, table, row, { ...saved, authority_hash: authority.pin });
  }
stages.push(quickStage);
const context = contextPermissionPlan(runtime, [
  { id: 'decide', account: 'daclifydecid' },
  { id: 'works', account: 'daclifyworks' },
  { id: 'payroll', account: 'daclifypayr1' },
  { id: 'grants-rounds', account: 'daclifygrant' },
  { id: 'endorsement-admission', account: 'daclifyendor' },
  { id: 'activity', account: 'daclifyactiv' },
  { id: 'quick-ballots', account: 'daclifyquick' },
]);
const missingContextLinks = auditContextPermission(context, root.originalAccount).missingLinks;
const reviewedContextLinks = new Set([
  runtime + '/recovergrant',
  runtime + '/ackrecgrant',
  runtime + '/setcontacts',
  runtime + '/cancelrec',
  runtime + '/setrecpolicy',
  runtime + '/putrecpack',
  runtime + '/setagentdesc',
  'daclifypayr1/commitpriv',
  'daclifypayr1/editpriv',
]);
assert.ok(
  missingContextLinks.every((link) => reviewedContextLinks.has(link.account + '/' + link.action)),
  'UNREVIEWED_CONTEXT_LINK',
);
const contextStage = stage('context-links');
contextStage.forward.push(...contextLinkRepairActions(context, root.originalAccount));
for (const link of missingContextLinks)
  contextStage.reverse.push(
    Action.from({
      account: 'eosio',
      name: 'unlinkauth',
      authorization: [{ actor: runtime, permission: 'owner' }],
      data: encodeSystem('unlinkauth', { account: runtime, code: link.account, type: link.action }),
    }),
  );
if (contextStage.forward.length) stages.push(contextStage);
const directoryStage = stage('directory');
for (const table of hub.tables.filter((t) => t.table === 'deployments'))
  for (const row of table.rows) {
    const saved = HubDeploymentRowSchema.parse(decode(hub, table, row));
    if (saved.runtime !== runtime) continue;
    assert.equal(saved.code_hash, root.prior.codeHash);
    assert.equal(saved.abi_hash, root.prior.rawAbiHash);
    const next = { ...saved, code_hash: RuntimeCodeHash, abi_hash: RuntimeRawAbiHash };
    for (const [list, data] of [
      [directoryStage.forward, next],
      [directoryStage.reverse, saved],
    ] as const)
      list.push(
        Action.from(
          {
            account: hub.account,
            name: 'regdeploy',
            authorization: [{ actor: runtime, permission: 'active' }],
            data,
          },
          hub.abi,
        ),
      );
    patch(directoryStage, hub, table, row, next);
  }
stages.push(directoryStage);
for (const repository of ['.', '../daclify-backend-modules'])
  assert.equal(
    execFileSync('git', ['diff', 'HEAD', '--', 'contracts', 'sdk/generated'], {
      cwd: repository,
      encoding: 'utf8',
    }),
    '',
    'UNCOMMITTED_CONTRACT_SOURCE',
  );
const keyFile = '/data/daclify-env/deploy.testnet.env';
assert.equal(statSync(keyFile).mode & 0o077, 0);
const key = PrivateKey.from(
  z
    .string()
    .min(1)
    .parse(parseEnvFile(readFileSync(keyFile, 'utf8')).DEPLOYER_PRIVATE_KEY),
);
async function packet(actions: Action[]) {
  const info = await api.v1.chain.get_info();
  assert.equal(String(info.chain_id), chainId);
  const transaction = Transaction.from({ ...info.getTransactionHeader(300), actions });
  assert.ok(
    Serializer.encode({ object: transaction }).array.length < 1048576,
    'DECOMPRESSED_LIMIT',
  );
  const required = z.object({ required_keys: z.array(z.string()).length(1) }).parse(
    await api.call({
      path: '/v1/chain/get_required_keys',
      params: {
        transaction: Transaction.from({
          ...transaction,
          actions: actions.map((a) => Action.from({ ...a, data: new Uint8Array() })),
        }),
        available_keys: [String(key.toPublic())],
      },
    }),
  );
  assert.ok(
    required.required_keys.every((k) => PublicKey.from(k).equals(key.toPublic())),
    'AUTHORITY_UNAVAILABLE',
  );
  const packed = PackedTransaction.fromSigned(
    SignedTransaction.from({
      ...transaction,
      signatures: [key.signDigest(transaction.signingDigest(chainId))],
    }),
    CompressionType.zlib,
  );
  assert.ok(packed.packed_trx.array.length < 590000, 'PACKED_LIMIT');
  return { transaction, packed };
}
async function verify(completed: number) {
  for (const target of targets) {
    const raw = await api.v1.chain.get_raw_abi(target.account);
    const updates = stages
      .slice(0, completed)
      .flatMap((s) => s.changes)
      .filter((c) => c.account === target.account);
    assert.equal(
      String(raw.code_hash),
      updates.some((c) => c.code) ? target.pin : target.prior.codeHash,
      'CHAIN_CODE_CHANGED',
    );
    assert.equal(
      String(raw.abi_hash),
      updates.some((c) => c.abi) ? hash(target.raw) : target.prior.rawAbiHash,
      'CHAIN_ABI_CHANGED',
    );
    const scopes: string[] = [];
    let lower = '';
    for (let page = 0; page < 100; page++) {
      const response = await api.v1.chain.get_table_by_scope({
        code: target.account,
        lower_bound: lower,
        limit: 100,
      });
      for (const item of response.rows) {
        const table = String(item.table);
        if (!target.abi.tables.some((t) => String(t.name) === table)) {
          assert.notEqual(
            BigInt(String(Name.from(table).value)) & 15n,
            0n,
            'UNKNOWN_PRIMARY_TABLE',
          );
          continue;
        }
        scopes.push(String(item.scope) + '/' + table);
      }
      if (!response.more) break;
      assert.ok(page < 99 && response.more !== lower, 'SCOPE_PAGE_LIMIT');
      lower = response.more;
    }
    assert.deepEqual(
      scopes.sort(),
      target.tables.map((t) => t.scope + '/' + t.table).sort(),
      'SCOPES_CHANGED',
    );
    const account = permissionAuditAccount(
      await api.call({ path: '/v1/chain/get_account', params: { account_name: target.account } }),
    );
    assertContextLinkUpgrade(
      target.originalAccount,
      account,
      target === root && stages.slice(0, completed).some((s) => s.label === 'context-links')
        ? missingContextLinks
        : [],
    );
    for (let offset = 0; offset < target.tables.length; offset += 10) {
      await Promise.all(
        target.tables.slice(offset, offset + 10).map(async (table) => {
          const result = await api.v1.chain.get_table_rows({
            code: target.account,
            scope: table.scope,
            table: table.table,
            json: false,
            limit: 100,
          });
          assert.equal(result.more, false);
          const patches = stages
            .slice(0, completed)
            .flatMap((s) => s.patches)
            .filter(
              (p) =>
                p.account === target.account && p.scope === table.scope && p.table === table.table,
            );
          const wanted = table.rows.map((r) => patches.find((p) => p.before === r)?.after ?? r);
          const current = z.array(z.string()).parse(result.rows);
          if (target.contract === 'names' && table.table === 'policy') {
            assert.equal(current.length, wanted.length);
            for (const [index, row] of current.entries()) {
              const old = wanted[index];
              assert.ok(old);
              const before = NamesTableSchemas.policy.parse(decode(target, table, old));
              const after = NamesTableSchemas.policy.parse(decode(target, table, row));
              assert.equal(after.bump_bps, before.bump_bps);
              assert.equal(after.quote_premium_bps, before.quote_premium_bps);
              assert.equal(after.quoted_precision, before.quoted_precision);
              assert.ok(
                BigInt(after.median) > 0n &&
                  after.observed_at >= before.observed_at &&
                  after.observed_at <= Math.floor(Date.now() / 1000) + 300,
                'ORACLE_OBSERVATION_INVALID',
              );
            }
          } else
            assert.ok(
              JSON.stringify(current) === JSON.stringify(wanted),
              'ROWS_CHANGED:' + target.account + '/' + table.scope + '/' + table.table,
            );
        }),
      );
    }
  }
}
if (mode === '--prepare') {
  await verify(0);
  for (const stage of stages) {
    await packet(stage.forward);
    await packet(stage.reverse);
  }
  const first = await packet(stages[0]?.forward ?? []);
  const simulation = await api.v1.chain.compute_transaction(first.packed);
  executedChainResult(simulation, String(first.transaction.id));
  assertNoAssetTransfer(simulation);
  save('privacy-runtime-simulation.json', simulation);
  for (const stage of stages.slice(1)) {
    // Each compute call rolls back. Directory admission additionally needs the candidate runtime.
    const actions =
      stage.label === 'directory'
        ? [...runtimeCode.forward, ...stage.forward]
        : stage.label === 'context-links'
          ? stage.forward // Native authorization checks unlinkauth before linkauth can execute.
          : [...stage.forward, ...stage.reverse];
    const candidate = await packet(actions);
    const result = await api.v1.chain.compute_transaction(candidate.packed);
    executedChainResult(result, String(candidate.transaction.id));
    assertNoAssetTransfer(result);
    save('privacy-' + stage.label + '-rehearsal.json', result);
  }
  save('privacy-plan.json', {
    chainId,
    coreCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    modulesCommit: execFileSync('git', ['-C', '../daclify-backend-modules', 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    openOrdinaryBallots: ballots.filter((b) => b.status === 0).length,
    legacyQuickBallots: oldQuick.length,
    keyOrThresholdChanges: false,
    actionLinksAdded: missingContextLinks,
    assetMovement: false,
    customerContentMigration: false,
    stages: stages.map((s) => ({
      label: s.label,
      forward: s.forward.map((a) => Serializer.objectify(a)),
      reverse: s.reverse.map((a) => Serializer.objectify(a)),
      patches: s.patches,
      changes: s.changes,
    })),
  });
  console.log(
    'Prepared source-bound forward/rollback plan; runtime simulation executed without broadcast.',
  );
} else if (mode === '--verify') {
  await verify(stages.length);
  save('privacy-verified.json', {
    chainId,
    at: new Date().toISOString(),
    rowsPreserved: true,
    authoritiesPreserved: true,
    actionLinksAdded: missingContextLinks.length,
    stages: stages.length,
  });
  console.log('All planned code, ABI, rows and authorities verified.');
} else {
  assert.ok(existsSync(directory + '/privacy-plan.json'), 'PREPARE_REQUIRED');
  const plan = z.object({ stages: z.unknown() }).parse(read('privacy-plan.json'));
  assert.deepEqual(
    plan.stages,
    stages.map((s) => ({
      label: s.label,
      forward: s.forward.map((a) => Serializer.objectify(a)),
      reverse: s.reverse.map((a) => Serializer.objectify(a)),
      patches: s.patches,
      changes: s.changes,
    })),
    'REVIEWED_PLAN_CHANGED',
  );
  const lib = Number((await api.v1.chain.get_info()).last_irreversible_block_num);
  const confirmed = (direction: 'apply' | 'rollback') =>
    stages.map((_, index) => {
      const file = 'privacy-' + direction + '-' + index + '-receipt.json';
      if (!existsSync(directory + '/' + file)) return false;
      const receipt = read(file),
        id = z
          .object({ transaction_id: z.string().regex(/^[a-f0-9]{64}$/) })
          .parse(receipt).transaction_id;
      assert.ok(executedChainResult(receipt, id).blockNum <= lib, 'PRIOR_RECEIPT_NOT_IRREVERSIBLE');
      return true;
    });
  const position = upgradePosition(confirmed('apply'), confirmed('rollback'));
  if (mode === '--apply')
    assert.equal(position.completed, position.remaining, 'FRESH_SNAPSHOT_AFTER_ROLLBACK_REQUIRED');
  const indexes =
    mode === '--apply'
      ? stages.map((_, i) => i).slice(position.completed)
      : stages
          .map((_, i) => i)
          .slice(0, position.remaining)
          .reverse();
  for (const index of indexes) {
    const stage = stages[index];
    assert.ok(stage);
    await verify(mode === '--apply' ? index : index + 1);
    const p = await packet(mode === '--apply' ? stage.forward : stage.reverse);
    const simulation = await api.v1.chain.compute_transaction(p.packed);
    executedChainResult(simulation, String(p.transaction.id));
    assertNoAssetTransfer(simulation);
    save('privacy-' + mode.slice(2) + '-' + index + '-simulation.json', simulation);
    const receipt = await api.v1.chain.push_transaction(p.packed);
    writeFileSync(
      directory + '/privacy-' + mode.slice(2) + '-' + index + '-receipt.json',
      JSON.stringify(receipt, null, 2) + '\n',
      { mode: 0o600, flag: 'wx' },
    );
    const result = executedChainResult(receipt, String(p.transaction.id));
    await waitForIrreversibleBlock(
      async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
      result.blockNum,
    );
    if (mode === '--apply' && stage.label === 'context-links') {
      const reverse = await packet(stage.reverse);
      const rehearsal = await api.v1.chain.compute_transaction(reverse.packed);
      executedChainResult(rehearsal, String(reverse.transaction.id));
      assertNoAssetTransfer(rehearsal);
      save('privacy-context-links-reverse-rehearsal.json', rehearsal);
    }
    console.log(JSON.stringify({ stage: stage.label, mode, ...result, irreversible: true }));
  }
  await verify(mode === '--apply' ? stages.length : 0);
}
