import { expect, it } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const suffix = Array.from(randomBytes(6), (byte) =>
    '12345abcdefghijklmnopqrstuvwxyz'.charAt(byte % 31),
  ).join(''),
  token = 'rmtokn' + suffix,
  sender = 'rmpayr' + suffix,
  receiver = 'rmrcvr' + suffix,
  opened = 'rmopen' + suffix;
function cleos(args: string[]) {
  try {
    const text = execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
        ...(args[0] === 'push' ? ['-j', '--force-unique'] : []),
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (args[0] === 'push') {
      const data: unknown = JSON.parse(text);
      executedChainResult(
        data,
        z.object({ transaction_id: z.string() }).parse(data).transaction_id,
      );
    }
  } catch {
    throw new Error('OWNED_TOKEN_PROBE_REJECTED');
  }
}
function action(name: string, data: object, actor: string) {
  cleos(['push', 'action', token, name, JSON.stringify(data), '-p', actor + '@active']);
}
async function used(account: string) {
  const response = await fetch(network.url + '/v1/chain/get_account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  if (!response.ok) throw new Error('OWNED_TOKEN_PROBE_QUERY');
  return z
    .object({ ram_usage: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
    .parse(await response.json()).ram_usage;
}
it('measures sender-paid first balances, existing source payer transfer, recipient reopening and preopened payouts on the actual reference token', async () => {
  const pins = z
    .object({ commit: z.literal('c526479a48370981a1e9f0ac6b3bb0e4f737afa2') })
    .parse(JSON.parse(readFileSync('.artifacts/reference-token/source-pins.json', 'utf8')));
  unlockFixtureWallet(network.container);
  for (const account of [token, sender, receiver, opened])
    cleos([
      'system',
      'newaccount',
      'alice',
      account,
      fixtureKey('alice').toPublic().toString(),
      fixtureKey('alice').toPublic().toString(),
      '--buy-ram-bytes',
      '4194304',
      '--stake-net',
      '10.0000 TLOS',
      '--stake-cpu',
      '10.0000 TLOS',
    ]);
  cleos([
    'set',
    'contract',
    token,
    '/work/.artifacts/reference-token',
    'reference.wasm',
    'reference.abi',
    '-p',
    token + '@active',
  ]);
  action('create', { issuer: 'alice', maximum_supply: '1000000.0000 RAMT' }, token);
  action('issue', { to: 'alice', quantity: '100.0000 RAMT', memo: 'owned calibration' }, 'alice');
  action(
    'transfer',
    { from: 'alice', to: sender, quantity: '10.0000 RAMT', memo: 'owned calibration' },
    'alice',
  );
  const accounts = [sender, receiver, opened, token],
    snapshot = async () =>
      Object.fromEntries(
        await Promise.all(accounts.map(async (account) => [account, await used(account)])),
      ),
    before = await snapshot();
  action(
    'transfer',
    { from: sender, to: receiver, quantity: '1.0000 RAMT', memo: 'first receiver' },
    sender,
  );
  const first = await snapshot();
  // 128 existing-source row bytes change payer; 128 new balance + 112 scope header are sender paid.
  expect((first[sender] ?? 0) - (before[sender] ?? 0)).toBe(368);
  expect(first[receiver]).toBe(before[receiver]);
  action(
    'transfer',
    { from: sender, to: receiver, quantity: '1.0000 RAMT', memo: 'existing receiver' },
    sender,
  );
  const second = await snapshot();
  expect(second).toEqual(first);
  action(
    'transfer',
    { from: receiver, to: sender, quantity: '2.0000 RAMT', memo: 'return before closing' },
    receiver,
  );
  const returned = await snapshot();
  expect((returned[sender] ?? 0) - (second[sender] ?? 0)).toBe(-128);
  expect((returned[receiver] ?? 0) - (second[receiver] ?? 0)).toBe(128);
  action('close', { owner: receiver, symbol: '4,RAMT' }, receiver);
  const closed = await snapshot();
  expect((closed[sender] ?? 0) - (returned[sender] ?? 0)).toBe(-112);
  expect((closed[receiver] ?? 0) - (returned[receiver] ?? 0)).toBe(-128);
  action('open', { owner: opened, symbol: '4,RAMT', ram_payer: opened }, opened);
  const preopened = await snapshot();
  action(
    'transfer',
    { from: sender, to: opened, quantity: '1.0000 RAMT', memo: 'receiver-funded row' },
    sender,
  );
  expect(await snapshot()).toEqual(preopened);
  writeFileSync(
    '.artifacts/native-token-ram.json',
    JSON.stringify(
      {
        sourceCommit: pins.commit,
        codeHash: createHash('sha256')
          .update(readFileSync('.artifacts/reference-token/reference.wasm'))
          .digest('hex'),
        token,
        sender,
        receiver,
        opened,
        before,
        first,
        second,
        returned,
        closed,
        preopened,
        firstSenderDeltaBytes: 368,
        limits: [
          'Owned native fixture and pinned official reference token; not Telos token code qualification.',
          'Direct token actions calibrate external payer behavior; Daclify payout tracking/reserves still require integration.',
          'Receiver transfer/close can move or release sender-paid bytes outside Daclify callbacks.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
}, 60000);
