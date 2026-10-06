import { beforeEach, describe, it, expect } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey, Name } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, send, row } from './helpers/vert.js';
import { wasmCodeHash } from './helpers/code-hash.js';
import { listFirstParty } from './helpers/list-module.js';
const worksHash = wasmCodeHash('.artifacts/contracts/modrelay.wasm');
let core: ReturnType<typeof load>;
function load() {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'eosio.token');
  const core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  return core;
}
beforeEach(async () => {
  core = load();
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(core, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const id of [1, 2])
    await send(
      core,
      'enroll',
      [1, id, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
});
describe('walletless DAO administration', () => {
  it('installs a bounded module through an internal administrator', async () => {
    await listFirstParty(core, 'works', worksHash);
    await send(
      core,
      'modconfig',
      ['daclifycore', 1, 1, 'works', 1, ['propose'], ['reserve'], worksHash],
      'daclifycore@active',
    );
    const module = z
      .object({ version: z.number(), grants: z.array(z.string()) })
      .parse(row(core, 'modules', 1n, BigInt(Name.from('works').value.toString())));
    expect(module.grants).toEqual(['reserve']);
  });
  it('rejects module installation by a regular member', async () => {
    await expect(
      send(
        core,
        'modconfig',
        ['daclifycore', 1, 2, 'works', 1, ['propose'], ['reserve'], worksHash],
        'daclifycore@active',
      ),
    ).rejects.toThrow('ADMIN_REQUIRED');
  });
  it('rejects unknown capabilities', async () => {
    await expect(
      send(
        core,
        'modconfig',
        ['daclifycore', 1, 1, 'works', 1, ['propose'], ['takeall'], worksHash],
        'daclifycore@active',
      ),
    ).rejects.toThrow('MODULE_GRANT_UNKNOWN');
  });
  it('sets and burns governance credits without changing membership', async () => {
    await send(core, 'setcredits', ['daclifycore', 1, 1, 2, 100], 'daclifycore@active');
    await send(core, 'setcredits', ['daclifycore', 1, 1, 2, 40], 'daclifycore@active');
    expect(
      z
        .object({
          credit_supply: z.number(),
          eligible_credits: z.number(),
          member_count: z.number(),
        })
        .parse(row(core, 'daos', core.toBigInt(), 1n)),
    ).toMatchObject({ credit_supply: 40, eligible_credits: 40, member_count: 2 });
  });
  it('rejects credit control by an ordinary member', async () => {
    await expect(
      send(core, 'setcredits', ['daclifycore', 1, 2, 2, 100], 'daclifycore@active'),
    ).rejects.toThrow('ADMIN_REQUIRED');
  });
});
