import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import { wasmCodeHash } from './helpers/code-hash.js';

const artifact = '.artifacts/contracts/runtime';
const chainId = 'ab'.repeat(32);
const reference = '11'.repeat(32);
const otherReference = '22'.repeat(32);
const worksHash = wasmCodeHash('.artifacts/contracts/modrelay.wasm');
const adminKey = PrivateKey.generate('K1');
const memberKey = PrivateKey.generate('K1');
let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
let token: ReturnType<typeof loadContract>;
let works: ReturnType<typeof loadContract>;
const id = z.union([z.string(), z.number()]);
const ledgerSchema = z.object({
  available: id,
  reserved: id,
  claims: id,
});
const obligationSchema = z.object({
  id,
  recipient: id,
  status: id,
});
const evidenceSchema = z.object({
  id,
  dao_id: id,
  obligation_id: id,
  recipient: id,
  quantity: z.string(),
  chain: z.string(),
  payer: z.string(),
  reference: z.string(),
  mode: id,
});

beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, 'daclifycore', artifact);
  works = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', [chainId], 'daclifycore@active');
  await send(token, 'create', ['alice', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '100.0000 TLOS', ''], 'alice@active');
  for (const dao of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [dao, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    await send(
      runtime,
      'enroll',
      [dao, 1, 'alice', adminKey.toPublic().toString(), 'key', 0],
      'alice@active',
    );
    await send(
      runtime,
      'setmodule',
      [dao, 'works', 1, [], ['reserve', 'approve'], worksHash],
      'alice@active',
    );
    await send(
      token,
      'transfer',
      ['alice', 'daclifycore', '10.0000 TLOS', `dao:${dao}`],
      'alice@active',
    );
    await send(works, 'reserve', ['daclifycore', dao, 1, 1, '1.0000 TLOS', 0], 'works@active');
    await send(works, 'approveob', ['daclifycore', dao, 1], 'works@active');
  }
  await send(
    runtime,
    'enroll',
    [1, 2, '', memberKey.toPublic().toString(), 'key', 0],
    'alice@active',
  );
});

function signed(
  memberId: number,
  signer: PrivateKey,
  nonce: number,
  fields: {
    obligation_id: number;
    recipient: number;
    quantity: string;
    chain: string;
    payer: string;
    reference: string;
  },
  dao = 1,
) {
  const abi = ABI.from(readFileSync(`${artifact}.abi`, 'utf8'));
  const object = { runtime: 'daclifycore', dao_id: dao, member_id: memberId, ...fields };
  const data = Serializer.encode({ abi, type: 'confirmext', object }).hexString;
  const request = {
    version: 1,
    chain_id: chainId,
    deployment: 'daclifycore',
    dao_id: dao,
    member_id: memberId,
    nonce,
    expires: chain.timestamp.toMilliseconds() / 1000 + 300,
    target: 'daclifycore',
    action: 'confirmext',
    data,
  };
  const digest = Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
  return [request, signer.signDigest(digest).toString()];
}

const statement = {
  obligation_id: 1,
  recipient: 1,
  quantity: '1.0000 TLOS',
  chain: 'eip155:1',
  payer: '0x1111111111111111111111111111111111111111',
  reference,
};

describe('DAO-confirmed external payment evidence', () => {
  it('rejects a direct runtime key and does not record evidence', async () => {
    await expect(
      send(
        runtime,
        'confirmext',
        [
          'daclifycore',
          1,
          1,
          statement.obligation_id,
          statement.chain,
          statement.payer,
          statement.recipient,
          statement.quantity,
          statement.reference,
        ],
        'daclifycore@active',
      ),
    ).rejects.toThrow('ACTOR_SENDER');
    expect(row(runtime, 'evidence', runtime.toBigInt(), 1n)).toBeUndefined();
  });

  it('records an authorized statement without settling the obligation', async () => {
    const before = ledgerSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n));
    await send(runtime, 'submit', signed(1, adminKey, 0, statement), 'relay@active');
    const evidence = evidenceSchema.parse(row(runtime, 'evidence', runtime.toBigInt(), 1n));
    expect(evidence).toMatchObject({
      id: 1,
      dao_id: 1,
      obligation_id: 1,
      recipient: 1,
      chain: 'eip155:1',
      payer: '0x1111111111111111111111111111111111111111',
      mode: 1,
    });
    expect(evidence.reference.toLowerCase()).toBe(reference);
    expect(evidence.quantity).toBe('1.0000 TLOS');
    expect(obligationSchema.parse(row(runtime, 'obligations', 1n, 1n)).status).toBe(1);
    expect(ledgerSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n))).toEqual(before);
    await send(runtime, 'payob', [1, 'works', 1], 'bob@active');
    expect(obligationSchema.parse(row(runtime, 'obligations', 1n, 1n)).status).toBe(2);
    expect(evidenceSchema.parse(row(runtime, 'evidence', runtime.toBigInt(), 1n)).mode).toBe(1);
  });

  it('rejects a non-admin, a mismatched statement, and a reused reference', async () => {
    await expect(
      send(runtime, 'submit', signed(2, memberKey, 0, statement), 'relay@active'),
    ).rejects.toThrow('ADMIN_REQUIRED');
    await expect(
      send(
        runtime,
        'submit',
        signed(1, adminKey, 0, { ...statement, quantity: '1.0001 TLOS' }),
        'relay@active',
      ),
    ).rejects.toThrow('EVIDENCE_AMOUNT');
    await expect(
      send(
        runtime,
        'submit',
        signed(1, adminKey, 0, { ...statement, recipient: 2 }),
        'relay@active',
      ),
    ).rejects.toThrow('EVIDENCE_RECIPIENT');
    await send(runtime, 'submit', signed(1, adminKey, 0, statement), 'relay@active');
    await expect(
      send(runtime, 'submit', signed(1, adminKey, 0, statement, 2), 'relay@active'),
    ).rejects.toThrow('EVIDENCE_REUSED');
    await send(
      runtime,
      'submit',
      signed(1, adminKey, 0, { ...statement, reference: otherReference }, 2),
      'relay@active',
    );
    await expect(
      send(
        runtime,
        'submit',
        signed(1, adminKey, 1, { ...statement, reference: otherReference }),
        'relay@active',
      ),
    ).rejects.toThrow('EVIDENCE_REUSED');
    expect(ledgerSchema.parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).reserved).toBe(10000);
  });
});
