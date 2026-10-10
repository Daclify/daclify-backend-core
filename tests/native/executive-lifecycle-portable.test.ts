import { afterAll, beforeAll, expect, it } from 'vitest';
import { encodeDecide } from '@daclify/modules/sdk';
import { encodeAction, RuntimeTableSchemas } from '../../sdk/index.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import {
  nativeContracts,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let owned: NativeContracts | undefined;
let governing: DummyDao;
const f = () => {
  if (!owned) throw new Error('FIXTURE_REQUIRED');
  return owned;
};
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function active() {
  const rows = (await f().api.v1.chain.get_account('daclifycore')).permissions;
  expect(
    rows
      .find((row) => row.perm_name.toString() === 'owner')
      ?.required_auth.accounts.map((row) => row.permission.toString()),
  ).toEqual(['recovery@active']);
  const auth = rows.find((row) => row.perm_name.toString() === 'active')?.required_auth;
  if (!auth) throw new Error('FIXTURE_ACTIVE');
  const threshold = auth.threshold.toNumber();
  expect(
    auth.accounts
      .find((row) => row.permission.toString() === 'daclifycore@eosio.code')
      ?.weight.toNumber(),
  ).toBe(threshold);
  return {
    threshold,
    signers: auth.accounts
      .filter((row) => row.permission.permission.toString() === 'active')
      .map((row) => row.permission.actor.toString()),
  };
}
beforeAll(async () => {
  owned = await nativeContracts();
  await owned.push(
    contextLinkRepairActions(owned.context, await owned.api.v1.chain.get_account('daclifycore')),
    [owned.key('daclifycore')],
  );
  governing = await owned.executiveTree();
  await owned.call(
    'daclifycore',
    'appoint',
    { dao_id: governing.daoId, member_ids: ['1', '2'], inactivity_seconds: 60, quorum_bps: 10000 },
    'daclifycore',
    'active',
    [owned.key('alice'), owned.key('bob')],
  );
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it('expires one executive, synchronizes through code and restores returning quorum weight', async () => {
  expect(await active()).toEqual({ threshold: 2, signers: ['alice', 'bob'] });
  const until = Date.now() + 63000;
  while (Date.now() < until) {
    await governing.act('daclifycore', 'heartbeat', encodeAction('heartbeat', governing.actor()));
    await wait(Math.min(14000, Math.max(1, until - Date.now())));
  }
  await f().call('daclifycore', 'syncexec', { dao_id: governing.daoId }, 'relay');
  expect(await active()).toEqual({ threshold: 1, signers: ['alice'] });
  expect((await governing.member('2')).admin).toBe(false);
  await governing.act(
    'daclifycore',
    'heartbeat',
    encodeAction('heartbeat', governing.actor('2')),
    '2',
  );
  expect(await active()).toEqual({ threshold: 2, signers: ['alice', 'bob'] });
  expect((await governing.member('2')).admin).toBe(true);
}, 90000);
it('retains an all-inactive roster until an elected successor pairs, then activates without creator signatures', async () => {
  const now = Math.floor(Date.now() / 1000);
  await governing.document();
  await governing.act(
    'decide',
    'newelect',
    encodeDecide('newelect', {
      ...governing.actor(),
      election_id: '1',
      title: 'Executives',
      document_id: '1',
      document_version: 1,
      nomination_close: now + 4,
      term_start: now + 76,
      term_end: now + 600,
      seats: 1,
    }),
  );
  await governing.act(
    'decide',
    'nominate',
    encodeDecide('nominate', { ...governing.actor('3'), election_id: '1', active: true }),
    '3',
  );
  while (Math.floor(Date.now() / 1000) < now + 4) await wait(250);
  await governing.act(
    'decide',
    'startelect',
    encodeDecide('startelect', { ...governing.actor(), election_id: '1' }),
  );
  for (const member of ['1', '2'])
    await governing.act(
      'decide',
      'vote',
      encodeDecide('vote', { ...governing.actor(member), ballot_id: '1', choice: 1 }),
      member,
    );
  while (Math.floor(Date.now() / 1000) <= now + 66) await wait(500);
  await f().call(
    'decide',
    'finalize',
    { runtime: 'daclifycore', dao_id: governing.daoId, ballot_id: '1' },
    'relay',
  );
  const pending = await f().api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: 'daclifycore',
    table: 'execpending',
    limit: 1,
  });
  expect(RuntimeTableSchemas.execpending.parse(pending.rows[0])).toMatchObject({
    dao_id: governing.daoId,
    members: ['3'],
  });
  expect(await active()).toEqual({ threshold: 2, signers: ['alice', 'bob'] });
  while (Math.floor(Date.now() / 1000) < now + 77) await wait(500);
  await f().call('daclifycore', 'syncexec', { dao_id: governing.daoId }, 'relay');
  expect(await active()).toEqual({ threshold: 2, signers: ['alice', 'bob'] });
  expect((await governing.member('3')).admin).toBe(false);
  await governing.act(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...governing.actor('3'), account: 'carol' }),
    '3',
    'carol',
  );
  expect(await active()).toEqual({ threshold: 1, signers: ['carol'] });
  expect((await governing.member('3')).admin).toBe(true);
  expect((await governing.member()).admin).toBe(false);
  await expect(
    governing.act('daclifycore', 'heartbeat', encodeAction('heartbeat', governing.actor())),
  ).rejects.toThrow('EXECUTIVE_REQUIRED');
}, 105000);
