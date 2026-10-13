import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';

const creator = PrivateKey.generate('K1').toPublic().toString();
const reference = 'ca'.repeat(32);
const settings = {
  participant_mode: 0,
  decide: 'decide',
  guardian: '',
  kind: 0,
  duration: 3600,
  quorum: 5000,
  approval: 5001,
  governed_works: false,
  max_commitment: '0',
  daily_commitment: '0',
};
const founder = { encryption_key: '{"owned":"public-fixture"}', custody: 0, settings };
let core: ReturnType<typeof loadContract>;
beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'relay', 'treasury', 'eosio.token', 'decide');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(
    core,
    'setfees',
    [500, 10000, 'treasury', 'eosio.token', '4,TLOS', ''],
    'daclifycore@active',
  );
  await send(core, 'setcreate', [0, 5000, 2000, 'relay'], 'daclifycore@active');
  await send(core, 'sethosted', [10, 'relay'], 'daclifycore@active');
  await send(core, 'orderfree', [reference, creator], 'relay@active');
});
function create(extra: unknown = founder, key = creator, id = 101, privacy = 0) {
  return send(
    core,
    'createpaid',
    {
      dao_id: id,
      owner: 'alice',
      metadata: '{}',
      privacy,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      reference,
      creator: key,
      founder: extra,
    },
    ['alice@active', 'relay@active'],
  );
}
function used() {
  return z.object({ used: z.boolean() }).parse(row(core, 'createords', core.toBigInt(), 1n)).used;
}
describe('claim creation founding executive', () => {
  it('atomically enrolls only the receipt creator as active administrator and executive', async () => {
    await create();
    expect(
      z
        .object({ member_count: z.number(), admin_count: z.number() })
        .parse(row(core, 'daos', core.toBigInt(), 101n)),
    ).toMatchObject({ member_count: 1, admin_count: 1 });
    expect(
      z
        .object({ active: z.boolean(), admin: z.boolean(), signing_key: z.string() })
        .parse(row(core, 'members', 101n, 1n)),
    ).toMatchObject({ active: true, admin: true, signing_key: creator });
    expect(
      z
        .object({ member_id: z.number(), office_epoch: z.number() })
        .parse(row(core, 'executives', 101n, 1n)),
    ).toEqual({ member_id: 1, office_epoch: 1 });
    expect(
      z
        .object({ inactivity_seconds: z.number(), quorum_bps: z.number() })
        .parse(row(core, 'execpols', core.toBigInt(), 101n)),
    ).toEqual({ inactivity_seconds: 0, quorum_bps: 10000 });
    expect(used()).toBe(true);
    await expect(create()).rejects.toThrow('CREATION_USED');
  });
  it('keeps legacy creation without the extension free of implicit appointments', async () => {
    await send(
      core,
      'createpaid',
      [101, 'alice', '{}', 0, 'eosio.token', '4,TLOS', reference, creator],
      ['alice@active', 'relay@active'],
    );
    expect(
      z.object({ member_count: z.number() }).parse(row(core, 'daos', core.toBigInt(), 101n))
        .member_count,
    ).toBe(0);
    expect(row(core, 'executives', 101n, 1n)).toBeUndefined();
  });
  it.each([
    ['empty encryption identity', { ...founder, encryption_key: '' }, 0, 'ENCRYPTION_KEY'],
    [
      'oversized encryption identity',
      { ...founder, encryption_key: 'x'.repeat(1025) },
      0,
      'ENCRYPTION_KEY',
    ],
    ['managed strict-private founder', { ...founder, custody: 1 }, 2, 'CUSTODY_POLICY'],
    [
      'agent-only human founder',
      { ...founder, settings: { ...settings, participant_mode: 2, guardian: 'alice' } },
      0,
      'CLAIM_PARTICIPANT_MODE',
    ],
  ])('rolls back the DAO and receipt for %s', async (_name, invalid, privacy, code) => {
    await expect(create(invalid, creator, 101, privacy)).rejects.toThrow(code);
    expect(used()).toBe(false);
    expect(row(core, 'daos', core.toBigInt(), 101n)).toBeUndefined();
    await create();
  });
  it('cannot substitute another founder key or overwrite an existing DAO', async () => {
    await expect(create(founder, PrivateKey.generate('K1').toPublic().toString())).rejects.toThrow(
      'CREATION_OWNER',
    );
    expect(used()).toBe(false);
    const other = 'cb'.repeat(32);
    await send(core, 'orderfree', [other, creator], 'relay@active');
    await send(
      core,
      'createpaid',
      [101, 'alice', '{}', 0, 'eosio.token', '4,TLOS', other, creator],
      ['alice@active', 'relay@active'],
    );
    await expect(create()).rejects.toThrow('DAO_EXISTS');
    expect(used()).toBe(false);
    expect(row(core, 'executives', 101n, 1n)).toBeUndefined();
  });
  it('does not let founder initialization bypass an unpaid receipt', async () => {
    await send(core, 'setcreate', [2000, 5000, 2000, 'relay'], 'daclifycore@active');
    const unpaid = 'ce'.repeat(32);
    await send(core, 'ordercreate', [unpaid, creator, 0, 1], 'relay@active');
    await expect(
      send(
        core,
        'createpaid',
        {
          dao_id: 101,
          owner: 'alice',
          metadata: '{}',
          privacy: 0,
          token_contract: 'eosio.token',
          token_symbol: '4,TLOS',
          reference: unpaid,
          creator,
          founder,
        },
        ['alice@active', 'relay@active'],
      ),
    ).rejects.toThrow('CREATION_UNPAID');
    expect(row(core, 'daos', core.toBigInt(), 101n)).toBeUndefined();
    expect(
      z.object({ used: z.boolean() }).parse(row(core, 'createords', core.toBigInt(), 2n)).used,
    ).toBe(false);
  });
});
