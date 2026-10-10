import { afterAll, beforeAll, expect, it } from 'vitest';
import { encodePayroll } from '@daclify/modules/sdk';
import { readFileSync } from 'node:fs';
import { ABI, Authority, Serializer } from '@wharfkit/antelope';
import { encodeAction, RuntimeTableSchemas } from '../../sdk/index.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import {
  nativeContracts,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let owned: NativeContracts | undefined;
let dao: DummyDao;
let payrollStarts = 0;
const f = () => {
  if (!owned) throw new Error('FIXTURE_REQUIRED');
  return owned;
};
beforeAll(async () => {
  owned = await nativeContracts(true);
  await owned.push(
    contextLinkRepairActions(owned.context, await owned.api.v1.chain.get_account('daclifycore')),
    [owned.key('daclifycore')],
  );
  dao = await owned.dummyDao();
  await owned.call(
    'daclifycore',
    'appoint',
    { dao_id: dao.daoId, member_ids: ['1', '2'], inactivity_seconds: 0, quorum_bps: 10000 },
    'alice',
  );
  for (const [member, account] of [
    ['1', 'alice'],
    ['2', 'bob'],
  ] as const)
    await dao.act(
      'daclifycore',
      'linknative',
      encodeAction('linknative', { ...dao.actor(member), account }),
      member,
      account,
    );
  await owned.call(
    'eosio.token',
    'transfer',
    {
      from: 'alice',
      to: 'daclifycore',
      quantity: '1.0000 TLOS',
      memo: 'stake:' + dao.daoId + ':1',
    },
    'alice',
  );
  await owned.call(
    'daclifycore',
    'setnativegov',
    { dao_id: dao.daoId, contracts: [], service_key: owned.key('relay').toPublic() },
    'daclifycore',
    'owner',
  );
  const owner = (await owned.api.v1.chain.get_account('daclifycore')).permissions.find(
    (row) => row.perm_name.toString() === 'owner',
  );
  if (!owner) throw new Error('FIXTURE_OWNER');
  const auth = Authority.from({
    threshold: 1,
    keys: owner.required_auth.keys,
    waits: owner.required_auth.waits,
    accounts: [{ permission: { actor: 'daclifycore', permission: 'eosio.code' }, weight: 1 }],
  });
  await owned.push(
    [
      owned.system(
        'updateauth',
        { account: 'daclifycore', permission: 'owner', parent: '', auth },
        'daclifycore',
        'owner',
      ),
      owned.action(
        'daclifycore',
        'handover',
        {
          dao_id: dao.daoId,
          expected_signers: ['alice', 'bob'],
          expected_threshold: 2,
          expected_revision: '1',
        },
        [{ actor: 'daclifycore', permission: 'owner' }],
        owned.abi('daclifycore'),
      ),
    ],
    [owned.key('daclifycore')],
  );
  payrollStarts = Math.floor(Date.now() / 1000) + 2;
  await dao.act(
    'payroll',
    'commit',
    encodePayroll('commit', {
      ...dao.actor(),
      schedule_id: '1',
      recipient: '3',
      quantity: '1.0000 TLOS',
      periods: 1,
      interval: 86400,
      starts: payrollStarts,
    }),
  );
  // Establish the old policy with its real binary, then upgrade with its actual quorum.
  await owned.push(
    [
      owned.system(
        'setcode',
        {
          account: 'daclifycore',
          vmtype: 0,
          vmversion: 0,
          code: readFileSync('.artifacts/contracts/runtime.wasm'),
        },
        'daclifycore',
        'owner',
      ),
      owned.system(
        'setabi',
        {
          account: 'daclifycore',
          abi: Serializer.encode({
            object: ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8')),
          }),
        },
        'daclifycore',
        'owner',
      ),
    ],
    [owned.key('alice'), owned.key('bob')],
  );
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it('reads the old persisted row without silently rewriting authority or controller state', async () => {
  const rows = await f().api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: 'daclifycore',
    table: 'nativegov',
    limit: 1,
  });
  expect(RuntimeTableSchemas.nativegov.parse(rows.rows[0])).toMatchObject({
    handed_over: true,
    dao_id: dao.daoId,
    signers: ['alice', 'bob'],
    threshold: 2,
  });
  expect(RuntimeTableSchemas.nativegov.parse(rows.rows[0]).ownership).toBeUndefined();
  const before = await dao.member();
  for (const action of ['heartbeat', 'unlinknat'] as const)
    await expect(dao.act('daclifycore', action, encodeAction(action, dao.actor()))).rejects.toThrow(
      'NATIVE_POLICY_MIGRATION_REQUIRED',
    );
  await expect(f().call('daclifycore', 'syncexec', { dao_id: dao.daoId }, 'relay')).rejects.toThrow(
    'NATIVE_POLICY_MIGRATION_REQUIRED',
  );
  expect(await dao.member()).toEqual(before);
});
it('preserves actual unstake exit across a legacy-policy upgrade', async () => {
  expect((await dao.member()).stake).toBe('10000');
  await dao.act(
    'daclifycore',
    'unstake',
    encodeAction('unstake', { ...dao.actor(), destination: 'alice', quantity: '1.0000 TLOS' }),
  );
  expect((await dao.member()).stake).toBe('0');
});

it('settles a real legacy payroll liability and preserves claim withdrawal after upgrade', async () => {
  while (
    Math.floor((await f().api.v1.chain.get_info()).head_block_time.toDate().getTime() / 1000) <
    payrollStarts
  )
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  await f().call(
    'payroll',
    'settle',
    { runtime: 'daclifycore', dao_id: dao.daoId, entry_id: '1' },
    'relay',
  );
  expect((await dao.member('3')).claim).toBe('10000');
  await dao.act(
    'daclifycore',
    'withdraw',
    encodeAction('withdraw', { ...dao.actor('3'), destination: 'alice', quantity: '1.0000 TLOS' }),
    '3',
  );
  expect((await dao.member('3')).claim).toBe('0');
});
