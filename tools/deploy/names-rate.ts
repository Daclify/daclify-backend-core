import assert from 'node:assert/strict';
import {
  ABI,
  Action,
  APIClient,
  PrivateKey,
  SignedTransaction,
  Transaction,
} from '@wharfkit/antelope';
import { NamesActionSchemas, NamesTableSchemas } from '../../sdk/generated/names-schemas.js';
import { NamesCodeHash, namesAbi } from '../../sdk/names.js';
import { RuntimeCodeHash, RuntimeRawAbiHash } from '../../sdk/index.js';
import { readDelphiPair, readDelphiRate } from '../../services/api/src/delphi.js';
import { eurCardFee } from '../../services/api/src/market/eur-reference.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
import { loadEnvironment } from './environment.js';

const args = process.argv.slice(2);
assert(
  args.length >= 1 &&
    args.length <= 2 &&
    args[0] === 'testnet' &&
    (!args[1] || args[1] === '--apply'),
  'NAMES_RATE_ARGUMENT',
);
const environment = await loadEnvironment('testnet');
if (process.env.DACLIFY_ENV_FILE) process.loadEnvFile(process.env.DACLIFY_ENV_FILE);
const runtime = environment.accounts[0]?.name,
  names = environment.namesAccount?.name;
assert(runtime && names, 'NAMES_UNCONFIGURED');
assert.equal(process.env.NETWORK_ENVIRONMENT, 'testnet');
assert.equal(process.env.CHAIN_ID, environment.chainId);
assert.equal(process.env.CHAIN_RPC_URL, environment.rpcUrl);
const api = new APIClient({ url: environment.rpcUrl });
const [runtimeAbi, namesRaw, policyRows, profitRows, pair, rate] = await Promise.all([
  api.v1.chain.get_raw_abi(runtime),
  api.v1.chain.get_raw_abi(names),
  api.v1.chain.get_table_rows({ code: names, scope: names, table: 'policy', json: true, limit: 1 }),
  api.v1.chain.get_table_rows({
    code: names,
    scope: names,
    table: 'profitcfg',
    json: true,
    limit: 1,
  }),
  readDelphiPair(environment.oracle.rpcUrl, environment.oracle.pair),
  readDelphiRate(environment.oracle.rpcUrl, environment.oracle.pair, new Date(), 900),
]);
assert.equal(runtimeAbi.code_hash.toString(), RuntimeCodeHash);
assert.equal(runtimeAbi.abi_hash.toString(), RuntimeRawAbiHash);
assert.equal(namesRaw.code_hash.toString(), NamesCodeHash);
const policy = NamesTableSchemas.policy.parse(policyRows.rows[0]);
const profit = NamesTableSchemas.profitcfg.parse(profitRows.rows[0]);
const actions: Action[] = [];
const abi = ABI.from(namesAbi);
const authorization = [{ actor: runtime, permission: 'active' }];
const observation = Math.floor(rate.observedAt.getTime() / 1000);
if (observation > policy.observed_at)
  actions.push(
    Action.from(
      {
        account: names,
        name: 'setoracle',
        authorization,
        data: NamesActionSchemas.setoracle.parse({
          runtime,
          median: rate.median.toString(),
          quoted_precision: pair.quotedPrecision,
          observed_at: observation,
        }),
      },
      abi,
    ),
  );
try {
  const response = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {
    signal: AbortSignal.timeout(10000),
  });
  assert(response.ok, 'NAME_FEE_REFERENCE');
  const fee = eurCardFee(await response.text(), new Date());
  if (
    fee.observedAt >= profit.fee_observed_at &&
    (fee.observedAt > profit.fee_observed_at || fee.fixedUsdCents !== profit.card_fixed_usd_cents)
  )
    actions.push(
      Action.from(
        {
          account: names,
          name: 'setprofit',
          authorization,
          data: NamesActionSchemas.setprofit.parse({
            runtime,
            version: profit.version,
            minimum_usd_cents: profit.minimum_usd_cents,
            card_fee_bps: profit.card_fee_bps,
            card_fixed_usd_cents: fee.fixedUsdCents,
            fee_observed_at: fee.observedAt,
          }),
        },
        abi,
      ),
    );
} catch {
  // Keep native observations current during ECB outages; expired fee estimates disable card quotes.
  console.warn('NAME_FEE_REFERENCE: keeping the last card estimate.');
}
if (!actions.length) {
  console.log(JSON.stringify({ state: 'current', observedAt: observation }));
} else if (args[1] !== '--apply') {
  console.log(
    JSON.stringify({
      chainId: environment.chainId,
      unsigned: true,
      actions: actions.map((action) => ({
        account: String(action.account),
        name: String(action.name),
        authorization,
        data: action.decodeData(abi),
      })),
    }),
  );
} else {
  assert(process.env.BOOTSTRAP_PRIVATE_KEY, 'BOOTSTRAP_KEY_REQUIRED');
  const key = PrivateKey.from(process.env.BOOTSTRAP_PRIVATE_KEY);
  const account = await api.v1.chain.get_account(runtime);
  const active = account.permissions.find((p) => p.perm_name.toString() === 'active');
  assert(
    active?.required_auth.keys.some(
      (k) =>
        k.key.equals(key.toPublic()) && Number(k.weight) >= Number(active.required_auth.threshold),
    ),
    'NAMES_RATE_AUTHORITY',
  );
  const info = await api.v1.chain.get_info();
  assert.equal(info.chain_id.toString(), environment.chainId);
  const transaction = Transaction.from({ ...info.getTransactionHeader(120), actions });
  const result = await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...transaction,
      signatures: [key.signDigest(transaction.signingDigest(info.chain_id))],
    }),
  );
  const receipt = executedChainResult(result, transaction.id.toString());
  await waitForIrreversibleBlock(
    async () => Number((await api.v1.chain.get_info()).last_irreversible_block_num),
    receipt.blockNum,
  );
  console.log(
    JSON.stringify({ state: 'updated', ...receipt, irreversible: true, observedAt: observation }),
  );
}
