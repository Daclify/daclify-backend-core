import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';

const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
function cleos(args: string[]): string {
  try {
    const result = execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
        ...(args[0] === 'push' ? ['-j'] : []),
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (args[0] === 'push') {
      const raw: unknown = JSON.parse(result);
      const rejected = z
        .object({ processed: z.object({ except: z.object({ code: z.literal(3050007) }) }) })
        .safeParse(raw);
      if (rejected.success) throw new Error('NATIVE_QUOTA_PRIVILEGED');
      const expected = z.object({ transaction_id: z.string() }).parse(raw).transaction_id;
      executedChainResult(raw, expected);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === 'NATIVE_QUOTA_PRIVILEGED') throw error;
    if (
      error instanceof Error &&
      (('stderr' in error && String(error.stderr).includes('unaccessible_api')) ||
        ('stdout' in error && /"name"\s*:\s*"unaccessible_api"/.test(String(error.stdout))))
    )
      throw new Error('NATIVE_QUOTA_PRIVILEGED');
    throw new Error('NATIVE_RAM_PROBE_REJECTED');
  }
}
function push(action: string, data: unknown[], actor = 'permprobe') {
  cleos(['push', 'action', 'permprobe', action, JSON.stringify(data), '-p', actor + '@active']);
}
async function ram(account = 'permprobe') {
  const response = await fetch(network.url + '/v1/chain/get_account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  if (!response.ok) throw new Error('NATIVE_RAM_QUERY_FAILED');
  return z.object({ ram_usage: z.number().int().nonnegative() }).parse(await response.json())
    .ram_usage;
}
it('rejects privileged quota intrinsics from an ordinary application contract', async () => {
  const response = await fetch(network.url + '/v1/chain/get_account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: 'permprobe' }),
  });
  if (!response.ok) throw new Error('NATIVE_QUOTA_QUERY_FAILED');
  const account = z.object({ ram_quota: z.number().int() }).parse(await response.json());
  expect(() => push('checkquota', ['permprobe', account.ram_quota])).toThrow(
    'NATIVE_QUOTA_PRIVILEGED',
  );
});
beforeAll(() => {
  unlockFixtureWallet(network.container);
  cleos([
    'set',
    'contract',
    'permprobe',
    '/work/.artifacts/contracts',
    'ramprobe.wasm',
    'ramprobe.abi',
    '-p',
    'permprobe@active',
  ]);
});
it('reconciles primary/index/header billing, UTF-8 payloads, growth, shrink and last-row deletion', async () => {
  const initial = await ram();
  const rowOverhead = 112 + 128 + 144 + 160;
  const headers = 3 * 112;
  push('put', [1, 1, 'ab'.repeat(127)]);
  push('checkcost', [1, rowOverhead + 8 + 8 + 1 + 127, headers]);
  expect((await ram()) - initial).toBe(rowOverhead + 8 + 8 + 1 + 127 + headers);
  const first = await ram();
  push('put', [1, 2, 'ab'.repeat(128)]);
  expect((await ram()) - first).toBe(2);
  const updated = await ram();
  push('put', [2, 3, Buffer.from('ą'.repeat(64)).toString('hex')]);
  expect((await ram()) - updated).toBe(rowOverhead + 8 + 8 + 2 + 128);
  push('put', [1, 2, '']);
  expect(await ram()).toBe(updated - 129 + rowOverhead + 8 + 8 + 2 + 128);
  push('remove', [1, false]);
  expect((await ram()) - initial).toBe(rowOverhead + 8 + 8 + 2 + 128 + headers);
  push('remove', [2, true]);
  expect(await ram()).toBe(initial);
});
it('shows that a contract can charge a foreign payer when its action supplies that payer authority', async () => {
  const before = await ram('alice');
  cleos([
    'push',
    'action',
    'permprobe',
    'foreign',
    JSON.stringify(['alice', 10]),
    '-p',
    'permprobe@active',
    '-p',
    'alice@active',
  ]);
  expect((await ram('alice')) - before).toBe(112 + 112 + 8);
  push('foreignrm', [10]);
  expect(await ram('alice')).toBe(before);
});
