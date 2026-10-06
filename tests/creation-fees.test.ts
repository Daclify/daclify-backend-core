import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { TimePointSec } from '@greymass/eosio';
import { loadContract, send, row } from './helpers/vert.js';
import { z } from 'zod';
const creator = PrivateKey.generate('K1').toPublic().toString();
const ref = 'ab'.repeat(32);
let chain: Blockchain,
  core: ReturnType<typeof loadContract>,
  token: ReturnType<typeof loadContract>;
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'relay', 'treasury', 'bob');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(
    core,
    'setfees',
    [500, 10000, 'treasury', 'eosio.token', '4,TLOS', ''],
    'daclifycore@active',
  );
  await send(token, 'create', ['alice', '1000000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '1000.0000 TLOS', ''], 'alice@active');
  await send(core, 'setcreate', [2000, 5000, 2000, 'relay'], 'daclifycore@active');
  await send(
    core,
    'setcrrate',
    [10000, 4, chain.timestamp.toMilliseconds() / 1000],
    'daclifycore@active',
  );
});
const order = () => send(core, 'ordercreate', [ref, creator, 0, 0], 'relay@active');
const pay = (amount = '24.0000 TLOS') =>
  send(token, 'transfer', ['alice', 'daclifycore', amount, 'create:' + ref], 'alice@active');
const paid = () =>
  send(
    core,
    'createpaid',
    [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS', ref, creator],
    ['alice@active', 'relay@active'],
  );
describe('DAO creation payment authority', () => {
  it('rejects the old unpaid creation path when fees are configured', async () => {
    await expect(
      send(core, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active'),
    ).rejects.toThrow('CREATION_PAYMENT_REQUIRED');
  });
  it('charges the quoted TLOS fee and consumes payment once', async () => {
    await order();
    await expect(paid()).rejects.toThrow('CREATION_UNPAID');
    await expect(pay('23.9999 TLOS')).rejects.toThrow('CREATION_AMOUNT');
    await pay();
    await paid();
    expect(
      z
        .object({ used: z.boolean(), dao_id: z.number() })
        .parse(row(core, 'createords', core.toBigInt(), 1n)),
    ).toMatchObject({ used: true, dao_id: 1 });
    await expect(paid()).rejects.toThrow('CREATION_USED');
  });
  it('refuses expired TLOS quotes atomically', async () => {
    await order();
    chain.addTime(TimePointSec.from(901));
    await expect(pay()).rejects.toThrow('CREATION_EXPIRED');
  });
  it('requires the attestor and exact captured USD amount for card payment', async () => {
    await send(core, 'ordercreate', [ref, creator, 0, 1], 'relay@active');
    const now = chain.timestamp.toMilliseconds() / 1000;
    await expect(
      send(core, 'cardcreate', [ref, 1999, 'cd'.repeat(32), now], 'relay@active'),
    ).rejects.toThrow('CREATION_AMOUNT');
    await expect(
      send(core, 'cardcreate', [ref, 2000, 'cd'.repeat(32), now], 'bob@active'),
    ).rejects.toThrow();
    await send(core, 'cardcreate', [ref, 2000, 'cd'.repeat(32), now], 'relay@active');
    await paid();
  });
  it('does not let another native owner consume a customer receipt', async () => {
    await order();
    await pay();
    await expect(
      send(
        core,
        'createpaid',
        [1, 'bob', '{}', 0, 'eosio.token', '4,TLOS', ref, creator],
        'bob@active',
      ),
    ).rejects.toThrow();
  });
  it('rejects stale or future conversion observations', async () => {
    const now = chain.timestamp.toMilliseconds() / 1000;
    await expect(
      send(core, 'setcrrate', [10000, 4, now + 1], 'daclifycore@active'),
    ).rejects.toThrow('CREATION_RATE');
    chain.addTime(TimePointSec.from(901));
    await expect(order()).rejects.toThrow('CREATION_RATE');
  });
  it('keeps a paid receipt usable after creation fails validation', async () => {
    await order();
    await pay();
    await expect(
      send(
        core,
        'createpaid',
        [1, 'alice', 'not-json', 0, 'eosio.token', '4,TLOS', ref, creator],
        ['alice@active', 'relay@active'],
      ),
    ).rejects.toThrow('METADATA_JSON');
    expect(
      z.object({ used: z.boolean() }).parse(row(core, 'createords', core.toBigInt(), 1n)).used,
    ).toBe(false);
    await paid();
  });
  it('rejects duplicate TLOS payments and malformed creation memos', async () => {
    await order();
    await pay();
    await expect(pay()).rejects.toThrow('CREATION_PAID');
    await expect(
      send(
        token,
        'transfer',
        ['alice', 'daclifycore', '24.0000 TLOS', 'create:' + ref.toUpperCase()],
        'alice@active',
      ),
    ).rejects.toThrow('CREATION_REFERENCE');
  });
  it('deduplicates card attestation and rejects the same checkout for another order', async () => {
    const now = chain.timestamp.toMilliseconds() / 1000;
    await send(core, 'ordercreate', [ref, creator, 0, 1], 'relay@active');
    await send(core, 'cardcreate', [ref, 2000, 'cd'.repeat(32), now], 'relay@active');
    await send(core, 'cardcreate', [ref, 2000, 'cd'.repeat(32), now], 'relay@active');
    await send(core, 'ordercreate', ['ef'.repeat(32), creator, 0, 1], 'relay@active');
    await expect(
      send(core, 'cardcreate', ['ef'.repeat(32), 2000, 'cd'.repeat(32), now], 'relay@active'),
    ).rejects.toThrow('CREATION_CARD');
  });
  it('captures the independent $50 policy with its TLOS premium but cannot consume it for a shared DAO', async () => {
    await send(core, 'ordercreate', [ref, creator, 1, 0], 'relay@active');
    expect(
      z
        .object({ usd_cents: z.number(), tlos_due: z.string() })
        .parse(row(core, 'createords', core.toBigInt(), 1n)),
    ).toMatchObject({ usd_cents: 5000, tlos_due: '60.0000 TLOS' });
    await expect(paid()).rejects.toThrow('CREATION_OWNER');
  });
});
