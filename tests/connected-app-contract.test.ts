import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { TimePointSec } from '@greymass/eosio';
import { loadContract, row, send } from './helpers/vert.js';
import { listFirstParty } from './helpers/list-module.js';
import { wasmCodeHash } from './helpers/code-hash.js';

const root = PrivateKey.generate('K1');
const delegate = PrivateKey.generate('K1');
const chainId = 'ab'.repeat(32);
const artifact = '.artifacts/contracts/runtime';
let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;

function signed(action: string, fields: object, nonce: number, member = 1) {
  const abi = ABI.from(readFileSync(artifact + '.abi', 'utf8'));
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: 1,
    member_id: member,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action,
    data: Serializer.encode({
      abi,
      type: action,
      object: {
        runtime: 'daclifycore',
        dao_id: 1,
        member_id: member,
        ...fields,
      },
    }).hexString,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  return [request, root.signDigest(digest).toString()];
}
async function register(appId = 1, revision = 1, enabled = true, nonce = 0) {
  await send(
    runtime,
    'submit',
    signed(
      'setapp',
      {
        app_id: appId,
        target: 'activity',
        revision,
        config_hash: 'cd'.repeat(32),
        enabled,
      },
      nonce,
    ),
    'relay@active',
  );
}
async function grant(session = 1, appId = 1, nonce = 1, lifetime = 600) {
  await send(
    runtime,
    'submit',
    signed(
      'addappses',
      {
        app_id: appId,
        app_revision: 1,
        session_id: session,
        signing_key: delegate.toPublic().toString(),
        expires: chain.timestamp.toMilliseconds() / 1000 + lifetime,
      },
      nonce,
    ),
    'relay@active',
  );
}
function scopedRequest(appId: number, nonce: number) {
  const abi = ABI.from(readFileSync(artifact + '.abi', 'utf8'));
  const data = Buffer.concat([
    Buffer.from(Serializer.encode({ type: 'name', object: 'daclifycore' }).array),
    ...[1, 1, appId].map((value) =>
      Buffer.from(Serializer.encode({ type: 'uint64', object: value }).array),
    ),
  ]).toString('hex');
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: 1,
    member_id: 1,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'activity',
    action: 'recordact',
    data,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  return [request, 1, delegate.signDigest(digest).toString()];
}

beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'relay');
  runtime = loadContract(chain, 'daclifycore', artifact);
  loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  loadContract(chain, 'activity', '.artifacts/contracts/modrelay');
  const hash = wasmCodeHash('.artifacts/contracts/modrelay.wasm');
  await send(runtime, 'init', [chainId], 'daclifycore@active');
  await listFirstParty(runtime, 'activity', hash);
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'initgov',
    [
      1,
      {
        participant_mode: 1,
        decide: 'activity',
        guardian: 'alice',
        kind: 0,
        duration: 300,
        quorum: 5000,
        approval: 5001,
        governed_works: false,
        max_commitment: 0,
        daily_commitment: 0,
      },
    ],
    'alice@active',
  );
  await send(runtime, 'enroll', [1, 1, '', root.toPublic().toString(), 'key', 0], 'alice@active');
  await send(
    runtime,
    'setmodule',
    [1, 'activity', 1, ['recordact', 'askreview'], [], hash],
    'alice@active',
  );
});

describe('native connected-app registration and credential boundaries', () => {
  it('allows suspension after the activity module was disabled', async () => {
    await register();
    await send(
      runtime,
      'submit',
      signed(
        'modconfig',
        { account: 'activity', version: 1, actions: [], grants: [], code_hash: '00'.repeat(32) },
        1,
      ),
      'relay@active',
    );
    await register(1, 2, false, 2);
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({ enabled: false, revision: 2 });
  });
  it('invalidates future app encryption when a member rotates credentials', async () => {
    await register();
    await send(
      runtime,
      'submit',
      signed('rotatekey', { signing_key: PrivateKey.generate('K1').toPublic().toString() }, 1),
      'relay@active',
    );
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({ security_epoch: 2 });
  });
  it('permanently revokes existing app grants when a member is deactivated', async () => {
    await register();
    await grant();
    await send(
      runtime,
      'enroll',
      [1, 2, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
    await send(
      runtime,
      'submit',
      signed('setactive', { target: 2, active: false }, 2),
      'relay@active',
    );
    expect(row(runtime, 'actors', 1n, 2n)).toMatchObject({ credential_epoch: 2 });
  });
  it('reclaims another app’s expired session while renewing a grant', async () => {
    await register();
    await grant(1, 1, 1, 60);
    await register(2, 1, true, 2);
    chain.addTime(TimePointSec.from(61));
    await grant(2, 2, 3);
    expect(row(runtime, 'sessions', 1n, 1n)).toBeUndefined();
    expect(row(runtime, 'appscopes', 1n, 1n)).toBeUndefined();
  });
  it('records app consent separately from unchanged native session rows', async () => {
    await register();
    await grant();
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({
      id: 1,
      revision: 1,
      enabled: true,
      target: 'activity',
    });
    expect(row(runtime, 'appscopes', 1n, 1n)).toMatchObject({ id: 1, app_id: 1, revision: 1 });
    expect(row(runtime, 'sessions', 1n, 1n)).toMatchObject({
      member_id: 1,
      permissions: [
        { target: 'activity', action: 'recordact' },
        { target: 'activity', action: 'askreview' },
      ],
    });
  });
  it('rejects a valid delegated signature for a different app', async () => {
    await register();
    await grant();
    await expect(send(runtime, 'submitsess', scopedRequest(2, 2), 'relay@active')).rejects.toThrow(
      'APP_SCOPE',
    );
  });
  it('requires member consent rather than a direct service-authorised grant', async () => {
    await register();
    await expect(
      send(
        runtime,
        'addappses',
        [
          'daclifycore',
          1,
          1,
          1,
          1,
          1,
          delegate.toPublic().toString(),
          chain.timestamp.toMilliseconds() / 1000 + 600,
        ],
        'daclifycore@active',
      ),
    ).rejects.toThrow('ACTOR_SENDER');
  });
  it('renews one app grant atomically and revokes its previous session', async () => {
    await register();
    await grant();
    await grant(2, 1, 2);
    expect(row(runtime, 'appscopes', 1n, 1n)).toBeUndefined();
    expect(row(runtime, 'sessions', 1n, 1n)).toBeUndefined();
    expect(row(runtime, 'appscopes', 1n, 2n)).toMatchObject({ app_id: 1 });
    await expect(send(runtime, 'submitsess', scopedRequest(1, 3), 'relay@active')).rejects.toThrow(
      'SESSION_UNKNOWN',
    );
  });
  it('does not allow app credential expiry beyond seven days', async () => {
    await register();
    await expect(grant(1, 1, 1, 604801)).rejects.toThrow('SESSION_EXPIRY');
  });
  it('advances app encryption access when public DAO membership changes', async () => {
    await register();
    const second = PrivateKey.generate('K1');
    await send(
      runtime,
      'enroll',
      [1, 2, '', second.toPublic().toString(), 'key', 0],
      'alice@active',
    );
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({ security_epoch: 2 });
    await send(
      runtime,
      'submit',
      signed('setactive', { target: 2, active: false }, 1),
      'relay@active',
    );
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({ security_epoch: 3 });
  });
  it('invalidates future app encryption when a guardian revokes an agent member', async () => {
    await register();
    await send(
      runtime,
      'enrollagent',
      [1, 2, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0, 'Agent'],
      'alice@active',
    );
    await send(runtime, 'guardrevoke', [1, 2], 'alice@active');
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({ security_epoch: 3 });
  });
  it('invalidates old recording authority when app configuration changes', async () => {
    await register();
    await grant();
    await register(1, 2, true, 2);
    await expect(send(runtime, 'submitsess', scopedRequest(1, 3), 'relay@active')).rejects.toThrow(
      'APP_REVISED',
    );
  });
  it('rejects consent signed before an app configuration revision changed', async () => {
    await register();
    await register(1, 2, true, 1);
    await expect(
      send(
        runtime,
        'submit',
        signed(
          'addappses',
          {
            app_id: 1,
            app_revision: 1,
            session_id: 1,
            signing_key: delegate.toPublic().toString(),
            expires: chain.timestamp.toMilliseconds() / 1000 + 600,
          },
          2,
        ),
        'relay@active',
      ),
    ).rejects.toThrow('APP_REVISED');
  });
  it('rejects suspended app authority without deleting historical registration', async () => {
    await register();
    await grant();
    await register(1, 2, false, 2);
    await expect(send(runtime, 'submitsess', scopedRequest(1, 3), 'relay@active')).rejects.toThrow(
      'APP_DISABLED',
    );
    expect(row(runtime, 'appregs', 1n, 1n)).toMatchObject({ enabled: false });
  });
  it('keeps generic native sessions from receiving activity scope', async () => {
    await register();
    await expect(
      send(
        runtime,
        'submit',
        signed(
          'addsession',
          {
            session_id: 1,
            signing_key: delegate.toPublic().toString(),
            expires: chain.timestamp.toMilliseconds() / 1000 + 600,
            permissions: [
              {
                target: 'activity',
                action: 'recordact',
                code_hash: wasmCodeHash('.artifacts/contracts/modrelay.wasm'),
              },
            ],
          },
          1,
        ),
        'relay@active',
      ),
    ).rejects.toThrow('SESSION_SCOPE');
  });
  it('reclaims expired app scope and session together while retaining active authority', async () => {
    await register();
    await grant(1, 1, 1, 60);
    await register(2, 1, true, 2);
    const fresh = PrivateKey.generate('K1');
    await send(
      runtime,
      'submit',
      signed(
        'addappses',
        {
          app_id: 2,
          app_revision: 1,
          session_id: 2,
          signing_key: fresh.toPublic().toString(),
          expires: chain.timestamp.toMilliseconds() / 1000 + 600,
        },
        3,
      ),
      'relay@active',
    );
    chain.addTime(TimePointSec.from(61));
    await send(runtime, 'pruneappses', [1, 0, 25], 'relay@active');
    expect(row(runtime, 'sessions', 1n, 1n)).toBeUndefined();
    expect(row(runtime, 'appscopes', 1n, 1n)).toBeUndefined();
    expect(row(runtime, 'sessions', 1n, 2n)).toMatchObject({ member_id: 1 });
    await expect(send(runtime, 'pruneappses', [1, 0, 26], 'relay@active')).rejects.toThrow(
      'APP_CLEANUP_BOUND',
    );
  });
});
