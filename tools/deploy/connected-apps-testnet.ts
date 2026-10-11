import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import {
  ABI,
  Action,
  Name,
  Serializer,
  Transaction,
  SignedTransaction,
  PackedTransaction,
  CompressionType,
  PrivateKey,
  PublicKey,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { ModuleCodeHashes, activityAbi } from '@daclify/modules/sdk';
import { VERSION, parseUnits } from '../../protocol/base.js';
import { RuntimeCodeHash, RuntimeRawAbiHash, RuntimeTableSchemas } from '../../sdk/index.js';
import { HubDeploymentRowSchema } from '../../protocol/directory.js';
import { ramMarketCost, tlosAsset } from '../../protocol/resources.js';
import { createRpcClient } from '../../services/api/src/rpc.js';
import { parseEnvFile } from '../../services/api/src/env-file.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
import { loadEnvironment, deploymentAccounts } from './environment.js';
import { encodeSystem, encodeContractAbi } from './actions.js';
import { contextPermissionPlan } from './permissions.js';
const mode = z.enum(['--prepare', '--apply', '--verify', '--simulate']).parse(process.argv[2]);
const directory = z
  .string()
  .regex(/^\/data\/daclify-runtime\/connected-apps-rollout-[a-z0-9-]+$/)
  .parse(process.argv[3]);
assert.equal(process.argv.length, 4);
const env = await loadEnvironment('testnet'),
  api = createRpcClient(env.rpcUrl),
  runtime = 'daclifycore1',
  moduleAccount = 'daclifyactiv',
  hub = 'daclifyhubv1';
assert.equal(env.accounts[0]?.name, runtime);
assert.equal(env.extraModules.find((item) => item.contract === 'activity')?.name, moduleAccount);
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex'),
  object = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const ActionSchema = z.object({
  account: z.string(),
  name: z.string(),
  authorization: z.array(z.object({ actor: z.string(), permission: z.string() })),
  data: z.string(),
});
const TableSchema = z.object({ scope: z.string(), table: z.string(), rows: z.array(z.string()) });
const StateSchema = z.object({
  accounts: z.array(
    z.object({
      name: z.string(),
      codeHash: z.string(),
      abiHash: z.string(),
      permissions: z.array(z.unknown()),
      ramQuota: z.string(),
      ramUsage: z.string(),
      balance: z.array(z.string()),
    }),
  ),
  tables: z.array(z.object({ account: z.string(), tables: z.array(TableSchema) })),
});
const SourcesSchema = z.object({
  coreCommit: z.string().regex(/^[a-f0-9]{40}$/),
  modulesCommit: z.string().regex(/^[a-f0-9]{40}$/),
  frontendCommit: z.string().regex(/^[a-f0-9]{40}$/),
  corePackage: z.string().regex(/^[a-f0-9]{64}$/),
  modulesPackage: z.string().regex(/^[a-f0-9]{64}$/),
});
function sourceIdentity() {
  const commit = (cwd: string) => {
    assert.equal(
      execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }),
      '',
      'UNCOMMITTED_RELEASE_SOURCE',
    );
    assert.equal(
      execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim(),
      'dev',
    );
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  };
  return SourcesSchema.parse({
    coreCommit: commit('/data/daclify-backend-core'),
    modulesCommit: commit('/data/daclify-backend-modules'),
    frontendCommit: commit('/data/daclify-frontend'),
    corePackage: hash(readFileSync('.artifacts/daclify-core-protocol-' + VERSION + '.tgz')),
    modulesPackage: hash(
      readFileSync('../daclify-backend-modules/.artifacts/daclify-modules-0.9.0-alpha.21.tgz'),
    ),
  });
}
const PacketSchema = z.object({
  sources: SourcesSchema,
  chainId: z.string(),
  priorCodeHash: z.string(),
  priorAbiHash: z.string(),
  runtimeCodeHash: z.literal(RuntimeCodeHash),
  activityCodeHash: z.literal(ModuleCodeHashes.activity),
  resourceCostCapUnits: z.string(),
  batches: z.array(z.array(ActionSchema)),
  before: StateSchema,
});
function save(name: string, value: unknown) {
  writeFileSync(directory + '/' + name, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
}
const read = (name: string): unknown => JSON.parse(readFileSync(directory + '/' + name, 'utf8'));
async function tables(account: string, abi: ABI) {
  const result: z.infer<typeof TableSchema>[] = [];
  let lower = '';
  for (let page = 0; page < 100; page++) {
    const scopes = await api.v1.chain.get_table_by_scope({
      code: account,
      lower_bound: lower,
      limit: 100,
    });
    for (const row of scopes.rows) {
      const table = row.table.toString(),
        scope = row.scope.toString();
      if (!abi.tables.some((entry) => entry.name.toString() === table)) {
        assert.ok(
          (BigInt(Name.from(table).value.toString()) & 15n) !== 0n,
          'UNKNOWN_PRIMARY_TABLE',
        );
        continue;
      }
      const data = await api.v1.chain.get_table_rows({
        code: account,
        scope,
        table,
        json: false,
        limit: 1000,
      });
      assert.equal(data.more, false, 'TABLE_BOUND');
      result.push({ scope, table, rows: z.array(z.string()).parse(data.rows) });
    }
    if (!scopes.more)
      return result.sort((a, b) =>
        (a.scope + '/' + a.table).localeCompare(b.scope + '/' + b.table),
      );
    assert.notEqual(scopes.more, lower);
    lower = scopes.more;
  }
  throw new Error('SCOPE_BOUND');
}
async function state(includeActivity = mode === '--verify') {
  const accounts = [],
    allTables = [];
  for (const definition of deploymentAccounts(env)) {
    if (definition.name === moduleAccount && !includeActivity) continue;
    const [raw, account, balance] = await Promise.all([
      api.v1.chain.get_raw_abi(definition.name),
      api.v1.chain.get_account(definition.name),
      api.v1.chain.get_currency_balance('eosio.token', definition.name, 'TLOS'),
    ]);
    accounts.push({
      name: definition.name,
      codeHash: String(raw.code_hash),
      abiHash: String(raw.abi_hash),
      permissions: object(account.permissions),
      ramQuota: String(account.ram_quota),
      ramUsage: String(account.ram_usage),
      balance: balance.map((item) => item.toString()),
    });
    if (raw.abi.array.length)
      allTables.push({
        account: definition.name,
        tables: await tables(
          definition.name,
          Serializer.decode({ type: ABI, data: raw.abi.array }),
        ),
      });
  }
  return StateSchema.parse({ accounts, tables: allTables });
}
function system(name: string, data: object, actor: string) {
  return Action.from({
    account: 'eosio',
    name,
    authorization: [{ actor, permission: 'active' }],
    data: encodeSystem(name, data),
  });
}
function core(name: string, data: object) {
  return Action.from(
    { account: runtime, name, authorization: [{ actor: runtime, permission: 'active' }], data },
    ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8')),
  );
}
async function simulate(actions: Action[]) {
  const info = await api.v1.chain.get_info(),
    transaction = Transaction.from({ ...info.getTransactionHeader(300), actions }),
    packed = PackedTransaction.fromSigned(
      SignedTransaction.from({ ...transaction, signatures: [] }),
      CompressionType.zlib,
    ),
    response = await fetch(env.rpcUrl + '/v1/chain/compute_transaction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: packed }),
      signal: AbortSignal.timeout(30000),
    }),
    result: unknown = await response.json();
  const parsed = z
    .object({
      processed: z
        .object({
          except: z.unknown().optional(),
          receipt: z.object({ status: z.string() }).nullable().optional(),
        })
        .optional(),
      error: z.unknown().optional(),
    })
    .parse(result);
  if (!response.ok || parsed.error || parsed.processed?.except) {
    save('simulation-failure-' + Date.now() + '.json', { status: response.status, result });
    throw new Error('TESTNET_SIMULATION_FAILED');
  }
  return { status: response.status, compressedBytes: packed.packed_trx.array.length, result };
}
const info = await api.v1.chain.get_info();
assert.equal(String(info.chain_id), env.chainId);
if (mode === '--prepare') {
  const sources = sourceIdentity();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  assert.equal(statSync(directory).mode & 0o077, 0);
  const unavailable = await fetch(env.rpcUrl + '/v1/chain/get_account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: moduleAccount }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(unavailable.status, 400, 'ACTIVITY_ACCOUNT_ALREADY_EXISTS');
  const before = await state(),
    root = before.accounts.find((item) => item.name === runtime);
  assert.ok(root);
  assert.equal(
    root.codeHash,
    '2733a5295dd72580c43622346ec3db8d93e9315a3e2febff929e895b30f687f5',
    'RUNTIME_BASELINE_CHANGED',
  );
  const wasm = readFileSync('.artifacts/contracts/runtime.wasm'),
    moduleWasm = readFileSync('../daclify-backend-modules/.artifacts/contracts/activity.wasm'),
    runtimeAbi = readFileSync('.artifacts/contracts/runtime.abi', 'utf8'),
    moduleAbi = readFileSync(
      '../daclify-backend-modules/.artifacts/contracts/activity.abi',
      'utf8',
    );
  assert.equal(hash(wasm), RuntimeCodeHash);
  assert.equal(hash(moduleWasm), ModuleCodeHashes.activity);
  assert.equal(hash(encodeContractAbi(runtimeAbi)), RuntimeRawAbiHash);
  const raw = await api.call({
      path: '/v1/chain/get_raw_code_and_abi',
      params: { account_name: runtime },
    }),
    old = z.object({ wasm: z.string() }).parse(raw),
    rawAbi = await api.v1.chain.get_raw_abi(runtime);
  writeFileSync(directory + '/runtime-before.wasm', Buffer.from(old.wasm, 'base64'), {
    mode: 0o600,
    flag: 'wx',
  });
  writeFileSync(directory + '/runtime-before.abi.bin', rawAbi.abi.array, {
    mode: 0o600,
    flag: 'wx',
  });
  const candidate = ABI.from(runtimeAbi);
  for (const table of before.tables.find((item) => item.account === runtime)?.tables ?? []) {
    const type = candidate.tables.find((entry) => entry.name.toString() === table.table)?.type;
    assert.ok(type, 'EXISTING_TABLE_REMOVED');
    for (const row of table.rows)
      assert.equal(
        Serializer.encode({
          abi: candidate,
          type,
          object: Serializer.decode({ abi: candidate, type, data: row }),
        }).hexString,
        row,
        'EXISTING_LAYOUT_CHANGED',
      );
  }
  const market = await api.v1.chain.get_table_rows({
      code: 'eosio',
      scope: 'eosio',
      table: 'rammarket',
      limit: 1,
    }),
    reserves = z
      .object({ base: z.object({ balance: z.string() }), quote: z.object({ balance: z.string() }) })
      .parse(market.rows[0]),
    cost = ramMarketCost(
      4194304n,
      BigInt(reserves.base.balance.split(' ')[0] ?? ''),
      parseUnits(reserves.quote.balance.split(' ')[0] ?? '', 4),
    ),
    cap = cost + cost / 10n + 30000n;
  assert.ok(cost < 3000000n, 'RAM_COST_REVIEW_REQUIRED');
  const authority = {
      threshold: 1,
      keys: [],
      accounts: [{ permission: { actor: runtime, permission: 'active' }, weight: 1 }],
      waits: [],
    },
    first = [
      system(
        'newaccount',
        {
          creator: env.creatorAccount,
          name: moduleAccount,
          owner: authority,
          active: {
            ...authority,
            accounts: [
              { permission: { actor: moduleAccount, permission: 'eosio.code' }, weight: 1 },
              ...authority.accounts,
            ],
          },
        },
        env.creatorAccount,
      ),
      system(
        'buyrambytes',
        { payer: env.creatorAccount, receiver: moduleAccount, bytes: 4194304 },
        env.creatorAccount,
      ),
      system(
        'delegatebw',
        {
          from: env.creatorAccount,
          receiver: moduleAccount,
          stake_net_quantity: '1.0000 TLOS',
          stake_cpu_quantity: '2.0000 TLOS',
          transfer: false,
        },
        env.creatorAccount,
      ),
      system(
        'setcode',
        { account: moduleAccount, vmtype: 0, vmversion: 0, code: moduleWasm },
        moduleAccount,
      ),
      system(
        'setabi',
        { account: moduleAccount, abi: encodeContractAbi(moduleAbi) },
        moduleAccount,
      ),
    ];
  const observerRows = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: runtime,
    table: 'ramobs',
    limit: 1,
  });
  const observed = observerRows.rows.length > 0;
  if (observed)
    assert.equal(
      RuntimeTableSchemas.ramobs.parse(observerRows.rows[0]).runtime_hash,
      root.codeHash,
    );
  const hubRaw = await api.v1.chain.get_raw_abi(hub),
    hubAbi = Serializer.decode({ type: ABI, data: hubRaw.abi.array }),
    registered = await api.v1.chain.get_table_rows({
      code: hub,
      scope: hub,
      table: 'deployments',
      index_position: 'secondary',
      key_type: 'name',
      lower_bound: Name.from(runtime),
      upper_bound: Name.from(runtime),
      limit: 1,
    }),
    deployment = HubDeploymentRowSchema.parse(registered.rows[0]);
  assert.equal(deployment.runtime, runtime);
  assert.equal(deployment.code_hash, root.codeHash);
  const second = [
    system('setcode', { account: runtime, vmtype: 0, vmversion: 0, code: wasm }, runtime),
    system('setabi', { account: runtime, abi: encodeContractAbi(runtimeAbi) }, runtime),
    ...(observed
      ? [
          core('rebindramobs', {
            expected_old_hash: root.codeHash,
            expected_new_hash: RuntimeCodeHash,
          }),
        ]
      : []),
    ...contextPermissionPlan(runtime, [{ id: 'activity', account: moduleAccount }])
      .links.filter(
        (link) => link.account === moduleAccount || ['setapp', 'addappses'].includes(link.action),
      )
      .map((link) =>
        system(
          'linkauth',
          { account: runtime, code: link.account, type: link.action, requirement: 'execctx' },
          runtime,
        ),
      ),
    ...(observed
      ? [core('setramcode', { account: moduleAccount, code_hash: ModuleCodeHashes.activity })]
      : []),
    Action.from(
      {
        account: moduleAccount,
        name: 'bindrampool',
        authorization: [{ actor: moduleAccount, permission: 'active' }],
        data: { runtime },
      },
      ABI.from(activityAbi),
    ),
    core('listmod', {
      account: moduleAccount,
      publisher: runtime,
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: ModuleCodeHashes.activity,
      title: 'Community Activity',
    }),
    Action.from(
      {
        account: hub,
        name: 'regdeploy',
        authorization: [{ actor: runtime, permission: 'active' }],
        data: {
          ...deployment,
          code_hash: RuntimeCodeHash,
          abi_hash: RuntimeRawAbiHash,
          metadata: deployment.metadata,
        },
      },
      hubAbi,
    ),
  ];
  const packet = PacketSchema.parse({
    sources,
    chainId: env.chainId,
    priorCodeHash: root.codeHash,
    priorAbiHash: root.abiHash,
    runtimeCodeHash: RuntimeCodeHash,
    activityCodeHash: ModuleCodeHashes.activity,
    resourceCostCapUnits: cap.toString(),
    batches: [first.slice(0, 3), first.slice(3), second].map((batch) =>
      batch.map((action) => object(action)),
    ),
    before,
  });
  save('packet.json', packet);
  writeFileSync(
    directory + '/packet.sha256',
    hash(readFileSync(directory + '/packet.json')) + '\n',
    { mode: 0o600, flag: 'wx' },
  );
  save('simulation.json', { batch: 0, ...(await simulate(first.slice(0, 3))) });
  console.log(
    JSON.stringify({
      state: 'prepared',
      coreVersion: VERSION,
      activityAccount: moduleAccount,
      ramBytes: 4194304,
      estimatedRamCost: tlosAsset(cost),
      stake: '3.0000 TLOS',
      batches: packet.batches.map((batch) => batch.length),
      runtimeCodeHash: RuntimeCodeHash,
    }),
  );
} else {
  assert.equal(
    hash(readFileSync(directory + '/packet.json')),
    readFileSync(directory + '/packet.sha256', 'utf8').trim(),
    'PACKET_CHANGED',
  );
  const packet = PacketSchema.parse(read('packet.json'));
  assert.equal(packet.chainId, env.chainId);
  if (mode === '--simulate') {
    console.log(
      JSON.stringify(
        await simulate((packet.batches[0] ?? []).map((action) => Action.from(action))),
      ),
    );
  } else if (mode === '--apply') {
    assert.deepEqual(sourceIdentity(), packet.sources, 'RELEASE_SOURCE_CHANGED');
    const market = await api.v1.chain.get_table_rows({
        code: 'eosio',
        scope: 'eosio',
        table: 'rammarket',
        limit: 1,
      }),
      reserves = z
        .object({
          base: z.object({ balance: z.string() }),
          quote: z.object({ balance: z.string() }),
        })
        .parse(market.rows[0]);
    const cost = ramMarketCost(
      4194304n,
      BigInt(reserves.base.balance.split(' ')[0] ?? ''),
      parseUnits(reserves.quote.balance.split(' ')[0] ?? '', 4),
    );
    assert.ok(cost + 30000n <= BigInt(packet.resourceCostCapUnits), 'RESOURCE_COST_CAP_CHANGED');
    const current = await state();
    assert.deepEqual(
      current.accounts.filter((account) => account.name !== moduleAccount),
      packet.before.accounts,
      'EXISTING_ACCOUNTS_CHANGED',
    );
    assert.deepEqual(
      current.tables.filter((account) => account.account !== moduleAccount),
      packet.before.tables,
      'FROZEN_DATA_CHANGED',
    );
    const file = '/data/daclify-env/deploy.testnet.env';
    assert.equal(statSync(file).mode & 0o077, 0);
    const key = PrivateKey.from(
      z.string().parse(parseEnvFile(readFileSync(file, 'utf8')).DEPLOYER_PRIVATE_KEY),
    );
    const push = async (actions: Action[], index: number) => {
      const simulation = await simulate(actions);
      save('simulation-' + index + '.json', simulation);
      const head = await api.v1.chain.get_info(),
        transaction = Transaction.from({ ...head.getTransactionHeader(300), actions }),
        authorityOnly = Transaction.from({
          ...head.getTransactionHeader(300),
          actions: actions.map((action) => Action.from({ ...action, data: new Uint8Array() })),
        }),
        required = z.object({ required_keys: z.array(z.string()) }).parse(
          await api.call({
            path: '/v1/chain/get_required_keys',
            params: { transaction: authorityOnly, available_keys: [key.toPublic().toString()] },
          }),
        );
      assert.equal(required.required_keys.length, 1, 'AUTHORITY_SIGNER_REQUIRED');
      assert.ok(
        required.required_keys.every((value) => PublicKey.from(value).equals(key.toPublic())),
      );
      const signed = SignedTransaction.from({
          ...transaction,
          signatures: [key.signDigest(transaction.signingDigest(head.chain_id))],
        }),
        packed = PackedTransaction.fromSigned(signed, CompressionType.zlib),
        result = await api.v1.chain.push_transaction(packed),
        executed = executedChainResult(result, transaction.id.toString());
      save('receipt-' + index + '.json', object(result));
      await waitForIrreversibleBlock(
        async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
        executed.blockNum,
      );
      save('irreversible-' + index + '.json', executed);
    };
    for (const [index, batch] of packet.batches.entries())
      await push(
        batch.map((action) => Action.from(action)),
        index,
      );
    const account = await api.v1.chain.get_account(moduleAccount);
    if (
      (
        await api.v1.chain.get_table_rows({
          code: runtime,
          scope: runtime,
          table: 'ramobs',
          limit: 1,
        })
      ).rows.length
    )
      await push(
        [
          core('setrampool', {
            payer: moduleAccount,
            expected_quota: String(account.ram_quota),
            baseline_bytes: String(account.ram_usage),
            platform_headroom: 65536,
          }),
        ],
        3,
      );
    console.log(
      JSON.stringify({
        state: 'installed',
        moduleAccount,
        runtimeCodeHash: RuntimeCodeHash,
        activityCodeHash: ModuleCodeHashes.activity,
      }),
    );
  } else {
    const after = await state();
    for (const prior of packet.before.accounts) {
      const current = after.accounts.find((account) => account.name === prior.name);
      assert.ok(current);
      assert.equal(current.codeHash, prior.name === runtime ? RuntimeCodeHash : prior.codeHash);
      assert.equal(current.abiHash, prior.name === runtime ? RuntimeRawAbiHash : prior.abiHash);
      const permissions = z.array(
        z.object({
          perm_name: z.string(),
          parent: z.string(),
          required_auth: z.unknown(),
          linked_actions: z
            .array(z.object({ account: z.string(), action: z.string().nullable() }))
            .optional(),
        }),
      );
      const saved = permissions.parse(prior.permissions),
        live = permissions.parse(current.permissions);
      assert.equal(saved.length, live.length);
      for (const permission of saved) {
        const next = live.find((item) => item.perm_name === permission.perm_name);
        assert.ok(next);
        assert.equal(next.parent, permission.parent);
        assert.deepEqual(next.required_auth, permission.required_auth, 'AUTHORITY_CHANGED');
        if (prior.name === runtime && permission.perm_name === 'execctx') {
          const expected = [
            ...(permission.linked_actions ?? []),
            ...contextPermissionPlan(runtime, [{ id: 'activity', account: moduleAccount }])
              .links.filter(
                (link) =>
                  link.account === moduleAccount || ['setapp', 'addappses'].includes(link.action),
              )
              .map((link) => ({ account: link.account, action: link.action })),
          ];
          assert.deepEqual(
            [...(next.linked_actions ?? [])].sort((a, b) =>
              (a.account + '/' + a.action).localeCompare(b.account + '/' + b.action),
            ),
            expected.sort((a, b) =>
              (a.account + '/' + a.action).localeCompare(b.account + '/' + b.action),
            ),
            'EXECUTION_LINK_CHANGED',
          );
        } else
          assert.deepEqual(
            next.linked_actions,
            permission.linked_actions,
            'UNEXPECTED_LINK_CHANGE',
          );
      }

      assert.deepEqual(current.balance, prior.balance, 'BALANCE_CHANGED');
      assert.equal(current.ramQuota, prior.ramQuota);
    }
    for (const prior of packet.before.tables) {
      const next = after.tables.find((account) => account.account === prior.account);
      assert.ok(next);
      for (const table of prior.tables) {
        if (prior.account === hub && table.table === 'deployments') {
          const raw = await api.v1.chain.get_raw_abi(hub),
            abi = Serializer.decode({ type: ABI, data: raw.abi.array }),
            type = abi.tables.find((item) => item.name.toString() === 'deployments')?.type;
          assert.ok(type);
          const action = packet.batches
            .flat()
            .find((action) => action.account === hub && action.name === 'regdeploy');
          assert.ok(action);
          const update = z
            .record(z.string(), z.unknown())
            .parse(object(Action.from(action).decodeData(abi)));
          const expected = table.rows.map((bytes) => {
            const fields = z
              .record(z.string(), z.unknown())
              .parse(object(Serializer.decode({ abi, type, data: bytes })));
            return fields.runtime === runtime
              ? Serializer.encode({ abi, type, object: { ...fields, ...update } }).hexString
              : bytes;
          });
          const live: z.infer<typeof TableSchema> | undefined = next.tables.find(
            (item) => item.scope === table.scope && item.table === table.table,
          );
          assert.ok(live);
          assert.deepEqual(live.rows, expected, 'HUB_STATE_CHANGED');
          continue;
        }
        if (prior.account === runtime && table.table === 'ramobs') continue;
        const live = next.tables.find(
          (item) => item.scope === table.scope && item.table === table.table,
        );
        assert.ok(live);
        for (const row of table.rows) assert.ok(live.rows.includes(row), 'EXISTING_ROW_CHANGED');
      }
    }
    const installed = after.accounts.find((account) => account.name === moduleAccount);
    assert.ok(installed);
    assert.equal(installed.codeHash, ModuleCodeHashes.activity);
    assert.equal(installed.ramQuota, '4194304');
    save('verified.json', {
      checkedAt: new Date().toISOString(),
      existingRowsPreserved: true,
      existingAuthoritiesPreserved: true,
      existingBalancesPreserved: true,
      after,
    });
    console.log(
      JSON.stringify({
        state: 'verified',
        existingRowsPreserved: true,
        existingAuthoritiesPreserved: true,
        moduleRamUsage: installed.ramUsage,
        moduleRamQuota: installed.ramQuota,
      }),
    );
  }
}
