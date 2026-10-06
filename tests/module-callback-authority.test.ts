import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { ABI, Checksum256, PrivateKey, Serializer } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
import { ZERO_CODE_HASH, wasmCodeHash } from './helpers/code-hash.js';
import { listFirstParty } from './helpers/list-module.js';
import { z } from 'zod';

const worksWasm = '.artifacts/contracts/modrelay.wasm';
const worksHash = wasmCodeHash(worksWasm);
function wasmWithMarker(wasm: Buffer): Buffer {
  const name = Buffer.from('daclify-pin-probe');
  const body = Buffer.concat([unsignedLeb128(name.length), name, Buffer.from([7])]);
  return Buffer.concat([wasm, Buffer.from([0]), unsignedLeb128(body.length), body]);
}
function unsignedLeb128(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return Buffer.from(bytes);
}

let chain: Blockchain;
let runtime: ReturnType<typeof loadContract>;
let works: ReturnType<typeof loadContract>;
let payroll: ReturnType<typeof loadContract>;
const signer = PrivateKey.generate('K1');
const reserved = () =>
  z.object({ reserved: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n)).reserved;
beforeEach(async () => {
  chain = new Blockchain();
  chain.createAccounts('alice');
  runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  works = loadContract(chain, 'works', '.artifacts/contracts/modrelay');
  payroll = loadContract(chain, 'payroll', '.artifacts/contracts/modrelay');
  const token = loadContract(chain, 'eosio.token', '.artifacts/contracts/testtoken');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(runtime, 'createdao', [1, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice@active');
  await send(
    runtime,
    'enroll',
    [1, 1, 'alice', signer.toPublic().toString(), 'key', 0],
    'alice@active',
  );
  await listFirstParty(runtime, 'works', worksHash);
  await send(
    runtime,
    'setmodule',
    [1, 'works', 1, ['propose'], ['reserve', 'approve', 'cancel', 'govlock'], worksHash],
    'alice@active',
  );
  await send(token, 'create', ['eosio.token', '1000.0000 TLOS'], 'eosio.token@active');
  await send(token, 'issue', ['alice', '20.0000 TLOS', ''], 'eosio.token@active');
  await send(token, 'transfer', ['alice', 'daclifycore', '10.0000 TLOS', 'dao:1'], 'alice@active');
});

describe('module callback authority', () => {
  it('rejects a module account key that calls reserve directly', async () => {
    await expect(
      send(runtime, 'reserve', [1, 'works', 1, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('SOURCE_SENDER');
    expect(reserved()).toBe(0);
  });
  it('accepts the same reservation from the module contract', async () => {
    await send(works, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'works@active');
    expect(reserved()).toBe(10000);
  });
  it('rejects another contract impersonating the installed module', async () => {
    await expect(
      send(
        payroll,
        'impersonate',
        ['daclifycore', 'works', 1, 1, 1, '1.0000 TLOS', 0],
        'payroll@active',
      ),
    ).rejects.toThrow('SOURCE_SENDER');
    expect(reserved()).toBe(0);
  });
  it('rejects an inline callback from a module without the grant', async () => {
    await expect(
      send(payroll, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'payroll@active'),
    ).rejects.toThrow('MODULE_DISABLED');
    expect(reserved()).toBe(0);
  });
  it('rejects a pin that is not the loaded module code', async () => {
    await expect(
      send(
        runtime,
        'setmodule',
        [1, 'works', 1, ['propose'], ['reserve'], 'ab'.repeat(32)],
        'alice@active',
      ),
    ).rejects.toThrow('MODULE_CODE');
    expect(reserved()).toBe(0);
  });
  it('rejects a callback after the module code is replaced', async () => {
    await send(works, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'works@active');
    expect(reserved()).toBe(10000);
    works.setContract(
      readFileSync('.artifacts/contracts/modrelay.abi', 'utf8'),
      wasmWithMarker(readFileSync(worksWasm)),
    );
    await works.recreateVm();
    await expect(
      send(works, 'reserve', ['daclifycore', 1, 2, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('MODULE_CODE');
    expect(reserved()).toBe(10000);
  });
  it('clears a replaced module without trusting the supplied hash', async () => {
    works.setContract(
      readFileSync('.artifacts/contracts/modrelay.abi', 'utf8'),
      wasmWithMarker(readFileSync(worksWasm)),
    );
    await works.recreateVm();
    await send(runtime, 'setmodule', [1, 'works', 1, [], [], 'ab'.repeat(32)], 'alice@active');
    const installed = z
      .object({ grants: z.array(z.string()), code_hash: z.string() })
      .parse(row(runtime, 'modules', 1n, works.toBigInt()));
    expect(installed).toEqual({ grants: [], code_hash: ZERO_CODE_HASH });
    await expect(
      send(works, 'reserve', ['daclifycore', 1, 1, 1, '1.0000 TLOS', 0], 'works@active'),
    ).rejects.toThrow('MODULE_GRANT');
  });
  it('rejects a member instruction after the module code is replaced', async () => {
    const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
    const data = Serializer.encode({
      abi,
      type: 'setmeta',
      object: { runtime: 'daclifycore', dao_id: 1, member_id: 1, metadata: '{}' },
    }).hexString;
    works.setContract(
      readFileSync('.artifacts/contracts/modrelay.abi', 'utf8'),
      wasmWithMarker(readFileSync(worksWasm)),
    );
    await works.recreateVm();
    const request = {
      version: 1,
      chain_id: 'ab'.repeat(32),
      deployment: 'daclifycore',
      dao_id: 1,
      member_id: 1,
      nonce: 0,
      expires: Number(chain.timestamp.toMilliseconds()) / 1000 + 300,
      target: 'works',
      action: 'propose',
      data,
    };
    const digest = Checksum256.hash(
      Serializer.encode({ abi, type: 'instruction', object: request }),
    );
    await expect(
      send(runtime, 'submit', [request, signer.signDigest(digest).toString()], 'alice@active'),
    ).rejects.toThrow('MODULE_CODE');
  });
  it('rejects a direct governance lock and accepts the module contract', async () => {
    await expect(send(runtime, 'govlock', [1, 'works', 1, 500], 'works@active')).rejects.toThrow(
      'SOURCE_SENDER',
    );
    await send(works, 'govlock', ['daclifycore', 1, 1, 500], 'works@active');
    expect(
      z.object({ active_ballots: z.number() }).parse(row(runtime, 'daos', runtime.toBigInt(), 1n))
        .active_ballots,
    ).toBe(1);
  });
});
