import { generateKeyPairSync } from 'node:crypto';
import {
  EncryptionPublicKeySchema,
  EncryptionPrivateKeySchema,
  EpochGrantSchema,
} from '../../protocol/crypto.js';
import {
  contactPacketCommitment,
  createContactDocumentPacket,
  openContactDocumentShare,
  recoverContactDocumentPacket,
} from '../../sdk/contact-recovery.js';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { ABI, Authority, PrivateKey, Serializer } from '@wharfkit/antelope';
import { statSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import { contextPermissionPlan } from '../../tools/deploy/permissions.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import {
  encodeQuickAnchor,
  quickAccountDigest,
  quickAccountIdentity,
  QuickAuthTableSchemas,
} from '../../sdk/quick-accounts.js';
import {
  contactRecoveryDigest,
  contactRequestCommitment,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
  nativeOwnershipSetupActions,
  nativeHandoverActions,
  governanceSettings,
} from '../../sdk/index.js';
import { defaultDaoSetup } from '../../protocol/dao.js';
let f: NativeProcess, abi: ABI, gateway: NativeChainGateway;
const old = PrivateKey.generate('K1'),
  replacement = PrivateKey.generate('K1'),
  contacts = [0, 1, 2].map(() => PrivateKey.generate('K1'));
const encryptionKeys = [0, 1, 2, 3, 4].map(() =>
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
);
function encryptionPair(index: number) {
  const pair = encryptionKeys[index];
  if (!pair) throw new Error('CONTACT_FIXTURE');
  return pair;
}
function contact(index: number) {
  const key = contacts[index];
  if (!key) throw new Error('CONTACT_FIXTURE');
  return key;
}
const publicEncryption = (i: number) => {
  const jwk = encryptionPair(i).publicKey.export({ format: 'jwk' });
  return EncryptionPublicKeySchema.parse({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
};
const encryption = (i: number) => JSON.stringify(publicEncryption(i));
const actor = { runtime: 'daclifycore', dao_id: '1', member_id: '1' };
const metrics: Record<string, number> = {};
async function call(name: string, data: object, account = 'relay', consent?: string) {
  const result = await f.push(
    [
      f.action(
        'daclifycore',
        name,
        data,
        [
          { actor: account, permission: 'active' },
          ...(consent ? [{ actor: consent, permission: 'active' }] : []),
        ],
        abi,
      ),
    ],
    [f.key(account), ...(consent ? [f.key(consent)] : [])],
  );
  const receipt = z
    .object({ processed: z.object({ receipt: z.object({ cpu_usage_us: z.coerce.number() }) }) })
    .parse(JSON.parse(JSON.stringify(result)));
  metrics[name + '_cpu_us'] = receipt.processed.receipt.cpu_usage_us;
  return result;
}
async function member() {
  return RuntimeTableSchemas.members.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: '1',
        table: 'members',
        limit: 1,
      })
    ).rows[0],
  );
}
async function own(name: string, data: object, signer = old, consent?: string) {
  const m = await member();
  const request = makeInstruction(
    { chainId: f.chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    '1',
    m.nonce,
    f.now() + 120,
    'daclifycore',
    name,
    Serializer.encode({ abi, type: name, object: { ...actor, ...data } }).array,
  );
  return call(
    'submit',
    { request, sig: signer.signDigest(instructionDigest(request)).toString() },
    'relay',
    consent,
  );
}
beforeAll(async () => {
  const library =
    process.env.DACLIFY_NATIVE_CLOCK_LIBRARY ??
    '/usr/lib/x86_64-linux-gnu/faketime/libfaketimeMT.so.1';
  f = await nativeProcess(library);
  for (const name of ['daclifycore', 'alice', 'bob', 'charlie', 'recovery', 'relay', 'eosio.token'])
    await f.create(name);
  abi = await f.deploy('daclifycore', '.artifacts/contracts/runtime');
  await f.update(
    'daclifycore',
    'active',
    'owner',
    Authority.from({
      threshold: 1,
      keys: [{ key: f.key('daclifycore').toPublic(), weight: 1 }],
      accounts: [{ permission: { actor: 'daclifycore', permission: 'eosio.code' }, weight: 1 }],
      waits: [],
    }),
  );
  const plan = contextPermissionPlan('daclifycore', []);
  await f.update('daclifycore', 'execctx', 'active', Authority.from(plan.authority));
  await f.push(
    plan.links.map((l) =>
      f.system(
        'linkauth',
        { account: 'daclifycore', code: l.account, type: l.action, requirement: 'execctx' },
        'daclifycore',
        'owner',
      ),
    ),
    [f.key('daclifycore')],
  );
  await call('init', { chain_id: f.chainId }, 'daclifycore');
  await call(
    'createdao',
    {
      dao_id: '1',
      owner: 'alice',
      metadata: '{}',
      privacy: 1,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  await call(
    'enroll',
    {
      dao_id: '1',
      member_id: '1',
      native_account: '',
      signing_key: old.toPublic().toString(),
      encryption_key: encryption(0),
      custody: 0,
    },
    'alice',
  );
  await call(
    'createdao',
    {
      dao_id: '2',
      owner: 'alice',
      metadata: '{}',
      privacy: 1,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  await call(
    'enroll',
    {
      dao_id: '2',
      member_id: '1',
      native_account: '',
      signing_key: old.toPublic().toString(),
      encryption_key: encryption(0),
      custody: 0,
    },
    'alice',
  );
  await call(
    'enroll',
    {
      dao_id: '1',
      member_id: '2',
      native_account: 'charlie',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      encryption_key: encryption(0),
      custody: 0,
    },
    'alice',
    'charlie',
  );
  gateway = new NativeChainGateway({
    rpcUrl: f.url,
    chainId: f.chainId,
    runtime: 'daclifycore',
    hub: 'daclifycore',
    environment: 'local',
    relayActor: 'relay',
    relayKey: f.key('relay'),
    modules: [],
  });
}, 90000);
afterAll(async () => {
  if (f) await f.stop();
});
it('runs real native permissions, exact proof packing, two contacts and a full 48-hour clock boundary', async () => {
  for (const name of ['quickauth', 'quickprobe']) await f.create(name);
  const quickAbi = await f.deploy('quickauth', '.artifacts/contracts/quickauth');
  await f.deploy('quickprobe', '.artifacts/contracts/quickprobe');
  const quick = (action: string, data: object, actors = ['relay']) =>
    f.push(
      [
        f.action(
          'quickauth',
          action,
          data,
          actors.map((actor) => ({ actor, permission: 'active' })),
          quickAbi,
        ),
      ],
      actors.map((actor) => f.key(actor)),
    );
  await quick(
    'qconfig',
    {
      runtime: 'daclifycore',
      source: 'quickprobe',
      code_hash: (await f.api.v1.chain.get_raw_abi('quickprobe')).code_hash.toString(),
      gateway: { actor: 'relay', permission: 'active' },
      maximum: 5000,
    },
    ['daclifycore', 'quickauth'],
  );
  const quickAnchor = { kind: 'key' as const, publicKey: old.toPublic().toString() };
  const registration = {
    version: 1,
    chain_id: f.chainId,
    runtime: 'daclifycore',
    authority: 'quickauth',
    anchor: encodeQuickAnchor(quickAnchor),
    account_id: '0',
    epoch: '0',
    expires: f.now() + 300,
  };
  await quick('qregister', {
    request: registration,
    proof: Serializer.encode({
      object: old.signDigest(quickAccountDigest('qregister', registration)),
    }).hexString,
  });
  await call(
    'setfees',
    {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    },
    'daclifycore',
  );
  await call(
    'setcreate',
    { shared_usd: 0, independent_usd: 5000, premium_bps: 2000, settler: 'relay' },
    'daclifycore',
  );
  await call('sethosted', { free_members: 10, settler: 'relay' }, 'daclifycore');
  const receiptReference = 'ce'.repeat(32);
  await call('orderfree', { reference: receiptReference, creator: old.toPublic().toString() });
  const initial = await member(),
    before = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage);
  const coordinate = publicEncryption(1).x,
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
    alias = coordinate.slice(0, -1) + alphabet[alphabet.indexOf(coordinate.slice(-1)) + 1];
  await expect(
    own('setcontacts', {
      contacts: contacts.map((key, index) => ({
        signing_key: key.toPublic().toString(),
        encryption_key: JSON.stringify(
          index === 1 ? { ...publicEncryption(1), x: alias } : publicEncryption(index + 1),
        ),
      })),
      documents: false,
    }),
  ).rejects.toThrow('RECOVERY_ENCRYPTION_KEY');
  await own('setrecpolicy', { allowed: true });
  const dummyGrant = EpochGrantSchema.parse({
    version: 1,
    ephemeralKey: publicEncryption(4),
    salt: Buffer.alloc(32).toString('base64'),
    envelope: {
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: Buffer.alloc(12).toString('base64'),
      ciphertext: Buffer.alloc(48).toString('base64'),
    },
  });
  await own('commitepoch', {
    epoch: '1',
    commitment: '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925',
    self_grant: JSON.stringify(dummyGrant),
  });
  await own('setcontacts', {
    contacts: contacts.map((key, i) => ({
      signing_key: key.toPublic().toString(),
      encryption_key: encryption(i + 1),
    })),
    documents: true,
  });
  const proof = async (action: string, index: number, id = '0', hash = '00'.repeat(32)) => ({
    action,
    chain_id: f.chainId,
    runtime: 'daclifycore',
    dao_id: '1',
    member_id: '1',
    revision: '1',
    request_id: id,
    contact: index,
    data_hash: hash,
    expires: f.now() + 300,
  });
  for (const [i, key] of contacts.entries()) {
    const p = await proof('acceptcont', i);
    await call('acceptcont', {
      proof: p,
      sig: key.signDigest(contactRecoveryDigest(p)).toString(),
    });
  }
  const target = {
    dao: { chainId: f.chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 as const },
    memberId: '1',
  };
  const packet = await createContactDocumentPacket(
    { target, revision: '1', packetId: '1' },
    [
      {
        epoch: '1',
        commitment: '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925',
        key: Buffer.alloc(32).toString('base64'),
      },
    ],
    contacts.map((key, i) => ({
      signingKey: key.toPublic().toString(),
      encryptionKey: publicEncryption(i + 1),
    })),
  );
  const packetBefore = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage);
  await own('putrecpack', { packet_id: '1', packet: JSON.stringify(packet) });
  metrics.packet_ram_bytes =
    Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage) - packetBefore;
  for (const index of [0, 1]) {
    const p = await proof('ackrecpack', index, '1', await contactPacketCommitment(packet));
    await call('ackrecpack', {
      proof: p,
      sig: contact(index).signDigest(contactRecoveryDigest(p)).toString(),
    });
  }
  let request = {
    action: 'startrecover',
    chain_id: f.chainId,
    runtime: 'daclifycore',
    dao_id: '1',
    member_id: '1',
    revision: '1',
    request_id: '1',
    signing_key: replacement.toPublic().toString(),
    encryption_key: encryption(4),
    native_account: '',
    expires: f.now() + 604800,
  };
  let hash = contactRequestCommitment(request);
  const first = await proof('startrecover', 0, '1', hash.toString());
  await call('startrecover', {
    request,
    new_sig: replacement.signDigest(hash).toString(),
    proof: first,
    sig: contact(0).signDigest(contactRecoveryDigest(first)).toString(),
  });
  const p = await proof('approverec', 1, '1', hash.toString());
  await call('approverec', {
    proof: p,
    sig: contact(1).signDigest(contactRecoveryDigest(p)).toString(),
  });
  await expect(call('finishrec', { dao_id: '1', member_id: '1', request_id: '1' })).rejects.toThrow(
    'RECOVERY_WAIT',
  );
  await call(
    'appoint',
    { dao_id: '1', member_ids: ['1'], inactivity_seconds: 604800, quorum_bps: 10000 },
    'alice',
  );
  await own('linknative', { account: 'alice' }, old, 'alice');
  const nativeEnrollment = makeInstruction(
    target.dao,
    '1',
    (await member()).nonce,
    f.now() + 120,
    'daclifycore',
    'setcontacts',
    Serializer.encode({
      abi,
      type: 'setcontacts',
      object: {
        ...actor,
        contacts: contacts.map((key, index) => ({
          signing_key: key.toPublic().toString(),
          encryption_key: encryption(index + 1),
        })),
        documents: true,
      },
    }).array,
  );
  await expect(call('submitnat', { request: nativeEnrollment }, 'alice')).rejects.toThrow(
    'RECOVERY_ROOT_PROOF_REQUIRED',
  );
  await f.push(
    nativeOwnershipSetupActions('daclifycore', {
      dao_id: '1',
      contracts: [],
      creator: 'recovery',
      inline_code: [],
      service_key: f.key('relay').toPublic().toString(),
    }),
    [f.key('daclifycore')],
  );
  const cfg = RuntimeTableSchemas.nativegov.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: 'daclifycore',
        table: 'nativegov',
        limit: 1,
      })
    ).rows[0],
  );
  const policy = RuntimeTableSchemas.execpols.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: 'daclifycore',
        table: 'execpols',
        limit: 1,
      })
    ).rows[0],
  );
  await f.push(
    nativeHandoverActions(
      'daclifycore',
      cfg,
      {
        dao_id: '1',
        expected_signers: ['alice'],
        expected_threshold: 1,
        expected_revision: policy.revision,
        expected_creator: 'recovery',
        expected_policy_version: 2,
      },
      [await f.api.v1.chain.get_account('daclifycore')],
    ),
    [f.key('daclifycore')],
  );
  await f.advanceClock(172801);
  const unchanged = await member();
  await expect(call('finishrec', { dao_id: '1', member_id: '1', request_id: '1' })).rejects.toThrow(
    'LAST_NATIVE_EXECUTIVE',
  );
  expect(await member()).toEqual(unchanged);
  await f.push(
    [
      f.action(
        'daclifycore',
        'appoint',
        {
          dao_id: '1',
          member_ids: ['1', '2'],
          inactivity_seconds: 604800,
          quorum_bps: 5000,
        },
        [{ actor: 'daclifycore', permission: 'active' }],
        abi,
      ),
    ],
    [f.key('alice')],
  );
  await expect(call('finishrec', { dao_id: '1', member_id: '1', request_id: '1' })).rejects.toThrow(
    'RECOVERY_NATIVE_ROLE_CHANGED',
  );
  expect(await member()).toEqual(unchanged);
  expect(await gateway.accountKeyRetired(old.toPublic().toString())).toBe(false);
  await own('cancelrec', {});
  request = {
    ...request,
    request_id: '2',
    native_account: 'bob',
    expires: f.now() + 604800,
  };
  hash = contactRequestCommitment(request);
  const restart = await proof('startrecover', 0, '2', hash.toString());
  await call('startrecover', {
    request,
    new_sig: replacement.signDigest(hash).toString(),
    proof: restart,
    sig: contact(0).signDigest(contactRecoveryDigest(restart)).toString(),
  });
  const second = await proof('approverec', 1, '2', hash.toString());
  await call('approverec', {
    proof: second,
    sig: contact(1).signDigest(contactRecoveryDigest(second)).toString(),
  });
  await f.advanceClock(172801);
  await expect(call('finishrec', { dao_id: '1', member_id: '1', request_id: '2' })).rejects.toThrow(
    'NATIVE_AUTH_REJECTED',
  );
  await call('finishrec', { dao_id: '1', member_id: '1', request_id: '2' }, 'relay', 'bob');
  const result = await member();
  expect(result).toMatchObject({
    id: initial.id,
    credits: initial.credits,
    claim: initial.claim,
    stake: initial.stake,
    admin: initial.admin,
    active: initial.active,
    signing_key: replacement.toPublic().toString(),
  });
  await expect(own('cancelrec', {}, old)).rejects.toThrow();
  const state = await gateway.contactRecovery({
    dao: { chainId: f.chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    memberId: '1',
  });
  expect(state.result?.request.signing_key).toBe(replacement.toPublic().toString());
  expect(state.packets[0]?.packet).toBe(JSON.stringify(packet));
  expect(state.packets[0]?.acknowledged).toBe(3);
  const recovered = await recoverContactDocumentPacket(
    packet,
    await Promise.all(
      [0, 1].map((index) =>
        openContactDocumentShare(
          packet,
          index,
          EncryptionPrivateKeySchema.parse(
            encryptionPair(index + 1).privateKey.export({ format: 'jwk' }),
          ),
        ),
      ),
    ),
  );
  expect(recovered[0]?.key).toBe(Buffer.alloc(32).toString('base64'));
  await own(
    'recovergrant',
    { request_id: '2', epoch: '1', envelope: JSON.stringify(dummyGrant) },
    replacement,
  );
  expect((await gateway.contactRecoveryGrant({ target, epoch: '1' })).grant).toEqual(dummyGrant);
  expect((await gateway.contactRecoveryGrant({ target, epoch: '2' })).grant).toBeNull();
  const other = await gateway.contactRecovery({
    dao: { chainId: f.chainId, contract: 'daclifycore', daoId: '2', interfaceVersion: 1 },
    memberId: '1',
  });
  expect(other.identity?.id).toBe(state.result?.identity_id);
  expect(other.identity?.signing_key).toBe(replacement.toPublic().toString());
  if (!other.member) throw new Error('CONTACT_FIXTURE');
  const retiredEnrollment = makeInstruction(
    other.target.dao,
    '1',
    other.member.nonce,
    f.now() + 120,
    'daclifycore',
    'setcontacts',
    Serializer.encode({
      abi,
      type: 'setcontacts',
      object: {
        runtime: 'daclifycore',
        dao_id: '2',
        member_id: '1',
        contacts: contacts.map((key, index) => ({
          signing_key: key.toPublic().toString(),
          encryption_key: encryption(index + 1),
        })),
        documents: false,
      },
    }).array,
  );
  await expect(
    call('submit', {
      request: retiredEnrollment,
      sig: old.signDigest(instructionDigest(retiredEnrollment)).toString(),
    }),
  ).rejects.toThrow('RECOVERY_KEY_RETIRED');
  expect((await gateway.contactRecovery(other.target)).policy).toBeNull();
  expect(
    (await gateway.accountRecoveryIdentity(replacement.toPublic().toString()))?.identity.origin_key,
  ).toBe(old.toPublic().toString());
  expect(await gateway.accountKeyRetired(old.toPublic().toString())).toBe(true);
  expect(await gateway.accountKeyRetired(replacement.toPublic().toString())).toBe(false);
  expect(
    (await gateway.accountRecoveryIdentity(old.toPublic().toString()))?.identity.signing_key,
  ).toBe(replacement.toPublic().toString());
  const quickRow = QuickAuthTableSchemas.qaccounts.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'quickauth',
        scope: 'daclifycore',
        table: 'qaccounts',
        limit: 1,
      })
    ).rows[0],
  );
  expect(quickRow.identity).toBe(quickAccountIdentity(f.chainId, 'daclifycore', quickAnchor));
  const control = {
    ...registration,
    account_id: quickRow.id,
    epoch: quickRow.epoch,
    nonce: quickRow.nonce,
    expires: f.now() + 300,
    use_default: false,
  };
  const defaultRequest = {
    control,
    method: encodeQuickAnchor({ kind: 'native', account: 'bob', permission: 'active' }),
  };
  const defaultProof = (signer: PrivateKey) =>
    Serializer.encode({ object: signer.signDigest(quickAccountDigest('qdefault', defaultRequest)) })
      .hexString;
  await expect(
    quick('qdefault', { request: defaultRequest, proof: defaultProof(old), incoming: '' }, [
      'relay',
      'bob',
    ]),
  ).rejects.toThrow();
  await quick(
    'qdefault',
    { request: defaultRequest, proof: defaultProof(replacement), incoming: '' },
    ['relay', 'bob'],
  );
  const deactivate = {
    ...control,
    epoch: String(BigInt(control.epoch) + 1n),
    nonce: String(BigInt(control.nonce) + 1n),
  };
  await quick('qdeactivate', {
    request: deactivate,
    proof: Serializer.encode({
      object: replacement.signDigest(quickAccountDigest('qdeactivate', deactivate)),
    }).hexString,
  });
  const retiredQuick = QuickAuthTableSchemas.qaccounts.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'quickauth',
        scope: 'daclifycore',
        table: 'qaccounts',
        limit: 1,
      })
    ).rows[0],
  );
  expect(retiredQuick).toMatchObject({
    identity: quickRow.identity,
    active: false,
    nonce: String(BigInt(quickRow.nonce) + 2n),
  });
  const receiptRamBefore = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage);
  const create = {
    dao_id: '3',
    owner: 'alice',
    metadata: '{}',
    privacy: 0,
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
    reference: receiptReference,
    creator: replacement.toPublic().toString(),
    founder: {
      encryption_key: encryption(4),
      custody: 0,
      settings: governanceSettings(defaultDaoSetup('custom'), 'charlie'),
    },
  };
  await expect(
    call('createpaid', { ...create, creator: old.toPublic().toString() }, 'relay', 'alice'),
  ).rejects.toThrow('CREATION_OWNER');
  await call('createpaid', create, 'relay', 'alice');
  await expect(call('createpaid', { ...create, dao_id: '4' }, 'relay', 'alice')).rejects.toThrow(
    'CREATION_USED',
  );
  const createdFounder = RuntimeTableSchemas.members.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: '3',
        table: 'members',
        limit: 1,
      })
    ).rows[0],
  );
  expect(createdFounder).toMatchObject({
    id: '1',
    signing_key: replacement.toPublic().toString(),
    active: true,
    admin: true,
  });
  const paidReceipt = RuntimeTableSchemas.createords.parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: 'daclifycore',
        table: 'createords',
        limit: 1,
      })
    ).rows[0],
  );
  expect(paidReceipt).toMatchObject({
    creator: old.toPublic().toString(),
    paid: true,
    used: true,
    dao_id: '3',
  });
  metrics.receipt_creation_ram_bytes =
    Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage) - receiptRamBefore;
  const lastAck = await proof('ackrecpack', 2, '1', await contactPacketCommitment(packet));
  const ackSignature = contact(2).signDigest(contactRecoveryDigest(lastAck)).toString();
  await expect(
    gateway.submitContactRecovery({
      action: 'ackrecpack',
      data: {
        proof: { ...lastAck, runtime: 'different' },
        sig: ackSignature,
      },
    }),
  ).rejects.toMatchObject({ code: 'RECOVERY_CONTEXT' });
  await gateway.submitContactRecovery({
    action: 'ackrecpack',
    data: { proof: lastAck, sig: ackSignature },
  });
  expect((await gateway.contactRecovery(target)).packets[0]?.acknowledged).toBe(7);
  metrics.recovery_ram_bytes =
    Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage) -
    before -
    (metrics.receipt_creation_ram_bytes ?? 0);
  metrics.runtime_wasm_bytes = statSync('.artifacts/contracts/runtime.wasm').size;
  writeFileSync(
    '.artifacts/contact-recovery-native-metrics.json',
    JSON.stringify(metrics, null, 2) + '\n',
  );
}, 60000);
