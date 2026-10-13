import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import { encodeContractAbi } from '../../tools/deploy/actions.js';
import { AccountSchema, CreateDaoSchema, defaultDaoSetup } from '../../protocol/index.js';
import { encodeAction, RuntimeCodeHash } from '../../sdk/index.js';
let owned: NativeContracts | undefined;
const f = () => {
  if (!owned) throw Error('Owned fixture absent');
  return owned;
};
const legacy = '.artifacts/claim-upgrade18/runtime';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
beforeAll(async () => {
  // Built from the frozen release source by npm run build:claim-upgrade.
  expect(hash(await readFile(legacy + '.wasm'))).toBe(
    'e6aaeeccb949710444e0fe4ca32331ffeeb5a6eeae688a417ae3d22cd3469d95',
  );
  owned = await nativeContracts();
  await owned.deploy('daclifycore', legacy);
  await owned.push(
    contextLinkRepairActions(owned.context, await owned.api.v1.chain.get_account('daclifycore')),
    [owned.key('daclifycore')],
  );
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it('preserves an existing governing DAO, permissions and pending legacy receipt through forward and rollback upgrades', async () => {
  const governing = await f().executiveTree();
  await f().call('daclifycore', 'setgov', { dao_id: governing.daoId }, 'daclifycore', 'owner', [
    f().key('recovery'),
  ]);
  await governing.act(
    'daclifycore',
    'govcreate',
    encodeAction('govcreate', {
      ...governing.actor(),
      shared_usd: 0,
      independent_usd: 5000,
      premium_bps: 2000,
      settler: 'relay',
    }),
  );
  await governing.act(
    'daclifycore',
    'govhosted',
    encodeAction('govhosted', { ...governing.actor(), free_members: 10, settler: 'relay' }),
  );
  const account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    }),
    custody: 'user-controlled',
  });
  const reference = hash(new TextEncoder().encode(randomUUID()));
  await f().call('daclifycore', 'orderfree', { reference, creator: account.signingKey }, 'relay');
  const rows = async (table: string, scope: string) =>
    (
      await f().api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope,
        table,
        json: true,
        limit: 100,
      })
    ).rows;
  const existing = await Promise.all(
    ['members', 'executives', 'actors'].map((table) => rows(table, governing.daoId)),
  );
  const receipt = await rows('createords', 'daclifycore');
  const permissions = (await f().api.v1.chain.get_account('daclifycore')).permissions;
  const balances = await f().api.v1.chain.get_currency_balance(
    'eosio.token',
    'daclifycore',
    'TLOS',
  );
  async function deploy(path: string) {
    await f().push(
      [
        f().system(
          'setcode',
          {
            account: 'daclifycore',
            vmtype: 0,
            vmversion: 0,
            code: (await readFile(path + '.wasm')).toString('hex'),
          },
          'daclifycore',
          'owner',
        ),
        f().system(
          'setabi',
          { account: 'daclifycore', abi: encodeContractAbi(await readFile(path + '.abi', 'utf8')) },
          'daclifycore',
          'owner',
        ),
      ],
      [f().key('recovery')],
    );
  }
  await deploy('.artifacts/contracts/runtime');
  expect((await f().api.v1.chain.get_raw_abi('daclifycore')).code_hash.toString()).toBe(
    RuntimeCodeHash,
  );
  expect(await rows('createords', 'daclifycore')).toEqual(receipt);
  expect(
    await Promise.all(
      ['members', 'executives', 'actors'].map((table) => rows(table, governing.daoId)),
    ),
  ).toEqual(existing);
  const gateway = new NativeChainGateway({
    rpcUrl: f().url,
    chainId: f().chainId,
    runtime: 'daclifycore',
    hub: 'daclifyhub',
    environment: 'local',
    relayActor: 'relay',
    relayKey: f().key('relay'),
    modules: nativeModules,
    bootstrap: { owner: 'daclifycore', key: f().key('relay') },
  });
  const summary = await gateway.createDao(
    account,
    CreateDaoSchema.parse({
      metadata: { schemaVersion: 1, title: 'Claim using pre-upgrade receipt' },
      privacy: 'public',
      token: { chainId: f().chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      setup: defaultDaoSetup('custom'),
    }),
    { reference, daoId: '912345', founderExecutive: true },
  );
  expect(summary.members).toBe(1);
  expect((await gateway.governance('912345')).executiveMembers).toMatchObject([
    { id: '1', active: true, admin: true, signing_key: account.signingKey },
  ]);
  const completed = await rows('createords', 'daclifycore'),
    members = await rows('members', '912345'),
    offices = await rows('executives', '912345');
  await deploy(legacy);
  expect(await rows('createords', 'daclifycore')).toEqual(completed);
  expect(await rows('members', '912345')).toEqual(members);
  expect(await rows('executives', '912345')).toEqual(offices);
  await deploy('.artifacts/contracts/runtime');
  expect((await f().api.v1.chain.get_account('daclifycore')).permissions).toEqual(permissions);
  expect(await f().api.v1.chain.get_currency_balance('eosio.token', 'daclifycore', 'TLOS')).toEqual(
    balances,
  );
  expect(
    await Promise.all(
      ['members', 'executives', 'actors'].map((table) => rows(table, governing.daoId)),
    ),
  ).toEqual(existing);
  expect(await rows('createords', 'daclifycore')).toEqual(completed);
}, 30000);
