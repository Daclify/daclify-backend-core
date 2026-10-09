import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  ABI,
  APIClient,
  Action,
  APIError,
  PrivateKey,
  SignedTransaction,
  Transaction,
} from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import {
  nameSellerAction,
  nameCreationPermissionActions,
  namePurchaseActions,
} from '../../sdk/names.js';
import { NameQuoteSchema } from '../../protocol/service-api.js';
import { SYSTEM_ABI } from '../../sdk/system-abi.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-names-native') throw new Error('NAMES_OWNED_FIXTURE_REQUIRED');
const rpc = new APIClient({ url: network.url });
let sequence = 0;
function cleos(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('NATIVE_NAMES_SETUP_FAILED');
  }
}
async function push(actions: Action[], keys: PrivateKey[]) {
  const info = await rpc.v1.chain.get_info();
  expect(info.chain_id.toString()).toBe(network.chainId);
  const transaction = Transaction.from({ ...info.getTransactionHeader(120 + sequence++), actions });
  try {
    return await rpc.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: keys.map((key) => key.signDigest(transaction.signingDigest(network.chainId))),
      }),
    );
  } catch (cause) {
    if (cause instanceof APIError) throw new Error('NATIVE_AUTHORIZATION_REJECTED');
    throw new Error('NATIVE_TRANSACTION_REJECTED');
  }
}
const owner = PrivateKey.generate('K1'),
  active = PrivateKey.generate('K1');
const quote = NameQuoteSchema.parse({
  accountName: 'test.bob',
  kind: 'premium',
  listed: false,
  seller: 'bob',
  party: 'third-party',
  price: '10.0000 TLOS',
  usdCents: 0,
  platformBps: 500,
  suffix: 'bob',
  bumpBps: 2000,
  quotePremiumBps: 2000,
  ramBytes: 3000,
  netStake: '0.0000 TLOS',
  cpuStake: '0.0000 TLOS',
  priceFromOracle: false,
  sales: 0,
  nextPrice: '12.0000 TLOS',
  nextUsdCents: 0,
});
beforeAll(() => {
  unlockFixtureWallet(network.container);
  cleos([
    'set',
    'contract',
    'eosio',
    '/work/.artifacts/contracts',
    'eosstub.wasm',
    'eosstub.abi',
    '-p',
    'eosio@active',
  ]);
  cleos([
    'set',
    'contract',
    'names',
    '/work/.artifacts/contracts',
    'names.wasm',
    'names.abi',
    '-p',
    'names@active',
  ]);
  cleos(['set', 'account', 'permission', 'names', 'active', '--add-code', '-p', 'names@active']);
  cleos([
    'push',
    'action',
    'names',
    'init',
    JSON.stringify(['daclifycore', 'relay', 'eosio.token', '4,TLOS']),
    '-p',
    'names@active',
  ]);
  cleos([
    'push',
    'action',
    'daclifycore',
    'setfees',
    JSON.stringify([500, 10000, 'alice', 'eosio.token', '4,TLOS', 'names']),
    '-p',
    'daclifycore@active',
  ]);
  cleos([
    'push',
    'action',
    'names',
    'settier',
    JSON.stringify([1, '10.0000 TLOS', 0, 3000, '0.0000 TLOS', '0.0000 TLOS']),
    '-p',
    'names@active',
  ]);
  for (const account of ['bob', 'carol'])
    cleos([
      'push',
      'action',
      'eosio.token',
      'open',
      JSON.stringify([account, '4,TLOS', account]),
      '-p',
      account + '@active',
    ]);
  cleos([
    'push',
    'action',
    'eosio.token',
    'transfer',
    JSON.stringify(['alice', 'carol', '100.0000 TLOS', 'fixture funding']),
    '-p',
    'alice@active',
  ]);
});
describe('native names seller and creator authority', () => {
  it('rejects unauthorized listing and a purchase without the suffix creation permission', async () => {
    const listing = nameSellerAction('names', 'regsuffix', {
      suffix: 'bob',
      price: '10.0000 TLOS',
      usd_cents: 0,
      accepts_fee_rule: 1,
    });
    await expect(push([listing], [fixtureKey('alice')])).rejects.toThrow(
      'NATIVE_AUTHORIZATION_REJECTED',
    );
    await push([listing], [fixtureKey('bob')]);
    await expect(
      push(
        namePurchaseActions(
          'names',
          'eosio.token',
          'carol',
          quote,
          owner.toPublic().toString(),
          active.toPublic().toString(),
        ),
        [fixtureKey('carol')],
      ),
    ).rejects.toThrow('NATIVE_AUTHORIZATION_REJECTED');
    expect(
      (await rpc.v1.chain.get_currency_balance('eosio.token', 'carol', 'TLOS')).map((item) =>
        item.toString(),
      ),
    ).toEqual(['100.0000 TLOS']);
  });
  it('uses a dedicated child to create the suffix account and splits the payment once', async () => {
    await push(nameCreationPermissionActions('bob', 'names'), [fixtureKey('bob')]);
    const before = await rpc.v1.chain.get_account('bob'),
      permission = before.permissions.find((item) => item.perm_name.toString() === 'namesale');
    expect(permission?.parent.toString()).toBe('active');
    expect(permission?.required_auth.accounts[0]?.permission.toString()).toBe('names@eosio.code');
    await push(
      namePurchaseActions(
        'names',
        'eosio.token',
        'carol',
        quote,
        owner.toPublic().toString(),
        active.toPublic().toString(),
      ),
      [fixtureKey('carol')],
    );
    const created = await rpc.v1.chain.get_account('test.bob');
    expect(
      created.permissions
        .find((item) => item.perm_name.toString() === 'owner')
        ?.required_auth.keys[0]?.key.toString(),
    ).toBe(owner.toPublic().toString());
    expect(
      (await rpc.v1.chain.get_currency_balance('eosio.token', 'bob', 'TLOS')).map((item) =>
        item.toString(),
      ),
    ).toEqual(['9.5000 TLOS']);
    await expect(
      push(
        namePurchaseActions(
          'names',
          'eosio.token',
          'carol',
          quote,
          owner.toPublic().toString(),
          active.toPublic().toString(),
        ),
        [fixtureKey('carol')],
      ),
    ).rejects.toThrow('NATIVE_AUTHORIZATION_REJECTED');
    expect(
      (await rpc.v1.chain.get_currency_balance('eosio.token', 'bob', 'TLOS')).map((item) =>
        item.toString(),
      ),
    ).toEqual(['9.5000 TLOS']);
  });
  it('does not let the creation child spend the seller balance', async () => {
    const abi = ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8'));
    const action = Action.from(
      {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{ actor: 'bob', permission: 'namesale' }],
        data: { from: 'bob', to: 'carol', quantity: '1.0000 TLOS', memo: 'forbidden' },
      },
      abi,
    );
    await expect(push([action], [fixtureKey('bob')])).rejects.toThrow(
      'NATIVE_AUTHORIZATION_REJECTED',
    );
    expect(
      (await rpc.v1.chain.get_currency_balance('eosio.token', 'bob', 'TLOS')).map((item) =>
        item.toString(),
      ),
    ).toEqual(['9.5000 TLOS']);
  });
  it('requires both native executives when a DAO seller uses a two-account quorum', async () => {
    const update = Action.from(
      {
        account: 'eosio',
        name: 'updateauth',
        authorization: [{ actor: 'bob', permission: 'owner' }],
        data: {
          account: 'bob',
          permission: 'active',
          parent: 'owner',
          auth: {
            threshold: 2,
            keys: [],
            waits: [],
            accounts: [
              { permission: { actor: 'alice', permission: 'active' }, weight: 1 },
              { permission: { actor: 'carol', permission: 'active' }, weight: 1 },
            ],
          },
        },
      },
      ABI.from(SYSTEM_ABI),
    );
    await push([update], [fixtureKey('bob')]);
    const listing = nameSellerAction('names', 'regsuffix', {
      suffix: 'bob',
      price: '20.0000 TLOS',
      usd_cents: 0,
      accepts_fee_rule: 1,
    });
    await expect(push([listing], [fixtureKey('alice')])).rejects.toThrow(
      'NATIVE_AUTHORIZATION_REJECTED',
    );
    await push([listing], [fixtureKey('alice'), fixtureKey('carol')]);
    const account = await rpc.v1.chain.get_account('bob');
    expect(
      account.permissions
        .find((item) => item.perm_name.toString() === 'owner')
        ?.required_auth.keys[0]?.key.toString(),
    ).toBe(fixtureKey('bob').toPublic().toString());
    expect(
      account.permissions
        .find((item) => item.perm_name.toString() === 'active')
        ?.required_auth.threshold.toNumber(),
    ).toBe(2);
  });
});
