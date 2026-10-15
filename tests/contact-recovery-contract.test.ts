import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { TimePoint } from '@greymass/eosio';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';

const chainId = 'ab'.repeat(32),
  root = PrivateKey.generate('K1'),
  replacement = PrivateKey.generate('K1');
const contacts = [0, 1, 2].map(() => PrivateKey.generate('K1'));
const encryption = (index: number) =>
  JSON.stringify({
    kty: 'EC',
    crv: 'P-256',
    x: String(index).repeat(42) + 'A',
    y: 'B'.repeat(42) + 'A',
  });
let daoId = '1';
let chain: Blockchain, runtime: ReturnType<typeof loadContract>, abi: ABI;
const encode = (type: string, object: object) => Serializer.encode({ abi, type, object });
const digest = (type: string, object: object) => Checksum256.hash(encode(type, object));
const now = () => Math.floor(chain.timestamp.toMilliseconds() / 1000);
async function memberAction(name: string, data: object, signer = root) {
  const member = z
    .object({ nonce: z.union([z.number(), z.string()]) })
    .parse(row(runtime, 'members', BigInt(daoId), 1n));
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: daoId,
    member_id: '1',
    nonce: String(member.nonce),
    expires: now() + 300,
    target: 'daclifycore',
    action: name,
    data: encode(name, { runtime: 'daclifycore', dao_id: daoId, member_id: '1', ...data })
      .hexString,
  };
  await send(
    runtime,
    'submit',
    { request, sig: signer.signDigest(digest('instruction', request)).toString() },
    'relay@active',
  );
}
function proof(action: string, index: number, requestId = '0', dataHash = '00'.repeat(32)) {
  return {
    action,
    chain_id: chainId,
    runtime: 'daclifycore',
    dao_id: daoId,
    member_id: '1',
    revision: '1',
    request_id: requestId,
    contact: index,
    data_hash: dataHash,
    expires: now() + 300,
  };
}
async function accepted(documents = false) {
  await memberAction('setcontacts', {
    contacts: contacts.map((key, index) => ({
      signing_key: key.toPublic().toString(),
      encryption_key: encryption(index + 1),
    })),
    documents,
  });
  for (const [index, key] of contacts.entries()) {
    const p = proof('acceptcont', index);
    await send(
      runtime,
      'acceptcont',
      { proof: p, sig: key.signDigest(digest('contact_proof', p)).toString() },
      'relay@active',
    );
  }
}
function request(signer = replacement, requestId = '1') {
  return {
    action: 'startrecover',
    chain_id: chainId,
    runtime: 'daclifycore',
    dao_id: daoId,
    member_id: '1',
    revision: '1',
    request_id: requestId,
    signing_key: signer.toPublic().toString(),
    encryption_key: encryption(4),
    native_account: '',
    expires: now() + 604800,
  };
}
async function start(signer = replacement, requestId = '1') {
  const r = request(signer, requestId),
    key = contacts[0];
  if (!key) throw new Error('CONTACT_FIXTURE');
  const hash = digest('contact_request', r),
    p = proof('startrecover', 0, requestId, hash.toString());
  await send(
    runtime,
    'startrecover',
    {
      request: r,
      new_sig: signer.signDigest(hash).toString(),
      proof: p,
      sig: key.signDigest(digest('contact_proof', p)).toString(),
    },
    'relay@active',
  );
  return r;
}
async function approve(r: ReturnType<typeof request>, index: number) {
  const key = contacts[index];
  if (!key) throw new Error('CONTACT_FIXTURE');
  const p = proof('approverec', index, r.request_id, digest('contact_request', r).toString());
  await send(
    runtime,
    'approverec',
    { proof: p, sig: key.signDigest(digest('contact_proof', p)).toString() },
    'relay@active',
  );
}
beforeEach(async () => {
  daoId = '1';
  chain = new Blockchain();
  chain.createAccounts('alice', 'relay', 'eosio.token');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  await send(runtime, 'init', [chainId], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 1, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, '', root.toPublic().toString(), encryption(0), 0],
    'alice@active',
  );
});
describe('contact recovery authority', () => {
  it('requires the original signing key when a DAO supplies a wallet binding', async () => {
    await send(
      runtime,
      'createdao',
      [2, 'alice', '{}', 1, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [2, 1, 'alice', root.toPublic().toString(), encryption(0), 0],
      'alice@active',
    );
    const request = {
      version: 1,
      chain_id: chainId,
      deployment: 'daclifycore',
      dao_id: '2',
      member_id: '1',
      nonce: '0',
      expires: now() + 300,
      target: 'daclifycore',
      action: 'setcontacts',
      data: encode('setcontacts', {
        runtime: 'daclifycore',
        dao_id: '2',
        member_id: '1',
        contacts: contacts.map((key, index) => ({
          signing_key: key.toPublic().toString(),
          encryption_key: encryption(index + 1),
        })),
        documents: false,
      }).hexString,
    };
    await expect(send(runtime, 'submitnat', { request }, 'alice@active')).rejects.toThrow(
      'RECOVERY_ROOT_PROOF_REQUIRED',
    );
    await expect(
      send(
        runtime,
        'submitevm',
        { request, evm_chain_id: '41', address: '11'.repeat(20), binding_epoch: '1', proof: '' },
        'alice@active',
      ),
    ).rejects.toThrow('RECOVERY_ROOT_PROOF_REQUIRED');
    expect(runtime.tables.reccontacts?.(2n).getTableRows()).toHaveLength(0);
  });
  it('rejects alternate encodings of the same encryption coordinate', async () => {
    await expect(
      memberAction('setcontacts', {
        contacts: contacts.map((key, index) => ({
          signing_key: key.toPublic().toString(),
          encryption_key:
            index === 1
              ? JSON.stringify({
                  kty: 'EC',
                  crv: 'P-256',
                  x: '1'.repeat(42) + 'B',
                  y: 'B'.repeat(42) + 'A',
                })
              : encryption(index + 1),
        })),
        documents: false,
      }),
    ).rejects.toThrow('RECOVERY_ENCRYPTION_KEY');
  });
  it('recovers another DAO after losing the replacement device while retaining one identity', async () => {
    const second = PrivateKey.generate('K1');
    await send(
      runtime,
      'createdao',
      [2, 'alice', '{}', 1, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [2, 1, '', root.toPublic().toString(), encryption(0), 0],
      'alice@active',
    );
    await accepted();
    daoId = '2';
    await accepted();
    daoId = '1';
    const first = await start();
    await approve(first, 1);
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await send(runtime, 'finishrec', [1, 1, 1], 'relay@active');
    daoId = '2';
    await expect(
      memberAction('setcontacts', {
        contacts: contacts.map((key, index) => ({
          signing_key: key.toPublic().toString(),
          encryption_key: encryption(index + 1),
        })),
        documents: false,
      }),
    ).rejects.toThrow('RECOVERY_KEY_RETIRED');
    const next = await start(second);
    await approve(next, 1);
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await send(runtime, 'finishrec', [2, 1, 1], 'relay@active');
    expect(row(runtime, 'recresults', 1n, 1n)).toMatchObject({ identity_id: 1 });
    expect(row(runtime, 'recresults', 2n, 1n)).toMatchObject({ identity_id: 1 });
    expect(runtime.tables.recroots?.(runtime.toBigInt()).getTableRows()).toMatchObject([
      { id: 1, signing_key: second.toPublic().toString() },
    ]);
    expect(runtime.tables.recretired?.(runtime.toBigInt()).getTableRows()).toHaveLength(2);
    daoId = '1';
    const final = await start(second, '2');
    await approve(final, 1);
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await send(runtime, 'finishrec', [1, 1, 2], 'relay@active');
    await memberAction('setmeta', { metadata: '{}' }, second);
    expect(runtime.tables.recroots?.(runtime.toBigInt()).getTableRows()).toHaveLength(1);
  });
  it('retains original grants and never turns future reentry into historical recovery permission', async () => {
    await memberAction('commitepoch', {
      epoch: '1',
      commitment: '11'.repeat(32),
      self_grant: '{}',
    });
    const original = runtime.tables.keygrants?.(1n).getTableRows();
    await accepted();
    const r = await start();
    await approve(r, 1);
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await send(runtime, 'finishrec', [1, 1, 1], 'relay@active');
    await memberAction('rotateepoch', {}, replacement);
    await memberAction('ackrecgrant', { recipient: '1' }, replacement);
    await memberAction('setrecpolicy', { allowed: true }, replacement);
    expect(row(runtime, 'recresults', 1n, 1n)).toMatchObject({
      documents_approved: false,
      future_grants: true,
    });
    await expect(
      memberAction('recovergrant', { request_id: '1', epoch: '1', envelope: '{}' }, replacement),
    ).rejects.toThrow('RECOVERY_DOCUMENT_POLICY');
    expect(runtime.tables.keygrants?.(1n).getTableRows()).toEqual(original);
  });
  it('rewraps only previously granted epochs and preserves the original ciphertext', async () => {
    await memberAction('setrecpolicy', { allowed: true });
    await memberAction('commitepoch', {
      epoch: '1',
      commitment: '11'.repeat(32),
      self_grant: '{}',
    });
    const original = runtime.tables.keygrants?.(1n).getTableRows();
    await accepted(true);
    const r = await start();
    await approve(r, 1);
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await send(runtime, 'finishrec', [1, 1, 1], 'relay@active');
    await memberAction(
      'recovergrant',
      { request_id: '1', epoch: '1', envelope: '{}' },
      replacement,
    );
    await memberAction(
      'recovergrant',
      { request_id: '1', epoch: '1', envelope: '{}' },
      replacement,
    );
    expect(runtime.tables.recgrants?.(1n).getTableRows()).toHaveLength(1);
    expect(runtime.tables.keygrants?.(1n).getTableRows()).toEqual(original);
    await expect(
      memberAction('recovergrant', { request_id: '1', epoch: '2', envelope: '{}' }, replacement),
    ).rejects.toThrow('RECOVERY_EPOCH_NOT_GRANTED');
    await expect(
      memberAction(
        'recovergrant',
        { request_id: '1', epoch: '1', envelope: '{"different":true}' },
        replacement,
      ),
    ).rejects.toThrow('RECOVERY_GRANT_EXISTS');
  });
  it('rejects another DAO proof, expires pending records and keeps the monotonic sequence', async () => {
    await accepted();
    const r = await start();
    const key = contacts[1];
    if (!key) throw new Error('CONTACT_FIXTURE');
    const p = {
      ...proof('approverec', 1, '1', digest('contact_request', r).toString()),
      chain_id: 'cd'.repeat(32),
    };
    await expect(
      send(
        runtime,
        'approverec',
        { proof: p, sig: key.signDigest(digest('contact_proof', p)).toString() },
        'relay@active',
      ),
    ).rejects.toThrow('RECOVERY_DOMAIN');
    chain.addTime(TimePoint.fromMilliseconds(604800000));
    await expect(approve(r, 1)).rejects.toThrow('RECOVERY_EXPIRY');
    await send(runtime, 'prunerec', [1, 1], 'relay@active');
    expect(runtime.tables.recrequests?.(1n).getTableRows()).toHaveLength(0);
    expect(row(runtime, 'reccontacts', 1n, 1n)).toMatchObject({ next_request: 1 });
    await expect(start()).rejects.toThrow('RECOVERY_SEQUENCE');
  });
  it('blocks document rewrapping when the DAO forbids contact recovery', async () => {
    await memberAction('commitepoch', {
      epoch: '1',
      commitment: '11'.repeat(32),
      self_grant: '{}',
    });
    await accepted();
    const r = await start();
    await approve(r, 1);
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await send(runtime, 'finishrec', [1, 1, 1], 'relay@active');
    await expect(
      memberAction('recovergrant', { request_id: '1', epoch: '1', envelope: '{}' }, replacement),
    ).rejects.toThrow('RECOVERY_DOCUMENT_POLICY');
  });
  it('requires two distinct approvals and 48 hours after the second without changing membership rights', async () => {
    await accepted();
    const r = await start();
    await expect(send(runtime, 'finishrec', [1, 1, 1], 'relay@active')).rejects.toThrow(
      'RECOVERY_PENDING',
    );
    chain.addTime(TimePoint.fromMilliseconds(60000));
    await approve(r, 1);
    await expect(approve(r, 1)).rejects.toThrow('RECOVERY_DUPLICATE_APPROVAL');
    await expect(send(runtime, 'finishrec', [1, 1, 1], 'relay@active')).rejects.toThrow(
      'RECOVERY_WAIT',
    );
    chain.addTime(TimePoint.fromMilliseconds(172799000));
    await expect(send(runtime, 'finishrec', [1, 1, 1], 'relay@active')).rejects.toThrow(
      'RECOVERY_WAIT',
    );
    chain.addTime(TimePoint.fromMilliseconds(1000));
    await send(runtime, 'finishrec', [1, 1, 1], 'relay@active');
    expect(row(runtime, 'members', 1n, 1n)).toMatchObject({
      signing_key: replacement.toPublic().toString(),
      active: true,
      admin: true,
    });
    await expect(memberAction('setmeta', { metadata: '{}' })).rejects.toThrow();
    await memberAction('setmeta', { metadata: '{}' }, replacement);
    await expect(send(runtime, 'finishrec', [1, 1, 1], 'relay@active')).rejects.toThrow();
  });
  it('lets surviving current control cancel and prevents old request reuse', async () => {
    await accepted();
    const r = await start();
    await approve(r, 1);
    await memberAction('cancelrec', {});
    chain.addTime(TimePoint.fromMilliseconds(172800000));
    await expect(send(runtime, 'finishrec', [1, 1, 1], 'relay@active')).rejects.toThrow();
    await expect(start()).rejects.toThrow('RECOVERY_SEQUENCE');
  });
  it('rejects duplicate contacts and forged first-contact approval', async () => {
    const key = contacts[0];
    if (!key) throw new Error('CONTACT_FIXTURE');
    await expect(
      memberAction('setcontacts', {
        contacts: [0, 1, 2].map((i) => ({
          signing_key: key.toPublic().toString(),
          encryption_key: encryption(i),
        })),
        documents: false,
      }),
    ).rejects.toThrow('RECOVERY_CONTACT_DUPLICATE');
    await accepted();
    const r = request(),
      hash = digest('contact_request', r),
      p = proof('startrecover', 0, '1', hash.toString());
    await expect(
      send(
        runtime,
        'startrecover',
        {
          request: r,
          new_sig: replacement.signDigest(hash).toString(),
          proof: p,
          sig: replacement.signDigest(digest('contact_proof', p)).toString(),
        },
        'relay@active',
      ),
    ).rejects.toThrow();
  });
});
