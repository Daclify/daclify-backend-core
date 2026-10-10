import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  ABI,
  Action,
  APIClient,
  APIError,
  Asset,
  PrivateKey,
  SignedTransaction,
  Transaction,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { NamesCodeHash, namesAbi, nameSellerAction, namePurchaseActions } from '../../sdk/names.js';
import { NamesActionSchemas } from '../../sdk/generated/names-schemas.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/index.js';
import { NameQuoteSchema } from '../../protocol/service-api.js';
import { encodeSystem, encodeContractAbi } from './actions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
process.loadEnvFile(process.env.DACLIFY_ENV_FILE ?? '/data/daclify-env/testnet.env');
process.loadEnvFile('/data/daclify-env/deploy.testnet.env');
const chainId = '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f';
assert.equal(process.env.NETWORK_ENVIRONMENT, 'testnet');
assert.equal(process.env.CHAIN_ID, chainId);
const api = new APIClient({ url: z.url().parse(process.env.CHAIN_RPC_URL) }),
  target = 'daclifynames',
  seller = '3boidanimus3',
  settler = 'daclifyrelay';
const owner = PrivateKey.from(z.string().parse(process.env.DEPLOYER_PRIVATE_KEY));
const relay = PrivateKey.from(z.string().parse(process.env.RELAY_PRIVATE_KEY));
const oldHash = '76714f4a8980b8405fb79e64a127c7492558960ebe63a79185ce6d3cb0a38c8a';
const live = process.argv.includes('--live'),
  contract = ABI.from(namesAbi);
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function snapshot() {
  const account = await api.v1.chain.get_account(target);
  const tables = await Promise.all(
    ['namescfg', 'tiers', 'sales', 'namelist', 'suffixes', 'intents', 'profitcfg', 'policy'].map(
      async (table) => ({
        table,
        rows: (
          await api.v1.chain.get_table_rows({
            code: target,
            scope: target,
            table,
            json: true,
            limit: 100,
          })
        ).rows,
      }),
    ),
  );
  return {
    permissionsHash: digest(account.permissions),
    balance: (await api.v1.chain.get_currency_balance('eosio.token', target, 'TLOS')).map(String),
    tables,
  };
}
const before = await snapshot();
const [rt, current, oldAbi, account] = await Promise.all([
  api.v1.chain.get_raw_abi('daclifycore1'),
  api.v1.chain.get_raw_abi(target),
  api.v1.chain.get_abi(target),
  api.v1.chain.get_account(target),
]);
assert.equal(rt.code_hash.toString(), RuntimeCodeHash);
assert.equal(rt.abi_hash.toString(), RuntimeRawAbiHash);
assert.equal(current.code_hash.toString(), live ? NamesCodeHash : oldHash);
assert.equal(
  createHash('sha256').update(readFileSync('.artifacts/contracts/names.wasm')).digest('hex'),
  NamesCodeHash,
);
assert(oldAbi.abi);
const oldContract = ABI.from(oldAbi.abi);
for (const old of oldContract.structs)
  assert.deepEqual(
    contract.structs.find((s) => s.name === old.name),
    old,
  );
for (const old of oldContract.actions)
  assert.deepEqual(
    contract.actions.find((s) => String(s.name) === String(old.name)),
    old,
  );
for (const old of oldContract.tables)
  assert.deepEqual(
    contract.tables.find((s) => String(s.name) === String(old.name)),
    old,
  );
const authority = account.permissions.find((p) => String(p.perm_name) === 'owner');
assert(
  authority?.required_auth.keys.some(
    (k) =>
      k.key.equals(owner.toPublic()) &&
      Number(k.weight) >= Number(authority.required_auth.threshold),
  ),
);
const upgrade = [
  Action.from({
    account: 'eosio',
    name: 'setcode',
    authorization: [{ actor: target, permission: 'owner' }],
    data: encodeSystem('setcode', {
      account: target,
      vmtype: 0,
      vmversion: 0,
      code: readFileSync('.artifacts/contracts/names.wasm'),
    }),
  }),
  Action.from({
    account: 'eosio',
    name: 'setabi',
    authorization: [{ actor: target, permission: 'owner' }],
    data: encodeSystem('setabi', {
      account: target,
      abi: encodeContractAbi(JSON.stringify(namesAbi)),
    }),
  }),
];
const bootstrap = live ? [] : upgrade;
const response = await fetch('https://testnet.api.daclify.com/v1/names/quote?name=dacux1111111');
assert(response.ok);
const quote = NameQuoteSchema.parse(await response.json()),
  key = PrivateKey.generate('K1').toPublic().toString();
const traceShape = z.object({
  processed: z.object({
    action_traces: z.array(
      z.object({
        receiver: z.string(),
        act: z.object({ account: z.string(), name: z.string(), data: z.unknown() }),
      }),
    ),
  }),
});
async function compute(actions: Action[], keys = [owner]) {
  const info = await api.v1.chain.get_info();
  assert.equal(String(info.chain_id), chainId);
  const tx = Transaction.from({ ...info.getTransactionHeader(120), actions });
  const signed = SignedTransaction.from({
    ...tx,
    signatures: keys.map((k) => k.signDigest(tx.signingDigest(info.chain_id))),
  });
  const result = await api.v1.chain.compute_transaction(signed);
  const value: unknown = JSON.parse(JSON.stringify(result));
  const failure = z.object({ processed: z.object({ except: z.unknown() }) }).safeParse(value);
  if (failure.success && failure.data.processed.except)
    throw new Error(JSON.stringify(failure.data.processed.except));
  return {
    receipt: executedChainResult(result, tx.id.toString()),
    traces: traceShape.parse(value).processed.action_traces,
  };
}
function allocations(result: Awaited<ReturnType<typeof compute>>) {
  const transfers = result.traces
    .filter((t) => t.receiver === 'eosio.token' && t.act.name === 'transfer')
    .map((t) =>
      z
        .object({ from: z.string(), to: z.string(), quantity: z.string(), memo: z.string() })
        .parse(t.act.data),
    );
  const resources = transfers
    .filter(
      (t) =>
        t.from === target &&
        t.memo !== 'Daclify name fee' &&
        t.memo !== 'Daclify name sale' &&
        !t.memo.startsWith('readonly qualification'),
    )
    .reduce((sum, t) => sum + BigInt(Asset.from(t.quantity).units.toString()), 0n);
  const fees = transfers
    .filter((t) => t.from === target && t.memo === 'Daclify name fee')
    .reduce((sum, t) => sum + BigInt(Asset.from(t.quantity).units.toString()), 0n);
  const proceeds = transfers
    .filter((t) => t.from === target && t.memo === 'Daclify name sale')
    .reduce((sum, t) => sum + BigInt(Asset.from(t.quantity).units.toString()), 0n);
  assert(result.traces.some((t) => t.act.name === 'checkprofit'));
  assert(result.traces.some((t) => t.act.name === 'closepay'));
  assert(resources > 0n);
  return { resources, fees, proceeds };
}
const listing = (price: string, usd = 0) =>
  nameSellerAction(target, 'regname', {
    seller,
    account_name: quote.accountName,
    price,
    usd_cents: usd,
    accepts_fee_rule: 1,
  });
const gross = BigInt(Asset.from(quote.price).units.toString());
const native = await compute([
  ...bootstrap,
  listing(quote.price),
  ...namePurchaseActions(target, 'eosio.token', seller, quote, key, key),
]);
const amounts = allocations(native);
assert.equal(amounts.fees, (gross * 500n) / 10000n);
assert.equal(amounts.proceeds, gross - amounts.resources - amounts.fees);
const first = await compute([
  ...bootstrap,
  ...namePurchaseActions(target, 'eosio.token', seller, quote, key, key),
]);
const firstAmounts = allocations(first);
assert.equal(firstAmounts.resources + firstAmounts.fees + firstAmounts.proceeds, gross);
const tokenAbi = ABI.from({
  version: 'eosio::abi/1.2',
  structs: [
    {
      name: 'transfer',
      base: '',
      fields: [
        { name: 'from', type: 'name' },
        { name: 'to', type: 'name' },
        { name: 'quantity', type: 'asset' },
        { name: 'memo', type: 'string' },
      ],
    },
  ],
  actions: [{ name: 'transfer', type: 'transfer', ricardian_contract: '' }],
});
const clear = Action.from(
  {
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{ actor: target, permission: 'owner' }],
    data: {
      from: target,
      to: seller,
      quantity: before.balance[0],
      memo: 'readonly qualification: empty reserve',
    },
  },
  tokenAbi,
);
const empty = await compute([
  ...bootstrap,
  clear,
  listing(quote.price),
  ...namePurchaseActions(target, 'eosio.token', seller, quote, key, key),
]);
assert.deepEqual(allocations(empty), amounts);
const sale = {
  settler,
  account_name: quote.accountName,
  owner_key: key,
  active_key: key,
  usd_cents: quote.usdCents,
  reference: 'cd'.repeat(32),
};
const card = (net: number) =>
  Action.from(
    {
      account: target,
      name: 'fulfillnet',
      authorization: [{ actor: settler, permission: 'active' }],
      data: NamesActionSchemas.fulfillnet.parse({ ...sale, net_usd_cents: net }),
    },
    contract,
  );
const paid = await compute([...bootstrap, card(105)], [...(live ? [] : [owner]), relay]);
const cardAmounts = allocations(paid);
assert.equal(cardAmounts.fees + cardAmounts.proceeds, 0n);
const rejections = [];
for (const [label, expected, actions, keys] of [
  [
    'cost-exceeds-price',
    'NAME_COST_LOW',
    [
      ...bootstrap,
      listing('1.0000 TLOS'),
      ...namePurchaseActions(
        target,
        'eosio.token',
        seller,
        { ...quote, price: '1.0000 TLOS' },
        key,
        key,
      ),
    ],
    [owner],
  ],
  [
    'third-party-card',
    'NAME_CARD_ROUTING',
    [...bootstrap, listing(quote.price, quote.usdCents), card(105)],
    [owner, relay],
  ],
  [
    'minimum-card-margin',
    'NAME_PROFIT_LOW',
    [...bootstrap, card(104)],
    [...(live ? [] : [owner]), relay],
  ],
  [
    'gross-only-card',
    'NAME_NET_REQUIRED',
    [
      ...bootstrap,
      Action.from(
        {
          account: target,
          name: 'fulfill',
          authorization: [{ actor: settler, permission: 'active' }],
          data: sale,
        },
        contract,
      ),
    ],
    [...(live ? [] : [owner]), relay],
  ],
] as const) {
  let rejected = false;
  try {
    await compute([...actions], [...keys]);
  } catch (error) {
    const detail = error instanceof APIError ? JSON.stringify(error.response.json) : String(error);
    assert(detail.includes(expected), detail);
    rejected = true;
  }
  assert(rejected);
  rejections.push({ label, expected });
}
// The observation timer can change only policy; all other state must be byte-equivalent.
const invariant = (v: Awaited<ReturnType<typeof snapshot>>) => ({
  ...v,
  tables: v.tables.filter((t) => t.table !== 'policy'),
});
assert.deepEqual(invariant(await snapshot()), invariant(before));
const fmt = (n: bigint) => `${n / 10000n}.${(n % 10000n).toString().padStart(4, '0')} TLOS`;
const report = {
  verifiedAt: new Date().toISOString(),
  chainId,
  scope:
    'Signed read-only native Telos resource provisioning, real permissions and token transfers',
  oldCodeHash: oldHash,
  newCodeHash: NamesCodeHash,
  existingAbiLayoutsPreserved: true,
  gross: quote.price,
  resourceCost: fmt(amounts.resources),
  platformFee: fmt(amounts.fees),
  sellerProceeds: fmt(amounts.proceeds),
  nativeReserveConserved: true,
  emptyReserveAccepted: true,
  firstPartyCardNetUsdCents: 105,
  cardProvisioningRequiresNativeFloat: true,
  additionalContractRamBytes: 0,
  rejections,
  receipts: [native.receipt, first.receipt, empty.receipt, paid.receipt],
  tablesBalancesAuthoritiesUnchanged: true,
  policyObservationMayAdvance: true,
  noBroadcast: true,
  suffixCreation:
    'Compiled-contract tests; native test uses an exact 12-character third-party listing without borrowing a short suffix owner authority.',
};
writeFileSync(
  `docs/evidence/2026-10-10-name-costs-${live ? 'live' : 'simulation'}.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
if (process.argv.includes('--apply')) {
  assert(!live);
  assert.equal(String((await api.v1.chain.get_raw_abi(target)).code_hash), oldHash);
  const info = await api.v1.chain.get_info();
  const tx = Transaction.from({ ...info.getTransactionHeader(120), actions: upgrade });
  const result = await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...tx,
      signatures: [owner.signDigest(tx.signingDigest(info.chain_id))],
    }),
  );
  const receipt = executedChainResult(result, tx.id.toString());
  await waitForIrreversibleBlock(
    async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
    receipt.blockNum,
  );
  const installed = await api.v1.chain.get_raw_abi(target);
  assert.equal(String(installed.code_hash), NamesCodeHash);
  assert.equal(
    String(installed.abi_hash),
    createHash('sha256')
      .update(encodeContractAbi(JSON.stringify(namesAbi)))
      .digest('hex'),
  );
  assert.deepEqual(invariant(await snapshot()), invariant(before));
  const applied = {
    appliedAt: new Date().toISOString(),
    chainId,
    receipt,
    irreversible: true,
    oldCodeHash: oldHash,
    newCodeHash: NamesCodeHash,
    existingAbiLayoutsPreserved: true,
    policiesTiersSalesListingsSuffixesIntentsUnchanged: true,
    permissionsUnchanged: true,
    balance: before.balance,
    noTokenTransfers: true,
  };
  writeFileSync(
    'docs/evidence/2026-10-10-name-costs-applied.json',
    JSON.stringify(applied, null, 2) + '\n',
  );
  console.log(JSON.stringify(applied));
}
