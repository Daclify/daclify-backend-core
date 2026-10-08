import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import {
  ABI,
  APIClient,
  APIError,
  Action,
  Transaction,
  SignedTransaction,
  Name,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { RamUsageSchema, resourcePolicyFromRow } from '../../protocol/resources.js';
import { nativeRamQuote } from '../../services/api/src/resources/native-quote.js';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const account = (prefix: string) =>
  prefix + Array.from(randomBytes(6), (n) => '12345abcdefghijklmnopqrstuvwxyz'[n % 31]).join('');
const runtime = account('rambuy'),
  receiver = account('rammod');
const key = fixtureKey('alice'),
  api = new APIClient({ url: network.url });
const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
const tokenAbi = ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8'));
const receiverHash = createHash('sha256')
  .update(readFileSync('.artifacts/contracts/ramprobe.wasm'))
  .digest('hex');
let sequence = 0;
const evidence: Record<string, unknown> = {
  chainId: network.chainId,
  systemCodeHash: '48d74c3df9f5c9952c0f87ab6c01e1c6dfe621429f59932ecf609b5d81e668e4',
  runtimeCodeHash: createHash('sha256')
    .update(readFileSync('.artifacts/contracts/runtime.wasm'))
    .digest('hex'),
};
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('OWNED_RAM_PURCHASE_FIXTURE_REJECTED');
  }
}
function action(name: string, data: Record<string, unknown>, actor = runtime) {
  return Action.from(
    { account: runtime, name, authorization: [{ actor, permission: 'active' }], data },
    abi,
  );
}
function transfer(reference: string, quantity = '2.0000 TLOS', token = 'eosio.token') {
  return Action.from(
    {
      account: token,
      name: 'transfer',
      authorization: [{ actor: 'alice', permission: 'active' }],
      data: { from: 'alice', to: runtime, quantity, memo: 'ram:' + reference },
    },
    tokenAbi,
  );
}
async function push(actions: Action[]) {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const tx = Transaction.from({ ...info.getTransactionHeader(60 + sequence++), actions });
  try {
    const result = await api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...tx,
        signatures: [
          ...new Map(
            actions
              .flatMap((a) =>
                a.authorization.map((auth) =>
                  auth.actor.toString() === 'bob' ? fixtureKey('bob') : key,
                ),
              )
              .map((k) => [k.toPublic().toString(), k]),
          ).values(),
        ].map((k) => k.signDigest(tx.signingDigest(network.chainId))),
      }),
    );
    executedChainResult(result, tx.id.toString());
  } catch (error) {
    const details = z
      .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
      .safeParse(error instanceof APIError ? error.response.json : undefined);
    for (const detail of details.success ? details.data.error.details : []) {
      const code = detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
      if (code) throw new Error(code);
    }
    throw new Error('NATIVE_RAM_PURCHASE_REJECTED');
  }
}
async function rows(table: string, scope = runtime) {
  return (
    await api.v1.chain.get_table_rows({ code: runtime, scope, table, json: true, limit: 100 })
  ).rows;
}
async function quota(account: string) {
  return (await api.v1.chain.get_account(account)).ram_quota.toString();
}
async function balance(account: string) {
  return (
    (
      await api.v1.chain.get_currency_balance('eosio.token', account, 'TLOS')
    )[0]?.units.toString() ?? '0'
  );
}
const ref = () => randomBytes(32).toString('hex');
const byAccount = (a: { receiver: string }, b: { receiver: string }) =>
  BigInt(Name.from(a.receiver).value.toString()) < BigInt(Name.from(b.receiver).value.toString())
    ? -1
    : 1;
async function order(reference: string, minimum = '1', revision = '1', expires?: number) {
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  return action(
    'orderram',
    {
      dao_id: '1',
      payer: 'alice',
      reference,
      policy_revision: revision,
      maximum: '2.0000 TLOS',
      expires: expires ?? now + 120,
      purchases: [
        { receiver: runtime, quantity: '1.0000 TLOS', minimum_bytes: '1' },
        { receiver, quantity: '0.5000 TLOS', minimum_bytes: minimum },
      ].sort(byAccount),
    },
    'alice',
  );
}
beforeAll(async () => {
  expect(abi.actions.some((a) => a.name.toString() === 'orderram')).toBe(true);
  unlockFixtureWallet(network.container);
  for (const [name, contract] of [
    [runtime, 'runtime'],
    [receiver, 'ramprobe'],
  ]) {
    if (!name || !contract) throw new Error('FIXTURE_ACCOUNT_MISSING');
    cleos([
      'system',
      'newaccount',
      'alice',
      name,
      key.toPublic().toString(),
      key.toPublic().toString(),
      '--buy-ram-bytes',
      '8388608',
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
      name,
      '/work/.artifacts/contracts',
      contract + '.wasm',
      contract + '.abi',
      '-p',
      name + '@active',
    ]);
    cleos(['set', 'account', 'permission', name, 'active', '--add-code', '-p', name + '@active']);
  }
  await push([action('initramobs', {}), action('init', { chain_id: network.chainId })]);
  await push([
    action('setfees', {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'bob',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    }),
    action('setresources', {
      native_ram_bps: 500,
      card_ram_bps: 2000,
      included_activity_bytes: '262144',
      identity_bytes_per_slot: '2048',
      quote_lifetime_seconds: 300,
      storage_free_bytes: '100000000',
      storage_unit_bytes: '1000000000',
      storage_monthly_usd: 100,
    }),
    action('setramcode', { account: receiver, code_hash: receiverHash }),
    action('listmod', {
      account: receiver,
      publisher: 'bob',
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: receiverHash,
      title: 'Owned RAM receiver',
    }),
  ]);
  await push([
    action(
      'createdao',
      {
        dao_id: '1',
        owner: 'alice',
        metadata: '{}',
        privacy: 0,
        token_contract: 'eosio.token',
        token_symbol: '4,TLOS',
      },
      'alice',
    ),
    action(
      'setmodule',
      {
        dao_id: '1',
        account: receiver,
        version: 1,
        actions: ['put'],
        grants: [],
        code_hash: receiverHash,
      },
      'alice',
    ),
  ]);
});
it('credits only actual acquired native RAM, takes the sole 5% fee and refunds change', async () => {
  const reference = ref();
  const before = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
    balance(runtime),
  ]);
  await push([await order(reference), transfer(reference)]);
  const after = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
    balance(runtime),
  ]);
  const credits = z.array(RuntimeTableSchemas.ramalloc).parse(await rows('ramalloc', '1'));
  for (const [index, payer] of [runtime, receiver].entries())
    expect(BigInt(credits.find((c) => c.payer === payer)?.purchased_bytes ?? '0')).toBe(
      BigInt(after[index] ?? '0') - BigInt(before[index] ?? '0'),
    );
  expect(BigInt(before[2] ?? '0') - BigInt(after[2] ?? '0')).toBe(15750n);
  expect(BigInt(after[3] ?? '0') - BigInt(before[3] ?? '0')).toBe(750n);
  expect(after[4]).toBe(before[4]);
  const receipt = z
    .array(RuntimeTableSchemas.ramorders)
    .parse(await rows('ramorders'))
    .find((r) => r.reference === reference);
  expect(receipt).toMatchObject({
    settled: true,
    platform_fee: '0.0750 TLOS',
    spent: '1.5000 TLOS',
  });
  await expect(push([transfer(reference)])).rejects.toThrow('RAM_ORDER_SETTLED');
  await expect(push([await order(reference)])).rejects.toThrow('RAM_ORDER_EXISTS');
  await expect(push([action('finishram', { reference })])).rejects.toThrow('RAM_PURCHASE_SENDER');
  evidence.success = { runtime, receiver, before, after, receipt, actualCredits: credits };
});
it('rolls back both receiver purchases, incoming funds, fees and credits on slippage', async () => {
  const reference = ref();
  const before = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
    balance(runtime),
    rows('ramalloc', '1'),
    rows('ramorders'),
  ]);
  await expect(
    push([await order(reference, '18446744073709551615'), transfer(reference)]),
  ).rejects.toThrow('RAM_ACQUISITION_MINIMUM');
  expect(
    await Promise.all([
      quota(runtime),
      quota(receiver),
      balance('alice'),
      balance('bob'),
      balance(runtime),
      rows('ramalloc', '1'),
      rows('ramorders'),
    ]),
  ).toEqual(before);
  evidence.atomicRollback = true;
});
it('rejects stale policies, expiries, wrong tokens and payment ceilings without buying RAM', async () => {
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  await expect(push([await order(ref(), '1', '0')])).rejects.toThrow('RESOURCE_POLICY_CHANGED');
  await expect(push([await order(ref(), '1', '1', now)])).rejects.toThrow('RAM_QUOTE_EXPIRED');
  const reference = ref();
  const before = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
  ]);
  await expect(push([await order(reference), transfer(reference, '3.0000 TLOS')])).rejects.toThrow(
    'RAM_PAYMENT_RANGE',
  );
  await expect(push([await order(reference), transfer(reference, '0.0100 TLOS')])).rejects.toThrow(
    'RAM_PAYMENT_RANGE',
  );
  await expect(
    push([await order(reference), transfer(reference, '2.0000 TLOS', 'testtoken')]),
  ).rejects.toThrow();
  expect(
    await Promise.all([quota(runtime), quota(receiver), balance('alice'), balance('bob')]),
  ).toEqual(before);
  evidence.paymentBoundaries = true;
});
it('rejects unapproved receivers, duplicate legs and a stale policy after order creation', async () => {
  const reference = ref();
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  const common = {
    dao_id: '1',
    payer: 'alice',
    reference,
    policy_revision: '1',
    maximum: '2.0000 TLOS',
    expires: now + 120,
  };
  await expect(
    push([
      action(
        'orderram',
        {
          ...common,
          purchases: [{ receiver: 'bob', quantity: '1.0000 TLOS', minimum_bytes: '1' }],
        },
        'alice',
      ),
    ]),
  ).rejects.toThrow('RAM_SOURCE_UNKNOWN');
  await expect(
    push([
      action(
        'orderram',
        {
          ...common,
          purchases: [
            { receiver: runtime, quantity: '0.5000 TLOS', minimum_bytes: '1' },
            { receiver: runtime, quantity: '0.5000 TLOS', minimum_bytes: '1' },
          ],
        },
        'alice',
      ),
    ]),
  ).rejects.toThrow('RAM_RECEIVER_ORDER');
  const before = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
    rows('ramalloc', '1'),
  ]);
  const policyChange = action('setresources', {
    native_ram_bps: 1000,
    card_ram_bps: 2000,
    included_activity_bytes: '262144',
    identity_bytes_per_slot: '2048',
    quote_lifetime_seconds: 300,
    storage_free_bytes: '100000000',
    storage_unit_bytes: '1000000000',
    storage_monthly_usd: 100,
  });
  await expect(push([await order(reference), policyChange, transfer(reference)])).rejects.toThrow(
    'RESOURCE_POLICY_CHANGED',
  );
  expect(
    await Promise.all([
      quota(runtime),
      quota(receiver),
      balance('alice'),
      balance('bob'),
      rows('ramalloc', '1'),
    ]),
  ).toEqual(before);
  await push([policyChange]);
  evidence.receiverAndRevisionBoundaries = true;
  writeFileSync(
    'docs/evidence/2026-10-08-ram-purchase.json',
    JSON.stringify(evidence, null, 2) + '\n',
  );
});

it('quotes and atomically pays two real contract payers from the pinned RAM market', async () => {
  const counters = z.array(RuntimeTableSchemas.ramstats).parse(await rows('ramstats', '1'));
  const policy = resourcePolicyFromRow((await rows('resourcecfg'))[0]);
  const payers = await Promise.all(
    [runtime, receiver].map(async (payer) => {
      const account = await api.v1.chain.get_account(payer),
        usage = counters.find((r) => r.payer === payer);
      return {
        payer,
        moduleId: null,
        sourceVerified: true,
        usage: usage
          ? {
              identity: usage.identity,
              activity: usage.activity,
              retained: usage.retained,
              platform: usage.platform,
            }
          : { identity: '0', activity: '0', retained: '0', platform: '0' },
        purchasedBytes: '0',
        globalQuotaBytes: account.ram_quota.toString(),
        globalUsedBytes: account.ram_usage.toString(),
      };
    }),
  );
  const at = new Date().toISOString();
  const usage = RamUsageSchema.parse({
    dao: { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    observation: 'active',
    enforcement: 'disabled',
    policy,
    read: { startedAt: at, completedAt: at, atomic: false },
    totalObservedBytes: payers
      .reduce((n, p) => n + Object.values(p.usage).reduce((t, b) => t + BigInt(b), 0n), 0n)
      .toString(),
    purchasedBytes: '0',
    payers,
  });
  const input = {
    dao: usage.dao,
    payer: 'alice',
    allocations: [
      { receiver: runtime, minimumBytes: '4096' },
      { receiver, minimumBytes: '8192' },
    ],
  };
  const quote = await nativeRamQuote(api, input, usage);
  const before = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
  ]);
  await push([
    action('orderram', quote.order, 'alice'),
    transfer(quote.order.reference, quote.order.maximum),
  ]);
  const after = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance('alice'),
    balance('bob'),
  ]);
  expect(BigInt(after[0] ?? '') - BigInt(before[0] ?? '')).toBeGreaterThanOrEqual(4096n);
  expect(BigInt(after[1] ?? '') - BigInt(before[1] ?? '')).toBeGreaterThanOrEqual(8192n);
  expect(BigInt(before[2] ?? '') - BigInt(after[2] ?? '')).toBe(BigInt(quote.totalUnits));
  expect(BigInt(after[3] ?? '') - BigInt(before[3] ?? '')).toBe(BigInt(quote.feeUnits));
  await expect(
    nativeRamQuote(api, input, {
      ...usage,
      payers: payers.map((p) => ({ ...p, globalQuotaBytes: null })),
    }),
  ).rejects.toThrow('RAM_RECEIVER_UNQUALIFIED');
});

it('fulfills card orders only from a separately funded operator reserve with no native markup', async () => {
  expect(abi.actions.some((a) => a.name.toString() === 'fulfilram')).toBe(true);
  await push([
    action('setcreate', {
      shared_usd: 0,
      independent_usd: 5000,
      premium_bps: 2000,
      settler: 'bob',
    }),
  ]);
  const reserve = (quantity: string) =>
    Action.from(
      {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{ actor: 'alice', permission: 'active' }],
        data: { from: 'alice', to: runtime, quantity, memo: 'ramreserve' },
      },
      tokenAbi,
    );
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  const reference = ref();
  const intent = {
    dao_id: '1',
    reference,
    policy_revision: RuntimeTableSchemas.resourcecfg.parse((await rows('resourcecfg'))[0]).revision,
    maximum: '0.1500 TLOS',
    expires: now + 120,
    purchases: [
      { receiver: runtime, quantity: '0.1000 TLOS', minimum_bytes: '1' },
      { receiver, quantity: '0.0500 TLOS', minimum_bytes: '1' },
    ].sort(byAccount),
  };
  const fulfil = () => action('fulfilram', intent, 'bob');
  const measured = async () => {
    const account = await api.v1.chain.get_account(runtime);
    const counters = z
      .array(RuntimeTableSchemas.ramstats)
      .parse([...(await rows('ramstats', '0')), ...(await rows('ramstats', '1'))]);
    const observer = RuntimeTableSchemas.ramobs.parse((await rows('ramobs'))[0]);
    return {
      native: BigInt(account.ram_usage.toString()),
      ledger:
        BigInt(observer.meter_bytes) +
        counters.reduce(
          (n, r) =>
            n + BigInt(r.identity) + BigInt(r.activity) + BigInt(r.retained) + BigInt(r.platform),
          0n,
        ),
    };
  };
  const initialMeter = await measured();
  const liabilities = await rows('daos');
  await expect(push([fulfil()])).rejects.toThrow('RAM_RESERVE_INSUFFICIENT');
  await push([reserve('1.0000 TLOS')]);
  const before = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance(runtime),
    balance('bob'),
  ]);
  await expect(push([action('fulfilram', intent, 'alice')])).rejects.toThrow();
  await push([fulfil()]);
  const after = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance(runtime),
    balance('bob'),
  ]);
  expect(BigInt(after[0] ?? '')).toBeGreaterThan(BigInt(before[0] ?? ''));
  expect(BigInt(after[1] ?? '')).toBeGreaterThan(BigInt(before[1] ?? ''));
  expect(BigInt(before[2] ?? '') - BigInt(after[2] ?? '')).toBe(1500n);
  expect(after[3]).toBe(before[3]);
  expect(await rows('ramreserve')).toMatchObject([{ available: '0.8500 TLOS' }]);
  expect(await rows('daos')).toEqual(liabilities);
  const finalMeter = await measured();
  expect(finalMeter.native - initialMeter.native).toBe(finalMeter.ledger - initialMeter.ledger);
  const snapshot = await Promise.all([
    quota(runtime),
    quota(receiver),
    balance(runtime),
    rows('ramreserve'),
    rows('ramalloc', '1'),
  ]);
  await expect(push([fulfil()])).rejects.toThrow('RAM_ORDER_EXISTS');
  await expect(push([action('finishram', { reference })])).rejects.toThrow('RAM_PURCHASE_SENDER');
  const invalid = {
    ...intent,
    reference: ref(),
    purchases: intent.purchases.map((p) => ({ ...p, minimum_bytes: '18446744073709551615' })),
  };
  await expect(push([action('fulfilram', invalid, 'bob')])).rejects.toThrow(
    'RAM_ACQUISITION_MINIMUM',
  );
  expect(
    await Promise.all([
      quota(runtime),
      quota(receiver),
      balance(runtime),
      rows('ramreserve'),
      rows('ramalloc', '1'),
    ]),
  ).toEqual(snapshot);
});

it('bounds unpaid sponsor intents and refuses payment from a separate transaction', async () => {
  const reference = ref(),
    count = (await rows('ramorders')).length;
  await push([
    await order(
      reference,
      '1',
      RuntimeTableSchemas.resourcecfg.parse((await rows('resourcecfg'))[0]).revision,
    ),
  ]);
  expect((await rows('ramorders')).length).toBe(count);
  await expect(push([transfer(reference)])).rejects.toThrow('RAM_PURCHASE_TRANSACTION');
  for (let i = 0; i < 3; i++)
    await push([
      await order(
        ref(),
        '1',
        RuntimeTableSchemas.resourcecfg.parse((await rows('resourcecfg'))[0]).revision,
      ),
    ]);
  expect((await rows('ramintent')).length).toBe(1);
  expect((await rows('ramorders')).length).toBe(count);
});
