import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Action, Authority, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { ModulePermissions } from '@daclify/modules';
import {
  encodeDecide,
  encodeWorks,
  encodePayroll,
  encodeGrants,
  encodeEndorse,
  ModuleCodeHashes,
} from '@daclify/modules/sdk';
import { encodeAction } from '../../sdk/index.js';
import {
  auditContextPermission,
  contextLinkRepairActions,
} from '../../tools/deploy/permissions.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let owned: NativeContracts | undefined;
let first: DummyDao, second: DummyDao;
let beforeRepair: ReturnType<typeof auditContextPermission>;
let afterRepair: ReturnType<typeof auditContextPermission>;
const fixture = () => {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
};
beforeAll(async () => {
  owned = await nativeContracts();
  first = await owned.dummyDao('alice');
  second = await owned.dummyDao('bob');
  await owned.executiveTree();
  const account = await owned.api.v1.chain.get_account('daclifycore');
  beforeRepair = auditContextPermission(owned.context, account);
  await owned.push(contextLinkRepairActions(owned.context, account), [owned.key('recovery')]);
  afterRepair = auditContextPermission(
    owned.context,
    await owned.api.v1.chain.get_account('daclifycore'),
  );
  await first.document();
  await second.document();
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it('repairs all eleven replicated testnet links on a real native chain', () => {
  expect(beforeRepair.authorityMatches).toBe(true);
  expect(beforeRepair.missingLinks.map((link) => link.action)).toEqual([
    'setexecs',
    'heartbeat',
    'refreshgov',
    'setvoter',
    'archapprove',
    'archrevoke',
    'restoredoc',
    'govpayfees',
    'govhosted',
    'govseatfee',
    'govresources',
  ]);
  expect(afterRepair).toMatchObject({
    authorityMatches: true,
    missingLinks: [],
    unexpectedLinks: [],
  });
});
it('funds two isolated dummy DAOs and reads five compatible hash-verified modules', async () => {
  for (const dao of [first, second]) {
    expect(await dao.totals()).toMatchObject({ available: '100000', reserved: '0', claims: '0' });
    const state = await dao.state();
    expect(state.modules).toHaveLength(5);
    expect(
      state.modules.every((module) => module.enabled && module.codeVerified && module.compatible),
    ).toBe(true);
  }
  expect(first.keys[0]?.toPublic().toString()).not.toBe(second.keys[0]?.toPublic().toString());
});
it('rolls back an unlinked heartbeat and succeeds after its link is restored', async () => {
  const f = fixture();
  await f.call(
    'daclifycore',
    'appoint',
    { dao_id: first.daoId, member_ids: ['1'], inactivity_seconds: 60, quorum_bps: 10000 },
    'alice',
  );
  await f.push(
    [
      f.system(
        'linkauth',
        { account: 'daclifycore', code: 'daclifycore', type: 'heartbeat', requirement: 'active' },
        'daclifycore',
        'owner',
      ),
    ],
    [f.key('recovery')],
  );
  const before = await first.member();
  const request = await first.request(
    'daclifycore',
    'heartbeat',
    encodeAction('heartbeat', first.actor()),
  );
  await expect(first.submit(request)).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await first.member()).toEqual(before);
  await f.push(
    [
      f.system(
        'linkauth',
        { account: 'daclifycore', code: 'daclifycore', type: 'heartbeat', requirement: 'execctx' },
        'daclifycore',
        'owner',
      ),
    ],
    [f.key('recovery')],
  );
  await first.submit(request);
  expect(BigInt((await first.member()).nonce)).toBe(BigInt(before.nonce) + 1n);
});
it('has module-owned code alongside delegated active without a bootstrap key', async () => {
  const active = (await fixture().api.v1.chain.get_account('works')).permissions.find(
    (row) => row.perm_name.toString() === 'active',
  );
  if (!active) throw new Error('FIXTURE_PERMISSION');
  expect(
    active.required_auth.equals(
      Authority.from({
        threshold: 1,
        keys: [],
        waits: [],
        accounts: [
          { permission: { actor: 'daclifycore', permission: 'active' }, weight: 1 },
          { permission: { actor: 'works', permission: 'eosio.code' }, weight: 1 },
        ],
      }),
    ),
  ).toBe(true);
});

it.each([
  ['setroles', { target: '3', admin: true, reviewer: true }],
  ['setcredits', { target: '3', quantity: '100' }],
  ['setactive', { target: '3', active: false }],
  ['setexecs', { member_ids: ['2'], inactivity_seconds: 60, quorum_bps: 10000 }],
  ['setvoter', { target: '3', can_vote: false }],
] as const)(
  'prevents ordinary members using %s and preserves both DAO state and nonce',
  async (name, fields) => {
    const before = await first.member('2'),
      other = await second.totals();
    const data = Serializer.encode({
      abi: fixture().abi('daclifycore'),
      type: name,
      object: { ...first.actor('2'), ...fields },
    }).array;
    await expect(first.act('daclifycore', name, data, '2')).rejects.toThrow('ADMIN_REQUIRED');
    expect(await first.member('2')).toEqual(before);
    expect(await second.totals()).toEqual(other);
  },
);

it.each(['runtime', 'dao', 'member'] as const)(
  'rejects a signed payload with substituted %s context',
  async (field) => {
    const before = await first.member(),
      other = await second.totals();
    const actor = {
      ...first.actor(),
      ...(field === 'runtime'
        ? { runtime: 'daclifyhub' }
        : field === 'dao'
          ? { dao_id: second.daoId }
          : { member_id: '2' }),
    };
    await expect(
      first.act('daclifycore', 'setmeta', encodeAction('setmeta', { ...actor, metadata: '{}' })),
    ).rejects.toThrow('PAYLOAD_DOMAIN');
    expect(await first.member()).toEqual(before);
    expect(await second.totals()).toEqual(other);
  },
);

it.each([
  { chain_id: 'cd'.repeat(32) },
  { deployment: 'daclifyhub' },
  { version: 2 },
  { nonce: '999' },
  { expires: 0 },
] as const)('rejects signed instruction-domain, nonce or expiry changes %j', async (overrides) => {
  const f = fixture(),
    before = await first.member();
  const request = {
    ...(await first.request(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', { ...first.actor(), metadata: '{}' }),
    )),
    ...overrides,
  };
  const key = first.keys[0];
  if (!key) throw new Error('FIXTURE_KEY');
  const digest = Checksum256.hash(
    Serializer.encode({ abi: f.abi('daclifycore'), type: 'instruction', object: request }),
  );
  const call = f.action(
    'daclifycore',
    'submit',
    { request, sig: key.signDigest(digest) },
    [{ actor: 'relay', permission: 'active' }],
    f.abi('daclifycore'),
  );
  await expect(f.push([call], [f.key('relay')])).rejects.toThrow(
    'nonce' in overrides
      ? 'NONCE'
      : 'expires' in overrides
        ? 'EXPIRED_OR_TOO_LONG'
        : 'INSTRUCTION_DOMAIN',
  );
  expect(await first.member()).toEqual(before);
});

it('rejects another DAO user signing the same member ID', async () => {
  const before = await first.member(),
    request = await first.request(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', { ...first.actor(), metadata: '{}' }),
    );
  await expect(first.submit(request, '2')).rejects.toThrow('NATIVE_REJECTED:crypto_api_exception');
  expect(await first.member()).toEqual(before);
});

it('commits a signed member instruction once and rejects its exact replay', async () => {
  const before = await first.member(),
    request = await first.request(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', { ...first.actor(), metadata: '{"test":"replay"}' }),
    );
  await first.submit(request);
  await expect(first.submit(request)).rejects.toThrow('NONCE');
  expect(BigInt((await first.member()).nonce)).toBe(BigInt(before.nonce) + 1n);
});

it.each(nativeModules)(
  '$account rejects executive-signed direct counterfeit callbacks',
  async (module) => {
    const f = fixture(),
      before = await first.totals();
    const call = f.action(
      'daclifycore',
      'reserve',
      {
        dao_id: first.daoId,
        source: module.account,
        source_id: '999',
        recipient: '3',
        quantity: '1.0000 TLOS',
        due: 0,
      },
      [{ actor: module.account, permission: 'active' }],
      f.abi('daclifycore'),
    );
    await expect(f.push([call], [f.key('alice'), f.key('bob')])).rejects.toThrow('SOURCE_SENDER');
    expect(await first.totals()).toEqual(before);
  },
);

it.each(nativeModules)(
  '$account rejects direct member actions even under executive quorum',
  async (module) => {
    const f = fixture(),
      now = Math.floor(Date.now() / 1000);
    const calls = {
      decide: [
        'open',
        encodeDecide('open', {
          ...first.actor(),
          ballot_id: '990',
          kind: 0,
          choices: 2,
          duration: 60,
          quorum: 5000,
          approval: 5001,
          metadata: '{}',
        }),
      ],
      works: [
        'propose',
        encodeWorks('propose', {
          ...first.actor(),
          project_id: '990',
          contributor: '3',
          document_id: '1',
          document_version: 1,
          payments: ['1.0000 TLOS'],
          dues: [0],
        }),
      ],
      payroll: [
        'commit',
        encodePayroll('commit', {
          ...first.actor(),
          schedule_id: '990',
          recipient: '3',
          quantity: '1.0000 TLOS',
          periods: 1,
          interval: 86400,
          starts: now + 60,
        }),
      ],
      'grants-rounds': [
        'newround',
        encodeGrants('newround', {
          ...first.actor(),
          round_id: '990',
          document_id: '1',
          document_version: 1,
          applications_close: now + 600,
          review_close: now + 1200,
          awards_close: now + 3600,
          maximum: '1.0000 TLOS',
          allow_agents: false,
          works: 'works',
        }),
      ],
      'endorsement-admission': [
        'applyjoin',
        encodeEndorse('applyjoin', {
          ...first.actor(),
          application_id: '990',
          signing_key: PrivateKey.generate('K1').toPublic().toString(),
          encryption_key: 'disposable',
          custody: 0,
          kind: 0,
          operator_label: '',
          document_id: '1',
          document_version: 1,
          expires: now + 120,
        }),
      ],
    } satisfies Record<(typeof nativeModules)[number]['id'], readonly [string, Uint8Array]>;
    const [name, data] = calls[module.id];
    const call = Action.from({
      account: module.account,
      name,
      data,
      authorization: [{ actor: 'daclifycore', permission: 'active' }],
    });
    await expect(f.push([call], [f.key('alice'), f.key('bob')])).rejects.toThrow('ACTOR_SENDER');
  },
);

it('requires incoming wallet consent and accepts submitnat only from the paired dummy user', async () => {
  const f = fixture(),
    before = await first.member('2');
  const link = await first.request(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...first.actor('2'), account: 'bob' }),
    '2',
  );
  await expect(first.submit(link, '2')).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await first.member('2')).toEqual(before);
  await first.submit(link, '2', 'bob');
  const request = await first.request(
    'daclifycore',
    'setprofile',
    encodeAction('setprofile', {
      ...first.actor('2'),
      account_name: 'bobprofile11',
      profile: '{"name":"bobprofile11"}',
    }),
    '2',
  );
  await expect(f.call('daclifycore', 'submitnat', { request }, 'alice')).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  const paired = await first.member('2');
  await f.call('daclifycore', 'submitnat', { request }, 'bob');
  expect(BigInt((await first.member('2')).nonce)).toBe(BigInt(paired.nonce) + 1n);
  expect((await second.member('2')).native_account).toBe('');
});

it('rejects changed module WASM without consuming a member nonce or funds and allows retry after restoring the pin', async () => {
  const f = fixture(),
    dao = await f.dummyDao();
  const original = readFileSync('../daclify-backend-modules/.artifacts/contracts/payroll.wasm');
  const replace = (code: Uint8Array) =>
    f.push(
      [
        f.system(
          'setcode',
          { account: 'payroll', vmtype: 0, vmversion: 0, code },
          'payroll',
          'owner',
        ),
      ],
      [f.key('alice'), f.key('bob')],
    );
  const request = await dao.request(
    'payroll',
    'commit',
    encodePayroll('commit', {
      ...dao.actor(),
      schedule_id: '9001',
      recipient: '3',
      quantity: '1.0000 TLOS',
      periods: 1,
      interval: 86400,
      starts: Math.floor(Date.now() / 1000) + 120,
    }),
  );
  const member = await dao.member(),
    totals = await dao.totals();
  await replace(readFileSync('.artifacts/contracts/permprobe.wasm'));
  try {
    expect(
      (await dao.state()).modules.find((module) => module.deployment.account === 'payroll')
        ?.codeVerified,
    ).toBe(false);
    await expect(dao.submit(request)).rejects.toThrow('MODULE_CODE');
    expect(await dao.member()).toEqual(member);
    expect(await dao.totals()).toEqual(totals);
  } finally {
    await replace(original);
  }
  await dao.submit(request);
  expect(await dao.totals()).toMatchObject({ available: '90000', reserved: '10000', claims: '0' });
});

it('rolls back Payroll when its callback grant is missing and succeeds after restoration', async () => {
  const f = fixture(),
    dao = await f.dummyDao();
  const configure = (grants: readonly string[]) =>
    dao.act(
      'daclifycore',
      'modconfig',
      encodeAction('modconfig', {
        ...dao.actor(),
        account: 'payroll',
        version: 1,
        actions: [...ModulePermissions.payroll.actions],
        grants: [...grants],
        code_hash: ModuleCodeHashes.payroll,
      }),
    );
  await configure(['approve']);
  const before = await dao.totals(),
    member = await dao.member(),
    other = await second.totals();
  const data = encodePayroll('commit', {
    ...dao.actor(),
    schedule_id: '1001',
    recipient: '3',
    quantity: '1.0000 TLOS',
    periods: 1,
    interval: 86400,
    starts: Math.floor(Date.now() / 1000) + 120,
  });
  await expect(dao.act('payroll', 'commit', data)).rejects.toThrow('MODULE_GRANT');
  expect(await dao.totals()).toEqual(before);
  expect(await dao.member()).toEqual(member);
  expect((await dao.state()).schedules).toEqual([]);
  expect(await second.totals()).toEqual(other);
  await configure(ModulePermissions.payroll.grants);
  await dao.act('payroll', 'commit', data);
  expect(await dao.totals()).toMatchObject({ available: '90000', reserved: '10000', claims: '0' });
});

it('requires Payroll own-code permission for callbacks and preserves the exact failed instruction for retry', async () => {
  const f = fixture(),
    dao = await f.dummyDao();
  const old = (await f.api.v1.chain.get_account('payroll')).permissions.find(
    (row) => row.perm_name.toString() === 'active',
  )?.required_auth;
  if (!old) throw new Error('FIXTURE_PERMISSION');
  const delegated = Authority.from({
    threshold: 1,
    keys: [],
    waits: [],
    accounts: [{ permission: { actor: 'daclifycore', permission: 'active' }, weight: 1 }],
  });
  await f.push(
    [
      f.system(
        'updateauth',
        { account: 'payroll', permission: 'active', parent: 'owner', auth: delegated },
        'payroll',
        'owner',
      ),
    ],
    [f.key('alice'), f.key('bob')],
  );
  const before = await dao.totals(),
    member = await dao.member();
  const request = await dao.request(
    'payroll',
    'commit',
    encodePayroll('commit', {
      ...dao.actor(),
      schedule_id: '1002',
      recipient: '3',
      quantity: '1.0000 TLOS',
      periods: 1,
      interval: 86400,
      starts: Math.floor(Date.now() / 1000) + 120,
    }),
  );
  try {
    await expect(dao.submit(request)).rejects.toThrow('NATIVE_AUTH_REJECTED');
    expect(await dao.totals()).toEqual(before);
    expect(await dao.member()).toEqual(member);
    expect((await dao.state()).schedules).toEqual([]);
  } finally {
    await f.push(
      [
        f.system(
          'updateauth',
          { account: 'payroll', permission: 'active', parent: 'owner', auth: old },
          'payroll',
          'owner',
        ),
      ],
      [f.key('alice'), f.key('bob')],
    );
  }
  await dao.submit(request);
  expect(await dao.totals()).toMatchObject({ available: '90000', reserved: '10000', claims: '0' });
});

it('admits an endorsed dummy user without admin, executive or native-account powers', async () => {
  const dao = await fixture().dummyDao();
  await dao.document();
  await dao.act(
    'daclifycore',
    'setadmit',
    encodeAction('setadmit', {
      ...dao.actor(),
      enabled: true,
      source: 'endorse',
      threshold: 2,
      allow_agents: false,
      admin_override: false,
    }),
  );
  await dao.act(
    'endorse',
    'applyjoin',
    encodeEndorse('applyjoin', {
      ...dao.actor(),
      application_id: '2001',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      encryption_key: 'disposable',
      custody: 0,
      kind: 0,
      operator_label: '',
      document_id: '1',
      document_version: 1,
      expires: Math.floor(Date.now() / 1000) + 300,
    }),
  );
  await dao.act(
    'endorse',
    'witness',
    encodeEndorse('witness', { ...dao.actor('2'), application_id: '2001', revision: '1' }),
    '2',
  );
  const before = await dao.member();
  const admit = () =>
    dao.act(
      'endorse',
      'admit',
      encodeEndorse('admit', { ...dao.actor(), application_id: '2001', revision: '1' }),
    );
  await expect(admit()).rejects.toThrow('ENDORSEMENT_THRESHOLD');
  expect(await dao.member()).toEqual(before);
  await dao.act(
    'endorse',
    'witness',
    encodeEndorse('witness', { ...dao.actor('3'), application_id: '2001', revision: '1' }),
    '3',
  );
  await admit();
  expect(await dao.member('4')).toMatchObject({
    admin: false,
    reviewer: false,
    native_account: '',
    credits: '0',
  });
  await expect(admit()).rejects.toThrow();
  expect((await dao.totals()).members).toBe(4);
  expect((await second.totals()).members).toBe(3);
});

it('rejects a direct native binding even when both executive and wallet authorities are supplied', async () => {
  const dao = await fixture().dummyDao(),
    before = await dao.member();
  const f = fixture(),
    call = f.action(
      'daclifycore',
      'linknative',
      { ...dao.actor(), account: 'bob' },
      [
        { actor: 'daclifycore', permission: 'active' },
        { actor: 'bob', permission: 'active' },
      ],
      f.abi('daclifycore'),
    );
  await expect(f.push([call], [f.key('alice'), f.key('bob')])).rejects.toThrow('ACTOR_SENDER');
  expect(await dao.member()).toEqual(before);
});

it('rejects wallet consent without the correct existing member signature', async () => {
  const dao = await fixture().dummyDao(),
    before = await dao.member();
  const request = await dao.request(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...dao.actor(), account: 'bob' }),
  );
  await expect(dao.submit(request, '2', 'bob')).rejects.toThrow(
    'NATIVE_REJECTED:crypto_api_exception',
  );
  expect(await dao.member()).toEqual(before);
});

it('rejects a weak incoming permission even when its owner links submit to that permission', async () => {
  const f = fixture(),
    dao = await f.dummyDao(),
    weak = PrivateKey.generate('K1');
  await f.create('weakwallet');
  await f.update(
    'weakwallet',
    'pair',
    'active',
    Authority.from({
      threshold: 1,
      keys: [{ key: weak.toPublic(), weight: 1 }],
      accounts: [],
      waits: [],
    }),
  );
  await f.push(
    [
      f.system(
        'linkauth',
        { account: 'weakwallet', code: 'daclifycore', type: 'submit', requirement: 'pair' },
        'weakwallet',
        'owner',
      ),
    ],
    [f.key('weakwallet')],
  );
  const before = await dao.member(),
    request = await dao.request(
      'daclifycore',
      'linknative',
      encodeAction('linknative', { ...dao.actor(), account: 'weakwallet' }),
    ),
    memberKey = dao.keys[0];
  if (!memberKey) throw new Error('FIXTURE_MEMBER_KEY');
  const digest = Checksum256.hash(
    Serializer.encode({ abi: f.abi('daclifycore'), type: 'instruction', object: request }),
  );
  const call = f.action(
    'daclifycore',
    'submit',
    { request, sig: memberKey.signDigest(digest) },
    [
      { actor: 'relay', permission: 'active' },
      { actor: 'weakwallet', permission: 'pair' },
    ],
    f.abi('daclifycore'),
  );
  await expect(f.push([call], [f.key('relay'), weak])).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await dao.member()).toEqual(before);
  await dao.submit(request, '1', 'weakwallet');
  expect((await dao.member()).native_account).toBe('weakwallet');
});

it('replaces a native binding only with fresh consent from the incoming dummy account', async () => {
  const dao = await fixture().dummyDao();
  await dao.act(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...dao.actor(), account: 'alice' }),
    '1',
    'alice',
  );
  const before = await dao.member();
  const request = await dao.request(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...dao.actor(), account: 'bob' }),
  );
  await expect(dao.submit(request, '1', 'alice')).rejects.toThrow('NATIVE_AUTH_REJECTED');
  expect(await dao.member()).toEqual(before);
  await dao.submit(request, '1', 'bob');
  expect(await dao.member()).toMatchObject({ native_account: 'bob' });
  expect((await dao.totals()).members).toBe(3);
});

it('executes real R1 member signatures after key rotation while rejecting the former key', async () => {
  const dao = await fixture().dummyDao(),
    old = dao.keys[0],
    r1 = PrivateKey.generate('R1');
  if (!old) throw new Error('FIXTURE_KEY');
  await dao.act(
    'daclifycore',
    'rotatekey',
    encodeAction('rotatekey', { ...dao.actor(), signing_key: r1.toPublic().toString() }),
  );
  const before = await dao.member(),
    request = await dao.request(
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', { ...dao.actor(), metadata: '{"test":"R1"}' }),
    );
  await expect(dao.submit(request)).rejects.toThrow('NATIVE_REJECTED:crypto_api_exception');
  expect(await dao.member()).toEqual(before);
  dao.keys[0] = r1;
  await dao.submit(request);
  expect(BigInt((await dao.member()).nonce)).toBe(BigInt(before.nonce) + 1n);
});

it('completes Grants → Decide → Works → Runtime plus Payroll with isolated once-only payouts', async () => {
  const f = fixture(),
    dao = await f.dummyDao('alice', true);
  await dao.document();
  await dao.act(
    'daclifycore',
    'setroles',
    encodeAction('setroles', { ...dao.actor(), target: '3', admin: false, reviewer: true }),
  );
  const now = Math.floor(Date.now() / 1000);
  await dao.act(
    'grants',
    'newround',
    encodeGrants('newround', {
      ...dao.actor(),
      round_id: '4001',
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
  await dao.act(
    'grants',
    'applygrant',
    encodeGrants('applygrant', {
      ...dao.actor('3'),
      round_id: '4001',
      application_id: '4001',
      document_id: '1',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [now],
      term_start: now - 1,
      term_end: now + 3600,
    }),
    '3',
  );
  await dao.act(
    'grants',
    'submitapp',
    encodeGrants('submitapp', { ...dao.actor('3'), application_id: '4001' }),
    '3',
  );
  await expect(
    dao.act(
      'grants',
      'reviewapp',
      encodeGrants('reviewapp', {
        ...dao.actor('3'),
        application_id: '4001',
        eligible: true,
        document_id: '1',
        document_version: 1,
      }),
      '3',
    ),
  ).rejects.toThrow('ADMIN_REQUIRED');
  await dao.act(
    'grants',
    'reviewapp',
    encodeGrants('reviewapp', {
      ...dao.actor(),
      application_id: '4001',
      eligible: true,
      document_id: '1',
      document_version: 1,
    }),
  );
  await dao.act(
    'decide',
    'openaward',
    encodeDecide('openaward', {
      ...dao.actor(),
      ballot_id: '4001',
      grants: 'grants',
      round_id: '4001',
      application_id: '4001',
      project_id: '4001',
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: '{}',
    }),
  );
  for (const member of ['1', '2'])
    await dao.act(
      'decide',
      'vote',
      encodeDecide('vote', { ...dao.actor(member), ballot_id: '4001', choice: 1 }),
      member,
    );
  await expect(
    dao.act(
      'decide',
      'vote',
      encodeDecide('vote', { ...dao.actor('2'), ballot_id: '4001', choice: 1 }),
      '2',
    ),
  ).rejects.toThrow('ALREADY_VOTED');
  const victimMember = await second.member();
  await expect(
    second.act(
      'decide',
      'vote',
      encodeDecide('vote', { ...second.actor(), ballot_id: '4001', choice: 1 }),
    ),
  ).rejects.toThrow('BALLOT_DOMAIN');
  expect(await second.member()).toEqual(victimMember);
  await expect(f.gateway.execute({ dao: dao.reference, ballotId: '4001' })).rejects.toMatchObject({
    code: 'BALLOT_NOT_PASSED',
  });
  await dao.act(
    'payroll',
    'commit',
    encodePayroll('commit', {
      ...dao.actor(),
      schedule_id: '4001',
      recipient: '3',
      quantity: '1.0000 TLOS',
      periods: 1,
      interval: 86400,
      starts: now + 60,
    }),
  );
  expect(await dao.totals()).toMatchObject({ available: '90000', reserved: '10000', claims: '0' });
  const closes = (await dao.state()).ballots.find((ballot) => ballot.id === '4001')?.closes;
  if (!closes) throw new Error('FIXTURE_BALLOT_REQUIRED');
  while (Math.floor(Date.now() / 1000) <= closes)
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  await f.gateway.finalize({ dao: dao.reference, ballotId: '4001' });
  await f.gateway.execute({ dao: dao.reference, ballotId: '4001' });
  expect(await f.gateway.execute({ dao: dao.reference, ballotId: '4001' })).toEqual({
    state: 'already-executed',
  });
  expect(await dao.totals()).toMatchObject({ available: '80000', reserved: '20000', claims: '0' });
  const state = await dao.state(),
    milestone = state.milestones.find((row) => row.project_id === '4001'),
    installment = state.entries.find((row) => row.schedule_id === '4001');
  if (!milestone || !installment) throw new Error('FIXTURE_LIABILITIES_REQUIRED');
  const otherBefore = await second.member('3');
  await expect(
    second.act(
      'works',
      'submitwork',
      encodeWorks('submitwork', {
        ...second.actor('3'),
        milestone_id: milestone.id,
        document_id: '1',
        document_version: 1,
      }),
      '3',
    ),
  ).rejects.toThrow('MILESTONE_DOMAIN');
  expect(await second.member('3')).toEqual(otherBefore);
  await dao.act(
    'works',
    'submitwork',
    encodeWorks('submitwork', {
      ...dao.actor('3'),
      milestone_id: milestone.id,
      document_id: '1',
      document_version: 1,
    }),
    '3',
  );
  await expect(
    dao.act(
      'works',
      'review',
      encodeWorks('review', {
        ...dao.actor('3'),
        milestone_id: milestone.id,
        approve: true,
        document_id: '1',
        document_version: 1,
      }),
      '3',
    ),
  ).rejects.toThrow('SELF_REVIEW');
  await dao.act(
    'works',
    'review',
    encodeWorks('review', {
      ...dao.actor(),
      milestone_id: milestone.id,
      approve: true,
      document_id: '1',
      document_version: 1,
    }),
  );
  const settleWork = () =>
    f.call(
      'works',
      'settle',
      { runtime: 'daclifycore', dao_id: dao.daoId, milestone_id: milestone.id },
      'relay',
    );
  await settleWork();
  await expect(settleWork()).rejects.toThrow('NOT_PAYABLE');
  const settlePayroll = () =>
    f.call(
      'payroll',
      'settle',
      { runtime: 'daclifycore', dao_id: dao.daoId, entry_id: installment.id },
      'relay',
    );
  await settlePayroll();
  await expect(settlePayroll()).rejects.toThrow('NOT_PAYABLE');
  expect(await dao.totals()).toMatchObject({ available: '80000', reserved: '0', claims: '20000' });
  await dao.act(
    'daclifycore',
    'setactive',
    encodeAction('setactive', { ...dao.actor(), target: '3', active: false }),
  );
  const claim = await dao.totals(),
    claimant = await dao.member('3');
  const withdraw = () =>
    dao.act(
      'daclifycore',
      'withdraw',
      encodeAction('withdraw', {
        ...dao.actor('3'),
        destination: 'carol',
        quantity: '2.0000 TLOS',
      }),
      '3',
    );
  await expect(withdraw()).rejects.toThrow('PAYOUT_TOKEN_ROW_REQUIRED');
  expect(await dao.totals()).toEqual(claim);
  expect(await dao.member('3')).toEqual(claimant);
  await f.call(
    'eosio.token',
    'open',
    { owner: 'carol', symbol: '4,TLOS', ram_payer: 'carol' },
    'carol',
  );
  await withdraw();
  expect(
    (await f.api.v1.chain.get_currency_balance('eosio.token', 'carol', 'TLOS')).map((value) =>
      value.toString(),
    ),
  ).toEqual(['2.0000 TLOS']);
  expect(await dao.totals()).toMatchObject({ available: '80000', reserved: '0', claims: '0' });
  await expect(withdraw()).rejects.toThrow('INSUFFICIENT_CLAIM');
  expect(await second.totals()).toMatchObject({ available: '100000', reserved: '0', claims: '0' });
}, 100000);
