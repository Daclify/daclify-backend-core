import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { AccountSchema, CreateDaoSchema, defaultDaoSetup } from '../../protocol/index.js';
import { encodeAction } from '../../sdk/index.js';
let owned: NativeContracts | undefined;
let gateway: NativeChainGateway;
const f = () => {
  if (!owned) throw Error('OWNED_FIXTURE_REQUIRED');
  return owned;
};
beforeAll(async () => {
  owned = await nativeContracts();
  await owned.push(
    contextLinkRepairActions(owned.context, await owned.api.v1.chain.get_account('daclifycore')),
    [owned.key('daclifycore')],
  );
  const governing = await owned.executiveTree();
  await owned.call('daclifycore', 'setgov', { dao_id: governing.daoId }, 'daclifycore', 'owner', [
    owned.key('recovery'),
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
  gateway = new NativeChainGateway({
    rpcUrl: owned.url,
    chainId: owned.chainId,
    runtime: 'daclifycore',
    hub: 'daclifyhub',
    environment: 'local',
    relayActor: 'relay',
    relayKey: owned.key('relay'),
    modules: nativeModules,
    bootstrap: { owner: 'daclifycore', key: owned.key('relay') },
  });
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it('creates the sole admin and executive using only the unchanged narrow bootstrap service', async () => {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: PrivateKey.generate('K1').toPublic().toString(),
    encryptionKey: keys.publicKey.export({ format: 'jwk' }),
    custody: 'user-controlled',
  });
  if (!account.signingKey) throw Error('OWNED_PUBLIC_IDENTITY');
  const input = CreateDaoSchema.parse({
    metadata: { schemaVersion: 1, title: 'Owned claim founder' },
    privacy: 'public',
    token: { chainId: f().chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
    setup: defaultDaoSetup(),
  });
  const reference = createHash('sha256').update(randomUUID()).digest('hex');
  await gateway.orderCreation(reference, account.signingKey, 'free');
  const before = await f().api.v1.chain.get_account('daclifycore');
  const balances = await Promise.all(
    ['alice', 'bob', 'relay', 'daclifycore'].map(async (name) =>
      (await f().api.v1.chain.get_currency_balance('eosio.token', name, 'TLOS')).map((value) =>
        value.toString(),
      ),
    ),
  );
  const realFetch = globalThis.fetch.bind(globalThis);
  const cpu: number[] = [];
  const observation = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const response = await realFetch(url, init);
    if (String(url).endsWith('/v1/chain/push_transaction') && response.ok) {
      const receipt = z
        .object({ processed: z.object({ receipt: z.object({ cpu_usage_us: z.number() }) }) })
        .parse(await response.clone().json());
      cpu.push(receipt.processed.receipt.cpu_usage_us);
    }
    return response;
  });
  const summary = await gateway
    .createDao(account, input, {
      reference,
      daoId: '90101',
      founderExecutive: true,
    })
    .finally(() => observation.mockRestore());
  expect(summary.members).toBe(1);
  const state = await gateway.governance(summary.reference.daoId);
  expect(state.executiveMembers).toHaveLength(1);
  expect(state.executiveMembers[0]).toMatchObject({
    id: '1',
    signing_key: account.signingKey,
    admin: true,
    active: true,
  });
  expect(state.executives).toHaveLength(1);
  expect(state.executives[0]).toMatchObject({ member_id: '1', office_epoch: '1' });
  expect(state.executivePolicy).toMatchObject({ inactivity_seconds: 0, quorum_bps: 10000 });
  const after = await f().api.v1.chain.get_account('daclifycore');
  expect(
    await Promise.all(
      ['alice', 'bob', 'relay', 'daclifycore'].map(async (name) =>
        (await f().api.v1.chain.get_currency_balance('eosio.token', name, 'TLOS')).map((value) =>
          value.toString(),
        ),
      ),
    ),
  ).toEqual(balances);
  expect(cpu).toHaveLength(1);
  expect(cpu[0]).toBeGreaterThan(0);
  const ramDelta = after.ram_usage.toNumber() - before.ram_usage.toNumber();
  expect(ramDelta).toBeGreaterThan(0);
  mkdirSync('.artifacts/native-claims', { recursive: true });
  writeFileSync(
    '.artifacts/native-claims/founder-resources.json',
    JSON.stringify(
      {
        cpuUsageUs: cpu[0],
        ramBytes: ramDelta,
        tokenMovement: false,
        authorityChanged: false,
      },
      null,
      2,
    ) + '\n',
  );
  expect(after.permissions.map((p) => p.toJSON())).toEqual(
    before.permissions.map((p) => p.toJSON()),
  );
  await expect(
    f().call(
      'daclifycore',
      'appoint',
      {
        dao_id: summary.reference.daoId,
        member_ids: ['1'],
        inactivity_seconds: 0,
        quorum_bps: 10000,
      },
      'daclifycore',
      'service',
      [f().key('relay')],
    ),
  ).rejects.toThrow();
}, 30000);
