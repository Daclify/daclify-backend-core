import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { Name, TimePointSec } from '@greymass/eosio';
import { loadContract, row, send } from './helpers/vert.js';
import { wasmCodeHash } from './helpers/code-hash.js';
import { encodeQuickAnchor, QuickAuthTableSchemas } from '../sdk/quick-accounts.js';

const runtime = 'daclifycore1',
  authority = 'quickauth',
  chainId = 'ab'.repeat(32);
const scope = BigInt(Name.from(runtime).value.toString());
let chain: Blockchain, core: ReturnType<typeof loadContract>, auth: ReturnType<typeof loadContract>;
const now = () => Math.floor(chain.timestamp.toMilliseconds() / 1000);
function registration(account: string) {
  return {
    version: 1,
    chain_id: chainId,
    runtime,
    authority,
    anchor: encodeQuickAnchor({ kind: 'native', account, permission: 'active' }),
    account_id: '0',
    epoch: '0',
    expires: now() + 120,
  };
}
async function register(account: string) {
  await send(auth, 'qregister', { request: registration(account), proof: '' }, [
    'gateway@active',
    `${account}@active`,
  ]);
}
async function deactivate(account: string, id = 1n) {
  const value = QuickAuthTableSchemas.qaccounts.parse(row(auth, 'qaccounts', scope, id));
  const request = {
    ...registration(account),
    account_id: value.id,
    epoch: value.epoch,
    nonce: value.nonce,
    use_default: false,
  };
  await send(auth, 'qdeactivate', { request, proof: '' }, ['gateway@active', `${account}@active`]);
}
const prune = (ids: string[]) => send(auth, 'qprune', { runtime, ids }, 'bob@active');
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'gateway');
  core = loadContract(chain, runtime, '.artifacts/contracts/runtime');
  auth = loadContract(chain, authority, '.artifacts/contracts/quickauth');
  loadContract(chain, 'quickprobe', '.artifacts/contracts/quickprobe');
  await send(core, 'init', { chain_id: chainId }, `${runtime}@active`);
  await send(
    auth,
    'qconfig',
    {
      runtime,
      source: 'quickprobe',
      code_hash: wasmCodeHash('.artifacts/contracts/quickprobe.wasm'),
      gateway: { actor: 'gateway', permission: 'active' },
      maximum: 2,
    },
    [`${runtime}@active`, `${authority}@active`],
  );
  await register('alice');
});

it('reclaims only inactive accounts at the exact thirty-day boundary', async () => {
  await expect(prune(['1'])).rejects.toThrow('QUICK_RETENTION');
  await deactivate('alice');
  chain.addTime(TimePointSec.from(30 * 86400 - 1));
  await expect(prune(['1'])).rejects.toThrow('QUICK_RETENTION');
  expect(row(auth, 'qaccounts', scope, 1n)).toBeDefined();
  chain.addTime(TimePointSec.from(1));
  await prune(['1']);
  expect(row(auth, 'qaccounts', scope, 1n)).toBeUndefined();
  await prune(['1']);
  expect(QuickAuthTableSchemas.qcfg.parse(row(auth, 'qcfg', scope, 0n)).records).toBe(0);
});

it('preserves the stable identity and high-water mark after cleanup and registration', async () => {
  const before = QuickAuthTableSchemas.qaccounts.parse(row(auth, 'qaccounts', scope, 1n));
  await deactivate('alice');
  chain.addTime(TimePointSec.from(30 * 86400));
  await prune(['1']);
  await register('alice');
  const after = QuickAuthTableSchemas.qaccounts.parse(row(auth, 'qaccounts', scope, 2n));
  expect(after.identity).toBe(before.identity);
  expect(after.id).not.toBe(before.id);
  expect(QuickAuthTableSchemas.qcfg.parse(row(auth, 'qcfg', scope, 0n))).toMatchObject({
    records: 1,
    next_id: '3',
  });
});

it('rejects unbounded cleanup and rolls a mixed invalid batch back', async () => {
  await register('bob');
  await deactivate('alice');
  chain.addTime(TimePointSec.from(30 * 86400));
  await expect(prune([])).rejects.toThrow('QUICK_BATCH');
  await expect(prune(Array.from({ length: 26 }, (_, i) => String(i + 1)))).rejects.toThrow(
    'QUICK_BATCH',
  );
  await expect(prune(['1', '2'])).rejects.toThrow('QUICK_RETENTION');
  expect(row(auth, 'qaccounts', scope, 1n)).toBeDefined();
  expect(QuickAuthTableSchemas.qcfg.parse(row(auth, 'qcfg', scope, 0n)).records).toBe(2);
  await prune(['1', '1']);
  expect(QuickAuthTableSchemas.qcfg.parse(row(auth, 'qcfg', scope, 0n)).records).toBe(1);
});

it('pins the original runtime and requires both owners to change configuration', async () => {
  const request = {
    runtime,
    source: 'quickprobe',
    code_hash: wasmCodeHash('.artifacts/contracts/quickprobe.wasm'),
    gateway: { actor: 'gateway', permission: 'active' },
    maximum: 2,
  };
  await expect(send(auth, 'qconfig', request, `${authority}@active`)).rejects.toThrow();
  await expect(send(auth, 'qconfig', request, `${runtime}@active`)).rejects.toThrow();
  await expect(prune(['9'].map(String))).resolves.toBeUndefined();
  await expect(
    send(auth, 'qprune', { runtime: 'othercore', ids: ['1'] }, 'bob@active'),
  ).rejects.toThrow('RAM_PAYER_RUNTIME');
});

it('backfills the bound companion tables with bounded repeatable kind-eight scans', async () => {
  await expect(send(auth, 'checkmig', { runtime, kind: 7 }, `${runtime}@active`)).rejects.toThrow(
    'RAM_MIGRATION_SOURCE_KIND',
  );
  await send(
    core,
    'beginram',
    {
      sources: [
        {
          account: authority,
          kind: 8,
          code_hash: wasmCodeHash('.artifacts/contracts/quickauth.wasm'),
        },
      ],
    },
    `${runtime}@active`,
  );
  for (const table of ['rampayer', 'qcfg', 'qaccounts']) {
    await send(auth, 'scanram', { runtime, table, limit: 1 }, `${runtime}@active`);
    await send(auth, 'scanram', { runtime, table, limit: 1 }, `${runtime}@active`);
  }
  expect(row(auth, 'qaccounts', scope, 1n)).toMatchObject({ active: true });
  await expect(
    send(auth, 'scanram', { runtime, table: 'qaccounts', limit: 26 }, `${runtime}@active`),
  ).rejects.toThrow('RAM_MIGRATION_BATCH');
  await expect(
    send(auth, 'scanram', { runtime, table: 'members', limit: 1 }, `${runtime}@active`),
  ).rejects.toThrow('RAM_MIGRATION_TABLE');
});
