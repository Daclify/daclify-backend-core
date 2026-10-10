import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { API, PublicKey, TimePoint } from '@greymass/eosio';
import { Asset, Name, PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
PublicKey.prototype.toJSON = function () {
  return 'public-key';
};
const key = PrivateKey.generate('K1').toPublic().toString();
const ref = 'ab'.repeat(32);
const now = 1791633600;
let names: ReturnType<typeof loadContract>,
  token: ReturnType<typeof loadContract>,
  system: ReturnType<typeof loadContract>;
const scope = (s: string) => BigInt(Name.from(s).value.toString());
const balance = (account: string) =>
  z
    .object({ balance: z.string() })
    .parse(
      row(
        token,
        'accounts',
        scope(account),
        BigInt(Asset.from('0.0000 TLOS').symbol.code.value.toString()),
      ),
    ).balance;
async function profit() {
  await send(names, 'setprofit', ['daclifycore', 1, 100, 515, 29, now], 'daclifycore@active');
}
async function fulfill(net: number, gross = 142) {
  return send(
    names,
    'fulfillnet',
    ['relay', 'dacux1111111', key, key, gross, net, ref],
    'relay@active',
  );
}
beforeEach(async () => {
  const chain = new Blockchain();
  chain.setTime(TimePoint.fromMilliseconds(now * 1000));
  chain.createAccounts('daclifycore', 'relay', 'alice', 'carol');
  names = loadContract(chain, 'names', '.artifacts/contracts/names');
  // VERT omits inherited authorization through system resource actions; native compute checks the real authority.
  const active = names.permissions.find((p) => p.perm_name.toString() === 'active');
  if (!active) throw new Error('FIXTURE_PERMISSION');
  names.setPermissions([
    ...names.permissions.filter((p) => p !== active),
    API.v1.AccountPermission.from({
      perm_name: 'active',
      parent: 'owner',
      required_auth: {
        threshold: 1,
        keys: [],
        accounts: [
          { permission: { actor: 'names', permission: 'eosio.code' }, weight: 1 },
          { permission: { actor: 'eosio', permission: 'eosio.code' }, weight: 1 },
        ],
        waits: [],
      },
    }),
  ]);
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  system = loadContract(chain, 'eosio', '.artifacts/contracts/eosstub');
  await send(names, 'init', ['daclifycore', 'relay', 'eosio.token', '4,TLOS'], 'names@active');
  await send(
    names,
    'setrates',
    ['daclifycore', 500, 10000, 'alice', 'eosio.token', '4,TLOS'],
    'daclifycore@active',
  );
  await send(token, 'create', ['eosio.token', '1000.0000 TLOS'], 'eosio.token@active');
  for (const account of ['names', 'carol'])
    await send(token, 'issue', [account, '100.0000 TLOS', ''], 'eosio.token@active');
  for (const account of ['alice', 'eosio'])
    await send(token, 'open', [account, '4,TLOS', account], account + '@active');
  await send(
    names,
    'settier',
    [0, '0.0000 TLOS', 100, 30720, '0.5000 TLOS', '0.5000 TLOS'],
    'names@active',
  );
  await send(names, 'setoracle', ['daclifycore', 176, 4, now], 'daclifycore@active');
  await send(
    system,
    'setmarket',
    [
      '10000000000.0000 RAMCORE',
      '20963900417 RAM',
      '1193977.8471 TLOS',
      '1.7587 TLOS',
      'eosio.token',
    ],
    'eosio@active',
  );
});
describe('Names minimum profit', () => {
  it('uses the same resource and exchange-rate floor for suffix registrations', async () => {
    await profit();
    await expect(
      send(names, 'regsuffix', ['carol', '71.5909 TLOS', 0, 1], 'carol@active'),
    ).rejects.toThrow('NAME_PRICE_FLOOR');
    await expect(
      send(names, 'regsuffix', ['carol', '0.0000 TLOS', 141, 1], 'carol@active'),
    ).rejects.toThrow('NAME_PRICE_FLOOR');
    await send(names, 'regsuffix', ['carol', '71.5910 TLOS', 142, 1], 'carol@active');
    await send(
      system,
      'setmarket',
      [
        '10000000000.0000 RAMCORE',
        '20963900417 RAM',
        '2387955.6942 TLOS',
        '3.5174 TLOS',
        'eosio.token',
      ],
      'eosio@active',
    );
    await expect(
      send(names, 'regsuffix', ['carol', '71.5910 TLOS', 0, 1], 'carol@active'),
    ).rejects.toThrow('NAME_PRICE_FLOOR');
    await send(names, 'regsuffix', ['carol', '73.6364 TLOS', 0, 1], 'carol@active');
    await send(names, 'setoracle', ['daclifycore', 88, 4, now], 'daclifycore@active');
    await expect(
      send(names, 'regsuffix', ['carol', '73.6364 TLOS', 0, 1], 'carol@active'),
    ).rejects.toThrow('NAME_PRICE_FLOOR');
    await send(names, 'regsuffix', ['carol', '141.8182 TLOS', 0, 1], 'carol@active');
  });
  it('requires a fresh oracle for a suffix floor and keeps native-only registration when card fee evidence expires', async () => {
    await send(
      names,
      'setprofit',
      ['daclifycore', 1, 100, 515, 29, now - 8 * 86400],
      'daclifycore@active',
    );
    await send(names, 'regsuffix', ['carol', '71.5910 TLOS', 0, 1], 'carol@active');
    await expect(
      send(names, 'regsuffix', ['carol', '71.5910 TLOS', 142, 1], 'carol@active'),
    ).rejects.toThrow('NAME_FEE_REFERENCE');
    await send(names, 'setoracle', ['daclifycore', 176, 4, now - 901], 'daclifycore@active');
    await expect(
      send(names, 'regsuffix', ['carol', '80.0000 TLOS', 0, 1], 'carol@active'),
    ).rejects.toThrow('ORACLE_STALE');
  });
  it('refuses a gross-only card attestation after policy activation', async () => {
    await profit();
    await expect(
      send(names, 'fulfill', ['relay', 'dacux1111111', key, key, 142, ref], 'relay@active'),
    ).rejects.toThrow('NAME_NET_REQUIRED');
  });
  it('requires operator authority and supported policy version', async () => {
    await expect(
      send(names, 'setprofit', ['daclifycore', 1, 100, 515, 29, now], 'carol@active'),
    ).rejects.toThrow();
    await expect(
      send(names, 'setprofit', ['daclifycore', 2, 100, 515, 29, now], 'daclifycore@active'),
    ).rejects.toThrow('NAME_PROFIT_POLICY');
  });
  it('counts actual costs, rolls back insufficient margin and accepts the same receipt once after recovery', async () => {
    await profit();
    await send(
      system,
      'setmarket',
      [
        '10000000000.0000 RAMCORE',
        '20963900417 RAM',
        '1193977.8471 TLOS',
        '4.0000 TLOS',
        'eosio.token',
      ],
      'eosio@active',
    );
    const before = balance('names');
    await expect(fulfill(108)).rejects.toThrow('NAME_PROFIT_LOW');
    expect(balance('names')).toBe(before);
    expect(names.tables.sales?.(names.toBigInt()).getTableRows()).toEqual([]);
    await send(
      system,
      'setmarket',
      [
        '10000000000.0000 RAMCORE',
        '20963900417 RAM',
        '1193977.8471 TLOS',
        '1.7587 TLOS',
        'eosio.token',
      ],
      'eosio@active',
    );
    await fulfill(105);
    expect(balance('names')).toBe('97.2413 TLOS');
    await expect(fulfill(105)).rejects.toThrow('NAME_SOLD');
    expect(names.tables.profitcheck?.(names.toBigInt()).getTableRows()).toEqual([]);
  });
  it('takes a matching live native quote and pays resources separately', async () => {
    await profit();
    await send(
      system,
      'setmarket',
      [
        '10000000000.0000 RAMCORE',
        '20963900417 RAM',
        '1193977.8471 TLOS',
        '1.7587 TLOS',
        'eosio.token',
      ],
      'eosio@active',
    );
    await send(names, 'intend', ['carol', 'dacux1111111', key, key], 'carol@active');
    await expect(
      send(
        token,
        'transfer',
        ['carol', 'names', '68.1819 TLOS', 'buy:dacux1111111'],
        'carol@active',
      ),
    ).rejects.toThrow('PRICE');
    await send(
      token,
      'transfer',
      ['carol', 'names', '71.5910 TLOS', 'buy:dacux1111111'],
      'carol@active',
    );
    expect(balance('alice')).toBe('71.5910 TLOS');
    expect(balance('names')).toBe('97.2413 TLOS');
  });
  it('rejects deposits during settlement that could conceal resource spending', async () => {
    await profit();
    await send(system, 'setrebate', ['0.0001 TLOS'], 'eosio@active');
    const before = balance('names');
    await expect(fulfill(105)).rejects.toThrow('NAME_PROFIT_PENDING');
    expect(balance('names')).toBe(before);
    expect(names.tables.sales?.(names.toBigInt()).getTableRows()).toEqual([]);
  });
  it('accepts a previously paid quote when its verified net still covers current costs', async () => {
    await profit();
    await fulfill(105, 150);
    expect(names.tables.sales?.(names.toBigInt()).getTableRows()).toHaveLength(1);
  });
  it('rejects stale conversion evidence even when gross/net look sufficient', async () => {
    await profit();
    await send(names, 'setoracle', ['daclifycore', 176, 4, now - 901], 'daclifycore@active');
    await expect(fulfill(141)).rejects.toThrow('ORACLE_STALE');
  });
  it('preserves legacy fulfillment while profit policy is absent', async () => {
    await send(names, 'fulfill', ['relay', 'dacux1111111', key, key, 100, ref], 'relay@active');
    expect(names.tables.sales?.(names.toBigInt()).getTableRows()).toHaveLength(1);
  });
});
