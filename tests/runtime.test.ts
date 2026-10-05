import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey, Serializer, Checksum256, ABI } from '@wharfkit/antelope';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { loadContract, send, row } from './helpers/vert.js';

const artifact = '.artifacts/contracts/runtime';
const chainId = 'ab'.repeat(32);
const key = PrivateKey.generate('K1');
const otherKey = PrivateKey.generate('K1');
let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
const memberSchema = z.object({
  id: z.union([z.string(), z.number()]),
  nonce: z.union([z.string(), z.number()]),
  credits: z.union([z.string(), z.number()]),
  active: z.boolean(),
});
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, 'daclifycore', artifact);
  await send(runtime, 'init', [chainId], 'daclifycore@active');
});
async function create(id = 1, privacy = 0) {
  await send(
    runtime,
    'createdao',
    [id, 'alice', '{"schemaVersion":1,"title":"DAO"}', privacy, 'eosio.token', '4,TLOS'],
    'alice@active',
  );
}
async function enroll(
  id = 1,
  native = 'alice',
  custody = 0,
  signingKey = key.toPublic().toString(),
) {
  await send(
    runtime,
    'enroll',
    [1, id, native, signingKey, 'encryption-public-key', custody],
    'alice@active',
  );
}
function instruction(dao = 1, nonce = 0, signer = key, overrides: object = {}) {
  const abi = ABI.from(readFileSync(`${artifact}.abi`, 'utf8'));
  const data = Serializer.encode({
    abi,
    type: 'setmeta',
    object: {
      runtime: 'daclifycore',
      dao_id: dao,
      member_id: 1,
      metadata: '{"schemaVersion":1,"title":"Changed"}',
    },
  }).hexString;
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: dao,
    member_id: 1,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action: 'setmeta',
    data,
    ...overrides,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  return [request, signer.signDigest(digest).toString()];
}
describe('DAO runtime authorization and isolation', () => {
  it('requires deployment authority to initialize', async () => {
    await expect(send(runtime, 'init', [chainId], 'bob@active')).rejects.toThrow();
  });
  it('rejects repeated initialization', async () => {
    await expect(send(runtime, 'init', [chainId], 'daclifycore@active')).rejects.toThrow(
      'ALREADY_INITIALIZED',
    );
  });
  it('requires owner consent for DAO creation', async () => {
    await expect(
      send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'bob@active'),
    ).rejects.toThrow();
  });
  it('persists DAO metadata durably', async () => {
    await create();
    expect(
      z.object({ metadata: z.string() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n))
        .metadata,
    ).toContain('DAO');
  });
  it('rejects duplicate DAO identifiers', async () => {
    await create();
    await expect(create()).rejects.toThrow('DAO_EXISTS');
  });
  it('rejects oversized JSON metadata', async () => {
    await expect(
      send(
        runtime,
        'createdao',
        [1, 'alice', JSON.stringify({ body: 'x'.repeat(5000) }), 0, 'eosio.token', '4,TLOS'],
        'alice@active',
      ),
    ).rejects.toThrow('METADATA_SIZE');
  });
  it('rejects malformed JSON metadata', async () => {
    await expect(
      send(runtime, 'createdao', [1, 'alice', '{bad', 0, 'eosio.token', '4,TLOS'], 'alice@active'),
    ).rejects.toThrow('METADATA_JSON');
  });
  it('keeps identical member ids in separate DAO scopes', async () => {
    await create();
    await create(2);
    await enroll();
    await send(
      runtime,
      'enroll',
      [2, 1, 'bob', otherKey.toPublic().toString(), 'different', 0],
      ['alice@active', 'bob@active'],
    );
    expect(row(runtime, 'members', 1n, 1n)).not.toEqual(row(runtime, 'members', 2n, 1n));
  });
  it('requires consent from an incoming native credential', async () => {
    await create();
    await expect(
      send(runtime, 'enroll', [1, 1, 'bob', key.toPublic().toString(), 'key', 0], 'alice@active'),
    ).rejects.toThrow();
  });
  it('rejects unauthorized membership admission', async () => {
    await create();
    await expect(
      send(runtime, 'enroll', [1, 1, 'bob', key.toPublic().toString(), 'key', 0], 'bob@active'),
    ).rejects.toThrow();
  });
  it('rejects duplicate native credentials in one DAO', async () => {
    await create();
    await enroll();
    await expect(enroll(2, 'alice', 0, otherKey.toPublic().toString())).rejects.toThrow(
      'CREDENTIAL_EXISTS',
    );
  });
  it('rejects duplicate signing credentials in one DAO', async () => {
    await create();
    await enroll();
    await expect(enroll(2, 'bob')).rejects.toThrow('CREDENTIAL_EXISTS');
  });
  it('rejects managed decryption custody under the user-controlled privacy policy', async () => {
    await create(1, 2);
    await expect(enroll(1, 'alice', 1)).rejects.toThrow('CUSTODY_POLICY');
  });
  it('accepts a walletless signed instruction', async () => {
    await create();
    await enroll(1, '');
    await send(runtime, 'submit', instruction(), 'relay@active');
    expect(String(memberSchema.parse(row(runtime, 'members', 1n, 1n)).nonce)).toBe('1');
  });
  it('rejects replay and preserves the nonce after rejection', async () => {
    await create();
    await enroll(1, '');
    const req = instruction();
    await send(runtime, 'submit', req, 'relay@active');
    await expect(send(runtime, 'submit', req, 'relay@active')).rejects.toThrow('NONCE');
    expect(String(memberSchema.parse(row(runtime, 'members', 1n, 1n)).nonce)).toBe('1');
  });
  it('rejects another member signature', async () => {
    await create();
    await enroll();
    await expect(
      send(runtime, 'submit', instruction(1, 0, otherKey), 'relay@active'),
    ).rejects.toThrow();
  });
  it.each([
    { chain_id: 'cd'.repeat(32) },
    { deployment: 'wrongtarget' },
    { version: 2 },
    { nonce: 1 },
    { expires: 0 },
  ])('rejects domain/nonce/expiry mismatch %j', async (overrides) => {
    await create();
    await enroll();
    await expect(
      send(runtime, 'submit', instruction(1, 0, key, overrides), 'relay@active'),
    ).rejects.toThrow();
  });
  it('rejects target payload DAO substitution', async () => {
    await create();
    await create(2);
    await enroll();
    await expect(
      send(runtime, 'submit', instruction(1, 0, key, { dao_id: 2 }), 'relay@active'),
    ).rejects.toThrow();
  });
  it('requires native proof for a native instruction', async () => {
    await create();
    await enroll();
    const req = instruction()[0];
    expect(req).toBeDefined();
    await expect(send(runtime, 'submitnat', { request: req }, 'bob@active')).rejects.toThrow();
  });
  it('records VERT R1 incompatibility so native verification is mandatory', async () => {
    const r1 = PrivateKey.generate('R1');
    await create();
    await enroll(1, '', 1, r1.toPublic().toString());
    await expect(send(runtime, 'submit', instruction(1, 0, r1), 'relay@active')).rejects.toThrow(
      'unsupported signature type',
    );
  });
  it('rejects a relayer attempting a direct authorized callback', async () => {
    await create();
    await enroll();
    await expect(
      send(runtime, 'setmeta', ['daclifycore', 1, 1, '{}'], 'relay@active'),
    ).rejects.toThrow();
  });
  it('rejects unauthorized credit issuance', async () => {
    await create();
    await enroll();
    await expect(send(runtime, 'grantcredit', [1, 1, 100], 'bob@active')).rejects.toThrow();
  });
  it('reconciles issued governance credits', async () => {
    await create();
    await enroll();
    await send(runtime, 'grantcredit', [1, 1, 100], 'alice@active');
    expect(String(memberSchema.parse(row(runtime, 'members', 1n, 1n)).credits)).toBe('100');
  });
});
