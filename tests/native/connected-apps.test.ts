import { afterAll, beforeAll, expect, it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  APIError,
  ABI,
  Authority,
  PrivateKey,
  UInt64,
  Transaction,
  SignedTransaction,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { ModulePermissions } from '@daclify/modules';
import {
  encodeActivity,
  ModuleCodeHashes,
  ActivityTableSchemas,
  encodeDecide,
} from '@daclify/modules/sdk';
import {
  encodeAction,
  instructionDigest,
  RuntimeTableSchemas,
  makeInstruction,
  RuntimeCodeHash,
} from '../../sdk/index.js';
import { appConfigurationHash, ConnectedAppConfigSchema } from '../../protocol/connected-apps.js';
import { AccountSchema } from '../../protocol/api.js';
import { DaoRefSchema } from '../../protocol/base.js';
import { EncryptionPublicKeySchema } from '../../protocol/crypto.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
let owned: NativeContracts | undefined, activityAbi: ABI, gateway: NativeChainGateway;
const keys = Array.from({ length: 7 }, () => PrivateKey.generate('K1')),
  delegates = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
const encryptionKeys = Array.from({ length: 7 }, () =>
  EncryptionPublicKeySchema.parse(
    generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
  ),
);
const wrappedGrant = JSON.stringify({
  version: 1,
  ephemeralKey: { kty: 'EC', crv: 'P-256', x: 'a'.repeat(43), y: 'b'.repeat(43) },
  salt: 'c'.repeat(43) + '=',
  envelope: {
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: 'd'.repeat(16),
    ciphertext: 'e'.repeat(64),
  },
});
const fixture = () => {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
};
const actor = (member = '1', dao = '90001') => ({
  runtime: 'daclifycore',
  dao_id: dao,
  member_id: member,
});
const reference = (dao = '90001') =>
  DaoRefSchema.parse({
    chainId: fixture().chainId,
    contract: 'daclifycore',
    daoId: dao,
    interfaceVersion: 1,
  });
function configFor(appId = '1', dao = '90001') {
  return ConnectedAppConfigSchema.parse({
    dao: reference(dao),
    appId,
    revision: '1',
    name: 'Garden',
    origins: ['https://garden.example'],
    redirectUris: ['https://garden.example/callback'],
    activityAccount: 'activity',
    enabled: true,
  });
}
async function person(member = '1', dao = '90001') {
  const rows = await fixture().api.v1.chain.get_table_rows({
    json: true,
    code: 'daclifycore',
    scope: UInt64.from(dao),
    table: 'members',
    lower_bound: UInt64.from(member),
    upper_bound: UInt64.from(member),
    limit: 1,
  });
  return RuntimeTableSchemas.members.parse(rows.rows[0]);
}
async function root(target: string, action: string, data: Uint8Array, member = '1', dao = '90001') {
  const f = fixture(),
    key = keys[Number(member) - 1];
  if (!key) throw new Error('FIXTURE_KEY');
  const request = makeInstruction(
    reference(dao),
    member,
    (await person(member, dao)).nonce,
    Math.floor(Date.now() / 1000) + 120,
    target,
    action,
    data,
  );
  return f.call(
    'daclifycore',
    'submit',
    { request, sig: key.signDigest(instructionDigest(request)).toString() },
    'relay',
  );
}
async function delegated(
  action: 'recordact' | 'askreview' | 'reviewact',
  data: Uint8Array,
  index = 0,
  dao = '90001',
) {
  const f = fixture(),
    key = delegates[index];
  if (!key) throw new Error('FIXTURE_KEY');
  const request = makeInstruction(
    reference(dao),
    '3',
    (await person('3', dao)).nonce,
    Math.floor(Date.now() / 1000) + 120,
    'activity',
    action,
    data,
  );
  return f.call(
    'daclifycore',
    'submitsess',
    {
      request,
      session_id: String(101 + index),
      sig: key.signDigest(instructionDigest(request)).toString(),
    },
    'relay',
  );
}
const item = (app = '1', event = 'aa', dao = '90001') => ({
  ...actor('3', dao),
  app_id: app,
  source_id: 'bb'.repeat(32),
  source_revision: 'cc'.repeat(32),
  event_id: event.repeat(32),
  evidence_cid: '',
  evidence_hash: '00'.repeat(32),
  key_epoch: '0',
});
async function rows<K extends keyof typeof ActivityTableSchemas>(table: K, lower = '0') {
  const response = await fixture().api.v1.chain.get_table_rows({
    json: true,
    code: 'activity',
    scope: 'daclifycore',
    table,
    lower_bound: UInt64.from(lower),
    limit: 50,
  });
  return z.array(ActivityTableSchemas[table]).parse(response.rows);
}
beforeAll(async () => {
  const f = (owned = await nativeContracts());
  await f.create('activity');
  activityAbi = await f.deploy(
    'activity',
    '../daclify-backend-modules/.artifacts/contracts/activity',
  );
  expect((await f.api.v1.chain.get_raw_abi('activity')).code_hash.toString()).toBe(
    ModuleCodeHashes.activity,
  );
  await f.update(
    'activity',
    'active',
    'owner',
    Authority.from({
      threshold: 1,
      keys: [{ key: f.key('activity').toPublic(), weight: 1 }],
      accounts: [{ permission: { actor: 'activity', permission: 'eosio.code' }, weight: 1 }],
      waits: [],
    }),
  );
  await f.push(
    [
      f.action(
        'activity',
        'bindrampool',
        { runtime: 'daclifycore' },
        [{ actor: 'activity', permission: 'active' }],
        activityAbi,
      ),
    ],
    [f.key('activity')],
  );
  await f.push(
    ModulePermissions.activity.actions.map((action) =>
      f.system(
        'linkauth',
        { account: 'daclifycore', code: 'activity', type: action, requirement: 'execctx' },
        'daclifycore',
        'owner',
      ),
    ),
    [f.key('daclifycore')],
  );
  await f.call('daclifycore', 'listmod', {
    account: 'activity',
    publisher: 'alice',
    party: 0,
    accepts_fee_rule: 1,
    price: '0.0000 TLOS',
    code_hash: ModuleCodeHashes.activity,
    title: 'Community Activity',
  });
  for (const dao of ['90001', '90002']) {
    await f.call(
      'daclifycore',
      'createdao',
      {
        dao_id: dao,
        owner: 'alice',
        metadata: '{}',
        privacy: dao === '90001' ? 0 : 2,
        token_contract: 'eosio.token',
        token_symbol: '4,TLOS',
      },
      'alice',
    );
    await f.call(
      'daclifycore',
      'initgov',
      {
        dao_id: dao,
        settings: {
          participant_mode: 0,
          decide: 'decide',
          guardian: 'alice',
          kind: 0,
          duration: 60,
          quorum: 5000,
          approval: 5001,
          governed_works: false,
          max_commitment: '0',
          daily_commitment: '0',
        },
      },
      'alice',
    );
    for (const [index, key] of keys.entries())
      await f.call(
        'daclifycore',
        'enroll',
        {
          dao_id: dao,
          member_id: String(index + 1),
          native_account: '',
          signing_key: key.toPublic(),
          encryption_key: JSON.stringify(encryptionKeys[index]),
          custody: 0,
        },
        'alice',
      );
    for (const config of [
      { account: 'activity', id: 'activity' },
      { account: 'decide', id: 'decide' },
    ]) {
      const permission =
        config.id === 'activity' ? ModulePermissions.activity : ModulePermissions.decide;
      await f.call(
        'daclifycore',
        'setmodule',
        {
          dao_id: dao,
          account: config.account,
          version: 1,
          actions: permission.actions,
          grants: permission.grants,
          code_hash: config.id === 'activity' ? ModuleCodeHashes.activity : ModuleCodeHashes.decide,
        },
        'alice',
      );
    }
    await root(
      'daclifycore',
      'setroles',
      encodeAction('setroles', { ...actor('1', dao), target: '2', admin: true, reviewer: true }),
      '1',
      dao,
    );
    for (const app of ['1', '2'])
      await root(
        'daclifycore',
        'setapp',
        encodeAction('setapp', {
          ...actor('1', dao),
          app_id: app,
          target: 'activity',
          revision: '1',
          config_hash: appConfigurationHash(configFor(app, dao)),
          enabled: true,
        }),
        '1',
        dao,
      );
  }
  for (const [index, key] of delegates.entries())
    await root(
      'daclifycore',
      'addappses',
      encodeAction('addappses', {
        ...actor('3'),
        app_id: String(index + 1),
        app_revision: '1',
        session_id: String(index + 101),
        signing_key: key.toPublic().toString(),
        expires: Math.floor(Date.now() / 1000) + 3600,
      }),
      '3',
    );
  gateway = new NativeChainGateway({
    rpcUrl: f.url,
    chainId: f.chainId,
    runtime: 'daclifycore',
    hub: 'daclifyhub',
    environment: 'local',
    relayActor: 'relay',
    relayKey: f.key('relay'),
    modules: [...nativeModules, { id: 'activity', account: 'activity' }],
  });
}, 60000);
afterAll(async () => owned?.stop());
it('reports the same built-in member prices used by hosted capacity when no override exists', async () => {
  const f = fixture();
  const current = await gateway.platform();
  expect(current.seatPricing).toEqual({
    first_usd: 100,
    next_usd: 50,
    rest_usd: 20,
    revision: '0',
  });
  expect(current.paymentPolicy).toBeNull();
  await f.push(['govseatfee', 'govpayfees'].map(action => f.system('linkauth', {
    account: 'daclifycore', code: 'daclifycore', type: action, requirement: 'execctx',
  }, 'daclifycore', 'owner')), [f.key('daclifycore')]);
  await f.call('daclifycore', 'setgov', { dao_id: '90001' }, 'daclifycore', 'owner');
  expect((await gateway.platform()).paymentPolicy).toEqual({ bps: 500, revision: '0' });
  expect((await gateway.paymentPolicy()).basisPoints).toBe(500);
  await root(
    'daclifycore',
    'govseatfee',
    encodeAction('govseatfee', {
      ...actor('1'),
      first_usd: 200,
      next_usd: 75,
      rest_usd: 25,
    }),
    '1',
  );
  await root(
    'daclifycore',
    'govpayfees',
    encodeAction('govpayfees', {
      ...actor('1'),
      bps: 725,
    }),
    '1',
  );
  const changed = await gateway.platform();
  expect(changed.seatPricing).toEqual({
    first_usd: 200,
    next_usd: 75,
    rest_usd: 25,
    revision: '1',
  });
  expect(changed.paymentPolicy).toEqual({ bps: 725, revision: '1' });
  expect((await gateway.paymentPolicy()).basisPoints).toBe(725);
  await f.call('daclifycore', 'setgov', { dao_id: '0' }, 'daclifycore', 'owner');
});
it('records two independently delegated apps under one seven-member DAO and measures native resources', async () => {
  const f = fixture(),
    before = Number((await f.api.v1.chain.get_account('activity')).ram_usage);
  const first = await delegated('recordact', encodeActivity('recordact', item()));
  const firstRam = Number((await f.api.v1.chain.get_account('activity')).ram_usage);
  const second = await delegated('recordact', encodeActivity('recordact', item('2')), 1);
  const secondRam = Number((await f.api.v1.chain.get_account('activity')).ram_usage);
  const receipts = await rows('activities');
  expect(receipts).toHaveLength(2);
  expect(receipts.map((receipt) => receipt.actor)).toEqual(['3', '3']);
  expect(receipts.map((receipt) => receipt.app_id)).toEqual(['1', '2']);
  const dao = await gateway.dao('90001');
  expect(dao.members).toBe(7);
  const byEvent = await gateway.connectedApps.activity(configFor(), { eventId: 'aa'.repeat(32) }),
    byApp = await gateway.connectedApps.activity(configFor('2'), {});
  expect(byEvent.receipts).toHaveLength(1);
  expect(byEvent.receipts[0]?.memberId).toBe('3');
  expect(byApp.receipts).toHaveLength(1);
  expect(byApp.receipts[0]?.appId).toBe('2');
  expect((await gateway.connectedApps.session('90001', '101'))?.credential.member_id).toBe('3');
  expect((await person('2')).admin).toBe(true);
  const cpu = (value: unknown) =>
    z
      .object({
        processed: z.object({
          receipt: z.object({ cpu_usage_us: z.coerce.number().int().positive() }),
        }),
      })
      .parse(JSON.parse(JSON.stringify(value))).processed.receipt.cpu_usage_us;
  writeFileSync(
    '.artifacts/connected-apps-native-metrics.json',
    JSON.stringify(
      {
        runtimeCodeHash: RuntimeCodeHash,
        activityCodeHash: ModuleCodeHashes.activity,
        wasmBytes: readFileSync('../daclify-backend-modules/.artifacts/contracts/activity.wasm')
          .length,
        firstAppReceiptRamBytes: firstRam - before,
        secondAppReceiptRamBytes: secondRam - firstRam,
        cpuMicroseconds: [cpu(first), cpu(second)],
      },
      null,
      2,
    ) + '\n',
  );
  expect(firstRam).toBeGreaterThan(before);
  expect(secondRam - firstRam).toBeLessThan(2048);
});
it('rejects cross-app signatures, direct service calls and elevated delegated actions', async () => {
  await expect(
    delegated('recordact', encodeActivity('recordact', item('2', 'ee'))),
  ).rejects.toThrow('APP_SCOPE');
  const data = {
    ...actor('3'),
    app_id: '1',
    receipt_id: '1',
    source_revision: 'cc'.repeat(32),
    accepted: true,
    evidence_cid: '',
    evidence_hash: '00'.repeat(32),
    key_epoch: '0',
  };
  await expect(delegated('reviewact', encodeActivity('reviewact', data))).rejects.toThrow(
    'SESSION_SCOPE',
  );
  await expect(
    fixture().push(
      [
        fixture().action(
          'activity',
          'recordact',
          item(),
          [{ actor: 'daclifycore', permission: 'active' }],
          activityAbi,
        ),
      ],
      [fixture().key('daclifycore')],
    ),
  ).rejects.toThrow('ACTOR_SENDER');
  await expect(
    root(
      'daclifycore',
      'setapp',
      encodeAction('setapp', {
        ...actor('3'),
        app_id: '3',
        target: 'activity',
        revision: '1',
        config_hash: appConfigurationHash(configFor('3')),
        enabled: true,
      }),
      '3',
    ),
  ).rejects.toThrow('ADMIN_REQUIRED');
});
it('deduplicates retries and permits only independent exact-version review', async () => {
  await delegated('recordact', encodeActivity('recordact', item()));
  expect(await rows('activities')).toHaveLength(2);
  await delegated('askreview', encodeActivity('askreview', item('1', 'ef')));
  const receipt = (await rows('activities')).find((row) => row.kind === 2);
  if (!receipt) throw new Error('FIXTURE_RECEIPT');
  const review = {
    ...actor('1'),
    app_id: '1',
    receipt_id: receipt.id,
    source_revision: receipt.source_revision,
    accepted: true,
    evidence_cid: '',
    evidence_hash: '00'.repeat(32),
    key_epoch: '0',
  };
  await expect(
    root(
      'activity',
      'reviewact',
      encodeActivity('reviewact', { ...review, source_revision: 'ff'.repeat(32) }),
    ),
  ).rejects.toThrow('ACTIVITY_REVISION');
  await root('activity', 'reviewact', encodeActivity('reviewact', review));
  expect((await rows('activities')).find((row) => row.id === receipt.id)?.status).toBe(2);
});
it('binds advisory decisions to the exact immutable receipt and source revision', async () => {
  const receipt = (await rows('activities'))[0];
  if (!receipt) throw new Error('FIXTURE_RECEIPT');
  const metadata = {
    type: 'connected-activity-v1',
    daoId: '90001',
    appId: '1',
    receiptId: receipt.id,
    sourceId: receipt.source_id,
    sourceRevision: receipt.source_revision,
  };
  await root(
    'decide',
    'open',
    encodeDecide('open', {
      ...actor(),
      ballot_id: '901',
      kind: 0,
      choices: 2,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: JSON.stringify({ ...metadata, sourceRevision: 'ee'.repeat(32) }),
    }),
  );
  await expect(
    root(
      'activity',
      'linkdecision',
      encodeActivity('linkdecision', {
        ...actor(),
        app_id: '1',
        receipt_id: receipt.id,
        decide: 'decide',
        ballot_id: '901',
      }),
    ),
  ).rejects.toThrow('DECISION_SOURCE');
  await root(
    'decide',
    'open',
    encodeDecide('open', {
      ...actor(),
      ballot_id: '902',
      kind: 0,
      choices: 2,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: JSON.stringify(metadata),
    }),
  );
  await root(
    'activity',
    'linkdecision',
    encodeActivity('linkdecision', {
      ...actor(),
      app_id: '1',
      receipt_id: receipt.id,
      decide: 'decide',
      ballot_id: '902',
    }),
  );
  expect((await rows('actdecisions'))[0]).toMatchObject({ dao_id: '90001', ballot_id: '902' });
});
it('supports protected app epochs within a private DAO and rejects old future access after removal', async () => {
  const actorContext = actor('1', '90002');
  await root(
    'activity',
    'newappkey',
    encodeActivity('newappkey', {
      ...actorContext,
      app_id: '1',
      key_epoch: '991',
      security_epoch: '1',
      app_revision: '1',
      key_commitment: 'de'.repeat(32),
      self_grant: wrappedGrant,
    }),
    '1',
    '90002',
  );
  await root(
    'daclifycore',
    'setactive',
    encodeAction('setactive', { ...actorContext, target: '5', active: false }),
    '1',
    '90002',
  );
  const evidence = {
    ...item('1', 'fa', '90002'),
    evidence_cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    evidence_hash: createHash('sha256').update('ciphertext fixture').digest('hex'),
    key_epoch: '991',
  };
  await expect(
    root('activity', 'recordact', encodeActivity('recordact', evidence), '3', '90002'),
  ).rejects.toThrow('APP_KEY_STALE');
  await root(
    'activity',
    'newappkey',
    encodeActivity('newappkey', {
      ...actorContext,
      app_id: '1',
      key_epoch: '992',
      security_epoch: '2',
      app_revision: '1',
      key_commitment: 'ee'.repeat(32),
      self_grant: wrappedGrant,
    }),
    '1',
    '90002',
  );
  await root(
    'activity',
    'recordact',
    encodeActivity('recordact', { ...evidence, key_epoch: '992' }),
    '3',
    '90002',
  );
  const registeredConfig = {
    dao: reference('90002'),
    appId: '1',
    revision: '1',
    name: 'Garden',
    origins: ['https://garden.example'],
    redirectUris: ['https://garden.example/callback'],
    activityAccount: 'activity',
    enabled: true,
  };
  const access = await gateway.connectedApps.keys(registeredConfig, '1');
  expect(access.currentEpoch).toBe('992');
  expect(access.grants.map((grant) => grant.key_epoch)).toEqual(['991', '992']);
  const encryption = encryptionKeys[4];
  if (!encryption) throw new Error('FIXTURE_KEY');
  await expect(
    root(
      'activity',
      'grantappkey',
      encodeActivity('grantappkey', {
        ...actorContext,
        app_id: '1',
        key_epoch: '992',
        recipient: '5',
        encryption_key: JSON.stringify(encryption),
        envelope: '{}',
      }),
      '1',
      '90002',
    ),
  ).rejects.toThrow('MEMBER_INACTIVE');
  const account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: keys[4]?.toPublic().toString(),
    custody: 'user-controlled',
    encryptionKey: encryption,
  });
  expect(await gateway.connectedApps.membership(account, '90002')).toBeNull();
});
it('controls the additive module through runtime authority while its code can meter RAM', async () => {
  const f = fixture(),
    authority = {
      threshold: 1,
      keys: [],
      accounts: [{ permission: { actor: 'daclifycore', permission: 'active' }, weight: 1 }],
      waits: [],
    };
  const actions = [
    f.system(
      'updateauth',
      {
        account: 'activity',
        permission: 'active',
        parent: 'owner',
        auth: {
          ...authority,
          accounts: [
            { permission: { actor: 'activity', permission: 'eosio.code' }, weight: 1 },
            ...authority.accounts,
          ],
        },
      },
      'activity',
      'owner',
    ),
    f.system(
      'updateauth',
      { account: 'activity', permission: 'owner', parent: '', auth: authority },
      'activity',
      'owner',
    ),
  ];
  const info = await f.api.v1.chain.get_info(),
    transaction = Transaction.from({ ...info.getTransactionHeader(120), actions });
  try {
    await f.api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: [f.key('activity').signDigest(transaction.signingDigest(info.chain_id))],
      }),
    );
  } catch (error) {
    if (error instanceof APIError)
      throw new Error(error.details.map((detail) => detail.message).join('; '));
    throw error;
  }
  await expect(
    f.call('activity', 'bindrampool', { runtime: 'daclifycore' }, 'activity'),
  ).rejects.toThrow();
  await f.push(
    [
      f.action(
        'activity',
        'bindrampool',
        { runtime: 'daclifycore' },
        [{ actor: 'activity', permission: 'active' }],
        activityAbi,
      ),
    ],
    [f.key('daclifycore')],
  );
  const account = await f.api.v1.chain.get_account('activity');
  expect(
    account.permissions.every((permission) => permission.required_auth.keys.length === 0),
  ).toBe(true);
  await delegated('recordact', encodeActivity('recordact', item('2', 'ad')), 1);
});
it('relays an actual member app signature through the native-backed API gateway',async()=>{
 const rootKey=keys[2],delegate=delegates[1],encryption=encryptionKeys[2];if(!rootKey||!delegate||!encryption)throw new Error('FIXTURE_KEY');
 const account=AccountSchema.parse({id:randomUUID(),custody:'user-controlled',signingKey:rootKey.toPublic().toString(),encryptionKey:encryption}),data=encodeActivity('recordact',item('2','af')),request=makeInstruction(reference(),'3',(await person('3')).nonce,Math.floor(Date.now()/1000)+120,'activity','recordact',data);
 const receipt=await gateway.connectedApps.relay(account,request,delegate.signDigest(instructionDigest(request)).toString(),'102','2');expect(receipt.transactionId).toMatch(/^[a-f0-9]{64}$/);
 expect((await gateway.connectedApps.activity(configFor('2'),{eventId:'af'.repeat(32)})).receipts[0]?.memberId).toBe('3');
});
