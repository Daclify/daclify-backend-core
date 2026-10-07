import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { TimePointSec } from '@greymass/eosio';
import { PrivateKey, ABI, Checksum256, Serializer, Name } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
let runtime: ReturnType<typeof loadContract>;
let chain: Blockchain;
const keys = new Map<string, PrivateKey>();
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay', 'eosio.token');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    'daclifycore@active',
  );
  for (const id of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [id, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    for (const member of [1, 2]) {
      const key = PrivateKey.generate('K1');
      keys.set(`${id}:${member}`, key);
      await send(
        runtime,
        'enroll',
        [id, member, '', key.toPublic().toString(), 'key', 0],
        'alice@active',
      );
    }
  }
  await send(runtime, 'setgov', [1], 'daclifycore@active');
});
describe('free shared creation and paid membership capacity', () => {
  const reference = 'cd'.repeat(32);
  const now = () => chain.timestamp.toMilliseconds() / 1000;
  async function enroll(id: number) {
    return send(
      runtime,
      'enroll',
      [2, id, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
  }
  it('preserves upgrades against older same-period invoices and refuses revoked receipt replay', async () => {
    await send(runtime, 'sethosted', [10, 'relay'], 'daclifycore@active');
    const end = now() + 3600;
    await send(runtime, 'setcapacity', [2, 20, end, reference], 'relay@active');
    await send(runtime, 'setcapacity', [2, 11, end, 'ab'.repeat(32)], 'relay@active');
    const cap = z.object({ members: z.number(), receipt: z.string() });
    expect(cap.parse(row(runtime, 'daocaps', runtime.toBigInt(), 2n)).members).toBe(20);
    await send(runtime, 'revokecap', [2, reference], 'relay@active');
    await expect(
      send(runtime, 'setcapacity', [2, 20, end, reference], 'relay@active'),
    ).rejects.toThrow('CAPACITY_RECEIPT');
    await send(runtime, 'setcapacity', [2, 11, end, 'ab'.repeat(32)], 'relay@active');
    expect(cap.parse(row(runtime, 'daocaps', runtime.toBigInt(), 2n)).members).toBe(11);
    await expect(send(runtime, 'resumecap', [2, reference], 'bob@active')).rejects.toThrow();
    await send(runtime, 'resumecap', [2, reference], 'relay@active');
    expect(cap.parse(row(runtime, 'daocaps', runtime.toBigInt(), 2n)).members).toBe(20);
    await send(runtime, 'setcapacity', [2, 10, end + 3600, 'ef'.repeat(32)], 'relay@active');
    expect(cap.parse(row(runtime, 'daocaps', runtime.toBigInt(), 2n)).members).toBe(10);
  });
  it('governs the per-slot price without changing existing capacity receipts', async () => {
    await send(runtime, 'sethosted', [10, 'relay'], 'daclifycore@active');
    await governance('govseatfee', { first_usd: 100, next_usd: 50, rest_usd: 20 });
    const policy = z.object({
      first_usd: z.number(),
      next_usd: z.number(),
      rest_usd: z.number(),
      revision: z.number(),
    });
    expect(
      policy.parse(
        row(runtime, 'seatcfg', runtime.toBigInt(), BigInt(Name.from('seatcfg').value.toString())),
      ),
    ).toEqual({ first_usd: 100, next_usd: 50, rest_usd: 20, revision: 1 });
    await send(runtime, 'setcapacity', [2, 20, now() + 3600, reference], 'relay@active');
    await governance('govseatfee', { first_usd: 125, next_usd: 60, rest_usd: 25 });
    expect(
      policy.parse(
        row(runtime, 'seatcfg', runtime.toBigInt(), BigInt(Name.from('seatcfg').value.toString())),
      ),
    ).toEqual({ first_usd: 125, next_usd: 60, rest_usd: 25, revision: 2 });
    expect(
      z.object({ members: z.number() }).parse(row(runtime, 'daocaps', runtime.toBigInt(), 2n))
        .members,
    ).toBe(20);
    await expect(
      governance('govseatfee', { first_usd: 100, next_usd: 50, rest_usd: 20 }, 2),
    ).rejects.toThrow('PLATFORM_DAO');
    await expect(
      governance('govseatfee', { first_usd: 0, next_usd: 50, rest_usd: 20 }),
    ).rejects.toThrow('HOSTED_PRICE');
    await expect(
      governance('govseatfee', { first_usd: 100000, next_usd: 50, rest_usd: 20 }),
    ).rejects.toThrow('HOSTED_PRICE');
  });
  it('creates a paid zero-price order only through the configured free shared path', async () => {
    await send(runtime, 'sethosted', [10, 'relay'], 'daclifycore@active');
    const creator = PrivateKey.generate('K1').toPublic().toString();
    await expect(send(runtime, 'orderfree', [reference, creator], 'bob@active')).rejects.toThrow();
    await send(runtime, 'orderfree', [reference, creator], 'relay@active');
    expect(
      z
        .object({ usd_cents: z.number(), method: z.number(), paid: z.boolean() })
        .parse(row(runtime, 'createords', runtime.toBigInt(), 1n)),
    ).toMatchObject({ usd_cents: 0, method: 2, paid: true });
    await send(
      runtime,
      'createpaid',
      [3, 'alice', '{}', 0, 'eosio.token', '4,TLOS', reference, creator],
      ['alice@active', 'relay@active'],
    );
    await expect(
      send(
        runtime,
        'createpaid',
        [4, 'alice', '{}', 0, 'eosio.token', '4,TLOS', reference, creator],
        ['alice@active', 'relay@active'],
      ),
    ).rejects.toThrow('CREATION_USED');
  });
  it('gates every admission and reactivation while preserving existing member governance after expiry', async () => {
    await send(runtime, 'sethosted', [10, 'relay'], 'daclifycore@active');
    for (let id = 3; id <= 10; id++) await enroll(id);
    await expect(enroll(11)).rejects.toThrow('MEMBERSHIP_CAPACITY');
    await expect(
      send(runtime, 'setcapacity', [2, 20, now() + 3600, reference], 'bob@active'),
    ).rejects.toThrow();
    await send(runtime, 'setcapacity', [2, 20, now() + 3600, reference], 'relay@active');
    await enroll(11);
    chain.addTime(TimePointSec.from(3601));
    await expect(enroll(12)).rejects.toThrow('MEMBERSHIP_CAPACITY');
    await governance(
      'setmeta',
      { metadata: '{"schemaVersion":1,"title":"Still governed","description":""}' },
      2,
    );
    await governance('setactive', { target: 11, active: false }, 2);
    await expect(governance('setactive', { target: 11, active: true }, 2)).rejects.toThrow(
      'MEMBERSHIP_CAPACITY',
    );
  });
  it('records each receipt once and cannot replay another DAO entitlement or shrink legacy members', async () => {
    await send(runtime, 'sethosted', [10, 'relay'], 'daclifycore@active');
    await send(runtime, 'setcapacity', [2, 20, now() + 3600, reference], 'relay@active');
    await send(runtime, 'setcapacity', [2, 20, now() + 3600, reference], 'relay@active');
    await expect(
      send(runtime, 'setcapacity', [1, 20, now() + 3600, reference], 'relay@active'),
    ).rejects.toThrow('CAPACITY_RECEIPT');
    await send(runtime, 'revokecap', [2, reference], 'relay@active');
    expect(
      z.object({ member_count: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 2n))
        .member_count,
    ).toBe(2);
  });
});
async function governance(action: string, values: Record<string, unknown>, dao = 1, member = 1) {
  const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const key = keys.get(`${dao}:${member}`);
  if (!key) throw new Error('Fixture key required');
  const nonce = z
    .object({ nonce: z.union([z.number(), z.string()]) })
    .parse(row(runtime, 'members', BigInt(dao), BigInt(member))).nonce;
  const request = {
    version: 1,
    chain_id: 'ab'.repeat(32),
    deployment: 'daclifycore',
    dao_id: dao,
    member_id: member,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action,
    data: Serializer.encode({
      abi,
      type: action,
      object: { runtime: 'daclifycore', dao_id: dao, member_id: member, ...values },
    }).hexString,
  };
  await send(
    runtime,
    'submit',
    [
      request,
      key
        .signDigest(
          Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request })),
        )
        .toString(),
    ],
    'relay@active',
  );
}
const change = (bps: number, dao = 1, member = 1) => governance('govpayfees', { bps }, dao, member);
describe('Daclify DAO Connect commission', () => {
  it('records fee changes with monotonic revision separately from native module fees', async () => {
    await change(500);
    const schema = z.object({ bps: z.number(), revision: z.union([z.number(), z.string()]) });
    expect(
      schema.parse(
        row(runtime, 'paycfg', runtime.toBigInt(), BigInt(Name.from('paycfg').value.toString())),
      ),
    ).toEqual({ bps: 500, revision: 1 });
    await change(0);
    expect(
      schema.parse(
        row(runtime, 'paycfg', runtime.toBigInt(), BigInt(Name.from('paycfg').value.toString())),
      ),
    ).toEqual({ bps: 0, revision: 2 });
  });
  it('rejects another DAO administrator and ordinary platform members', async () => {
    await expect(change(500, 2, 1)).rejects.toThrow('PLATFORM_DAO');
    await expect(change(500, 1, 2)).rejects.toThrow('ADMIN_REQUIRED');
    await expect(
      send(runtime, 'govpayfees', ['daclifycore', 1, 1, 500], 'bob@active'),
    ).rejects.toThrow();
  });
  it('rejects a commission consuming the whole charge', async () => {
    await expect(change(10000)).rejects.toThrow('FEE_BPS');
  });
});
