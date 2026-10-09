import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { loadContract, send, row } from './helpers/vert.js';
import { listFirstParty } from './helpers/list-module.js';
import { wasmCodeHash } from './helpers/code-hash.js';
import {
  RuntimeTableSchemas,
  makeInstruction,
  encodeAction,
  instructionDigest,
} from '../sdk/index.js';

let chain: Blockchain,
  runtime: ReturnType<typeof loadContract>,
  token: ReturnType<typeof loadContract>,
  works: ReturnType<typeof loadContract>;
const signer = PrivateKey.generate('K1');
const stakeSigner = PrivateKey.generate('K1');
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  token = loadContract(chain, 'eosio.token', '.artifacts/reference-token/reference');
  works = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(token, 'create', ['alice', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '100.0000 TLOS', ''], 'alice@active');
  await send(token, 'open', ['daclifycore', '4,TLOS', 'daclifycore'], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, '', signer.toPublic().toString(), 'original encryption key', 0],
    'alice@active',
  );
  await send(
    runtime,
    'enroll',
    [1, 2, 'bob', PrivateKey.generate('K1').toPublic().toString(), 'native key', 0],
    ['alice@active', 'bob@active'],
  );
  await listFirstParty(runtime, 'works', wasmCodeHash('.artifacts/contracts/modrelay.wasm'));
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, [], ['reserve', 'approve'], wasmCodeHash('.artifacts/contracts/modrelay.wasm')],
    'alice@active',
  );
  await send(token, 'transfer', ['alice', 'daclifycore', '10.0000 TLOS', 'dao:1'], 'alice@active');
});
function snapshot() {
  return {
    dao: row(runtime, 'daos', runtime.toBigInt(), 1n),
    member: row(runtime, 'members', 1n, 1n),
    native: runtime.tables.members?.(1n).getTableRows(),
    obligation: row(runtime, 'obligations', 1n, 1n),
    receipts: runtime.tables.receipts?.(1n).getTableRows(),
  };
}
async function approve(recipient: number) {
  await send(works, 'reserve', ['daclifycore', 1, 1, recipient, '2.0000 TLOS', 0], 'works@active');
  await send(works, 'approveob', ['daclifycore', 1, 1], 'works@active');
}
async function exit(kind: 'withdraw' | 'unstake', id = '1') {
  const member = RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, BigInt(id)));
  const input = {
    runtime: 'daclifycore',
    dao_id: '1',
    member_id: id,
    destination: 'bob',
    quantity: '2.0000 TLOS',
  };
  const request = makeInstruction(
    { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    id,
    member.nonce,
    300,
    'daclifycore',
    kind,
    encodeAction(kind, input),
  );
  await send(
    runtime,
    'submit',
    [
      request,
      (id === '3' ? stakeSigner : signer).signDigest(instructionDigest(request)).toString(),
    ],
    'relay@active',
  );
}
it.each(['withdraw', 'unstake'] as const)(
  'requires a receiver-prepared token row for %s and preserves rights/nonces on refusal',
  async (kind) => {
    const id = kind === 'withdraw' ? '1' : '3';
    if (kind === 'withdraw') {
      await approve(1);
      await send(runtime, 'payob', [1, 'works', 1], 'relay@active');
    } else {
      await send(
        runtime,
        'enroll',
        [1, 3, 'alice', stakeSigner.toPublic().toString(), 'stake key', 0],
        'alice@active',
      );
      await send(
        token,
        'transfer',
        ['alice', 'daclifycore', '2.0000 TLOS', 'stake:1:3'],
        'alice@active',
      );
    }
    const before = snapshot();
    await expect(exit(kind, id)).rejects.toThrow('PAYOUT_TOKEN_ROW_REQUIRED');
    expect(snapshot()).toEqual(before);
    await send(token, 'open', ['bob', '4,TLOS', 'bob'], 'bob@active');
    await exit(kind, id);
    const person = RuntimeTableSchemas.members.parse(row(runtime, 'members', 1n, BigInt(id)));
    expect(person.nonce).toBe('1');
    expect(kind === 'withdraw' ? person.claim : person.stake).toBe('0');
  },
);
it('keeps an approved native obligation pending until the receiver prepares its row, then pays once', async () => {
  await approve(2);
  const before = snapshot();
  await expect(send(runtime, 'payob', [1, 'works', 1], 'relay@active')).rejects.toThrow(
    'PAYOUT_TOKEN_ROW_REQUIRED',
  );
  expect(snapshot()).toEqual(before);
  await send(token, 'open', ['bob', '4,TLOS', 'bob'], 'bob@active');
  await send(runtime, 'payob', [1, 'works', 1], 'relay@active');
  expect(RuntimeTableSchemas.obligations.parse(row(runtime, 'obligations', 1n, 1n)).status).toBe(2);
  await expect(send(runtime, 'payob', [1, 'works', 1], 'relay@active')).rejects.toThrow(
    'NOT_PAYABLE',
  );
});
