// Source-bound testnet upgrade: no owner/active changes and no module binary replacement.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  ABI,
  APIClient,
  Action,
  Name,
  Serializer,
  Transaction,
  SignedTransaction,
  PackedTransaction,
  CompressionType,
  PrivateKey,
  PublicKey,
  UInt64,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { VERSION } from '../../protocol/base.js';
import {
  RuntimeCodeHash,
  RuntimeRawAbiHash,
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
} from '../../sdk/index.js';
import { parseEnvFile } from '../../services/api/src/env-file.js';
import { encodeSystem, encodeContractAbi } from './actions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
const mode = z.enum(['--prepare', '--apply', '--verify']).parse(process.argv[2]);
const directory = z
  .string()
  .regex(/^\/data\/daclify-runtime\/module-fees-testnet-[a-z0-9-]+$/)
  .parse(process.argv[3]);
assert.equal(process.argv.length, 4);
mkdirSync(directory, { recursive: true, mode: 0o700 });
assert.equal(statSync(directory).mode & 0o077, 0, 'PRIVATE_PACKET_REQUIRED');
const chainId = '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
  runtime = 'daclifycore1',
  governor = '3boidanimus3';
const priorCode = '4235158cdd149a4bebf1006a69b5f3943a842a9b437db14abf823acbd6cc277b';
const api = new APIClient({ url: 'https://testnet.telos.net' }),
  candidate = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const wasm = readFileSync('.artifacts/contracts/runtime.wasm'),
  rawAbi = encodeContractAbi(JSON.stringify(candidate));
assert.equal(hash(wasm), RuntimeCodeHash);
assert.equal(hash(rawAbi), RuntimeRawAbiHash);
assert.equal((await api.v1.chain.get_info()).chain_id.toString(), chainId);
const save = (file: string, value: unknown) =>
  writeFileSync(directory + '/' + file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const Table = z.object({ scope: z.string(), table: z.string(), rows: z.array(z.string()) });
const Account = z.object({
  name: z.string(),
  codeHash: z.string(),
  abiHash: z.string(),
  permissions: z.unknown(),
  ramUsage: z.number(),
  ramQuota: z.string(),
});
const Packet = z.object({
  coreCommit: z.string(),
  coreVersion: z.literal(VERSION),
  corePackageHash: z.string(),
  wasmHash: z.literal(RuntimeCodeHash),
  abiHash: z.literal(RuntimeRawAbiHash),
  accounts: z.array(Account),
  tables: z.array(Table),
});
async function tables(abi: ABI) {
  const result: z.infer<typeof Table>[] = [];
  let lower = '';
  for (let page = 0; page < 100; page++) {
    const scopes = await api.v1.chain.get_table_by_scope({
      code: runtime,
      lower_bound: lower,
      limit: 100,
    });
    for (const row of scopes.rows) {
      const table = row.table.toString(),
        scope = row.scope.toString();
      if (!abi.tables.some((t) => t.name.toString() === table)) {
        assert.ok(
          (BigInt(Name.from(table).value.toString()) & 15n) !== 0n,
          'UNKNOWN_PRIMARY_TABLE',
        );
        continue;
      }
      const rows = await api.v1.chain.get_table_rows({
        code: runtime,
        scope,
        table,
        json: false,
        limit: 1000,
      });
      assert.equal(rows.more, false, 'TABLE_BOUND');
      result.push({ scope, table, rows: z.array(z.string()).parse(rows.rows) });
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
const env = parseEnvFile(readFileSync('/data/daclify-env/testnet.env', 'utf8'));
assert.equal(env.NETWORK_ENVIRONMENT, 'testnet');
assert.equal(env.CHAIN_ID, chainId);
const relay = z
  .string()
  .regex(/^[a-z1-5]{12}$/)
  .parse(env.RELAY_ACCOUNT);
const names = [
  runtime,
  'daclifyhubv1',
  'daclifydecid',
  'daclifyworks',
  'daclifypayr1',
  'daclifygrant',
  'daclifyendor',
  'daclifyactiv',
  'daclifynames',
  relay,
];
async function accounts() {
  return Promise.all(
    names.map(async (name) => {
      const [raw, account] = await Promise.all([
        api.v1.chain.get_raw_abi(name),
        api.v1.chain.get_account(name),
      ]);
      return {
        name,
        codeHash: String(raw.code_hash),
        abiHash: String(raw.abi_hash),
        permissions: JSON.parse(JSON.stringify(account.permissions)),
        ramUsage: Number(account.ram_usage),
        ramQuota: String(account.ram_quota),
      };
    }),
  );
}
const packageHash = () =>
  hash(readFileSync('.artifacts/daclify-core-protocol-' + VERSION + '.tgz'));
const commit = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (mode === '--prepare') {
  assert.equal(
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    '',
    'CLEAN_SOURCE_REQUIRED',
  );
  const before = await accounts(),
    raw = await api.v1.chain.get_raw_abi(runtime);
  assert.equal(String(raw.code_hash), priorCode);
  const oldAbi = Serializer.decode({ data: raw.abi.array, type: ABI });
  const rows = await tables(oldAbi);
  assert.ok(
    !rows.some((r) => ['rammig', 'rammigsrc'].includes(r.table)),
    'ACTIVE_RAM_MIGRATION_REVIEW_REQUIRED',
  );
  for (const table of rows) {
    const type = candidate.tables.find((t) => t.name.toString() === table.table)?.type;
    assert.ok(type, 'EXISTING_TABLE_REMOVED');
    for (const row of table.rows)
      assert.equal(
        Serializer.encode({
          abi: candidate,
          type,
          object: Serializer.decode({ abi: candidate, type, data: row }),
        }).hexString,
        row,
        'EXISTING_ROW_LAYOUT_CHANGED',
      );
  }
  const bytes = z
    .object({ wasm: z.string() })
    .parse(
      await api.call({ path: '/v1/chain/get_raw_code_and_abi', params: { account_name: runtime } }),
    );
  writeFileSync(directory + '/runtime-before.wasm', Buffer.from(bytes.wasm, 'base64'), {
    mode: 0o600,
  });
  writeFileSync(directory + '/runtime-before.abi.bin', raw.abi.array, { mode: 0o600 });
  save('upgrade-packet.json', {
    coreCommit: commit(),
    coreVersion: VERSION,
    corePackageHash: packageHash(),
    wasmHash: RuntimeCodeHash,
    abiHash: RuntimeRawAbiHash,
    accounts: before,
    tables: rows,
  });
  console.log(
    JSON.stringify({
      state: 'prepared',
      coreVersion: VERSION,
      wasmBytes: wasm.length,
      existingTables: rows.length,
      existingRows: rows.reduce((sum, t) => sum + t.rows.length, 0),
      ownerActiveChanges: 0,
    }),
  );
} else {
  const packet = Packet.parse(JSON.parse(readFileSync(directory + '/upgrade-packet.json', 'utf8')));
  assert.equal(packet.coreCommit, commit(), 'SOURCE_CHANGED');
  assert.equal(packet.corePackageHash, packageHash(), 'PACKAGE_CHANGED');
  if (mode === '--apply') {
    const current = await accounts();
    assert.deepEqual(current, packet.accounts, 'ACCOUNTS_CHANGED_SINCE_PREPARE');
    const oldAbi = Serializer.decode({
      data: readFileSync(directory + '/runtime-before.abi.bin'),
      type: ABI,
    });
    assert.deepEqual(await tables(oldAbi), packet.tables, 'ROWS_CHANGED_SINCE_PREPARE');
    const runtimeAccount = current.find((a) => a.name === runtime);
    assert.ok(runtimeAccount);
    assert.ok(
      BigInt(runtimeAccount.ramQuota) - BigInt(runtimeAccount.ramUsage) >
        BigInt(
          Math.max(0, wasm.length - readFileSync(directory + '/runtime-before.wasm').length) +
            65536,
        ),
      'RUNTIME_RAM_MARGIN',
    );
    const actions: Action[] = [];
    const system = (name: string, data: object, actor: string) =>
      Action.from({
        account: 'eosio',
        name,
        authorization: [{ actor, permission: 'active' }],
        data: encodeSystem(name, data),
      });
    const link = async (actor: string, code: string, type: string, permission: string) => {
      const account = await api.v1.chain.get_account(actor),
        parent = account.permissions.find((p) => p.perm_name.toString() === permission);
      assert.ok(parent, 'REQUIRED_PERMISSION_MISSING');
      const linked = account.permissions.filter((p) =>
        p.linked_actions?.some(
          (a) => a.account.toString() === code && a.action?.toString() === type,
        ),
      );
      assert.ok(
        linked.length === 0 ||
          (linked.length === 1 && linked[0]?.perm_name.toString() === permission),
        'ACTION_LINK_REVIEW_REQUIRED',
      );
      if (!linked.length)
        actions.push(
          system('linkauth', { account: actor, code, type, requirement: permission }, actor),
        );
    };
    await link(runtime, runtime, 'govmodfee', 'execctx');
    for (const type of ['setmodterm', 'revmodterm', 'resmodterm'])
      await link(relay, runtime, type, 'operator');
    actions.push(
      system(
        'setcode',
        { account: runtime, vmtype: 0, vmversion: 0, code: wasm.toString('hex') },
        runtime,
      ),
      system('setabi', { account: runtime, abi: Buffer.from(rawAbi).toString('hex') }, runtime),
    );
    const member = RuntimeTableSchemas.members.parse(
      (
        await api.v1.chain.get_table_rows({
          code: runtime,
          scope: '1',
          table: 'members',
          lower_bound: UInt64.from(1),
          limit: 1,
        })
      ).rows[0],
    );
    assert.equal(member.id, '1');
    assert.equal(member.native_account, governor);
    assert.ok(member.active && member.admin);
    const plans = [
      { account: 'daclifydecid', usd: 200, actions: ['open', 'newelect'] },
      { account: 'daclifyworks', usd: 300, actions: ['propose', 'offeragr'] },
      { account: 'daclifypayr1', usd: 300, actions: ['commit'] },
      { account: 'daclifygrant', usd: 200, actions: ['newround', 'applygrant'] },
      { account: 'daclifyendor', usd: 100, actions: ['applyjoin'] },
      { account: 'daclifyactiv', usd: 100, actions: ['recordact'] },
    ];
    const head = await api.v1.chain.get_info();
    for (const [index, plan] of plans.entries()) {
      const request = makeInstruction(
        { chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
        '1',
        (BigInt(member.nonce) + BigInt(index)).toString(),
        Math.floor(Date.now() / 1000) + 300,
        runtime,
        'govmodfee',
        encodeAction('govmodfee', {
          runtime,
          dao_id: '1',
          member_id: '1',
          account: plan.account,
          expected_revision: '0',
          monthly_usd: plan.usd,
          actions: plan.actions,
        }),
      );
      actions.push(
        Action.from({
          account: runtime,
          name: 'submitnat',
          authorization: [{ actor: governor, permission: 'active' }],
          data: encodeAction('submitnat', { request }),
        }),
      );
    }
    const transaction = Transaction.from({ ...head.getTransactionHeader(300), actions });
    const unsigned = PackedTransaction.fromSigned(
      SignedTransaction.from({ ...transaction, signatures: [] }),
      CompressionType.zlib,
    );
    const response = await fetch('https://testnet.telos.net/v1/chain/compute_transaction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: unsigned }),
      signal: AbortSignal.timeout(30000),
    });
    const simulation = z
      .object({
        processed: z.object({
          receipt: z.object({ status: z.literal('executed') }),
          except: z.null().optional(),
        }),
      })
      .parse(await response.json());
    assert.ok(response.ok);
    save('upgrade-simulation.json', simulation);
    const file = '/data/daclify-env/deploy.testnet.env';
    assert.equal(statSync(file).mode & 0o077, 0);
    const key = PrivateKey.from(
      z.string().parse(parseEnvFile(readFileSync(file, 'utf8')).DEPLOYER_PRIVATE_KEY),
    );
    const authorityOnly = Transaction.from({
      ...head.getTransactionHeader(300),
      actions: actions.map((a) => Action.from({ ...a, data: new Uint8Array() })),
    });
    const required = z.object({ required_keys: z.array(z.string()).length(1) }).parse(
      await api.call({
        path: '/v1/chain/get_required_keys',
        params: { transaction: authorityOnly, available_keys: [key.toPublic().toString()] },
      }),
    );
    assert.ok(
      required.required_keys.every((k) => PublicKey.from(k).equals(key.toPublic())),
      'SIGNING_AUTHORITY_CHANGED',
    );
    save('required-keys.json', required);
    const signed = SignedTransaction.from({
      ...transaction,
      signatures: [key.signDigest(transaction.signingDigest(head.chain_id))],
    });
    const result = await api.v1.chain.push_transaction(
      PackedTransaction.fromSigned(signed, CompressionType.zlib),
    );
    const executed = executedChainResult(result, transaction.id.toString());
    save('upgrade-receipt.json', JSON.parse(JSON.stringify(result)));
    await waitForIrreversibleBlock(
      async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
      executed.blockNum,
    );
    save('upgrade-irreversible.json', executed);
    console.log(
      JSON.stringify({
        state: 'applied',
        ...executed,
        monthlyTotalUsdCents: 1200,
        ownerActiveChanges: 0,
      }),
    );
  } else {
    const current = await accounts();
    for (const prior of packet.accounts) {
      const live = current.find((a) => a.name === prior.name);
      assert.ok(live);
      assert.equal(live.codeHash, prior.name === runtime ? RuntimeCodeHash : prior.codeHash);
      assert.equal(live.abiHash, prior.name === runtime ? RuntimeRawAbiHash : prior.abiHash);
      const authorities = z.array(
        z.object({ perm_name: z.string(), parent: z.string(), required_auth: z.unknown() }),
      );
      assert.deepEqual(
        authorities.parse(live.permissions),
        authorities.parse(prior.permissions),
        'AUTHORITY_CHANGED',
      );
    }
    const live = await tables(candidate),
      changed = new Set(['modfees', 'ramobs', 'ramstats', 'ramactual', 'ramrecord']);
    for (const prior of packet.tables) {
      if (prior.scope === '1' || Name.from(prior.scope).value.toString() === '1') {
        if (['members', 'executives', 'memberacts'].includes(prior.table)) {
          const after = live.find((t) => t.scope === prior.scope && t.table === prior.table);
          assert.ok(after);
          assert.equal(after.rows.length, prior.rows.length);
          const type = candidate.tables.find((t) => t.name.toString() === prior.table)?.type;
          assert.ok(type);
          for (const [i, row] of prior.rows.entries()) {
            const before = z
              .record(z.string(), z.unknown())
              .parse(
                JSON.parse(JSON.stringify(Serializer.decode({ abi: candidate, type, data: row }))),
              );
            const saved = after.rows[i];
            assert.ok(saved);
            const current = z
              .record(z.string(), z.unknown())
              .parse(
                JSON.parse(
                  JSON.stringify(Serializer.decode({ abi: candidate, type, data: saved })),
                ),
              );
            if (String(before.id ?? before.member_id) === '1') {
              if (prior.table === 'members') {
                assert.equal(
                  BigInt(
                    z
                      .union([z.string().regex(/^[0-9]+$/), z.number().int().nonnegative()])
                      .parse(current.nonce),
                  ),
                  BigInt(
                    z
                      .union([z.string().regex(/^[0-9]+$/), z.number().int().nonnegative()])
                      .parse(before.nonce),
                  ) + 6n,
                );
                before.nonce = current.nonce;
              } else {
                assert.ok(Number(current.last_active) >= Number(before.last_active));
                before.last_active = current.last_active;
              }
            }
            assert.deepEqual(current, before, 'MEMBER_OR_ROLE_CHANGED');
          }
          continue;
        }
      }
      if (changed.has(prior.table)) continue;
      assert.deepEqual(
        live.find((t) => t.scope === prior.scope && t.table === prior.table)?.rows,
        prior.rows,
        'EXISTING_ROWS_CHANGED',
      );
    }
    const fees = (
      await api.v1.chain.get_table_rows({
        code: runtime,
        scope: runtime,
        table: 'modfees',
        limit: 32,
      })
    ).rows.map((row) => RuntimeTableSchemas.modfees.parse(row));
    assert.equal(fees.length, 6);
    assert.equal(
      fees.reduce((sum, r) => sum + r.monthly_usd, 0),
      1200,
    );
    save('upgrade-verification.json', {
      state: 'verified',
      coreVersion: VERSION,
      codeHash: RuntimeCodeHash,
      abiHash: RuntimeRawAbiHash,
      fees,
      accounts: current,
    });
    console.log(
      JSON.stringify({
        state: 'verified',
        plans: fees.length,
        totalUsdCents: 1200,
        existingTableLayouts: true,
        ownerActiveUnchanged: true,
      }),
    );
  }
}
