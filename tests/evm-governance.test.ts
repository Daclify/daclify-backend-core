import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hashTypedData, type TypedData } from 'viem';
import {
  bindingTypedData,
  governanceTypedData,
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
} from '../sdk/index.js';
import { loadContract, row, send } from './helpers/vert.js';
const native = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1 as const,
};
const root = PrivateKey.generate('K1'),
  scalar = new Uint8Array(32);
scalar[31] = 1;
const binding = {
  chainId: 41 as const,
  address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  epoch: '1',
};
let chain: Blockchain, runtime: ReturnType<typeof loadContract>;
const expires = () => chain.timestamp.toMilliseconds() / 1000 + 120;
function sign(
  data: ReturnType<typeof bindingTypedData> | ReturnType<typeof governanceTypedData>,
): string {
  const hash = hashTypedData<TypedData, string>(data),
    signature = secp256k1.sign(Buffer.from(hash.slice(2), 'hex'), scalar, {
      prehash: false,
      format: 'recovered',
    });
  return Buffer.concat([
    Buffer.from(signature.subarray(1)),
    Buffer.from([(signature[0] ?? 0) + 27]),
  ]).toString('hex');
}
async function bind(dao = native, signer = root) {
  const proof = sign(bindingTypedData(dao, '1', binding, '0', expires()));
  const request = makeInstruction(
    dao,
    '1',
    '0',
    expires(),
    'daclifycore',
    'linkevm',
    encodeAction('linkevm', {
      runtime: 'daclifycore',
      dao_id: dao.daoId,
      member_id: '1',
      evm_chain_id: '41',
      address: binding.address.slice(2),
      epoch: '1',
      nonce: '0',
      expires: expires(),
      proof,
    }),
  );
  await send(
    runtime,
    'submit',
    [request, signer.signDigest(instructionDigest(request)).toString()],
    'relay@active',
  );
}
function unbind(nonce = '1') {
  return makeInstruction(
    native,
    '1',
    nonce,
    expires(),
    'daclifycore',
    'unlinkevm',
    encodeAction('unlinkevm', { runtime: 'daclifycore', dao_id: '1', member_id: '1' }),
  );
}
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  await send(runtime, 'init', [native.chainId], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, '', root.toPublic().toString(), 'fixture', 0],
    'alice@active',
  );
});
it('requires existing member and incoming EVM consent, with no second member or voting balance', async () => {
  const typed = bindingTypedData(native, '1', binding, '0', expires());
  await expect(
    send(
      runtime,
      'linkevm',
      ['daclifycore', 1, 1, 41, binding.address.slice(2), 1, 0, expires(), sign(typed)],
      'daclifycore@active',
    ),
  ).rejects.toThrow('ACTOR_SENDER');
  await bind();
  expect(RuntimeTableSchemas.evmbindings.parse(row(runtime, 'evmbindings', 1n, 1n))).toMatchObject({
    member_id: '1',
    epoch: '1',
    active: true,
  });
  expect(RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n))).toMatchObject({
    nonce: '1',
    credits: '0',
  });
  expect(row(runtime, 'members', 1n, 2n)).toBeUndefined();
});
it('accepts independent EIP-712 instruction signatures, rejects changed payloads and preserves shared nonce/revocation', async () => {
  await bind();
  const request = unbind(),
    proof = sign(governanceTypedData(request, binding));
  for (const changed of [
    { ...request, chain_id: 'cd'.repeat(32) },
    { ...request, deployment: 'other' },
    { ...request, member_id: '2' },
    { ...request, dao_id: '2' },
    { ...request, nonce: '2' },
    { ...request, expires: expires() - 1 },
    { ...request, action: 'rotatekey' },
  ])
    await expect(
      send(runtime, 'submitevm', [changed, 41, binding.address.slice(2), 1, proof], 'relay@active'),
    ).rejects.toThrow();
  await expect(
    send(runtime, 'submitevm', [request, 40, binding.address.slice(2), 1, proof], 'relay@active'),
  ).rejects.toThrow('EVM_BINDING');
  await expect(
    send(runtime, 'submitevm', [request, 41, binding.address.slice(2), 2, proof], 'relay@active'),
  ).rejects.toThrow('EVM_BINDING');
  await send(
    runtime,
    'submitevm',
    [request, 41, binding.address.slice(2), 1, proof],
    'relay@active',
  );
  expect(RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, 1n)).nonce).toBe('2');
  expect(RuntimeTableSchemas.evmbindings.parse(row(runtime, 'evmbindings', 1n, 1n))).toMatchObject({
    active: false,
    epoch: '2',
  });
  await expect(
    send(runtime, 'submitevm', [request, 41, binding.address.slice(2), 1, proof], 'relay@active'),
  ).rejects.toThrow('NONCE');
  const fresh = unbind('2');
  await expect(
    send(
      runtime,
      'submitevm',
      [fresh, 41, binding.address.slice(2), 1, sign(governanceTypedData(fresh, binding))],
      'relay@active',
    ),
  ).rejects.toThrow('EVM_BINDING');
});

it('guardian recovery also revokes the compromised EVM binding before the agent resumes', async () => {
  chain.createAccounts('decide');
  const dao = { ...native, daoId: '2' };
  await send(runtime, 'createdao', [2, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'initgov',
    [
      2,
      {
        participant_mode: 1,
        decide: 'decide',
        guardian: 'alice',
        kind: 0,
        duration: 300,
        quorum: 5000,
        approval: 5001,
        governed_works: true,
        max_commitment: 100000,
        daily_commitment: 300000,
      },
    ],
    'alice@active',
  );
  await send(
    runtime,
    'enrollagent',
    [2, 1, '', root.toPublic().toString(), 'fixture', 0, 'Agent operator'],
    'alice@active',
  );
  await bind(dao);
  await send(runtime, 'guardrevoke', [2, 1], 'alice@active');
  const replacement = PrivateKey.generate('K1');
  await send(runtime, 'guardrecover', [2, 1, replacement.toPublic().toString()], 'alice@active');
  expect(RuntimeTableSchemas.evmbindings.parse(row(runtime, 'evmbindings', 2n, 1n))).toMatchObject({
    active: false,
    epoch: '2',
  });
  const request = makeInstruction(
    dao,
    '1',
    '1',
    expires(),
    'daclifycore',
    'unlinkevm',
    encodeAction('unlinkevm', { runtime: 'daclifycore', dao_id: '2', member_id: '1' }),
  );
  await expect(
    send(
      runtime,
      'submitevm',
      [request, 41, binding.address.slice(2), 1, sign(governanceTypedData(request, binding))],
      'relay@active',
    ),
  ).rejects.toThrow('EVM_BINDING');
});
