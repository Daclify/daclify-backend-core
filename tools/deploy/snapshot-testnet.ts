// Read-only, bounded rollback snapshot for the existing testnet upgrade tool.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { ABI, APIClient, Name, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { nativeOwnershipAccount } from '../../sdk/executives.js';
const root = '/data/daclify-upgrades/testnet';
const directory = z
  .string()
  .regex(/^\/data\/daclify-upgrades\/testnet\/snapshot-[a-z0-9-]+$/)
  .parse(process.argv[2]);
assert.deepEqual(process.argv.slice(3), process.argv.includes('--privacy') ? ['--privacy'] : []);
mkdirSync(directory, { recursive: true, mode: 0o700 });
assert.equal(statSync(directory).mode & 0o077, 0, 'PRIVATE_SNAPSHOT_REQUIRED');
const api = new APIClient({ url: 'https://testnet.telos.net' });
const chainId = '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f';
assert.equal(String((await api.v1.chain.get_info()).chain_id), chainId);
const names = [
  'daclifycore1',
  'daclifyhubv1',
  'daclifydecid',
  'daclifyworks',
  'daclifypayr1',
  'daclifygrant',
  'daclifyendor',
  'daclifyactiv',
  'daclifynames',
  ...(process.argv.includes('--privacy') ? ['daclifyqauth', 'daclifyquick'] : []),
];
const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const accounts = [];
for (const account of names) {
  const path = directory + '/' + account;
  mkdirSync(path, { mode: 0o700 });
  const raw = await api.v1.chain.get_raw_abi(account);
  const abi = Serializer.decode({ data: raw.abi.array, type: ABI });
  const bytes = z
    .object({ wasm: z.string() })
    .parse(
      await api.call({ path: '/v1/chain/get_raw_code_and_abi', params: { account_name: account } }),
    );
  const wasm = Buffer.from(bytes.wasm, 'base64');
  assert.equal(
    createHash('sha256').update(wasm).digest('hex'),
    String(raw.code_hash),
    'SNAPSHOT_WASM_HASH',
  );
  assert.equal(
    createHash('sha256').update(raw.abi.array).digest('hex'),
    String(raw.abi_hash),
    'SNAPSHOT_ABI_HASH',
  );
  writeFileSync(path + '/contract.wasm', wasm, { mode: 0o600 });
  writeFileSync(path + '/contract.abi.bin', raw.abi.array, { mode: 0o600 });
  const accountState = await api.call({
    path: '/v1/chain/get_account',
    params: { account_name: account },
  });
  nativeOwnershipAccount(accountState);
  save(path + '/account.json', accountState);
  const tables: { table: string; scope: string; rows: string[] }[] = [];
  let lower = '';
  for (let page = 0; page < 100; page++) {
    const scopes = await api.v1.chain.get_table_by_scope({
      code: account,
      lower_bound: lower,
      limit: 100,
    });
    for (const row of scopes.rows) {
      const table = String(row.table),
        scope = String(row.scope);
      if (!abi.tables.some((t) => String(t.name) === table)) {
        assert.ok(
          (BigInt(Name.from(table).value.toString()) & 15n) !== 0n,
          'UNKNOWN_PRIMARY_TABLE',
        );
        continue;
      }
      const data = await api.v1.chain.get_table_rows({
        code: account,
        table,
        scope,
        json: false,
        limit: 100,
      });
      assert.equal(data.more, false, 'TABLE_PAGINATION_REQUIRES_REVIEW');
      tables.push({
        table,
        scope,
        rows: z.array(z.string().regex(/^(?:[0-9a-f]{2})*$/)).parse(data.rows),
      });
    }
    if (!scopes.more) break;
    assert.notEqual(scopes.more, lower, 'SCOPE_PAGINATION_LOOP');
    assert.ok(page < 99, 'SCOPE_PAGINATION_LIMIT');
    lower = scopes.more;
  }
  save(path + '/tables.json', tables);
  accounts.push({ account, codeHash: String(raw.code_hash), rawAbiHash: String(raw.abi_hash) });
  console.log(
    JSON.stringify({
      account,
      tables: tables.length,
      rows: tables.reduce((sum, table) => sum + table.rows.length, 0),
    }),
  );
}
save(directory + '/snapshot.json', { chainId, accounts });
writeFileSync(root + '/current-snapshot.txt', directory + '\n', { mode: 0o600 });
