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

const root = '/data/daclify-upgrades/testnet';
const chainId = '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f';
const api = new APIClient({ url: 'https://testnet.telos.caleos.io' });
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
    '5f05cac05cd0bc3ea057402df7aef3e0c3fb3f9373094d1ad47605b377ab6bee',
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
    .filter((target) => !['runtime', 'hub', 'names'].includes(target.contract))
    .every((target) => target.tables.length === 0),
  'PENDING_MODULE_STATE_REQUIRES_REVIEW',
);
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
  const runtime = targets[0];
  assert.ok(runtime, 'RUNTIME_REQUIRED');
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
    assert.ok(hasKey(account, 'owner'), 'CONTRACT_OWNER_KEY_REQUIRED');
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
    assert.ok(extra <= 1048576, 'RAM_PLAN_REQUIRES_REVIEW');
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
      const next = { ...saved, code_hash: hash(target.wasm) };
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
              authorization: [{ actor: runtime.account, permission: 'owner' }],
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
  const batches = [runtimeActions, actions];
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
    process.argv.slice(2).filter((arg) => arg !== '--send'),
    [],
    'USAGE: optional --send only',
  );
  if (!process.argv.includes('--send')) return;
  const submitted = [];
  for (const [index, batch] of batches.entries()) {
    for (const target of targets) {
      await verifyTables(target);
      const live = await api.v1.chain.get_raw_abi(target.account);
      const updated: boolean = index === 1 && target === runtime;
      assert.equal(
        live.code_hash.toString(),
        updated ? hash(target.wasm) : target.prior.codeHash,
        'CHAIN_CODE_CHANGED',
      );
      assert.equal(
        live.abi_hash.toString(),
        updated ? hash(target.rawAbi) : target.prior.rawAbiHash,
        'CHAIN_ABI_CHANGED',
      );
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
    for (const target of targets) {
      const updated: boolean = index === 1 || target === runtime;
      const live = await api.v1.chain.get_raw_abi(target.account);
      assert.equal(
        live.code_hash.toString(),
        updated ? hash(target.wasm) : target.prior.codeHash,
        'POST_UPGRADE_CODE_HASH',
      );
      assert.equal(
        live.abi_hash.toString(),
        updated ? hash(target.rawAbi) : target.prior.rawAbiHash,
        'POST_UPGRADE_ABI_HASH',
      );
      await verifyTables(
        target,
        index === 1 && target === runtime ? expectedTables : target.tables,
      );
      assert.deepEqual(
        Serializer.objectify((await api.v1.chain.get_account(target.account)).permissions),
        originalPermissions.get(target.account),
        'AUTHORITY_CHANGED',
      );
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
  console.log('Irreversible; all eight code/ABI pins, existing rows and authorities verified.');
}
async function simulate(actions: Action[]) {
  const info = await api.v1.chain.get_info();
  assert.equal(info.chain_id.toString(), chainId, 'TESTNET_CHAIN_REQUIRED');
  const transaction = Transaction.from({ ...info.getTransactionHeader(300), actions });
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
    path.join(snapshot, `simulation-${actions.length}-result.json`),
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
