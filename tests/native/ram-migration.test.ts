import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  ABI,
  Action,
  APIClient,
  Transaction,
  SignedTransaction,
  Serializer,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { Uint64Schema } from '../../protocol/base.js';
const NativeUint64 = z.preprocess(
  (value) => (typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value),
  Uint64Schema,
);
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const account =
  'rammig' +
  Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join('');
const key = fixtureKey('alice'),
  api = new APIClient({ url: network.url });
const abi = ABI.from(readFileSync('.artifacts/contracts/migprobe.abi', 'utf8'));
const max = '18446744073709551615';
let baseline = 0n,
  control = 0n,
  sequence = 0;
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('OWNED_MIGRATION_FIXTURE_REJECTED');
  }
}
async function push(name: string, data: Record<string, unknown>, target = account) {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const tx = Transaction.from({
    ...info.getTransactionHeader(60 + sequence++),
    actions: [
      Action.from(
        { account: target, name, authorization: [{ actor: target, permission: 'active' }], data },
        abi,
      ),
    ],
  });
  const result = await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...tx,
      signatures: [key.signDigest(tx.signingDigest(network.chainId))],
    }),
  );
  executedChainResult(result, tx.id.toString());
}
async function used(target = account) {
  return BigInt((await api.v1.chain.get_account(target)).ram_usage.toString());
}
async function rows(table: string, target = account) {
  const result = await api.v1.chain.get_table_rows({
    code: target,
    scope: target,
    table,
    json: true,
    limit: 100,
  });
  if (result.more) throw new Error('MIGRATION_FIXTURE_COVERAGE');
  return result.rows;
}
async function reconcile() {
  const totals = await rows('totals');
  const accounted = z
    .array(z.object({ bytes: NativeUint64 }))
    .parse(totals)
    .reduce((n, r) => n + BigInt(r.bytes), 0n);
  const type = abi.tables.find((t) => t.name.toString() === 'totals')?.type;
  if (!type) throw new Error('MIGRATION_COUNTER_ABI_REQUIRED');
  const counterMetadata = totals.reduce(
    (n: bigint, value: unknown) =>
      n + BigInt(Serializer.encode({ abi, type, object: value }).array.length + 112),
    112n,
  );
  expect((await used()) - baseline - control).toBe(accounted + counterMetadata);
}
beforeAll(async () => {
  unlockFixtureWallet(network.container);
  const pub = key.toPublic().toString();
  cleos([
    'system',
    'newaccount',
    'alice',
    account,
    pub,
    pub,
    '--buy-ram-bytes',
    '8388608',
    '--stake-net',
    '1.0000 TLOS',
    '--stake-cpu',
    '1.0000 TLOS',
  ]);
  cleos([
    'set',
    'contract',
    account,
    '/work/.artifacts/contracts',
    'migprobe.wasm',
    'migprobe.abi',
    '-p',
    account + '@active',
  ]);
  cleos([
    'set',
    'account',
    'permission',
    account,
    'active',
    '--add-code',
    '-p',
    account + '@active',
  ]);
  baseline = await used();
  for (const [id, dao_id, payload] of [
    ['0', '1', 'zero'],
    ['7', '1', 'middle'],
    ['99', '2', 'last'],
    [max, '2', 'maximum'],
  ])
    await push('seed', { id, dao_id, payload });
  const before = await used();
  await push('begin', {});
  control = (await used()) - before;
}, 20000);
it('reconciles resumable backfill, protected overlays, deletion and uint64 maximum against native billing', async () => {
  await push('edit', { id: '7', payload: 'ą'.repeat(128) });
  await push('remove', { id: '99' });
  await push('backfill', { limit: 1 });
  await push('edit', { id: '7', payload: 'changed again' });
  await push('backfill', { limit: 1 });
  await push('backfill', { limit: 1 });
  await reconcile();
  expect(await rows('ramoverlays')).toEqual([]);
  const samples = z
    .array(z.object({ id: NativeUint64, payload: z.string() }))
    .parse(await rows('samples'));
  expect(samples.map((r) => r.id)).toEqual(['0', '7', max]);
  expect(samples.find((r) => r.id === '7')?.payload).toBe('changed again');
  const beforeRetry = await used(),
    beforeCounters = await rows('totals');
  await push('backfill', { limit: 1 });
  expect(await used()).toBe(beforeRetry);
  expect(await rows('totals')).toEqual(beforeCounters);
});
it('releases the last data header after completion while retaining stable progress and no phantom bytes', async () => {
  for (const id of ['0', '7', max]) await push('remove', { id });
  expect(await rows('samples')).toEqual([]);
  await reconcile();
  const before = await used();
  await push('backfill', { limit: 25 });
  expect(await used()).toBe(before);
});
it('reconciles the shared wrapper through protected changes, singleton shrink and blocked ordinary growth', async () => {
  const target = 'wramig' + account.slice(6),
    pub = key.toPublic().toString();
  cleos([
    'system',
    'newaccount',
    'alice',
    target,
    pub,
    pub,
    '--buy-ram-bytes',
    '8388608',
    '--stake-net',
    '1.0000 TLOS',
    '--stake-cpu',
    '1.0000 TLOS',
  ]);
  cleos([
    'set',
    'contract',
    target,
    '/work/.artifacts/contracts',
    'migprobe.wasm',
    'migprobe.abi',
    '-p',
    target + '@active',
  ]);
  cleos(['set', 'account', 'permission', target, 'active', '--add-code', '-p', target + '@active']);
  const initial = await used(target);
  await push('wseed', {}, target);
  const seeded = await used(target);
  await push('wbegin', {}, target);
  const controls = (await used(target)) - seeded;
  await push('wedit', { id: '7', label: 'ą'.repeat(128) }, target);
  await push('wnew', { id: '8' }, target);
  await push('wremove', { id: '0' }, target);
  await push('wconfig', { label: 'x' }, target);
  const beforeFailure = await used(target);
  await expect(push('wordinary', { kind: 1 }, target)).rejects.toThrow();
  expect(await used(target)).toBe(beforeFailure);
  await push('wbackfill', { limit: 1 }, target);
  await push('wedit', { id: '7', label: 'changed again' }, target);
  await push('wbackfill', { limit: 25 }, target);
  await push('wcfgfill', {}, target);
  await push('wotherfill', {}, target);
  const totals = await rows('totals', target),
    type = abi.tables.find((t) => t.name.toString() === 'totals')?.type;
  if (!type) throw new Error('MIGRATION_COUNTER_ABI_REQUIRED');
  const accounted = z
    .array(z.object({ bytes: NativeUint64 }))
    .parse(totals)
    .reduce((n, r) => n + BigInt(r.bytes), 0n);
  const counterMetadata = totals.reduce(
    (n: bigint, value: unknown) =>
      n + BigInt(Serializer.encode({ abi, type, object: value }).array.length + 112),
    112n,
  );
  expect((await used(target)) - initial - controls).toBe(accounted + counterMetadata);
  const beforeRetry = await used(target);
  await push('wbackfill', { limit: 25 }, target);
  await push('wcfgfill', {}, target);
  await push('wotherfill', {}, target);
  expect(await used(target)).toBe(beforeRetry);
});
