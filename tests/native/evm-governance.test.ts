import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { APIClient, Action, PrivateKey, Transaction, SignedTransaction } from '@wharfkit/antelope';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hashTypedData, type TypedData } from 'viem';
import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  bindingTypedData,
  governanceTypedData,
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
} from '../../sdk/index.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
const network = z
  .object({
    url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
    chainId: z.string(),
    container: z.literal('daclify-research-native'),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const rpc = new APIClient({ url: network.url }),
  native = {
    chainId: network.chainId,
    contract: 'daclifycore',
    daoId: String(Date.now()),
    interfaceVersion: 1 as const,
  },
  root = PrivateKey.generate('K1');
const scalar = new Uint8Array(32);
scalar[31] = 1;
const binding = {
  chainId: 41 as const,
  address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  epoch: '1',
};
function sign(data: ReturnType<typeof bindingTypedData> | ReturnType<typeof governanceTypedData>) {
  const digest = hashTypedData<TypedData, string>(data),
    raw = secp256k1.sign(Buffer.from(digest.slice(2), 'hex'), scalar, {
      prehash: false,
      format: 'recovered',
    });
  return Buffer.concat([Buffer.from(raw.subarray(1)), Buffer.from([(raw[0] ?? 0) + 27])]).toString(
    'hex',
  );
}
async function push(name: string, data: Uint8Array) {
  const info = await rpc.v1.chain.get_info(),
    transaction = Transaction.from({
      ...info.getTransactionHeader(60),
      actions: [
        Action.from({
          account: 'daclifycore',
          name,
          authorization: [{ actor: 'alice', permission: 'active' }],
          data,
        }),
      ],
    });
  return rpc.v1.chain.push_transaction(
    SignedTransaction.from({
      ...transaction,
      signatures: [fixtureKey('alice').signDigest(transaction.signingDigest(network.chainId))],
    }),
  );
}
it('executes independent typed EOA governance on the native runtime and shares K1/native nonces', async () => {
  unlockFixtureWallet(network.container);
  configureFixtureContext(network.container);
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'set',
      'contract',
      'daclifycore',
      '/work/.artifacts/contracts',
      'runtime.wasm',
      'runtime.abi',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  await push(
    'createdao',
    encodeAction('createdao', {
      dao_id: native.daoId,
      owner: 'alice',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    }),
  );
  await push(
    'enroll',
    encodeAction('enroll', {
      dao_id: native.daoId,
      member_id: '1',
      native_account: '',
      signing_key: root.toPublic().toString(),
      encryption_key: 'fixture',
      custody: 0,
    }),
  );
  const expires = Math.floor(Date.now() / 1000) + 120;
  const bind = makeInstruction(
    native,
    '1',
    '0',
    expires,
    'daclifycore',
    'linkevm',
    encodeAction('linkevm', {
      runtime: 'daclifycore',
      dao_id: native.daoId,
      member_id: '1',
      evm_chain_id: '41',
      address: binding.address.slice(2),
      epoch: '1',
      nonce: '0',
      expires,
      proof: sign(bindingTypedData(native, '1', binding, '0', expires)),
    }),
  );
  await push(
    'submit',
    encodeAction('submit', {
      request: bind,
      sig: root.signDigest(instructionDigest(bind)).toString(),
    }),
  );
  const request = makeInstruction(
    native,
    '1',
    '1',
    expires,
    'daclifycore',
    'setcredits',
    encodeAction('setcredits', {
      runtime: 'daclifycore',
      dao_id: native.daoId,
      member_id: '1',
      target: '1',
      quantity: '42',
    }),
  );
  const proof = sign(governanceTypedData(request, binding));
  const malformed = { ...request, expires: expires - 1 };
  await expect(
    push(
      'submitevm',
      encodeAction('submitevm', {
        request: malformed,
        evm_chain_id: '41',
        address: binding.address.slice(2),
        binding_epoch: '1',
        proof,
      }),
    ),
  ).rejects.toThrow();
  const result = await push(
    'submitevm',
    encodeAction('submitevm', {
      request,
      evm_chain_id: '41',
      address: binding.address.slice(2),
      binding_epoch: '1',
      proof,
    }),
  );
  const members = await rpc.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: native.daoId,
    table: 'members',
    limit: 10,
  });
  const member = RuntimeTableSchemas.members.parse(members.rows[0]);
  expect(member).toMatchObject({ id: '1', nonce: '2', credits: '42' });
  expect(members.rows).toHaveLength(1);
  await expect(
    push(
      'submitevm',
      encodeAction('submitevm', {
        request,
        evm_chain_id: '41',
        address: binding.address.slice(2),
        binding_epoch: '1',
        proof,
      }),
    ),
  ).rejects.toThrow();
  await expect(
    push(
      'submit',
      encodeAction('submit', {
        request,
        sig: root.signDigest(instructionDigest(request)).toString(),
      }),
    ),
  ).rejects.toThrow();
  const revoke = makeInstruction(
    native,
    '1',
    '2',
    expires,
    'daclifycore',
    'unlinkevm',
    encodeAction('unlinkevm', { runtime: 'daclifycore', dao_id: native.daoId, member_id: '1' }),
  );
  await push(
    'submitevm',
    encodeAction('submitevm', {
      request: revoke,
      evm_chain_id: '41',
      address: binding.address.slice(2),
      binding_epoch: '1',
      proof: sign(governanceTypedData(revoke, binding)),
    }),
  );
  const stale = makeInstruction(
    native,
    '1',
    '3',
    expires,
    'daclifycore',
    'setcredits',
    encodeAction('setcredits', {
      runtime: 'daclifycore',
      dao_id: native.daoId,
      member_id: '1',
      target: '1',
      quantity: '100',
    }),
  );
  await expect(
    push(
      'submitevm',
      encodeAction('submitevm', {
        request: stale,
        evm_chain_id: '41',
        address: binding.address.slice(2),
        binding_epoch: '1',
        proof: sign(governanceTypedData(stale, binding)),
      }),
    ),
  ).rejects.toThrow();
  const receipt = z
    .object({
      processed: z.object({ receipt: z.object({ cpu_usage_us: z.number().nonnegative() }) }),
    })
    .parse(JSON.parse(JSON.stringify(result)));
  writeFileSync(
    '.artifacts/native/evm-governance-evidence.json',
    JSON.stringify(
      {
        native: network.chainId,
        fixture: network.container,
        independentEncoder: 'viem 2.57.3',
        singleMember: true,
        sharedNonce: true,
        revocation: true,
        cpuMicroseconds: receipt.processed.receipt.cpu_usage_us,
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
});
