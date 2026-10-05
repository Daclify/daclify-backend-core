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
beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'bob');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  cid = CID.createV1(0x55, await sha256.digest(new TextEncoder().encode('document'))).toString();
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  for (const id of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [id, 'alice', '{}', id === 1 ? 0 : 2, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [id, 1, '', key.toPublic().toString(), 'encryption-key', 0],
      'alice@active',
    );
    if (id === 2)
      await send(
        runtime,
        'commitepoch',
        ['daclifycore', 2, 1, 1, 'ab'.repeat(32), '{}'],
        'daclifycore@active',
      );
  }
});
function document(dao = 1, version = 1, format = 0, epoch = 0, metadata = '{}') {
  return ['daclifycore', dao, 1, 1, version, cid, metadata, 'ab'.repeat(32), 8, format, epoch];
}
describe('durable and private documents', () => {
  it('persists a versioned document without transaction-history reconstruction', async () => {
    await send(runtime, 'putdoc', document(), 'daclifycore@active');
    expect(
      z.object({ cid: z.string(), version: z.number() }).parse(row(runtime, 'documents', 1n, 1n)),
    ).toMatchObject({ cid, version: 1 });
  });
  it('rejects duplicate document versions', async () => {
    await send(runtime, 'putdoc', document(), 'daclifycore@active');
    await expect(send(runtime, 'putdoc', document(), 'daclifycore@active')).rejects.toThrow(
      'DOCUMENT_VERSION',
    );
  });
  it('requires contiguous version progression', async () => {
    await expect(send(runtime, 'putdoc', document(1, 2), 'daclifycore@active')).rejects.toThrow(
      'DOCUMENT_VERSION',
    );
  });
  it('rejects a malformed CID on chain', async () => {
    const data = document();
    data[5] = 'not-a-cid';
    await expect(send(runtime, 'putdoc', data, 'daclifycore@active')).rejects.toThrow('CID_FORMAT');
  });
  it('rejects private content published without an encryption envelope', async () => {
    await expect(send(runtime, 'putdoc', document(2), 'daclifycore@active')).rejects.toThrow(
      'PRIVACY_ENVELOPE',
    );
  });
  it('rejects plaintext private metadata', async () => {
    await expect(
      send(runtime, 'putdoc', document(2, 1, 1, 1, '{"title":"secret"}'), 'daclifycore@active'),
    ).rejects.toThrow('PRIVATE_METADATA');
  });
  it('requires current epoch and stores only opaque private references', async () => {
    await send(runtime, 'putdoc', document(2, 1, 1, 1), 'daclifycore@active');
    expect(
      z
        .object({ envelope_version: z.number(), key_epoch: z.union([z.string(), z.number()]) })
        .parse(row(runtime, 'documents', 2n, 1n)).envelope_version,
    ).toBe(1);
  });
  it('rotates future document epochs without rewriting history', async () => {
    await send(runtime, 'putdoc', document(2, 1, 1, 1), 'daclifycore@active');
    await send(runtime, 'rotateepoch', ['daclifycore', 2, 1], 'daclifycore@active');
    await expect(
      send(runtime, 'putdoc', document(2, 2, 1, 1), 'daclifycore@active'),
    ).rejects.toThrow('KEY_EPOCH');
    await send(
      runtime,
      'commitepoch',
      ['daclifycore', 2, 1, 2, 'cd'.repeat(32), '{}'],
      'daclifycore@active',
    );
    await send(runtime, 'putdoc', document(2, 2, 1, 2), 'daclifycore@active');
  });
  it('rejects unauthorized document callbacks', async () => {
    await expect(send(runtime, 'putdoc', document(), 'bob@active')).rejects.toThrow();
  });
});
describe('credential ownership and offboarding', () => {
  it('requires incoming native account authorization for linking', async () => {
    await expect(
      send(runtime, 'linknative', ['daclifycore', 1, 1, 'alice'], 'daclifycore@active'),
    ).rejects.toThrow();
  });
  it('links a proved native credential to the existing member', async () => {
    await send(
      runtime,
      'linknative',
      ['daclifycore', 1, 1, 'alice'],
      ['daclifycore@active', 'alice@active'],
    );
    expect(
      z.object({ native_account: z.string() }).parse(row(runtime, 'members', 1n, 1n))
        .native_account,
    ).toBe('alice');
  });
  it('rejects removal of the last administrator', async () => {
    await expect(
      send(runtime, 'setactive', ['daclifycore', 1, 1, 1, false], 'daclifycore@active'),
    ).rejects.toThrow('LAST_ADMIN');
  });
  it('keeps member identities and balances when access is removed', async () => {
    await send(
      runtime,
      'enroll',
      [1, 2, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
    await send(runtime, 'grantcredit', [1, 2, 10], 'alice@active');
    await send(runtime, 'setactive', ['daclifycore', 1, 1, 2, false], 'daclifycore@active');
    expect(
      z
        .object({ active: z.boolean(), credits: z.union([z.string(), z.number()]) })
        .parse(row(runtime, 'members', 1n, 2n)),
    ).toMatchObject({ active: false, credits: 10 });
  });
});

describe('small durable JSON content', () => {
  it('stores JSON directly with an immutable hash rather than requiring an IPFS hash', async () => {
    await send(
      runtime,
      'putjson',
      ['daclifycore', 1, 1, 7, 1, '{"text":"small contract document"}', 0, 0],
      'daclifycore@active',
    );
    const result = z
      .object({
        document_id: z.number(),
        cid: z.string(),
        metadata: z.string(),
        commitment: z.string(),
        bytes: z.number(),
      })
      .parse(row(runtime, 'documents', 1n, 1n));
    expect(result.cid).toBe('');
    expect(result.metadata).toBe('{"text":"small contract document"}');
    expect(result.commitment).toBe(
      Buffer.from((await sha256.digest(new TextEncoder().encode(result.metadata))).digest).toString(
        'hex',
      ),
    );
    expect(result.bytes).toBe(new TextEncoder().encode(result.metadata).length);
  });
  it('rejects oversized inline JSON before consuming storage', async () => {
    await expect(
      send(
        runtime,
        'putjson',
        ['daclifycore', 1, 1, 7, 1, JSON.stringify({ body: 'x'.repeat(4096) }), 0, 0],
        'daclifycore@active',
      ),
    ).rejects.toThrow('METADATA_SIZE');
  });
  it('rejects plaintext JSON inside a private DAO', async () => {
    await expect(
      send(
        runtime,
        'putjson',
        ['daclifycore', 2, 1, 7, 1, '{"text":"private plaintext"}', 1, 1],
        'daclifycore@active',
      ),
    ).rejects.toThrow('PRIVACY_ENVELOPE');
  });
  it('rejects a noncanonical CID with a zero padding suffix', async () => {
    const data = document();
    data[5] = cid + 'a';
    await expect(send(runtime, 'putdoc', data, 'daclifycore@active')).rejects.toThrow('CID_FORMAT');
  });
  it('shares contiguous document versions between inline JSON and IPFS content', async () => {
    await send(
      runtime,
      'putjson',
      ['daclifycore', 1, 1, 1, 1, '{"text":"inline"}', 0, 0],
      'daclifycore@active',
    );
    await send(runtime, 'putdoc', document(1, 2), 'daclifycore@active');
    expect(z.object({ version: z.number() }).parse(row(runtime, 'documents', 1n, 2n)).version).toBe(
      2,
    );
  });
});
