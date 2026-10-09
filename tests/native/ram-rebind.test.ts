import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes, createHash, generateKeyPairSync } from 'node:crypto';
import { z } from 'zod';
import {
  ABI,
  APIClient,
  APIError,
  Action,
  Transaction,
  SignedTransaction,
} from '@wharfkit/antelope';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const runtime =
  'ramobs' +
  Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join('');
const key = fixtureKey('alice'),
  api = new APIClient({ url: network.url }),
  abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
if (
  !existsSync('.artifacts/observer-upgrade-old/runtime.wasm') ||
  !existsSync('.artifacts/observer-upgrade-old/runtime.abi')
)
  execFileSync('npm', ['exec', '--', 'tsx', 'tools/build/upgrade.ts', '--observer'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const oldHash = hash('.artifacts/observer-upgrade-old/runtime.wasm'),
  newHash = hash('.artifacts/contracts/runtime.wasm');
let sequence = 0;
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('OWNED_UPGRADE_FIXTURE_REJECTED');
  }
}
async function act(name: string, data: Record<string, unknown>, actor = runtime) {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const transaction = Transaction.from({
    ...info.getTransactionHeader(60 + sequence++),
    actions: [
      Action.from(
        { account: runtime, name, authorization: [{ actor, permission: 'active' }], data },
        abi,
      ),
    ],
  });
  try {
    const result = await api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: [key.signDigest(transaction.signingDigest(network.chainId))],
      }),
    );
    executedChainResult(result, transaction.id.toString());
  } catch (error) {
    const details = z
      .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
      .safeParse(error instanceof APIError ? error.response.json : undefined);
    for (const detail of details.success ? details.data.error.details : []) {
      const code = detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
      if (code) throw new Error(code);
    }
    throw new Error('NATIVE_UPGRADE_ACTION_REJECTED');
  }
}
async function observer() {
  return (
    await api.v1.chain.get_table_rows({
      code: runtime,
      scope: runtime,
      table: 'ramobs',
      json: true,
    })
  ).rows;
}
async function counters() {
  return Promise.all(
    ['0', '1'].map(
      async (scope) =>
        (await api.v1.chain.get_table_rows({ code: runtime, scope, table: 'ramstats', json: true }))
          .rows,
    ),
  );
}
async function preservedRows() {
  return Promise.all(
    ['daos', 'members', 'actors', 'documents'].map(
      async (table) =>
        (
          await api.v1.chain.get_table_rows({
            code: runtime,
            scope: table === 'daos' ? runtime : '1',
            table,
            json: true,
          })
        ).rows,
    ),
  );
}
beforeAll(async () => {
  unlockFixtureWallet(network.container);
  const pub = key.toPublic().toString();
  cleos([
    'system',
    'newaccount',
    'alice',
    runtime,
    pub,
    pub,
    '--buy-ram-bytes',
    '12582912',
    '--stake-net',
    '1.0000 TLOS',
    '--stake-cpu',
    '1.0000 TLOS',
    '-p',
    'alice@active',
  ]);
  cleos([
    'set',
    'contract',
    runtime,
    '/work/.artifacts/observer-upgrade-old',
    'runtime.wasm',
    'runtime.abi',
    '-p',
    runtime + '@active',
  ]);
  cleos([
    'set',
    'account',
    'permission',
    runtime,
    'active',
    '--add-code',
    '-p',
    runtime + '@active',
  ]);
  await act('initramobs', {});
  await act('init', { chain_id: network.chainId });
  await act(
    'createdao',
    {
      dao_id: '1',
      owner: 'alice',
      metadata: '{"title":"Owned observer upgrade"}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  const encryption = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  await act(
    'enroll',
    {
      dao_id: '1',
      member_id: '1',
      native_account: 'alice',
      signing_key: pub,
      encryption_key: JSON.stringify(encryption),
      custody: 0,
    },
    'alice',
  );
  await act('putjson', {
    runtime,
    dao_id: '1',
    member_id: '1',
    document_id: '7',
    version: 1,
    value: '{"retained":"original document"}',
    envelope_version: 0,
    key_epoch: '0',
  });
});
it('requires reviewed old/new hashes and native runtime authority, preserving observer counters across code replacement', async () => {
  expect(oldHash).not.toBe(newHash);
  expect(abi.actions.some((action) => action.name.toString() === 'rebindramobs')).toBe(true);
  const before = await observer(),
    measured = await counters(),
    existing = await preservedRows();
  cleos([
    'set',
    'contract',
    runtime,
    '/work/.artifacts/contracts',
    'runtime.wasm',
    'runtime.abi',
    '-p',
    runtime + '@active',
  ]);
  const policy = {
    native_ram_bps: 500,
    card_ram_bps: 2000,
    included_activity_bytes: '262144',
    identity_bytes_per_slot: '2048',
    quote_lifetime_seconds: 300,
    storage_free_bytes: '100000000',
    storage_unit_bytes: '1000000000',
    storage_monthly_usd: 100,
  };
  await expect(act('setresources', policy)).rejects.toThrow('RAM_SOURCE_CODE');
  const intent = { expected_old_hash: oldHash, expected_new_hash: newHash };
  await expect(act('rebindramobs', intent, 'alice')).rejects.toThrow();
  await expect(
    act('rebindramobs', { ...intent, expected_old_hash: '00'.repeat(32) }),
  ).rejects.toThrow('RAM_OBSERVER_CHANGED');
  await expect(act('rebindramobs', { ...intent, expected_new_hash: oldHash })).rejects.toThrow(
    'RAM_SOURCE_CODE',
  );
  expect(await observer()).toEqual(before);
  expect(await counters()).toEqual(measured);
  expect(await preservedRows()).toEqual(existing);
  await act('rebindramobs', intent);
  expect(await counters()).toEqual(measured);
  expect(await preservedRows()).toEqual(existing);
  const old = z
    .array(z.object({ meter_bytes: z.union([z.string(), z.number()]), runtime_hash: z.string() }))
    .parse(before)[0];
  if (!old) throw new Error('Missing observer');
  expect(await observer()).toEqual([{ ...old, runtime_hash: newHash }]);
  await expect(act('rebindramobs', intent)).rejects.toThrow('RAM_OBSERVER_CHANGED');
  await act('setresources', policy);
  const rows = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: runtime,
    table: 'resourcecfg',
    json: true,
  });
  expect(
    z.array(z.object({ native_ram_bps: z.number() })).parse(rows.rows)[0]?.native_ram_bps,
  ).toBe(500);
});
