import { beforeAll, expect, it } from 'vitest';
import {
  Action,
  APIError,
  PermissionLevel,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
} from '@wharfkit/antelope';
import {
  encodeDecide,
  encodeWorks,
  encodePayroll,
  encodeGrants,
  encodeEndorse,
  ModuleCodeHashes,
} from '@daclify/modules/sdk';
import { ModulePermissions } from '@daclify/modules';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  nativeOwnershipSetupActions,
  handoverOwnerActions,
  RuntimeCodeHash,
  RuntimeRawAbiHash,
} from '../../sdk/index.js';
import { fixtureKey } from '../../tools/native/keys.js';
import {
  researchDao,
  researchRpc as rpc,
  researchNetwork as network,
  nativePush,
} from '../helpers/native-research.js';

// Stateful scenario on its own fresh node: never combine with suites that change owners.
const modules = ['decide', 'works', 'payroll', 'grants', 'endorse'] as const;
const managed = [...modules, 'daclifyhub'];
const serviceKey = PrivateKey.generate('K1');
let first: Awaited<ReturnType<typeof researchDao>>;
let second: Awaited<ReturnType<typeof researchDao>>;
let sequence = 0;
async function push(actions: Action[], keys: PrivateKey[]) {
  const info = await rpc.v1.chain.get_info();
  expect(info.chain_id.toString()).toBe(network.chainId);
  const transaction = Transaction.from({
    ...info.getTransactionHeader(120 + (sequence++ % 60)),
    actions,
  });
  try {
    return await rpc.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: keys.map((key) => key.signDigest(transaction.signingDigest(network.chainId))),
      }),
    );
  } catch (cause) {
    if (cause instanceof APIError) {
      const code = cause.details
        .map((detail) => detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1])
        .find(Boolean);
      throw new Error(code ?? 'NATIVE_ACTION_REJECTED');
    }
    throw new Error('NATIVE_TRANSACTION_REJECTED');
  }
}
function action(account: string, name: string, data: Uint8Array, permission: string) {
  return Action.from({ account, name, data, authorization: [PermissionLevel.from(permission)] });
}
async function incoming(member: string, account: string) {
  const person = (await first.gateway.table('members', first.daoId, member, 1))[0];
  const key = first.keys[Number(member) - 1];
  if (!person || person.id !== member || !key) throw new Error('FIXTURE_MEMBER');
  const request = makeInstruction(
    first.reference,
    member,
    person.nonce,
    Math.floor(Date.now() / 1000) + 120,
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...first.actor(member), account }),
  );
  const call = action(
    'daclifycore',
    'submit',
    encodeAction('submit', {
      request,
      sig: key.signDigest(instructionDigest(request)).toString(),
    }),
    'relay@active',
  );
  call.authorization.push(PermissionLevel.from(account + '@active'));
  await push([call], [fixtureKey('relay'), fixtureKey(account)]);
}
async function authority(account: string, permission: string) {
  const result = (await rpc.v1.chain.get_account(account)).permissions.find(
    (p) => p.perm_name.toString() === permission,
  );
  if (!result) throw new Error('FIXTURE_PERMISSION');
  return {
    parent: result.parent.toString(),
    threshold: result.required_auth.threshold.toNumber(),
    keys: result.required_auth.keys.map((k) => k.key.toString()),
    accounts: result.required_auth.accounts.map((p) => ({
      permission: p.permission.toString(),
      weight: p.weight.toNumber(),
    })),
  };
}
async function totals(f = first) {
  const d = await f.gateway.dao(f.daoId);
  expect(BigInt(d.available) + BigInt(d.reserved) + BigInt(d.claims)).toBe(100000n);
  return { available: d.available, reserved: d.reserved, claims: d.claims };
}
const coreAct = <N extends Parameters<typeof encodeAction>[0]>(
  name: N,
  fields: Parameters<typeof encodeAction<N>>[1],
) => first.act('daclifycore', name, encodeAction(name, fields));

beforeAll(async () => {
  if (network.container !== 'daclify-integration-native')
    throw new Error('FRESH_INTEGRATION_NODE_REQUIRED');
  first = await researchDao(true);
  second = await researchDao(true);
  await nativePush(
    'daclifycore',
    'appoint',
    encodeAction('appoint', {
      dao_id: first.daoId,
      member_ids: ['1', '2'],
      inactivity_seconds: 2592000,
      quorum_bps: 10000,
    }),
  );
  await incoming('1', 'alice');
  await incoming('2', 'bob');
  const setup = nativeOwnershipSetupActions('daclifycore', {
    dao_id: first.daoId,
    contracts: managed,
    service_key: serviceKey.toPublic().toString(),
  });
  await push(setup, [fixtureKey('daclifycore')]);
  const staging = handoverOwnerActions(
    'daclifycore',
    await Promise.all(
      ['daclifycore', ...managed].map((account) => rpc.v1.chain.get_account(account)),
    ),
  );
  const call = action(
    'daclifycore',
    'handover',
    encodeAction('handover', {
      dao_id: first.daoId,
      expected_signers: ['alice', 'bob'],
      expected_threshold: 2,
      expected_revision: '1',
    }),
    'daclifycore@owner',
  );
  for (const account of managed) call.authorization.push(PermissionLevel.from(account + '@owner'));
  await push([...staging, call], ['daclifycore', ...managed].map(fixtureKey));
}, 120000);

it.each(managed)(
  '%s keeps root governance separate from its inline-code authority',
  async (account) => {
    expect(await authority(account, 'owner')).toEqual({
      parent: '',
      threshold: 1,
      keys: [],
      accounts: [{ permission: 'daclifycore@govern', weight: 1 }],
    });
    const active = await authority(account, 'active');
    expect(active).toEqual({
      parent: 'owner',
      threshold: 1,
      keys: [],
      accounts: [
        { permission: 'daclifycore@govern', weight: 1 },
        { permission: account + '@eosio.code', weight: 1 },
      ].sort((a, b) => a.permission.localeCompare(b.permission)),
    });
  },
);

it('retains 2-of-2 executives, a separate service child and code-only execution context', async () => {
  const rootAccounts = [
    { permission: 'daclifycore@eosio.code', weight: 1 },
    { permission: 'daclifycore@govern', weight: 1 },
  ];
  expect(await authority('daclifycore', 'owner')).toEqual({
    parent: '',
    threshold: 1,
    keys: [],
    accounts: rootAccounts,
  });
  expect(await authority('daclifycore', 'active')).toEqual({
    parent: 'owner',
    threshold: 1,
    keys: [],
    accounts: rootAccounts,
  });
  expect(await authority('daclifycore', 'govern')).toEqual({
    parent: 'owner',
    threshold: 2,
    keys: [],
    accounts: [
      { permission: 'alice@active', weight: 1 },
      { permission: 'bob@active', weight: 1 },
    ],
  });
  expect(await authority('daclifycore', 'execctx')).toEqual({
    parent: 'active',
    threshold: 1,
    keys: [],
    accounts: [{ permission: 'daclifycore@eosio.code', weight: 1 }],
  });
  expect(await authority('daclifycore', 'service')).toEqual({
    parent: 'active',
    threshold: 1,
    keys: [serviceKey.toPublic().toString()],
    accounts: [],
  });
  for (const key of [serviceKey, fixtureKey('daclifycore'), fixtureKey('alice')])
    await expect(
      push(
        [
          action(
            'daclifycore',
            'appoint',
            encodeAction('appoint', {
              dao_id: first.daoId,
              member_ids: ['1'],
              inactivity_seconds: 2592000,
              quorum_bps: 10000,
            }),
            'daclifycore@govern',
          ),
        ],
        [key],
      ),
    ).rejects.toThrow('NATIVE_ACTION_REJECTED');
});

it.each(modules)(
  '%s rejects its removed bootstrap key and direct counterfeit runtime callbacks',
  async (source) => {
    const data = encodeAction('reserve', {
      dao_id: first.daoId,
      source,
      source_id: '999',
      recipient: '3',
      quantity: '1.0000 TLOS',
      due: 0,
    });
    const call = action('daclifycore', 'reserve', data, source + '@active');
    const before = await totals();
    await expect(push([call], [fixtureKey(source)])).rejects.toThrow('NATIVE_ACTION_REJECTED');
    await expect(push([call], [fixtureKey('alice'), fixtureKey('bob')])).rejects.toThrow(
      'SOURCE_SENDER',
    );
    expect(await totals()).toEqual(before);
  },
);

it('allows Hub registration only with runtime authority and gives the directory no treasury control', async () => {
  const abi = (await rpc.v1.chain.get_abi('daclifyhub')).abi;
  if (!abi) throw new Error('FIXTURE_HUB_ABI');
  const call = action(
    'daclifyhub',
    'regdeploy',
    Serializer.encode({
      abi,
      type: 'regdeploy',
      object: {
        runtime: 'daclifycore',
        owner: 'alice',
        chain_id: network.chainId,
        interface_version: 1,
        code_hash: RuntimeCodeHash,
        abi_hash: RuntimeRawAbiHash,
        metadata: '{"title":"Integration DAO","hosting":"shared"}',
        listed: true,
      },
    }).array,
    'daclifycore@active',
  );
  call.authorization.push(PermissionLevel.from('alice@active'));
  await expect(push([call], [fixtureKey('alice')])).rejects.toThrow('NATIVE_ACTION_REJECTED');
  await push([call], [fixtureKey('alice'), fixtureKey('bob')]);
  const before = await totals();
  await expect(
    push(
      [
        action(
          'daclifycore',
          'reserve',
          encodeAction('reserve', {
            dao_id: first.daoId,
            source: 'daclifyhub',
            source_id: '1',
            recipient: '3',
            quantity: '1.0000 TLOS',
            due: 0,
          }),
          'daclifyhub@active',
        ),
      ],
      [fixtureKey('alice'), fixtureKey('bob')],
    ),
  ).rejects.toThrow('SOURCE_SENDER');
  expect(await totals()).toEqual(before);
});

it('rejects direct member actions even when signed by the executive quorum', async () => {
  const calls = [
    [
      'decide',
      'open',
      encodeDecide('open', {
        ...first.actor(),
        ballot_id: '500',
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    ],
    [
      'works',
      'propose',
      encodeWorks('propose', {
        ...first.actor(),
        project_id: '500',
        contributor: '3',
        document_id: '1',
        document_version: 1,
        payments: ['1.0000 TLOS'],
        dues: [0],
      }),
    ],
    [
      'payroll',
      'commit',
      encodePayroll('commit', {
        ...first.actor(),
        schedule_id: '500',
        recipient: '3',
        quantity: '1.0000 TLOS',
        periods: 1,
        interval: 86400,
        starts: Math.floor(Date.now() / 1000) + 120,
      }),
    ],
    [
      'grants',
      'newround',
      encodeGrants('newround', {
        ...first.actor(),
        round_id: '500',
        document_id: '1',
        document_version: 1,
        applications_close: 1,
        review_close: 2,
        awards_close: 3,
        maximum: '1.0000 TLOS',
        allow_agents: false,
        works: 'works',
      }),
    ],
    [
      'endorse',
      'applyjoin',
      encodeEndorse('applyjoin', {
        ...first.actor(),
        application_id: '500',
        signing_key: PrivateKey.generate('K1').toPublic().toString(),
        encryption_key: 'fixture',
        custody: 0,
        kind: 0,
        operator_label: '',
        document_id: '1',
        document_version: 1,
        expires: Math.floor(Date.now() / 1000) + 120,
      }),
    ],
  ] as const;
  for (const [target, name, data] of calls)
    await expect(
      push(
        [action(target, name, data, 'daclifycore@owner')],
        [fixtureKey('alice'), fixtureKey('bob')],
      ),
    ).rejects.toThrow('ACTOR_SENDER');
});

it('completes Grants → Decide → Works → Runtime and Payroll after handover, with once-only settlement', async () => {
  const { act, actor, daoId, gateway } = first;
  const now = Math.floor(Date.now() / 1000);
  await coreAct('putjson', {
    ...actor(),
    document_id: '1',
    version: 1,
    value: '{"purpose":"Integration grant"}',
    envelope_version: 0,
    key_epoch: '0',
  });
  await act(
    'grants',
    'newround',
    encodeGrants('newround', {
      ...actor(),
      round_id: '1',
      document_id: '1',
      document_version: 1,
      applications_close: now + 600,
      review_close: now + 1200,
      awards_close: now + 3600,
      maximum: '4.0000 TLOS',
      allow_agents: false,
      works: 'works',
    }),
  );
  await act(
    'grants',
    'applygrant',
    encodeGrants('applygrant', {
      ...actor('3'),
      round_id: '1',
      application_id: '1',
      document_id: '1',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [now],
      term_start: now - 1,
      term_end: now + 3600,
    }),
    '3',
  );
  await act(
    'grants',
    'submitapp',
    encodeGrants('submitapp', { ...actor('3'), application_id: '1' }),
    '3',
  );
  await expect(
    act(
      'grants',
      'reviewapp',
      encodeGrants('reviewapp', {
        ...actor('3'),
        application_id: '1',
        eligible: true,
        document_id: '1',
        document_version: 1,
      }),
      '3',
    ),
  ).rejects.toThrow();
  await act(
    'grants',
    'reviewapp',
    encodeGrants('reviewapp', {
      ...actor(),
      application_id: '1',
      eligible: true,
      document_id: '1',
      document_version: 1,
    }),
  );
  await act(
    'decide',
    'openaward',
    encodeDecide('openaward', {
      ...actor(),
      ballot_id: '1',
      grants: 'grants',
      round_id: '1',
      application_id: '1',
      project_id: '1',
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: '{}',
    }),
  );
  for (const member of ['1', '2'])
    await act(
      'decide',
      'vote',
      encodeDecide('vote', { ...actor(member), ballot_id: '1', choice: 1 }),
      member,
    );
  await expect(
    second.act(
      'decide',
      'vote',
      encodeDecide('vote', {
        ...second.actor(),
        ballot_id: '1',
        choice: 1,
      }),
    ),
  ).rejects.toThrow('BALLOT_DOMAIN');
  await expect(gateway.execute({ dao: first.reference, ballotId: '1' })).rejects.toMatchObject({
    code: 'BALLOT_NOT_PASSED',
  });
  await act(
    'payroll',
    'commit',
    encodePayroll('commit', {
      ...actor(),
      schedule_id: '1',
      recipient: '3',
      quantity: '1.0000 TLOS',
      periods: 1,
      interval: 86400,
      starts: now + 60,
    }),
  );
  expect(await totals()).toEqual({ available: '90000', reserved: '10000', claims: '0' });
  const closes = (await gateway.moduleState(daoId)).ballots.find((b) => b.id === '1')?.closes;
  if (!closes) throw new Error('FIXTURE_BALLOT');
  while (Math.floor(Date.now() / 1000) <= closes)
    await new Promise((resolve) => setTimeout(resolve, 500));
  await gateway.finalize({ dao: first.reference, ballotId: '1' });
  await gateway.execute({ dao: first.reference, ballotId: '1' });
  expect(await gateway.execute({ dao: first.reference, ballotId: '1' })).toEqual({
    state: 'already-executed',
  });
  expect(await totals()).toEqual({ available: '80000', reserved: '20000', claims: '0' });
  const milestone = (await gateway.moduleState(daoId)).milestones.find((m) => m.project_id === '1');
  if (!milestone) throw new Error('FIXTURE_MILESTONE');
  await act(
    'works',
    'submitwork',
    encodeWorks('submitwork', {
      ...actor('3'),
      milestone_id: milestone.id,
      document_id: '1',
      document_version: 1,
    }),
    '3',
  );
  await expect(
    act(
      'works',
      'review',
      encodeWorks('review', {
        ...actor('3'),
        milestone_id: milestone.id,
        approve: true,
        document_id: '1',
        document_version: 1,
      }),
      '3',
    ),
  ).rejects.toThrow();
  await act(
    'works',
    'review',
    encodeWorks('review', {
      ...actor(),
      milestone_id: milestone.id,
      approve: true,
      document_id: '1',
      document_version: 1,
    }),
  );
  const settleWork = () =>
    nativePush(
      'works',
      'settle',
      encodeWorks('settle', {
        runtime: 'daclifycore',
        dao_id: daoId,
        milestone_id: milestone.id,
      }),
      'relay',
    );
  await settleWork();
  await expect(settleWork()).rejects.toThrow();
  const settlePayroll = () =>
    nativePush(
      'payroll',
      'settle',
      encodePayroll('settle', {
        runtime: 'daclifycore',
        dao_id: daoId,
        entry_id: '1',
      }),
      'relay',
    );
  await settlePayroll();
  await expect(settlePayroll()).rejects.toThrow('NOT_PAYABLE');
  expect(await totals()).toEqual({ available: '80000', reserved: '0', claims: '20000' });
  expect(await totals(second)).toEqual({ available: '100000', reserved: '0', claims: '0' });
}, 100000);

it('rolls back a missing Payroll callback grant in one tenant while preserving the other tenant', async () => {
  const before = await second.gateway.dao(second.daoId);
  const firstBefore = await totals();
  const configure = (grants: string[]) =>
    second.act(
      'daclifycore',
      'modconfig',
      encodeAction('modconfig', {
        ...second.actor(),
        account: 'payroll',
        version: 1,
        actions: [...ModulePermissions.payroll.actions],
        grants,
        code_hash: ModuleCodeHashes.payroll,
      }),
    );
  await configure(['approve']);
  const person = (await second.gateway.table('members', second.daoId, '1', 1))[0];
  const commit = () =>
    second.act(
      'payroll',
      'commit',
      encodePayroll('commit', {
        ...second.actor(),
        schedule_id: '2',
        recipient: '3',
        quantity: '1.0000 TLOS',
        periods: 1,
        interval: 86400,
        starts: Math.floor(Date.now() / 1000) + 120,
      }),
    );
  await expect(commit()).rejects.toThrow('MODULE_GRANT');
  expect(await second.gateway.dao(second.daoId)).toEqual(before);
  expect((await second.gateway.table('members', second.daoId, '1', 1))[0]?.nonce).toBe(
    person?.nonce,
  );
  expect((await second.gateway.moduleState(second.daoId)).schedules).toEqual([]);
  expect(await totals()).toEqual(firstBefore);
  await configure([...ModulePermissions.payroll.grants]);
  await commit();
  expect(await totals(second)).toEqual({ available: '90000', reserved: '10000', claims: '0' });
  expect(await totals()).toEqual(firstBefore);
});

it('rejects cross-tenant grant application references without advancing the member nonce', async () => {
  const member = (await second.gateway.table('members', second.daoId, '1', 1))[0];
  await expect(
    second.act(
      'grants',
      'applygrant',
      encodeGrants('applygrant', {
        ...second.actor(),
        round_id: '1',
        application_id: '2',
        document_id: '1',
        document_version: 1,
        payments: ['1.0000 TLOS'],
        dues: [0],
        term_start: 0,
        term_end: Math.floor(Date.now() / 1000) + 120,
      }),
    ),
  ).rejects.toThrow('GRANT_DOMAIN');
  expect((await second.gateway.table('members', second.daoId, '1', 1))[0]).toEqual(member);
  expect((await second.gateway.moduleState(second.daoId)).applications).toEqual([]);
});

it('requires endorsement witnesses, keeps admission separate from executive powers and supports nonvoting membership', async () => {
  const { act, actor, daoId, gateway } = first;
  await coreAct('setadmit', {
    ...actor(),
    enabled: true,
    source: 'endorse',
    threshold: 2,
    allow_agents: false,
    admin_override: false,
  });
  await act(
    'endorse',
    'applyjoin',
    encodeEndorse('applyjoin', {
      ...actor(),
      application_id: '1',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      encryption_key: 'fixture',
      custody: 0,
      kind: 0,
      operator_label: '',
      document_id: '1',
      document_version: 1,
      expires: Math.floor(Date.now() / 1000) + 120,
    }),
  );
  await act(
    'endorse',
    'witness',
    encodeEndorse('witness', { ...actor('2'), application_id: '1', revision: '1' }),
    '2',
  );
  await expect(
    act(
      'endorse',
      'admit',
      encodeEndorse('admit', {
        ...actor(),
        application_id: '1',
        revision: '1',
      }),
    ),
  ).rejects.toThrow('ENDORSEMENT_THRESHOLD');
  await act(
    'endorse',
    'witness',
    encodeEndorse('witness', { ...actor('3'), application_id: '1', revision: '1' }),
    '3',
  );
  await act(
    'endorse',
    'admit',
    encodeEndorse('admit', { ...actor(), application_id: '1', revision: '1' }),
  );
  expect((await gateway.table('members', daoId, '4', 1))[0]).toMatchObject({
    id: '4',
    admin: false,
    native_account: '',
  });
  await coreAct('setvoter', { ...actor(), target: '4', can_vote: false });
  expect((await gateway.governance(daoId)).executives.map((e) => e.member_id)).toEqual(['1', '2']);
  expect((await gateway.dao(daoId)).members).toBe(4);
  expect((await second.gateway.dao(second.daoId)).members).toBe(3);
});

it('preserves earned claims after offboarding and atomically rolls back failed token-row payouts', async () => {
  await coreAct('setactive', { ...first.actor(), target: '3', active: false });
  const before = await first.gateway.dao(first.daoId);
  const withdraw = () =>
    first.act(
      'daclifycore',
      'withdraw',
      encodeAction('withdraw', {
        ...first.actor('3'),
        destination: 'carol',
        quantity: '2.0000 TLOS',
      }),
      '3',
    );
  await expect(withdraw()).rejects.toThrow('PAYOUT_TOKEN_ROW_REQUIRED');
  expect(await first.gateway.dao(first.daoId)).toEqual(before);
  const abi = (await rpc.v1.chain.get_abi('eosio.token')).abi;
  if (!abi) throw new Error('FIXTURE_TOKEN_ABI');
  await nativePush(
    'eosio.token',
    'open',
    Serializer.encode({
      abi,
      type: 'open',
      object: { owner: 'carol', symbol: '4,TLOS', ram_payer: 'carol' },
    }).array,
    'carol',
  );
  await withdraw();
  const result = await first.gateway.dao(first.daoId);
  expect(result).toMatchObject({ available: '80000', reserved: '0', claims: '0' });
  expect(
    (await rpc.v1.chain.get_currency_balance('eosio.token', 'carol', 'TLOS')).map((balance) =>
      balance.toString(),
    ),
  ).toEqual(['2.0000 TLOS']);
  await expect(withdraw()).rejects.toThrow('INSUFFICIENT_CLAIM');
  expect(await first.gateway.dao(first.daoId)).toEqual(result);
});
