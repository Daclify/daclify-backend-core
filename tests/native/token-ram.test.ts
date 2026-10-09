import { beforeAll, expect, it } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { RuntimeTableSchemas } from '../../sdk/index.js';
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
  } catch (error) {
    const output = z.object({ stdout: z.string().optional() }).safeParse(error);
    if (output.success && output.data.stdout) {
      const value: unknown = JSON.parse(output.data.stdout);
      const failure = z
        .object({ processed: z.object({ except: z.object({ name: z.string() }) }) })
        .safeParse(value);
      if (failure.success)
        throw new Error('OWNED_TOKEN_PROBE_REJECTED: ' + failure.data.processed.except.name);
    }
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
let sourceCommit = '';
beforeAll(async () => {
  const infoResponse = await fetch(network.url + '/v1/chain/get_info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  expect(z.object({ chain_id: z.string() }).parse(await infoResponse.json()).chain_id).toBe(
    network.chainId,
  );
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
  sourceCommit = pins.commit;
});
it('measures sender-paid first balances, existing source payer transfer, recipient reopening and preopened payouts on the actual reference token', async () => {
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
        sourceCommit,
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

it('finishes a real Daclify internal claim using held RAM even when the reference token creates sender-paid rows', async () => {
  const runtime = 'rmcore' + suffix;
  cleos([
    'system',
    'newaccount',
    'alice',
    runtime,
    fixtureKey('alice').toPublic().toString(),
    fixtureKey('alice').toPublic().toString(),
    '--buy-ram-bytes',
    '16777216',
    '--stake-net',
    '10.0000 TLOS',
    '--stake-cpu',
    '10.0000 TLOS',
  ]);
  for (const [account, contract] of [
    [runtime, 'runtime'],
    [sender, 'modrelay'],
  ] as const) {
    cleos([
      'set',
      'contract',
      account,
      '/work/.artifacts/contracts',
      contract + '.wasm',
      contract + '.abi',
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
  }
  const core = (name: string, data: unknown[], actor = runtime) =>
    cleos(['push', 'action', runtime, name, JSON.stringify(data), '-p', actor + '@active']);
  const source = (name: string, data: unknown[]) =>
    cleos(['push', 'action', sender, name, JSON.stringify(data), '-p', sender + '@active']);
  const sourceHash = createHash('sha256')
    .update(readFileSync('.artifacts/contracts/modrelay.wasm'))
    .digest('hex');
  core('init', [network.chainId]);
  core('initramobs', []);
  core('setramcode', [sender, sourceHash]);
  core('setfees', [500, 10000, 'alice', 'eosio.token', '4,TLOS', '']);
  core('listmod', [sender, 'alice', 0, 1, '0.0000 TLOS', sourceHash, 'Owned receipt calibration']);
  core('createdao', [1, 'alice', '{}', 0, token, '4,RAMT'], 'alice');
  core(
    'enroll',
    [1, 1, '', fixtureKey('alice').toPublic().toString(), 'owned receipt calibration', 0],
    'alice',
  );
  core('setmodule', [1, sender, 1, [], ['reserve', 'approve'], sourceHash], 'alice');
  action(
    'transfer',
    { from: 'alice', to: runtime, quantity: '2.0000 RAMT', memo: 'dao:1' },
    'alice',
  );
  source('reserve', [runtime, 1, 1, 1, '1.0000 RAMT', 0]);
  source('approveob', [runtime, 1, 1]);
  const accepted = await used(runtime);
  core('payob', [1, sender, 1], 'alice');
  const claimed = await used(runtime);
  expect(claimed).toBeLessThan(accepted);
  cleos([
    'push',
    'action',
    'eosio',
    'setacctram',
    JSON.stringify([runtime, claimed + 1024]),
    '-p',
    'eosio@active',
  ]);
  const physicalBeforeWithdrawal = await used(runtime);
  cleos([
    'push',
    'action',
    'eosio',
    'setacctram',
    JSON.stringify([runtime, physicalBeforeWithdrawal]),
    '-p',
    'eosio@active',
  ]);
  expect(await used(runtime)).toBe(physicalBeforeWithdrawal);
  let withdrawn: number;
  try {
    expect(() => core('withdraw', [runtime, 1, 1, receiver, '0.2500 RAMT'])).toThrow(
      'ram_usage_exceeded',
    );
    expect(await used(runtime)).toBe(physicalBeforeWithdrawal);
    const response = await fetch(network.url + '/v1/chain/get_table_rows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: runtime, scope: '1', table: 'members', json: true, limit: 1 }),
    });
    const member = z
      .object({ rows: z.array(RuntimeTableSchemas.members) })
      .parse(await response.json()).rows[0];
    expect(member?.claim).toBe('10000');
    core('withdraw', [runtime, 1, 1, receiver, '1.0000 RAMT']);
    withdrawn = await used(runtime);
  } finally {
    cleos([
      'push',
      'action',
      'eosio',
      'setacctram',
      JSON.stringify([runtime, null]),
      '-p',
      'eosio@active',
    ]);
  }
  expect(withdrawn).toBeLessThan(claimed);
  expect(withdrawn - physicalBeforeWithdrawal).toBe(-310);
  writeFileSync(
    '.artifacts/native-reference-claim.json',
    JSON.stringify(
      {
        runtime,
        token,
        receiver,
        runtimeCodeHash: createHash('sha256')
          .update(readFileSync('.artifacts/contracts/runtime.wasm'))
          .digest('hex'),
        tokenCodeHash: createHash('sha256')
          .update(readFileSync('.artifacts/reference-token/reference.wasm'))
          .digest('hex'),
        acceptedBytes: accepted,
        claimBytes: claimed,
        withdrawnBytes: withdrawn,
        settlementDeltaBytes: claimed - accepted,
        fullClaimDeltaBytes: withdrawn - physicalBeforeWithdrawal,
        physicalQuotaAtWithdrawalBytes: physicalBeforeWithdrawal,
        managedQuotaControlBytes: physicalBeforeWithdrawal - claimed,
        partialWithdrawalRejectedAtPhysicalQuota: true,
        limitations: [
          'Owned native reference token only; Telos token code is not qualified.',
          'Exact finite managed quota is an exhaustion fixture; native RAM purchases reject managed accounts.',
          'External sender-paid rows remain outside the Daclify contract-record counter.',
          'Quota enforcement and legacy holds remain disabled/unimplemented.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
}, 60000);
