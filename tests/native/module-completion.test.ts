import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { ABI, Checksum256, Name, PrivateKey, Serializer, UInt64 } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
} from '../../sdk/index.js';
import { ModulePermissions } from '@daclify/modules';
import {
  ballotCommitment,
  DecideTableSchemas,
  encodeDecide,
  encodeWorks,
  encodePayroll,
} from '@daclify/modules/sdk';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { localFixture, localFixtureRoot } from '../../tools/native/local.js';
const fixture = localFixture(),
  scope = Name.from('daclifycore').value.toString(),
  dao = '1',
  keys = [
    PrivateKey.generate('K1'),
    PrivateKey.generate('K1'),
    PrivateKey.generate('K1'),
    PrivateKey.generate('K1'),
  ],
  measurements: { action: string; cpu: number; ram: unknown }[] = [];
async function table<T>(
  code: string,
  name: string,
  scopeValue: string,
  schema: z.ZodType<T>,
  id = '0',
) {
  const result = await fixture.rpc.v1.chain.get_table_rows({
    code,
    table: name,
    scope: scopeValue,
    lower_bound: UInt64.from(id),
    ...(id === '0' ? {} : { upper_bound: UInt64.from(id) }),
    limit: 100,
    key_type: 'i64',
  });
  return z.array(schema).parse(result.rows);
}
async function push(account: string, action: string, data: Uint8Array, actor = account) {
  const accounts = ['daclifycore', 'decide', 'works', 'payroll'];
  const before = await Promise.all(
    accounts.map((account) => fixture.rpc.v1.chain.get_account(account)),
  );
  const result = await fixture.push([fixture.action(account, action, data, actor)]);
  const after = await Promise.all(
    accounts.map((account) => fixture.rpc.v1.chain.get_account(account)),
  );
  const trace = z
    .object({
      receipt: z.object({ cpu_usage_us: z.number() }),
      action_traces: z.array(
        z.object({
          account_ram_deltas: z.array(z.object({ account: z.string(), delta: z.number() })),
        }),
      ),
    })
    .parse(result.processed);
  measurements.push({
    action: account + '::' + action,
    cpu: trace.receipt.cpu_usage_us,
    ram: accounts.map((account, index) => ({
      account,
      before: before[index]?.ram_usage.toString(),
      after: after[index]?.ram_usage.toString(),
    })),
  });
  return result;
}
async function signed(target: string, action: string, data: Uint8Array, member = '1') {
  const person = (
      await table('daclifycore', 'members', dao, RuntimeTableSchemas.members, member)
    )[0],
    key = keys[Number(member) - 1];
  if (!person || !key) throw Error('Fixture member');
  const request = makeInstruction(
    { chainId: fixture.network.chainId, contract: 'daclifycore', daoId: dao, interfaceVersion: 1 },
    member,
    person.nonce,
    Math.floor(Date.now() / 1000) + 300,
    target,
    action,
    data,
  );
  return push(
    'daclifycore',
    'submit',
    encodeAction('submit', { request, sig: key.signDigest(instructionDigest(request)).toString() }),
    'relay',
  );
}
async function terms() {
  const value = (
    await table('works', 'arbterms', scope, z.object({ commitment: z.string() }), '1')
  )[0];
  if (!value) throw Error('Fixture protection');
  return value;
}
async function setup() {
  await push(
    'daclifycore',
    'setfees',
    encodeAction('setfees', {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    }),
  );
  for (const [, account] of [
    ['decide', 'decide'],
    ['works', 'works'],
    ['payroll', 'payroll'],
  ] as const) {
    const hash = Checksum256.hash(
      readFileSync(`../daclify-backend-modules/.artifacts/contracts/${account}.wasm`),
    ).toString();
    await push(
      'daclifycore',
      'listmod',
      encodeAction('listmod', {
        account,
        publisher: 'alice',
        party: 0,
        accepts_fee_rule: 1,
        price: '0.0000 TLOS',
        code_hash: hash,
        title: 'Local qualification',
      }),
    );
  }
  await push(
    'daclifycore',
    'createdao',
    encodeAction('createdao', {
      dao_id: dao,
      owner: 'alice',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    }),
    'alice',
  );
  for (const [index, key] of keys.entries())
    await push(
      'daclifycore',
      'enroll',
      encodeAction('enroll', {
        dao_id: dao,
        member_id: String(index + 1),
        native_account: '',
        signing_key: key.toPublic().toString(),
        encryption_key: 'key',
        custody: 0,
      }),
      'alice',
    );
  for (const [id, account] of [
    ['decide', 'decide'],
    ['works', 'works'],
    ['payroll', 'payroll'],
  ] as const)
    await push(
      'daclifycore',
      'setmodule',
      encodeAction('setmodule', {
        dao_id: dao,
        account,
        version: 1,
        actions: [...ModulePermissions[id].actions],
        grants: [...ModulePermissions[id].grants],
        code_hash: Checksum256.hash(
          readFileSync(`../daclify-backend-modules/.artifacts/contracts/${account}.wasm`),
        ).toString(),
      }),
      'alice',
    );
  const token = ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8'));
  await push(
    'eosio.token',
    'transfer',
    Serializer.encode({
      abi: token,
      type: 'transfer',
      object: { from: 'alice', to: 'daclifycore', quantity: '10.0000 TLOS', memo: 'dao:1' },
    }).array,
    'alice',
  );
  await signed(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      runtime: 'daclifycore',
      dao_id: dao,
      member_id: '1',
      document_id: '42',
      version: 1,
      value: '{}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
}
it('enforces signed protection, conflict-free frozen voting, fixed settlement and payroll renewal on Spring', async () => {
  await setup();
  const now = Math.floor(Date.now() / 1000),
    actor = { runtime: 'daclifycore', dao_id: dao, member_id: '1' };
  await signed(
    'works',
    'propose',
    encodeWorks('propose', {
      ...actor,
      project_id: '1',
      contributor: '2',
      document_id: '42',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [now],
    }),
  );
  await signed(
    'works',
    'offeragr',
    encodeWorks('offeragr', { ...actor, project_id: '1', term_start: now, term_end: now + 300 }),
  );
  await signed(
    'works',
    'offerprot',
    encodeWorks('offerprot', {
      ...actor,
      project_id: '1',
      decide: 'decide',
      backup: '3',
      representative: '1',
      review_seconds: 60,
      challenge_seconds: 60,
      vote_seconds: 60,
      backup_seconds: 60,
    }),
  );
  await expect(
    signed('works', 'accept', encodeWorks('accept', { ...actor, project_id: '1' })),
  ).rejects.toThrow('ARBITRATION_CONSENT');
  const term = await terms();
  await signed(
    'works',
    'acceptprot',
    encodeWorks('acceptprot', {
      ...actor,
      member_id: '2',
      project_id: '1',
      expected: term.commitment,
    }),
    '2',
  );
  await signed('works', 'accept', encodeWorks('accept', { ...actor, project_id: '1' }));
  await expect(
    push(
      'daclifycore',
      'cancelob',
      encodeAction('cancelob', { dao_id: dao, source: 'works', source_id: '1' }),
      'alice',
    ),
  ).rejects.toThrow('OBLIGATION_PROTECTED');
  await signed(
    'works',
    'submitwork',
    encodeWorks('submitwork', {
      ...actor,
      member_id: '2',
      milestone_id: '1',
      document_id: '42',
      document_version: 1,
    }),
    '2',
  );
  await signed(
    'works',
    'review',
    encodeWorks('review', {
      ...actor,
      milestone_id: '1',
      approve: false,
      document_id: '42',
      document_version: 1,
    }),
  );
  await signed(
    'daclifycore',
    'arbchallenge',
    encodeAction('arbchallenge', {
      ...actor,
      member_id: '2',
      obligation_id: '1',
      expected_terms: term.commitment,
      document_id: '42',
      document_version: 1,
    }),
    '2',
  );
  await push(
    'decide',
    'openarb',
    encodeDecide('openarb', {
      runtime: 'daclifycore',
      dao_id: dao,
      obligation_id: '1',
      ballot_id: '10',
    }),
    'relay',
  );
  const ballot = (await table('decide', 'ballots', scope, DecideTableSchemas.ballots, '10'))[0],
    definition = (
      await table('decide', 'ballotdefs', scope, DecideTableSchemas.ballotdefs, '10')
    )[0],
    dispute = (await table('decide', 'arbplans', scope, DecideTableSchemas.arbplans, '10'))[0];
  if (!ballot || !definition || !dispute) throw Error('Native dispute snapshot');
  expect(dispute.voters.map((row) => row.member_id)).toEqual(['3', '4']);
  const expected = ballotCommitment({
    chainId: fixture.network.chainId,
    runtime: 'daclifycore',
    decide: 'decide',
    ballot,
    definition,
    dispute,
  });
  expect(expected).toBe(definition.commitment);
  for (const member of ['1', '2'])
    await expect(
      signed(
        'decide',
        'votecommit',
        encodeDecide('votecommit', {
          runtime: 'daclifycore',
          dao_id: dao,
          member_id: member,
          ballot_id: '10',
          expected,
          choice: 1,
        }),
        member,
      ),
    ).rejects.toThrow('ARBITRATION_VOTER');
  await signed(
    'decide',
    'votecommit',
    encodeDecide('votecommit', {
      runtime: 'daclifycore',
      dao_id: dao,
      member_id: '3',
      ballot_id: '10',
      expected,
      choice: 1,
    }),
    '3',
  );
  const commitment = Checksum256.hash(new TextEncoder().encode('{}')).toString();
  const payroll = {
    ...actor,
    schedule_id: '1',
    recipient: '2',
    quantity: '1.0000 TLOS',
    periods: 1,
    interval: 86400,
    starts: now + 120,
    label: 'Native terms',
    document_id: '42',
    document_version: 1,
    expected: commitment,
    successor_of: '0',
  };
  await signed('payroll', 'commitdoc', encodePayroll('commitdoc', payroll));
  await signed(
    'payroll',
    'commitdoc',
    encodePayroll('commitdoc', {
      ...payroll,
      schedule_id: '2',
      starts: now + 86400 + 120,
      successor_of: '1',
    }),
  );
  await expect(
    signed(
      'payroll',
      'commitdoc',
      encodePayroll('commitdoc', {
        ...payroll,
        schedule_id: '3',
        starts: now + 86400 + 120,
        successor_of: '1',
      }),
    ),
  ).rejects.toThrow('PAYROLL_ALREADY_RENEWED');
  while (Date.now() / 1000 < ballot.closes + 1) await new Promise((done) => setTimeout(done, 1000));
  await push(
    'decide',
    'finalize',
    encodeDecide('finalize', { runtime: 'daclifycore', dao_id: dao, ballot_id: '10' }),
    'relay',
  );
  await push(
    'decide',
    'execarb',
    encodeDecide('execarb', { runtime: 'daclifycore', dao_id: dao, ballot_id: '10' }),
    'relay',
  );
  await push(
    'daclifycore',
    'payob',
    encodeAction('payob', { dao_id: dao, source: 'works', source_id: '1' }),
    'relay',
  );
  await expect(
    push(
      'daclifycore',
      'payob',
      encodeAction('payob', { dao_id: dao, source: 'works', source_id: '1' }),
      'relay',
    ),
  ).rejects.toThrow('NOT_PAYABLE');
  const gateway = new NativeChainGateway({
    rpcUrl: fixture.network.url,
    chainId: fixture.network.chainId,
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: fixture.key('relay'),
    modules: [
      { id: 'decide', account: 'decide' },
      { id: 'works', account: 'works' },
      { id: 'payroll', account: 'payroll' },
    ],
  });
  expect(
    await gateway.execute({
      dao: {
        chainId: fixture.network.chainId,
        contract: 'daclifycore',
        daoId: dao,
        interfaceVersion: 1,
      },
      ballotId: '10',
    }),
  ).toMatchObject({ state: 'already-executed' });
  expect(await gateway.ballotExport(dao, '10')).toMatchObject({
    verification: 'verified',
    coverage: 'complete-live',
    dispute: { quantity: '1.0000 TLOS' },
    votes: [{ member: '3', choice: 1 }],
  });
  const community = (await table('daclifycore', 'daos', scope, RuntimeTableSchemas.daos, dao))[0];
  expect(community).toMatchObject({ available: '70000', reserved: '20000', claims: '10000' });
  writeFileSync(
    `${localFixtureRoot}/measurements.json`,
    JSON.stringify(
      {
        chainId: fixture.network.chainId,
        wasm: {
          runtime: readFileSync('.artifacts/contracts/runtime.wasm').length,
          decide: readFileSync('../daclify-backend-modules/.artifacts/contracts/decide.wasm')
            .length,
        },
        measurements,
      },
      null,
      2,
    ),
  );
}, 120000);
it('opens a bounded court at the 5000-member limit and records native CPU/RAM cost', async () => {
  const daoId = String(Date.now()),
    signers = Array.from({ length: 5000 }, () => PrivateKey.generate('K1'));
  await push(
    'daclifycore',
    'createdao',
    encodeAction('createdao', {
      dao_id: daoId,
      owner: 'alice',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    }),
    'alice',
  );
  for (let start = 0; start < signers.length; start += 10) {
    await fixture.push(
      signers
        .slice(start, start + 10)
        .map((key, index) =>
          fixture.action(
            'daclifycore',
            'enroll',
            encodeAction('enroll', {
              dao_id: daoId,
              member_id: String(start + index + 1),
              native_account: '',
              signing_key: key.toPublic().toString(),
              encryption_key: 'key',
              custody: 0,
            }),
            'alice',
          ),
        ),
    );
  }
  for (const [id, account] of [
    ['decide', 'decide'],
    ['works', 'works'],
  ] as const)
    await push(
      'daclifycore',
      'setmodule',
      encodeAction('setmodule', {
        dao_id: daoId,
        account,
        version: 1,
        actions: [...ModulePermissions[id].actions],
        grants: [...ModulePermissions[id].grants],
        code_hash: Checksum256.hash(
          readFileSync(`../daclify-backend-modules/.artifacts/contracts/${account}.wasm`),
        ).toString(),
      }),
      'alice',
    );
  const token = ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8'));
  await push(
    'eosio.token',
    'transfer',
    Serializer.encode({
      abi: token,
      type: 'transfer',
      object: { from: 'alice', to: 'daclifycore', quantity: '2.0000 TLOS', memo: 'dao:' + daoId },
    }).array,
    'alice',
  );
  async function sign(target: string, name: string, data: Uint8Array, member = '1') {
    const person = (
        await table('daclifycore', 'members', daoId, RuntimeTableSchemas.members, member)
      )[0],
      key = signers[Number(member) - 1];
    if (!person || !key) throw Error('Native load fixture');
    const request = makeInstruction(
      { chainId: fixture.network.chainId, contract: 'daclifycore', daoId, interfaceVersion: 1 },
      member,
      person.nonce,
      Math.floor(Date.now() / 1000) + 300,
      target,
      name,
      data,
    );
    return push(
      'daclifycore',
      'submit',
      encodeAction('submit', {
        request,
        sig: key.signDigest(instructionDigest(request)).toString(),
      }),
      'relay',
    );
  }
  const actor = { runtime: 'daclifycore', dao_id: daoId, member_id: '1' },
    now = Math.floor(Date.now() / 1000);
  await sign(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor,
      document_id: '42',
      version: 1,
      value: '{}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  await sign(
    'works',
    'propose',
    encodeWorks('propose', {
      ...actor,
      project_id: '9001',
      contributor: '2',
      document_id: '42',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [now],
    }),
  );
  await sign(
    'works',
    'offeragr',
    encodeWorks('offeragr', { ...actor, project_id: '9001', term_start: now, term_end: now + 300 }),
  );
  await sign(
    'works',
    'offerprot',
    encodeWorks('offerprot', {
      ...actor,
      project_id: '9001',
      decide: 'decide',
      backup: '3',
      representative: '1',
      review_seconds: 60,
      challenge_seconds: 60,
      vote_seconds: 60,
      backup_seconds: 60,
    }),
  );
  const term = (
    await table('works', 'arbterms', scope, z.object({ commitment: z.string() }), '9001')
  )[0];
  if (!term) throw Error('Native load terms');
  await sign(
    'works',
    'acceptprot',
    encodeWorks('acceptprot', {
      ...actor,
      member_id: '2',
      project_id: '9001',
      expected: term.commitment,
    }),
    '2',
  );
  await sign('works', 'accept', encodeWorks('accept', { ...actor, project_id: '9001' }));
  const project = (
      await table(
        'works',
        'projects',
        scope,
        z.object({ milestones: z.array(z.coerce.string()) }),
        '9001',
      )
    )[0],
    milestone = project?.milestones[0];
  if (!milestone) throw Error('Native load milestone');
  await sign(
    'works',
    'submitwork',
    encodeWorks('submitwork', {
      ...actor,
      member_id: '2',
      milestone_id: milestone,
      document_id: '42',
      document_version: 1,
    }),
    '2',
  );
  await sign(
    'works',
    'review',
    encodeWorks('review', {
      ...actor,
      milestone_id: milestone,
      approve: false,
      document_id: '42',
      document_version: 1,
    }),
  );
  await sign(
    'daclifycore',
    'arbchallenge',
    encodeAction('arbchallenge', {
      ...actor,
      member_id: '2',
      obligation_id: '1',
      expected_terms: term.commitment,
      document_id: '42',
      document_version: 1,
    }),
    '2',
  );
  const before = await fixture.rpc.v1.chain.get_account('decide');
  const gateway=new NativeChainGateway({rpcUrl:fixture.network.url,chainId:fixture.network.chainId,runtime:'daclifycore',hub:null,environment:'local',relayActor:'relay',relayKey:fixture.key('relay'),modules:[{id:'decide',account:'decide'},{id:'works',account:'works'}]});
  const stepCpu:number[]=[],originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,options)=>{const response=await originalFetch(input,options);if(String(input)===fixture.network.url+'/v1/chain/push_transaction'&&response.ok){const result=z.object({processed:z.object({receipt:z.object({cpu_usage_us:z.number()})})}).parse(await response.clone().json());stepCpu.push(result.processed.receipt.cpu_usage_us);}return response;};
  let result;
  try{result=await gateway.arbitration({dao:{chainId:fixture.network.chainId,contract:'daclifycore',daoId,interfaceVersion:1},obligationId:'1',operation:'open-vote'});}finally{globalThis.fetch=originalFetch;}
  const ballotId=result.ballotId;if(!ballotId)throw Error('Native load ballot');expect(stepCpu).toHaveLength(20);
  const after = await fixture.rpc.v1.chain.get_account('decide');
  const ballot = (await table('decide', 'ballots', scope, DecideTableSchemas.ballots, ballotId))[0],
    plan = (await table('decide', 'arbplans', scope, DecideTableSchemas.arbplans, ballotId))[0];
  expect(ballot?.denominator).toBe('4998');
  expect(plan?.voters).toHaveLength(4998);
  const cpu=stepCpu.at(-1);if(cpu===undefined)throw Error('Native CPU measurements');
  writeFileSync(
    `${localFixtureRoot}/load-5000.json`,
    JSON.stringify(
      {
        daoId,
        members: 5000,
        voters: plan?.voters.length,
        cpuMicroseconds: cpu,
        steps: stepCpu.length,
        maxStepCpuMicroseconds: Math.max(...stepCpu),
        stepCpuMicroseconds: stepCpu,
        decideRamBefore: before.ram_usage.toString(),
        decideRamAfter: after.ram_usage.toString(),
      },
      null,
      2,
    ),
  );
}, 180000);
