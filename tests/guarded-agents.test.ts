import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { TimePointSec } from '@greymass/eosio';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import { wasmCodeHash } from './helpers/code-hash.js';
const artifact = '.artifacts/contracts/runtime';
const key = PrivateKey.generate('K1'),
  sessionKey = PrivateKey.generate('K1');
let chain: Blockchain,
  runtime: ReturnType<typeof loadContract>,
  module: ReturnType<typeof loadContract>;
const settings = {
  participant_mode: 2,
  decide: 'decide',
  guardian: 'guardian',
  kind: 0,
  duration: 300,
  quorum: 5000,
  approval: 5001,
  governed_works: true,
  max_commitment: 10000,
  daily_commitment: 20000,
};
function signed(action: string, fields: object, signer = key, nonce = 0, daoId = 1) {
  const abi = ABI.from(readFileSync(artifact + '.abi', 'utf8'));
  const data = Serializer.encode({
    abi,
    type: action,
    object: { runtime: 'daclifycore', dao_id: daoId, member_id: 1, ...fields },
  }).hexString;
  const request = {
    version: 1,
    chain_id: 'ab'.repeat(32),
    deployment: 'daclifycore',
    dao_id: daoId,
    member_id: 1,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action,
    data,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  return [request, signer.signDigest(digest).toString()];
}
function delegated(action: string, fields: object, nonce = 0, daoId = 1) {
  const [request, signature] = signed(action, fields, sessionKey, nonce, daoId);
  return [request, 1, signature];
}
async function credential() {
  await send(
    runtime,
    'submit',
    signed('addsession', {
      session_id: 1,
      signing_key: sessionKey.toPublic().toString(),
      expires: chain.timestamp.toMilliseconds() / 1000 + 600,
      permissions: [{ target: 'daclifycore', action: 'putjson', code_hash: '00'.repeat(32) }],
    }),
    'relay@active',
  );
}
const json = {
  document_id: 1,
  version: 1,
  value: '{"decision":"test"}',
  envelope_version: 0,
  key_epoch: 0,
};
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'guardian', 'stranger', 'relay', 'decide');
  runtime = loadContract(chain, 'daclifycore', artifact);
  module = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  const token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  for (const id of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [id, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(runtime, 'initgov', [id, settings], 'alice@active');
    await send(
      runtime,
      'enrollagent',
      [id, 1, '', key.toPublic().toString(), 'key', 0, 'Declared operator'],
      'alice@active',
    );
    await send(
      runtime,
      'setmodule',
      [
        id,
        'works',
        1,
        ['propose'],
        ['reserve', 'approve', 'cancel'],
        wasmCodeHash('.artifacts/contracts/modrelay.wasm'),
      ],
      'alice@active',
    );
  }
  await send(token, 'create', ['eosio.token', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '100.0000 TLOS', ''], 'eosio.token@active');
  for (const id of [1, 2])
    await send(
      token,
      'transfer',
      ['alice', 'daclifycore', '20.0000 TLOS', 'dao:' + id],
      'alice@active',
    );
});
describe('guarded agent authority', () => {
  it('does not give a guardian voting membership', () => {
    expect(
      z.object({ member_count: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n))
        .member_count,
    ).toBe(1);
    expect(
      z.object({ native_account: z.string() }).parse(row(runtime, 'members', 1n, 1n))
        .native_account,
    ).toBe('');
  });
  it('rejects human enrolment in an agent-only DAO', async () => {
    await expect(
      send(
        runtime,
        'enroll',
        [1, 2, '', sessionKey.toPublic().toString(), 'key', 0],
        'alice@active',
      ),
    ).rejects.toThrow('PARTICIPANT_MODE');
  });
  it('preserves preset provenance when a descriptive rename is signed', async () => {
    const metadata = {
      schemaVersion: 2,
      title: 'Before',
      purpose: 'community',
      setup: { presetId: 'community', presetVersion: 1 },
    };
    await send(
      runtime,
      'submit',
      signed('setmeta', { metadata: JSON.stringify(metadata) }),
      'relay@active',
    );
    await expect(
      send(
        runtime,
        'submit',
        signed('setmeta', { metadata: '{"schemaVersion":1,"title":"Erased preset"}' }, key, 1),
        'relay@active',
      ),
    ).rejects.toThrow('PRESET_IDENTITY_IMMUTABLE');
    await send(
      runtime,
      'submit',
      signed('setmeta', { metadata: JSON.stringify({ ...metadata, title: 'After' }) }, key, 1),
      'relay@active',
    );
  });
  it('lets an agent administrator admit another declared agent without the bootstrap key', async () => {
    await send(
      runtime,
      'submit',
      signed('addmember', {
        signing_key: sessionKey.toPublic().toString(),
        encryption_key: 'key',
        custody: 0,
        kind: 1,
        operator_label: 'Second declared operator',
      }),
      'relay@active',
    );
    expect(
      z.object({ member_count: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n))
        .member_count,
    ).toBe(2);
    expect(z.object({ kind: z.number() }).parse(row(runtime, 'actors', 1n, 2n)).kind).toBe(1);
  });
  it('accepts a scoped key for its declared action but refuses administration and re-delegation', async () => {
    await credential();
    await send(runtime, 'submitsess', delegated('putjson', json, 1), 'relay@active');
    await expect(
      send(
        runtime,
        'submitsess',
        delegated('setcredits', { target: 1, quantity: 10 }, 2),
        'relay@active',
      ),
    ).rejects.toThrow('SESSION_SCOPE');
    await expect(
      send(runtime, 'submitsess', delegated('delsession', { session_id: 1 }, 2), 'relay@active'),
    ).rejects.toThrow('SESSION_SCOPE');
    expect(z.object({ nonce: z.number() }).parse(row(runtime, 'members', 1n, 1n)).nonce).toBe(2);
  });
  it('revokes a scoped key without changing membership', async () => {
    await credential();
    await send(runtime, 'submit', signed('delsession', { session_id: 1 }, key, 1), 'relay@active');
    await expect(
      send(runtime, 'submitsess', delegated('putjson', json, 2), 'relay@active'),
    ).rejects.toThrow('SESSION_UNKNOWN');
  });
  it('does not let a delegated key become another member or a recovered root', async () => {
    await credential();
    await expect(
      send(
        runtime,
        'submit',
        signed(
          'addmember',
          {
            signing_key: sessionKey.toPublic().toString(),
            encryption_key: 'key',
            custody: 0,
            kind: 1,
            operator_label: 'Collision fixture',
          },
          key,
          1,
        ),
        'relay@active',
      ),
    ).rejects.toThrow('CREDENTIAL_EXISTS');
    await send(runtime, 'guardrevoke', [1, 1], 'guardian@active');
    await expect(
      send(runtime, 'guardrecover', [1, 1, sessionKey.toPublic().toString()], 'guardian@active'),
    ).rejects.toThrow('CREDENTIAL_EXISTS');
  });
  it('clears native authentication when an agent signing identity is recovered', async () => {
    await send(
      runtime,
      'createdao',
      [3, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(runtime, 'initgov', [3, settings], 'alice@active');
    await send(
      runtime,
      'enrollagent',
      [3, 1, 'alice', key.toPublic().toString(), 'key', 0, 'Native fixture'],
      'alice@active',
    );
    await send(runtime, 'guardrevoke', [3, 1], 'guardian@active');
    const recovered = PrivateKey.generate('K1');
    await send(runtime, 'guardrecover', [3, 1, recovered.toPublic().toString()], 'guardian@active');
    expect(
      z.object({ native_account: z.string() }).parse(row(runtime, 'members', 3n, 1n))
        .native_account,
    ).toBe('');
    const [request] = signed('putjson', json, recovered, 0, 3);
    await expect(send(runtime, 'submitnat', [request], 'alice@active')).rejects.toThrow(
      'NATIVE_UNLINKED',
    );
  });
  it('rejects expired credentials and cross-DAO reuse', async () => {
    await credential();
    await expect(
      send(runtime, 'submitsess', delegated('putjson', json, 0, 2), 'relay@active'),
    ).rejects.toThrow('SESSION_UNKNOWN');
    chain.addTime(TimePointSec.from(601));
    await expect(
      send(runtime, 'submitsess', delegated('putjson', json, 1), 'relay@active'),
    ).rejects.toThrow('SESSION_EXPIRED');
  });
  it('requires guardian auth and keeps a pause inside its 24-hour bound', async () => {
    const now = chain.timestamp.toMilliseconds() / 1000;
    await expect(
      send(runtime, 'guardpause', [1, now + 600, 'ab'.repeat(32)], 'stranger@active'),
    ).rejects.toThrow();
    await expect(
      send(runtime, 'guardpause', [1, now + 86401, 'ab'.repeat(32)], 'guardian@active'),
    ).rejects.toThrow('PAUSE_DURATION');
    await send(runtime, 'guardpause', [1, now + 600, 'ab'.repeat(32)], 'guardian@active');
    await expect(send(runtime, 'submit', signed('putjson', json), 'relay@active')).rejects.toThrow(
      'DAO_PAUSED',
    );
    await expect(
      send(module, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('DAO_PAUSED');
    await send(module, 'reserve', ['daclifycore', 2, 1, 1, '1.0000 TLOS', 0], 'works@active');
    chain.addTime(TimePointSec.from(601));
    await send(runtime, 'submit', signed('putjson', json), 'relay@active');
  });
  it('preserves approved liabilities while a pause temporarily stops payout', async () => {
    await send(module, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'works@active');
    await send(module, 'approveob', ['daclifycore', 1, 1], 'works@active');
    await send(
      runtime,
      'guardpause',
      [1, chain.timestamp.toMilliseconds() / 1000 + 600, 'ab'.repeat(32)],
      'guardian@active',
    );
    await expect(send(runtime, 'payob', [1, 'works', 1], 'stranger@active')).rejects.toThrow(
      'DAO_PAUSED',
    );
    expect(z.object({ status: z.number() }).parse(row(runtime, 'obligations', 1n, 1n)).status).toBe(
      1,
    );
    chain.addTime(TimePointSec.from(601));
    await send(runtime, 'payob', [1, 'works', 1], 'stranger@active');
    expect(z.object({ claim: z.number() }).parse(row(runtime, 'members', 1n, 1n)).claim).toBe(
      10000,
    );
  });
  it('enforces per-obligation and daily commitment limits atomically', async () => {
    await expect(
      send(module, 'reserve', ['daclifycore', 1, 1, 1, '1.0001 TLOS', 0], 'works@active'),
    ).rejects.toThrow('COMMITMENT_LIMIT');
    for (const id of [1, 2])
      await send(module, 'reserve', ['daclifycore', 1, id, 1, '1.0000 TLOS', 0], 'works@active');
    await expect(
      send(module, 'reserve', ['daclifycore', 1, 3, 1, '0.0001 TLOS', 0], 'works@active'),
    ).rejects.toThrow('DAILY_LIMIT');
    expect(row(runtime, 'obligations', 1n, 3n)).toBeUndefined();
  });
  it('does not refund a daily allowance through cancellation', async () => {
    for (const id of [1, 2])
      await send(module, 'reserve', ['daclifycore', 1, id, 1, '1.0000 TLOS', 0], 'works@active');
    await send(module, 'cancelob', ['daclifycore', 1, 1], 'works@active');
    await expect(
      send(module, 'reserve', ['daclifycore', 1, 3, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('DAILY_LIMIT');
  });
  it('guardian recovery revokes previous root and session keys without minting votes or decrypting content', async () => {
    await credential();
    await send(runtime, 'guardrevoke', [1, 1], 'guardian@active');
    await expect(
      send(runtime, 'submit', signed('putjson', json, key, 1), 'relay@active'),
    ).rejects.toThrow('AGENT_REVOKED');
    const recovered = PrivateKey.generate('K1');
    await send(runtime, 'guardrecover', [1, 1, recovered.toPublic().toString()], 'guardian@active');
    await expect(
      send(runtime, 'submitsess', delegated('putjson', json, 1), 'relay@active'),
    ).rejects.toThrow('SESSION_REVOKED');
    await expect(
      send(runtime, 'submit', signed('putjson', json, key, 1), 'relay@active'),
    ).rejects.toThrow();
    await send(runtime, 'submit', signed('putjson', json, recovered, 1), 'relay@active');
    expect(
      z.object({ encryption_key: z.string() }).parse(row(runtime, 'members', 1n, 1n))
        .encryption_key,
    ).toBe('key');
    expect(
      z.object({ member_count: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n))
        .member_count,
    ).toBe(1);
  });
});
