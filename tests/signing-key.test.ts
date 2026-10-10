import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import { RuntimeTableSchemas } from '../sdk/index.js';

const artifact = '.artifacts/contracts/runtime';
const chainId = 'ab'.repeat(32);
const key = PrivateKey.generate('K1');
const nextKey = PrivateKey.generate('K1');
const otherKey = PrivateKey.generate('K1');
let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
const memberSchema = z.object({
  id: z.union([z.string(), z.number()]),
  signing_key: z.string(),
  native_account: z.string(),
  credits: z.union([z.string(), z.number()]),
  nonce: z.union([z.string(), z.number()]),
});
const daoSchema = z.object({
  member_count: z.number(),
  credit_supply: z.number(),
  eligible_credits: z.number(),
});

beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, 'daclifycore', artifact);
  await send(runtime, 'init', [chainId], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, '', key.toPublic().toString(), 'encryption-key', 0],
    'alice@active',
  );
  await send(runtime, 'grantcredit', [1, 1, 10], 'alice@active');
});

function signed(action: string, object: object, signer: PrivateKey, nonce: number) {
  const abi = ABI.from(readFileSync(`${artifact}.abi`, 'utf8'));
  const data = Serializer.encode({ abi, type: action, object }).hexString;
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: 1,
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

describe('signing-key rotation without a second member', () => {
  it('allocates the credential epoch at enrollment so first recovery does not grow that row', async () => {
    const before = RuntimeTableSchemas.actors.parse(row(runtime, 'actors', 1n, 1n));
    expect(before).toMatchObject({ kind: 0, operator_label: '', credential_epoch: '1' });
    const abi = ABI.from(readFileSync(`${artifact}.abi`, 'utf8'));
    await send(
      runtime,
      'submit',
      signed(
        'rotatekey',
        {
          runtime: 'daclifycore',
          dao_id: 1,
          member_id: 1,
          signing_key: nextKey.toPublic().toString(),
        },
        key,
        0,
      ),
      'relay@active',
    );
    const after = RuntimeTableSchemas.actors.parse(row(runtime, 'actors', 1n, 1n));
    expect(after.credential_epoch).toBe('2');
    expect(Serializer.encode({ abi, type: 'participant_record', object: after }).array.length).toBe(
      Serializer.encode({ abi, type: 'participant_record', object: before }).array.length,
    );
    expect(daoSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).member_count).toBe(1);
  });
  it('links a native wallet without a second member or a second vote', async () => {
    await send(
      runtime,
      'submit',
      signed(
        'linknative',
        { runtime: 'daclifycore', dao_id: 1, member_id: 1, account: 'bob' },
        key,
        0,
      ),
      'bob@active',
    );
    expect(memberSchema.parse(row(runtime, 'members', 1n, 1n))).toMatchObject({
      id: 1,
      native_account: 'bob',
      credits: 10,
    });
    expect(row(runtime, 'members', 1n, 2n)).toBeUndefined();
    expect(daoSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n))).toMatchObject({
      member_count: 1,
      credit_supply: 10,
      eligible_credits: 10,
    });
  });

  it('rejects a relayer that rotates a signing key without the current credential', async () => {
    await expect(
      send(
        runtime,
        'rotatekey',
        ['daclifycore', 1, 1, nextKey.toPublic().toString()],
        'daclifycore@active',
      ),
    ).rejects.toThrow('ACTOR_SENDER');
    expect(memberSchema.parse(row(runtime, 'members', 1n, 1n)).signing_key).toBe(
      key.toPublic().toString(),
    );
  });

  it('replaces the signing key and rejects the previous signature', async () => {
    await send(
      runtime,
      'submit',
      signed(
        'rotatekey',
        {
          runtime: 'daclifycore',
          dao_id: 1,
          member_id: 1,
          signing_key: nextKey.toPublic().toString(),
        },
        key,
        0,
      ),
      'relay@active',
    );
    expect(memberSchema.parse(row(runtime, 'members', 1n, 1n))).toMatchObject({
      id: 1,
      signing_key: nextKey.toPublic().toString(),
      native_account: '',
      credits: 10,
      nonce: 1,
    });
    expect(daoSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).member_count).toBe(1);
    await expect(
      send(
        runtime,
        'submit',
        signed(
          'setmeta',
          { runtime: 'daclifycore', dao_id: 1, member_id: 1, metadata: '{"title":"old"}' },
          key,
          1,
        ),
        'relay@active',
      ),
    ).rejects.toThrow();
    expect(String(memberSchema.parse(row(runtime, 'members', 1n, 1n)).nonce)).toBe('1');
    await send(
      runtime,
      'submit',
      signed(
        'setmeta',
        { runtime: 'daclifycore', dao_id: 1, member_id: 1, metadata: '{"title":"new"}' },
        nextKey,
        1,
      ),
      'relay@active',
    );
    expect(String(memberSchema.parse(row(runtime, 'members', 1n, 1n)).nonce)).toBe('2');
  });

  it('rejects reuse of another member key and a no-op rotation', async () => {
    await send(
      runtime,
      'enroll',
      [1, 2, '', otherKey.toPublic().toString(), 'encryption-key', 0],
      'alice@active',
    );
    await expect(
      send(
        runtime,
        'submit',
        signed(
          'rotatekey',
          {
            runtime: 'daclifycore',
            dao_id: 1,
            member_id: 1,
            signing_key: otherKey.toPublic().toString(),
          },
          key,
          0,
        ),
        'relay@active',
      ),
    ).rejects.toThrow('CREDENTIAL_EXISTS');
    await expect(
      send(
        runtime,
        'submit',
        signed(
          'rotatekey',
          {
            runtime: 'daclifycore',
            dao_id: 1,
            member_id: 1,
            signing_key: key.toPublic().toString(),
          },
          key,
          0,
        ),
        'relay@active',
      ),
    ).rejects.toThrow('SIGNING_KEY');
    expect(memberSchema.parse(row(runtime, 'members', 1n, 1n)).signing_key).toBe(
      key.toPublic().toString(),
    );
  });
});
