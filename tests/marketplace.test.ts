import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PublicKey, API } from '@greymass/eosio';
import { Asset, Name, PrivateKey } from '@wharfkit/antelope';

// Vert logs decoded action data before the VM runs. JSON.stringify calls
// @greymass/eosio PublicKey.toJSON, and two keys in one action share a buffer.
// The second toString throws and the runner reverts the sale. Return a string
// without reading the key bytes.
PublicKey.prototype.toJSON = function () {
  return 'public-key';
};
import { z } from 'zod';
import { wasmCodeHash } from './helpers/code-hash.js';
import { loadContract, row, send } from './helpers/vert.js';

const hash = wasmCodeHash('.artifacts/contracts/modrelay.wasm');
const reference = 'ab'.repeat(32);
let runtime: ReturnType<typeof loadContract>;
let names: ReturnType<typeof loadContract>;
let token: ReturnType<typeof loadContract>;
const ownerKey = PrivateKey.generate('K1');
const activeKey = PrivateKey.generate('K1');

const scope = (account: string) => BigInt(Name.from(account).value.toString());
const symbolKey = BigInt(Asset.from('0.0000 TLOS').symbol.code.value.toString());
const balanceRow = z.object({ balance: z.string() });
const paymentRow = z.object({
  platform_fee: z.string(),
  publisher_share: z.string(),
  bps: z.number(),
  party: z.number(),
});
const saleRow = z.object({
  seller: z.string(),
  platform_fee: z.string(),
  platform_cents: z.number(),
  bps: z.number(),
  usd_cents: z.number(),
  rail: z.number(),
});

beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'carol', 'relay');
  const bob = chain.accounts.bob;
  if (!bob) throw new Error('FIXTURE_ACCOUNT_REQUIRED');
  bob.setPermissions([
    ...bob.permissions,
    API.v1.AccountPermission.from({
      perm_name: 'namesale',
      parent: 'active',
      required_auth: {
        threshold: 1,
        keys: [],
        accounts: [{ permission: { actor: 'names', permission: 'eosio.code' }, weight: 1 }],
        waits: [],
      },
    }),
  ]);
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  names = loadContract(chain, 'names', '.artifacts/contracts/names');
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  loadContract(chain, 'eosio', '.artifacts/contracts/eosstub');
  loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  loadContract(chain, 'payroll', '.artifacts/contracts/modrelay');
  await send(runtime, 'init', ['cd'.repeat(32)], 'daclifycore@active');
  await send(names, 'init', ['daclifycore', 'relay', 'eosio.token', '4,TLOS'], 'names@active');
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', 'names'],
    'daclifycore@active',
  );
  await send(token, 'create', ['eosio.token', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['carol', '100.0000 TLOS', ''], 'eosio.token@active');
  for (const recipient of ['alice', 'bob'])
    await send(token, 'open', [recipient, '4,TLOS', recipient], recipient + '@active');
  await send(
    names,
    'settier',
    [0, '1.0000 TLOS', 500, 4096, '0.0000 TLOS', '0.0000 TLOS'],
    'names@active',
  );
  await send(
    names,
    'settier',
    [1, '20.0000 TLOS', 20000, 4096, '0.0000 TLOS', '0.0000 TLOS'],
    'names@active',
  );
});

function balance(account: string): string {
  return balanceRow.parse(row(token, 'accounts', scope(account), symbolKey)).balance;
}

describe('module catalogue fees', () => {
  it('rolls back the buyer transfer and platform share until the publisher prepares its token row', async () => {
    await send(
      runtime,
      'listmod',
      ['payroll', 'relay', 1, 1, '2.0000 TLOS', hash, 'Receiving-wallet fixture'],
      'relay@active',
    );
    const before = {
      buyer: balance('carol'),
      platform: balance('alice'),
      payments: runtime.tables.modpays?.(runtime.toBigInt()).getTableRows(),
    };
    const pay = () =>
      send(
        token,
        'transfer',
        ['carol', 'daclifycore', '2.0000 TLOS', 'mod:payroll'],
        'carol@active',
      );
    await expect(pay()).rejects.toThrow('PAYOUT_TOKEN_ROW_REQUIRED');
    expect({
      buyer: balance('carol'),
      platform: balance('alice'),
      payments: runtime.tables.modpays?.(runtime.toBigInt()).getTableRows(),
    }).toEqual(before);
    await send(token, 'open', ['relay', '4,TLOS', 'relay'], 'relay@active');
    await pay();
    expect(balance('relay')).toBe('1.9000 TLOS');
    expect(balance('alice')).toBe('0.1000 TLOS');
  });
  it('refuses a module that does not accept the platform fee', async () => {
    await expect(
      send(
        runtime,
        'listmod',
        ['payroll', 'bob', 1, 0, '2.0000 TLOS', hash, 'Outside payroll'],
        'bob@active',
      ),
    ).rejects.toThrow('FEE_RULE');
    await expect(
      send(runtime, 'setmodule', [1, 'works', 1, [], ['reserve'], hash], 'daclifycore@active'),
    ).rejects.toThrow('DAO_UNKNOWN');
  });

  it('keeps a first-party charge and takes the configured share of a third-party charge', async () => {
    await send(
      runtime,
      'listmod',
      ['works', 'alice', 0, 1, '1.0000 TLOS', hash, 'Works'],
      'daclifycore@active',
    );
    await send(
      runtime,
      'listmod',
      ['payroll', 'bob', 1, 1, '2.0000 TLOS', hash, 'Outside payroll'],
      'bob@active',
    );
    await send(
      token,
      'transfer',
      ['carol', 'daclifycore', '1.0000 TLOS', 'mod:works'],
      'carol@active',
    );
    await send(
      token,
      'transfer',
      ['carol', 'daclifycore', '2.0000 TLOS', 'mod:payroll'],
      'carol@active',
    );
    expect(balance('alice')).toBe('1.1000 TLOS');
    expect(balance('bob')).toBe('1.9000 TLOS');
    expect(paymentRow.parse(row(runtime, 'modpays', runtime.toBigInt(), 1n))).toMatchObject({
      platform_fee: '1.0000 TLOS',
      publisher_share: '0.0000 TLOS',
      bps: 10000,
      party: 0,
    });
    expect(paymentRow.parse(row(runtime, 'modpays', runtime.toBigInt(), 2n))).toMatchObject({
      platform_fee: '0.1000 TLOS',
      publisher_share: '1.9000 TLOS',
      bps: 500,
      party: 1,
    });
  });

  it('uses the fee rate configured on the runtime for the next payment', async () => {
    await send(
      runtime,
      'listmod',
      ['payroll', 'bob', 1, 1, '2.0000 TLOS', hash, 'Outside payroll'],
      'bob@active',
    );
    await send(
      runtime,
      'setfees',
      [1000, 10000, 'alice', 'eosio.token', '4,TLOS', 'names'],
      'daclifycore@active',
    );
    await send(
      token,
      'transfer',
      ['carol', 'daclifycore', '2.0000 TLOS', 'mod:payroll'],
      'carol@active',
    );
    expect(paymentRow.parse(row(runtime, 'modpays', runtime.toBigInt(), 1n)).bps).toBe(1000);
    expect(balance('alice')).toBe('0.2000 TLOS');
    expect(balance('bob')).toBe('1.8000 TLOS');
  });

  it('does not let a DAO enable a module that is not listed', async () => {
    await send(
      runtime,
      'createdao',
      [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await expect(
      send(runtime, 'setmodule', [1, 'works', 1, [], ['reserve'], hash], 'alice@active'),
    ).rejects.toThrow('MODULE_UNLISTED');
    await send(
      runtime,
      'listmod',
      ['works', 'alice', 0, 1, '0.0000 TLOS', hash, 'Works'],
      'daclifycore@active',
    );
    await send(runtime, 'setmodule', [1, 'works', 1, [], ['reserve'], hash], 'alice@active');
  });

  it('stores a module description beside the catalogue and lets the linked DAO change rates', async () => {
    await expect(
      send(runtime, 'setmodcopy', ['works', 'Work records.', 'Detail'], 'daclifycore@active'),
    ).rejects.toThrow('MODULE_UNLISTED');
    await send(
      runtime,
      'listmod',
      ['works', 'alice', 0, 1, '0.0000 TLOS', hash, 'Works'],
      'daclifycore@active',
    );
    await send(
      runtime,
      'setmodcopy',
      ['works', 'Proposals, milestones, and review.', 'Works records proposals.'],
      'daclifycore@active',
    );
    expect(
      z
        .object({ summary: z.string() })
        .parse(
          row(runtime, 'modcopy', runtime.toBigInt(), BigInt(Name.from('works').value.toString())),
        ).summary,
    ).toBe('Proposals, milestones, and review.');
    await send(
      runtime,
      'createdao',
      [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [1, 1, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [1, 2, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
    await expect(
      send(
        runtime,
        'govfees',
        ['daclifycore', 1, 1, 1000, 10000, 1000, 2500],
        'daclifycore@active',
      ),
    ).rejects.toThrow('DAO_UNKNOWN');
    await send(runtime, 'setgov', [1], 'daclifycore@active');
    await expect(
      send(
        runtime,
        'govfees',
        ['daclifycore', 1, 2, 1000, 10000, 1000, 2500],
        'daclifycore@active',
      ),
    ).rejects.toThrow('ADMIN_REQUIRED');
    await send(
      runtime,
      'govfees',
      ['daclifycore', 1, 1, 1000, 10000, 1000, 2500],
      'daclifycore@active',
    );
    await send(names, 'regsuffix', ['bob', '10.0000 TLOS', 0, 1], 'bob@active');
    await send(
      names,
      'intend',
      ['carol', 'aa.bob', ownerKey.toPublic().toString(), activeKey.toPublic().toString()],
      'carol@active',
    );
    await send(token, 'transfer', ['carol', 'names', '10.0000 TLOS', 'buy:aa.bob'], 'carol@active');
    expect(saleRow.parse(row(names, 'sales', names.toBigInt(), 1n))).toMatchObject({
      seller: 'bob',
      platform_fee: '1.0000 TLOS',
      bps: 1000,
    });
    expect(
      z
        .object({ price: z.string(), sales_count: z.number() })
        .parse(row(names, 'suffixes', names.toBigInt(), BigInt(Name.from('bob').value.toString()))),
    ).toMatchObject({ price: '11.0000 TLOS', sales_count: 1 });
  });
});

describe('Telos name sales', () => {
  it('lets only the seller change or remove unsold listings and suffixes', async () => {
    await send(names, 'regname', ['bob', 'premname', '2.0000 TLOS', 0, 1], 'bob@active');
    await expect(
      send(names, 'editname', ['carol', 'premname', '3.0000 TLOS', 0, 1], 'carol@active'),
    ).rejects.toThrow('SELLER');
    await send(names, 'editname', ['bob', 'premname', '3.0000 TLOS', 0, 1], 'bob@active');
    expect(
      z
        .object({ price: z.string() })
        .parse(
          row(names, 'namelist', names.toBigInt(), BigInt(Name.from('premname').value.toString())),
        ).price,
    ).toBe('3.0000 TLOS');
    await expect(send(names, 'delname', ['carol', 'premname'], 'carol@active')).rejects.toThrow(
      'SELLER',
    );
    await send(names, 'delname', ['bob', 'premname'], 'bob@active');
    await send(names, 'regsuffix', ['bob', '1.0000 TLOS', 0, 1], 'bob@active');
    await expect(send(names, 'delsuffix', ['bob'], 'carol@active')).rejects.toThrow(
      'missing required authority',
    );
    await send(names, 'delsuffix', ['bob'], 'bob@active');
  });
  it('keeps a RAM float and refuses an unknown transfer memo', async () => {
    await send(token, 'transfer', ['carol', 'names', '1.0000 TLOS', 'float'], 'carol@active');
    expect(balance('names')).toBe('1.0000 TLOS');
    await expect(
      send(token, 'transfer', ['carol', 'names', '1.0000 TLOS', 'gift'], 'carol@active'),
    ).rejects.toThrow('NAME_MEMO');
  });

  it('keeps the basic name price and charges the platform fee on a listed special name', async () => {
    await send(names, 'regname', ['bob', 'premname', '2.0000 TLOS', 1000, 1], 'bob@active');
    await expect(
      send(names, 'regname', ['bob', 'othername', '2.0000 TLOS', 1000, 0], 'bob@active'),
    ).rejects.toThrow('FEE_RULE');
    await send(
      names,
      'intend',
      ['carol', 'alice12345ab', ownerKey.toPublic().toString(), activeKey.toPublic().toString()],
      'carol@active',
    );
    await send(
      token,
      'transfer',
      ['carol', 'names', '1.0000 TLOS', 'buy:alice12345ab'],
      'carol@active',
    );
    await send(
      names,
      'intend',
      ['carol', 'premname', ownerKey.toPublic().toString(), activeKey.toPublic().toString()],
      'carol@active',
    );
    await send(
      token,
      'transfer',
      ['carol', 'names', '2.0000 TLOS', 'buy:premname'],
      'carol@active',
    );
    expect(saleRow.parse(row(names, 'sales', names.toBigInt(), 1n))).toMatchObject({
      seller: 'alice',
      platform_fee: '1.0000 TLOS',
      platform_cents: 500,
      bps: 10000,
      usd_cents: 500,
      rail: 0,
    });
    expect(saleRow.parse(row(names, 'sales', names.toBigInt(), 2n))).toMatchObject({
      seller: 'bob',
      platform_fee: '0.1000 TLOS',
      platform_cents: 50,
      bps: 500,
      usd_cents: 1000,
      rail: 0,
    });
    expect(balance('alice')).toBe('1.1000 TLOS');
    expect(balance('bob')).toBe('1.9000 TLOS');
  });

  it('records a card purchase at the on-chain price and refuses a different amount', async () => {
    await expect(
      send(
        names,
        'fulfill',
        [
          'relay',
          'short',
          ownerKey.toPublic().toString(),
          activeKey.toPublic().toString(),
          100,
          reference,
        ],
        'relay@active',
      ),
    ).rejects.toThrow('PRICE');
    await send(
      names,
      'fulfill',
      [
        'relay',
        'short',
        ownerKey.toPublic().toString(),
        activeKey.toPublic().toString(),
        20000,
        reference,
      ],
      'relay@active',
    );
    expect(saleRow.parse(row(names, 'sales', names.toBigInt(), 1n))).toMatchObject({
      seller: 'alice',
      platform_fee: '0.0000 TLOS',
      platform_cents: 20000,
      bps: 10000,
      usd_cents: 20000,
      rail: 1,
    });
  });

  it('prices a basic name from the stored dollar amount and raises a suffix after a sale', async () => {
    await expect(
      send(names, 'regsuffix', ['bob', '10.0000 TLOS', 0, 0], 'bob@active'),
    ).rejects.toThrow('FEE_RULE');
    await expect(
      send(names, 'regsuffix', ['alice', '10.0000 TLOS', 0, 1], 'alice@active'),
    ).rejects.toThrow('FEE_PARTY');
    await send(names, 'setoracle', ['daclifycore', 50000, 4, 1], 'daclifycore@active');
    await send(
      names,
      'intend',
      ['carol', 'basicname111', ownerKey.toPublic().toString(), activeKey.toPublic().toString()],
      'carol@active',
    );
    await send(
      token,
      'transfer',
      ['carol', 'names', '1.2000 TLOS', 'buy:basicname111'],
      'carol@active',
    );
    expect(saleRow.parse(row(names, 'sales', names.toBigInt(), 1n))).toMatchObject({
      seller: 'alice',
      platform_fee: '1.2000 TLOS',
      usd_cents: 500,
      bps: 10000,
    });
    await send(
      names,
      'intend',
      ['carol', 'aa.bob', ownerKey.toPublic().toString(), activeKey.toPublic().toString()],
      'carol@active',
    );
    await expect(
      send(token, 'transfer', ['carol', 'names', '10.0000 TLOS', 'buy:aa.bob'], 'carol@active'),
    ).rejects.toThrow('SUFFIX');
    await send(names, 'regsuffix', ['bob', '10.0000 TLOS', 500, 1], 'bob@active');
    await send(
      names,
      'intend',
      ['carol', 'aa.bob', ownerKey.toPublic().toString(), activeKey.toPublic().toString()],
      'carol@active',
    );
    await send(token, 'transfer', ['carol', 'names', '10.0000 TLOS', 'buy:aa.bob'], 'carol@active');
    expect(saleRow.parse(row(names, 'sales', names.toBigInt(), 2n))).toMatchObject({
      seller: 'bob',
      platform_fee: '0.5000 TLOS',
      platform_cents: 25,
      bps: 500,
      usd_cents: 500,
    });
    expect(
      z
        .object({ price: z.string(), usd_cents: z.number(), sales_count: z.number() })
        .parse(row(names, 'suffixes', names.toBigInt(), BigInt(Name.from('bob').value.toString()))),
    ).toMatchObject({ price: '12.0000 TLOS', usd_cents: 600, sales_count: 1 });
  });
});
