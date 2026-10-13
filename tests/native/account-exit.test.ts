import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { ABI, Action, PrivateKey, Serializer, UInt64, Transaction } from '@wharfkit/antelope';
import { ModulePermissions } from '@daclify/modules';
import {
  ModuleCodeHashes,
  WorksTableSchemas,
  ActivityTableSchemas,
  encodeWorks,
  encodeActivity,
} from '@daclify/modules/sdk';
import { Pool } from 'pg';
import { z } from 'zod';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import {
  encodeAction,
  instructionDigest,
  makeInstruction,
  RuntimeTableSchemas,
  RuntimeCodeHash,
} from '../../sdk/index.js';
import { privateHandoverCommitment } from '../../sdk/account-exit.js';
import { DaoRefSchema } from '../../protocol/base.js';
import { createServer } from '../../services/api/src/server.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { VERSION } from '../../protocol/base.js';
let owned: NativeContracts | undefined;
let activityAbi: ABI | undefined;
const measurements: Array<{
  scenario: string;
  module?: string;
  insertedRam?: number;
  releasedRam?: number;
  cpuUs: number;
}> = [];
const f = () => {
  if (!owned) throw new Error('FIXTURE_REQUIRED');
  return owned;
};
let sequence = 87000;
const cpu = (value: unknown) =>
  z
    .object({
      processed: z.object({
        receipt: z.object({ cpu_usage_us: z.coerce.number().int().positive() }),
      }),
    })
    .parse(JSON.parse(JSON.stringify(value))).processed.receipt.cpu_usage_us;
async function bare(privacy = 0) {
  const daoId = String(++sequence),
    roots = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
  await f().call(
    'daclifycore',
    'createdao',
    {
      dao_id: daoId,
      owner: 'alice',
      metadata: '{}',
      privacy,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  for (const [index, key] of roots.entries())
    await f().call(
      'daclifycore',
      'enroll',
      {
        dao_id: daoId,
        member_id: index + 1,
        native_account: '',
        signing_key: key.toPublic(),
        encryption_key: 'Synthetic native presence fixture',
        custody: 0,
      },
      'alice',
    );
  const actor = (member = '1') => ({ runtime: 'daclifycore', dao_id: daoId, member_id: member });
  const reference = DaoRefSchema.parse({
    chainId: f().chainId,
    contract: 'daclifycore',
    daoId,
    interfaceVersion: 1,
  });
  async function member(id = '1') {
    const page = await f().api.v1.chain.get_table_rows({
      code: 'daclifycore',
      scope: daoId,
      table: 'members',
      lower_bound: UInt64.from(id),
      limit: 1,
    });
    const person = RuntimeTableSchemas.members.parse(page.rows[0]);
    if (person.id !== id) throw new Error('FIXTURE_MEMBER');
    return person;
  }
  async function act(action: string, data: Uint8Array, id = '1', proof?: PrivateKey) {
    const key = proof ?? roots[Number(id) - 1];
    if (!key) throw new Error('FIXTURE_ROOT');
    const request = makeInstruction(
      reference,
      id,
      (await member(id)).nonce,
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      action,
      data,
    );
    return f().call(
      'daclifycore',
      'submit',
      { request, sig: key.signDigest(instructionDigest(request)) },
      'relay',
    );
  }
  return { daoId, roots, actor, reference, member, act };
}
beforeAll(async () => {
  owned = await nativeContracts();
  await owned.create('activity');
  activityAbi = await owned.deploy(
    'activity',
    '../daclify-backend-modules/.artifacts/contracts/activity',
  );
  expect((await owned.api.v1.chain.get_raw_abi('activity')).code_hash.toString()).toBe(
    ModuleCodeHashes.activity,
  );
  await owned.call('daclifycore', 'listmod', {
    account: 'activity',
    publisher: 'alice',
    party: 0,
    accepts_fee_rule: 1,
    price: '0.0000 TLOS',
    code_hash: ModuleCodeHashes.activity,
    title: 'Disposable Activity closure fixture',
  });
  await owned.push(
    ModulePermissions.activity.actions.map((action) =>
      f().system(
        'linkauth',
        { account: 'daclifycore', code: 'activity', type: action, requirement: 'execctx' },
        'daclifycore',
        'owner',
      ),
    ),
    [owned.key('daclifycore')],
  );
}, 90000);
afterAll(async () => {
  try {
    await mkdir('.artifacts/native', { recursive: true });
    await writeFile(
      '.artifacts/native/account-exit-samples.json',
      JSON.stringify(
        {
          coreVersion: VERSION,
          runtimeCodeHash: RuntimeCodeHash,
          environment: 'owned local Spring; concurrent test load',
          measurements,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await owned?.stop();
  }
});
it('requires the actual root, prunes delegated sessions and preserves inactive native financial exit', async () => {
  const dao = await f().dummyDao();
  const key = dao.keys[0];
  if (!key) throw new Error('FIXTURE_ROOT');
  await dao.act(
    'daclifycore',
    'addsession',
    encodeAction('addsession', {
      ...dao.actor('2'),
      session_id: '1',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      expires: Math.floor(Date.now() / 1000) + 300,
      permissions: [{ target: 'daclifycore', action: 'putjson', code_hash: '0'.repeat(64) }],
    }),
    '2',
  );
  await dao.act(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...dao.actor('2'), account: 'bob' }),
    '2',
    'bob',
  );
  await f().call(
    'eosio.token',
    'transfer',
    { from: 'bob', to: 'daclifycore', quantity: '5.0000 TLOS', memo: 'stake:' + dao.daoId + ':2' },
    'bob',
  );
  const request = await dao.request(
    'daclifycore',
    'leave',
    encodeAction('leave', dao.actor('2')),
    '2',
  );
  await expect(
    f().call(
      'daclifycore',
      'submit',
      { request, sig: key.signDigest(instructionDigest(request)) },
      'relay',
    ),
  ).rejects.toThrow();
  const before = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage);
  const departure = await dao.submit(request, '2');
  expect(await dao.member('2')).toMatchObject({ active: false, stake: '50000' });
  const sessions = await f().api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: dao.daoId,
    table: 'sessions',
    limit: 25,
  });
  expect(sessions.rows).toEqual([]);
  const after = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage);
  expect(after).toBeLessThan(before);
  const payout = encodeAction('unstake', {
    ...dao.actor('2'),
    destination: 'bob',
    quantity: '5.0000 TLOS',
  });
  await dao.act('daclifycore', 'unstake', payout, '2');
  await expect(dao.act('daclifycore', 'unstake', payout, '2')).rejects.toThrow(
    'INSUFFICIENT_STAKE',
  );
  expect((await dao.member('2')).stake).toBe('0');
  await expect(
    dao.act(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', { ...dao.actor('2'), metadata: '{}' }),
      '2',
    ),
  ).rejects.toThrow('MEMBER_INACTIVE');
  console.info('Owned departure sample', {
    releasedSessionRam: before - after,
    departureCpuUs: cpu(departure),
  });
  measurements.push({ scenario: 'departure', releasedRam: before - after, cpuUs: cpu(departure) });
});
it('reports current handover readiness through actual chain reads and binds successor acceptance', async () => {
  const dao = await bare(1);
  await dao.act(
    'setroles',
    encodeAction('setroles', { ...dao.actor(), target: '2', admin: true, reviewer: false }),
  );
  await dao.act(
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: '1',
      commitment: 'ab'.repeat(32),
      self_grant: '{}',
    }),
  );
  expect(await f().gateway.privateHandover(dao.daoId)).toBeNull();
  await dao.act(
    'beginhand',
    encodeAction('beginhand', {
      ...dao.actor(),
      departing: '2',
      successor: '1',
      expires: Math.floor(Date.now() / 1000) + 600,
    }),
  );
  await expect(dao.act('leave', encodeAction('leave', dao.actor('2')), '2')).rejects.toThrow(
    'PRIVATE_HANDOVER_REQUIRED',
  );
  await dao.act('scanhand', encodeAction('scanhand', { ...dao.actor(), limit: 25 }));
  const preparation = await f().gateway.privateHandover(dao.daoId);
  if (!preparation) throw new Error('FIXTURE_HANDOVER');
  expect(preparation.status).toBe('pending');
  expect(preparation.commitment).toBe(privateHandoverCommitment(dao.reference, preparation));
  await expect(
    dao.act(
      'accepthand',
      encodeAction('accepthand', {
        ...dao.actor('2'),
        expected_commitment: preparation.commitment,
      }),
      '2',
    ),
  ).rejects.toThrow('PRIVATE_SUCCESSOR_REQUIRED');
  const before = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage);
  const acceptance = await dao.act(
    'accepthand',
    encodeAction('accepthand', { ...dao.actor(), expected_commitment: preparation.commitment }),
  );
  expect((await f().gateway.privateHandover(dao.daoId))?.status).toBe('ready');
  const originalFetch = globalThis.fetch;
  const futureLifecycle = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, options) => {
      if (typeof options?.body === 'string' && options.body.includes('"table":"daolife"'))
        return Response.json({
          rows: [{ dao_id: dao.daoId, state: 3, transitioned_at: 1 }],
          more: false,
        });
      return originalFetch(input, options);
    });
  try {
    await expect(f().gateway.privateHandover(dao.daoId)).rejects.toThrow(
      'DAO_LIFECYCLE_UNSUPPORTED',
    );
  } finally {
    futureLifecycle.mockRestore();
  }
  const pool = new Pool({ connectionString: 'postgres://127.0.0.1:9/unused' });
  const app = await createServer(pool, f().gateway, 'https://app.example');
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/daos/' + dao.daoId + '/handover',
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"status":"ready"');
    expect(response.body).not.toContain('self_grant');
  } finally {
    await app.close();
    await pool.end();
  }
  const departure = await dao.act('leave', encodeAction('leave', dao.actor('2')), '2');
  expect((await dao.member('2')).active).toBe(false);
  expect(await f().gateway.privateHandover(dao.daoId)).toBeNull();
  const after = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage);
  expect(after).toBeLessThan(before);
  console.info('Owned private handover sample', {
    releasedRam: before - after,
    acceptanceCpuUs: cpu(acceptance),
    departureCpuUs: cpu(departure),
  });
  measurements.push(
    { scenario: 'handover acceptance', cpuUs: cpu(acceptance) },
    { scenario: 'handover departure', releasedRam: before - after, cpuUs: cpu(departure) },
  );
  await dao.act('startclose', encodeAction('startclose', dao.actor()));
  const current = (await f().gateway.dao(dao.daoId)).keyEpoch;
  await dao.act(
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: current,
      commitment: 'cd'.repeat(32),
      self_grant: '{}',
    }),
  );
  await dao.act('rotateepoch', encodeAction('rotateepoch', dao.actor()));
});
it('requires explicit retirement and settlement before the last member can depart', async () => {
  const dao = await bare();
  await dao.act('leave', encodeAction('leave', dao.actor('2')), '2');
  await expect(dao.act('leave', encodeAction('leave', dao.actor()))).rejects.toThrow('LAST_ADMIN');
  await dao.act('startclose', encodeAction('startclose', dao.actor()));
  await expect(
    f().call(
      'eosio.token',
      'transfer',
      { from: 'alice', to: 'daclifycore', quantity: '1.0000 TLOS', memo: 'dao:' + dao.daoId },
      'alice',
    ),
  ).rejects.toThrow('DAO_CLOSING');
  await dao.act('closedao', encodeAction('closedao', dao.actor()));
  await dao.act('leave', encodeAction('leave', dao.actor()));
  expect((await dao.member()).active).toBe(false);
});
it('requires actual bounded liability proofs from all six installed modules before native final closure', async () => {
  const dao = await bare();
  if (!activityAbi) throw new Error('FIXTURE_ACTIVITY_ABI');
  const modules = [...nativeModules, { id: 'activity', account: 'activity' }] as const;
  for (const [index, module] of modules.entries()) {
    await f().call(
      'daclifycore',
      'setmodule',
      {
        dao_id: dao.daoId,
        account: module.account,
        version: 1,
        actions: ModulePermissions[module.id].actions,
        grants: ModulePermissions[module.id].grants,
        code_hash: ModuleCodeHashes[module.id],
      },
      'alice',
    );
    await f().call('daclifycore', 'setlifecode', {
      account: module.account,
      code_hash: ModuleCodeHashes[module.id],
      kind: index + 1,
    });
  }
  await dao.act('startclose', encodeAction('startclose', dao.actor()));
  await expect(dao.act('closedao', encodeAction('closedao', dao.actor()))).rejects.toThrow(
    'DAO_MODULE_LIABILITIES_REMAIN',
  );
  const samples = [];
  const originalRam = new Map<string, number>();
  for (const module of modules) {
    const before = Number((await f().api.v1.chain.get_account(module.account)).ram_usage);
    originalRam.set(module.account, before);
    let result;
    for (let step = 0; step < 2; step++)
      result = await f().push(
        [
          f().action(
            module.account,
            'scanclose',
            { runtime: 'daclifycore', dao_id: dao.daoId, limit: 25 },
            [{ actor: 'relay', permission: 'active' }],
            module.id === 'activity' ? activityAbi : f().abi(module.account),
          ),
        ],
        [f().key('relay')],
      );
    const filled = Number((await f().api.v1.chain.get_account(module.account)).ram_usage);
    samples.push({ module: module.id, insertedRam: filled - before, scanCpuUs: cpu(result) });
    measurements.push({
      scenario: 'module closure scan',
      module: module.id,
      insertedRam: filled - before,
      cpuUs: cpu(result),
    });
  }
  await dao.act('closedao', encodeAction('closedao', dao.actor()));
  expect((await f().gateway.dao(dao.daoId)).lifecycle).toBe('closed');
  for (const module of modules) {
    await f().push(
      [
        f().action(
          module.account,
          'clearclose',
          { runtime: 'daclifycore', dao_id: dao.daoId },
          [{ actor: 'relay', permission: 'active' }],
          module.id === 'activity' ? activityAbi : f().abi(module.account),
        ),
      ],
      [f().key('relay')],
    );
    expect(Number((await f().api.v1.chain.get_account(module.account)).ram_usage)).toBe(
      originalRam.get(module.account),
    );
  }
  console.info('Owned module closure samples', samples);
});
it('upgrades the frozen pre-exit runtime without rewriting identity, stake, pending work or app receipts', async () => {
  await f().deploy('daclifycore', '.artifacts/account-exit-legacy/runtime');
  try {
    const dao = await f().dummyDao();
    await dao.act(
      'daclifycore',
      'linknative',
      encodeAction('linknative', { ...dao.actor('2'), account: 'bob' }),
      '2',
      'bob',
    );
    await f().call(
      'eosio.token',
      'transfer',
      {
        from: 'bob',
        to: 'daclifycore',
        quantity: '2.0000 TLOS',
        memo: 'stake:' + dao.daoId + ':2',
      },
      'bob',
    );
    await dao.document();
    await dao.act(
      'works',
      'propose',
      encodeWorks('propose', {
        ...dao.actor('3'),
        project_id: '87101',
        contributor: '3',
        document_id: '1',
        document_version: 1,
        payments: ['1.0000 TLOS'],
        dues: [0],
      }),
      '3',
    );
    await dao.act(
      'works',
      'accept',
      encodeWorks('accept', { ...dao.actor(), project_id: '87101' }),
    );
    const project = WorksTableSchemas.projects.parse(
      (
        await f().api.v1.chain.get_table_rows({
          code: 'works',
          scope: 'daclifycore',
          table: 'projects',
          lower_bound: UInt64.from('87101'),
          limit: 1,
        })
      ).rows[0],
    );
    const milestone = project.milestones[0];
    if (!milestone) throw new Error('FIXTURE_MILESTONE');
    await f().call(
      'daclifycore',
      'setmodule',
      {
        dao_id: dao.daoId,
        account: 'activity',
        version: 1,
        actions: ModulePermissions.activity.actions,
        grants: [],
        code_hash: ModuleCodeHashes.activity,
      },
      'alice',
    );
    await dao.act(
      'daclifycore',
      'setapp',
      encodeAction('setapp', {
        ...dao.actor(),
        app_id: '1',
        target: 'activity',
        revision: '1',
        config_hash: 'ab'.repeat(32),
        enabled: true,
      }),
    );
    await dao.act(
      'activity',
      'askreview',
      encodeActivity('askreview', {
        ...dao.actor('2'),
        app_id: '1',
        source_id: 'ab'.repeat(32),
        source_revision: 'cd'.repeat(32),
        event_id: 'ef'.repeat(32),
        evidence_cid: '',
        evidence_hash: '0'.repeat(64),
        key_epoch: '0',
      }),
      '2',
    );
    const receipt = ActivityTableSchemas.activities.parse(
      (
        await f().api.v1.chain.get_table_rows({
          code: 'activity',
          scope: 'daclifycore',
          table: 'activities',
          limit: 1,
        })
      ).rows[0],
    );
    const beforeTotals = await dao.totals();
    const before = await dao.member('2');
    await expect(f().gateway.privateHandover(dao.daoId)).rejects.toThrow(
      'PRIVATE_HANDOVER_UNSUPPORTED',
    );
    expect((await dao.totals()).lifecycle).toBe('active');
    await f().deploy('daclifycore', '.artifacts/contracts/runtime');
    expect(await dao.member('2')).toEqual(before);
    expect(await dao.totals()).toEqual(beforeTotals);
    expect(
      WorksTableSchemas.projects.parse(
        (
          await f().api.v1.chain.get_table_rows({
            code: 'works',
            scope: 'daclifycore',
            table: 'projects',
            lower_bound: UInt64.from('87101'),
            limit: 1,
          })
        ).rows[0],
      ),
    ).toEqual(project);
    expect(
      ActivityTableSchemas.activities.parse(
        (
          await f().api.v1.chain.get_table_rows({
            code: 'activity',
            scope: 'daclifycore',
            table: 'activities',
            limit: 1,
          })
        ).rows[0],
      ),
    ).toEqual(receipt);
    await dao.act('daclifycore', 'startclose', encodeAction('startclose', dao.actor()));
    await dao.act(
      'works',
      'submitwork',
      encodeWorks('submitwork', {
        ...dao.actor('3'),
        milestone_id: milestone,
        document_id: '1',
        document_version: 1,
      }),
      '3',
    );
    await dao.act(
      'works',
      'review',
      encodeWorks('review', {
        ...dao.actor(),
        milestone_id: milestone,
        approve: true,
        document_id: '1',
        document_version: 1,
      }),
    );
    await dao.act(
      'activity',
      'reviewact',
      encodeActivity('reviewact', {
        ...dao.actor(),
        app_id: '1',
        receipt_id: receipt.id,
        source_revision: receipt.source_revision,
        accepted: false,
        evidence_cid: '',
        evidence_hash: '0'.repeat(64),
        key_epoch: '0',
      }),
    );
    await f().call(
      'works',
      'settle',
      { runtime: 'daclifycore', dao_id: dao.daoId, milestone_id: milestone },
      'relay',
    );
    expect((await dao.member('3')).claim).toBe('10000');
    await dao.act('daclifycore', 'leave', encodeAction('leave', dao.actor('3')), '3');
    expect(await dao.member('3')).toMatchObject({ active: false, claim: '10000' });
    const claim = encodeAction('withdraw', {
      ...dao.actor('3'),
      destination: 'bob',
      quantity: '1.0000 TLOS',
    });
    await dao.act('daclifycore', 'withdraw', claim, '3');
    await expect(dao.act('daclifycore', 'withdraw', claim, '3')).rejects.toThrow(
      'INSUFFICIENT_CLAIM',
    );
    await dao.act('daclifycore', 'leave', encodeAction('leave', dao.actor('2')), '2');
    expect(await dao.member('2')).toMatchObject({
      active: false,
      signing_key: before.signing_key,
      encryption_key: before.encryption_key,
      stake: '20000',
      claim: '0',
    });
    await dao.act(
      'daclifycore',
      'unstake',
      encodeAction('unstake', { ...dao.actor('2'), destination: 'bob', quantity: '2.0000 TLOS' }),
      '2',
    );
    expect((await dao.member('2')).stake).toBe('0');
  } finally {
    if (
      (await f().api.v1.chain.get_raw_abi('daclifycore')).code_hash.toString() !== RuntimeCodeHash
    )
      await f().deploy('daclifycore', '.artifacts/contracts/runtime');
  }
});
it('rolls back retirement at an exhausted native RAM quota and completes after physical capacity is funded', async () => {
  const dao = await bare();
  const usage = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage);
  const limits = async (bytes: number) =>
    f().push(
      [
        Action.from({
          account: 'eosio',
          name: 'limits',
          authorization: [{ actor: 'eosio', permission: 'active' }],
          data: new Uint8Array([
            ...Serializer.encode({ type: 'name', object: 'daclifycore' }).array,
            ...Serializer.encode({ type: 'int64', object: bytes }).array,
          ]),
        }),
      ],
      [f().key('eosio')],
    );
  try {
    await limits(usage);
    expect(Number((await f().api.v1.chain.get_account('daclifycore')).ram_quota)).toBe(usage);
    const before = await dao.member();
    await expect(dao.act('startclose', encodeAction('startclose', dao.actor()))).rejects.toThrow();
    expect((await f().gateway.dao(dao.daoId)).lifecycle).toBe('active');
    expect(await dao.member()).toEqual(before);
    await limits(usage + 4096);
    const started = await dao.act('startclose', encodeAction('startclose', dao.actor()));
    const filled = Number((await f().api.v1.chain.get_account('daclifycore')).ram_usage);
    measurements.push({
      scenario: 'funded native retirement after exhausted quota',
      insertedRam: filled - usage,
      cpuUs: cpu(started),
    });
    await dao.act('closedao', encodeAction('closedao', dao.actor()));
    expect((await f().gateway.dao(dao.daoId)).lifecycle).toBe('closed');
  } finally {
    await limits(-1);
  }
});
it('binds actual native exit signatures to operation/step and consumes the member nonce once',async()=>{
 const test=await bare(),person=await test.member('2'),key=test.roots[1];if(!key)throw Error('FIXTURE_ROOT');
 const request=makeInstruction(test.reference,'2',person.nonce,Math.floor(Date.now()/1000)+300,'daclifycore','leave',encodeAction('leave',test.actor('2')));
 const {exitInstructionDigest}=await import('../../sdk/account-exit.js');
 const operation='ab'.repeat(32),step_digest='cd'.repeat(32),sig=key.signDigest(exitInstructionDigest(operation,step_digest,request)).toString();
 await expect(f().call('daclifycore','submitexit',{operation:'ae'.repeat(32),step_digest,request,sig},'relay')).rejects.toThrow();
 await expect(f().call('daclifycore','submitexit',{operation,step_digest:'de'.repeat(32),request,sig},'relay')).rejects.toThrow();
 expect((await test.member('2')).nonce).toBe(person.nonce);
 await expect(f().call('daclifycore','submitexit',{operation:'00'.repeat(32),step_digest,request,sig},'relay')).rejects.toThrow('EXIT_CONTEXT');
 await expect(f().call('daclifycore','submitexit',{operation,step_digest,request:{...request,action:'setcredits'},sig},'relay')).rejects.toThrow('EXIT_ACTION');
 const result=await f().call('daclifycore','submitexit',{operation,step_digest,request,sig},'relay');
 measurements.push({scenario:'operation-bound-exit',cpuUs:cpu(result)});
 expect((await test.member('2')).active).toBe(false);
 await expect(f().call('daclifycore','submitexit',{operation,step_digest,request,sig},'relay')).rejects.toThrow();
});
it('persists an exact exit packet before delivery and reconciles its irreversible transaction',async()=>{
 const test=await bare(),person=await test.member('2'),key=test.roots[1];if(!key)throw Error('FIXTURE_ROOT');
 const request=makeInstruction(test.reference,'2',person.nonce,Math.floor(Date.now()/1000)+300,'daclifycore','leave',encodeAction('leave',test.actor('2')));
 const {exitInstructionDigest}=await import('../../sdk/account-exit.js');
 const input={operation:'ef'.repeat(32),step_digest:'bc'.repeat(32),request,sig:key.signDigest(exitInstructionDigest('ef'.repeat(32),'bc'.repeat(32),request)).toString()};
 const gateway=f().gateway;
 const packet=await gateway.prepareExitSubmission(input);
 expect((await test.member('2')).active).toBe(true);
 const delivered=await gateway.submitPreparedExit(packet);expect(delivered.transactionId).toBe(packet.transactionId);
 const reconciled=await gateway.reconcileExitSubmission(packet);expect(reconciled.state).toBe('confirmed');
 expect((await test.member('2')).active).toBe(false);
});
it('refuses account-deletion closure when another active member joined before signing',async()=>{
 const test=await bare(),person=await test.member(),key=test.roots[0];if(!key)throw Error('FIXTURE_ROOT');
 const request=makeInstruction(test.reference,'1',person.nonce,Math.floor(Date.now()/1000)+300,'daclifycore','startclose',encodeAction('startclose',test.actor()));
 const {exitInstructionDigest}=await import('../../sdk/account-exit.js');const operation='aa'.repeat(32),step_digest='bb'.repeat(32),sig=key.signDigest(exitInstructionDigest(operation,step_digest,request)).toString();
 await expect(f().call('daclifycore','submitexit',{operation,step_digest,request,sig},'relay')).rejects.toThrow('SOLE_MEMBER_REQUIRED');
 expect((await test.member()).nonce).toBe(person.nonce);
});
it('settles inactive stake through the narrow exit packet without a hosted account',async()=>{
 const dao=await f().dummyDao(),key=dao.keys[1];if(!key)throw Error('FIXTURE_ROOT');
 await dao.act('daclifycore','linknative',encodeAction('linknative',{...dao.actor('2'),account:'bob'}),'2','bob');
 await f().call('eosio.token','transfer',{from:'bob',to:'daclifycore',quantity:'2.0000 TLOS',memo:'stake:'+dao.daoId+':2'},'bob');
 await dao.act('daclifycore','leave',encodeAction('leave',dao.actor('2')),'2');
 const request=await dao.request('daclifycore','unstake',encodeAction('unstake',{...dao.actor('2'),destination:'bob',quantity:'2.0000 TLOS'}),'2');
 const {exitInstructionDigest}=await import('../../sdk/account-exit.js');
 const operation='ad'.repeat(32),step_digest='ce'.repeat(32),signed={operation,step_digest,request,sig:key.signDigest(exitInstructionDigest(operation,step_digest,request)).toString()};
 const packet=await f().gateway.prepareSettlement(signed);await f().gateway.submitSettlement(packet);
 expect((await dao.member('2')).stake).toBe('0');
 await expect(f().gateway.submitSettlement(packet)).rejects.toThrow();
});
it('requires the linked native wallet for operation-bound exit and preserves its later settlement authority',async()=>{
 const dao=await f().dummyDao();await dao.act('daclifycore','linknative',encodeAction('linknative',{...dao.actor('2'),account:'bob'}),'2','bob');
 const request=await dao.request('daclifycore','leave',encodeAction('leave',dao.actor('2')),'2');
 const input={operation:'bf'.repeat(32),step_digest:'cf'.repeat(32),request};
 await expect(f().call('daclifycore','exitnative',input,'alice')).rejects.toThrow();
 const result=await f().call('daclifycore','exitnative',input,'bob');measurements.push({scenario:'linked-wallet-operation-exit',cpuUs:cpu(result)});
 expect((await dao.member('2')).active).toBe(false);await expect(f().call('daclifycore','exitnative',input,'bob')).rejects.toThrow();
});
it('binds linked EVM departure to the reviewed operation and step without a hosted account',async()=>{
 const {bindingTypedData,exitGovernanceTypedData,evmTypedDigest}=await import('../../sdk/evm.js'),{secp256k1}=await import('@noble/curves/secp256k1.js');
 const dao=await f().dummyDao(),binding={chainId:41 as const,address:'0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',epoch:'1'},scalar=new Uint8Array(32);scalar[31]=1;
 const sign=(data:Parameters<typeof evmTypedDigest>[0])=>{const raw=secp256k1.sign(evmTypedDigest(data),scalar,{prehash:false,format:'recovered'});return Buffer.concat([Buffer.from(raw.subarray(1)),Buffer.from([(raw[0]??0)+27])]).toString('hex');};
 const person=await dao.member('2'),expires=Math.floor(Date.now()/1000)+300;
 await dao.act('daclifycore','linkevm',encodeAction('linkevm',{...dao.actor('2'),evm_chain_id:'41',address:binding.address.slice(2),epoch:'1',nonce:person.nonce,expires,proof:sign(bindingTypedData(dao.reference,'2',binding,person.nonce,expires))}),'2');
 const request=await dao.request('daclifycore','leave',encodeAction('leave',dao.actor('2')),'2'),operation='cd'.repeat(32),step_digest='ef'.repeat(32),proof=sign(exitGovernanceTypedData(operation,step_digest,request,binding));
 const input={operation,step_digest,request,evm_chain_id:'41',address:binding.address.slice(2),binding_epoch:'1',proof};
 await expect(f().call('daclifycore','exitevm',{...input,operation:'cc'.repeat(32)},'relay')).rejects.toThrow();
 await expect(f().call('daclifycore','exitevm',{...input,step_digest:'ee'.repeat(32)},'relay')).rejects.toThrow();
 const packet=await f().gateway.prepareExitSubmission(input);expect((await dao.member('2')).active).toBe(true);const result=await f().gateway.submitPreparedExit(packet);expect(result.transactionId).toBe(packet.transactionId);expect((await f().gateway.reconcileExitSubmission(packet)).state).toBe('confirmed');expect((await dao.member('2')).active).toBe(false);
 await expect(f().call('daclifycore','exitevm',input,'relay')).rejects.toThrow();
 const measured=await f().dummyDao(),initial=await measured.member('2');
 await measured.act('daclifycore','linkevm',encodeAction('linkevm',{...measured.actor('2'),evm_chain_id:'41',address:binding.address.slice(2),epoch:'1',nonce:initial.nonce,expires,proof:sign(bindingTypedData(measured.reference,'2',binding,initial.nonce,expires))}),'2');
 const measuredRequest=await measured.request('daclifycore','leave',encodeAction('leave',measured.actor('2')),'2');
 const sample=await f().call('daclifycore','exitevm',{operation,step_digest,request:measuredRequest,evm_chain_id:'41',address:binding.address.slice(2),binding_epoch:'1',proof:sign(exitGovernanceTypedData(operation,step_digest,measuredRequest,binding))},'relay');
 measurements.push({scenario:'linked-EVM-operation-exit',cpuUs:cpu(sample)});
 expect((await measured.member('2')).active).toBe(false);
});

it('verifies and tracks a prepared native wallet exit without hosted credentials',async()=>{
 const dao=await f().dummyDao();await dao.act('daclifycore','linknative',encodeAction('linknative',{...dao.actor('2'),account:'bob'}),'2','bob');
 const request=await dao.request('daclifycore','leave',encodeAction('leave',dao.actor('2')),'2'),operation='af'.repeat(32),step_digest='bf'.repeat(32),info=await f().api.v1.chain.get_info();
 const transaction=Transaction.from({...info.getTransactionHeader(60),actions:[Action.from({account:'daclifycore',name:'exitnative',authorization:[{actor:'bob',permission:'active'}],data:encodeAction('exitnative',{operation,step_digest,request})})]}),input={operation,step_digest,request,account:'bob',permission:'active',packedTransaction:Serializer.encode({object:transaction}).hexString,signatures:[f().key('bob').signDigest(transaction.signingDigest(info.chain_id)).toString()]};
 await expect(f().gateway.prepareExitSubmission({...input,signatures:[f().key('alice').signDigest(transaction.signingDigest(info.chain_id)).toString()]})).rejects.toThrow();
 await expect(f().gateway.prepareExitSubmission({...input,operation:'cf'.repeat(32)})).rejects.toThrow();
 const packet=await f().gateway.prepareExitSubmission(input);expect((await dao.member('2')).active).toBe(true);
 await f().gateway.submitPreparedExit(packet);expect((await f().gateway.reconcileExitSubmission(packet)).state).toBe('confirmed');expect((await dao.member('2')).active).toBe(false);
});
