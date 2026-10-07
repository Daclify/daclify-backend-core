import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { z } from 'zod';
import { loadContract, send, row } from './helpers/vert.js';

let runtime: ReturnType<typeof loadContract>;
let cid: string;
const key = PrivateKey.generate('K1');
const other = PrivateKey.generate('K1');
const profileRow = z.object({
  account_name: z.string(),
  profile: z.string(),
});

beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'bob');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  cid = CID.createV1(0x55, await sha256.digest(new TextEncoder().encode('avatar'))).toString();
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, '', key.toPublic().toString(), 'encryption-key', 0],
    'alice@active',
  );
  await send(
    runtime,
    'enroll',
    [1, 2, '', other.toPublic().toString(), 'encryption-key', 0],
    'alice@active',
  );
});

function profile(account: string, fields: Record<string, string> = {}) {
  return JSON.stringify({ name: account, ...fields });
}

describe('member profile images', () => {
  it('stores an avatar with the same CID a document accepts', async () => {
    await send(
      runtime,
      'putdoc',
      ['daclifycore', 1, 1, 1, 1, cid, '{}', 'ab'.repeat(32), 8, 0, 0],
      'daclifycore@active',
    );
    const body = profile('alice', { avatar: cid, background: cid });
    await send(runtime, 'setprofile', ['daclifycore', 1, 1, 'alice', body], 'daclifycore@active');
    expect(profileRow.parse(row(runtime, 'profiles', runtime.toBigInt(), 0n))).toMatchObject({
      account_name: 'alice',
      profile: body,
    });
  });

  it('rejects an image URL with the document CID error', async () => {
    const body = profile('alice', { avatar: 'https://cdn.example/avatar.png' });
    await expect(
      send(runtime, 'setprofile', ['daclifycore', 1, 1, 'alice', body], 'daclifycore@active'),
    ).rejects.toThrow('CID_FORMAT');
  });

  it('rejects a malformed image CID', async () => {
    const body = profile('alice', { background: 'not-a-cid' });
    await expect(
      send(runtime, 'setprofile', ['daclifycore', 1, 1, 'alice', body], 'daclifycore@active'),
    ).rejects.toThrow('CID_FORMAT');
  });

  it('allows an empty image and an https website', async () => {
    const body = profile('alice', { avatar: '', website: 'https://daclify.io' });
    await send(runtime, 'setprofile', ['daclifycore', 1, 1, 'alice', body], 'daclifycore@active');
    expect(profileRow.parse(row(runtime, 'profiles', runtime.toBigInt(), 0n)).profile).toBe(body);
  });

  it('keeps the account name unique and immutable', async () => {
    await send(
      runtime,
      'setprofile',
      ['daclifycore', 1, 1, 'alice', profile('alice', { motto: 'build' })],
      'daclifycore@active',
    );
    await expect(
      send(
        runtime,
        'setprofile',
        ['daclifycore', 1, 2, 'alice', profile('alice')],
        'daclifycore@active',
      ),
    ).rejects.toThrow('NAME_TAKEN');
    await expect(
      send(
        runtime,
        'setprofile',
        ['daclifycore', 1, 1, 'bob', profile('bob')],
        'daclifycore@active',
      ),
    ).rejects.toThrow('NAME_IMMUTABLE');
  });
});
