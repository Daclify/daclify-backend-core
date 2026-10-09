import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { ABI, Serializer } from '@wharfkit/antelope';
import { validateTokenSnapshot } from '../tools/qualification/telos-token-snapshot.js';
const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const rawAbi = Serializer.encode({
  object: ABI.from({ version: 'eosio::abi/1.2', structs: [], actions: [] }),
}).array;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pin = { chainId: 'ab'.repeat(32), codeHash: hash(wasm), rawAbiHash: hash(rawAbi) };
const snapshot = {
  beforeChainId: pin.chainId,
  afterChainId: pin.chainId,
  beforeCodeHash: pin.codeHash,
  afterCodeHash: pin.codeHash,
  wasm,
  rawAbi,
};
it('decodes only the bytes bound to the recorded chain/code/raw-ABI identity', () => {
  expect(validateTokenSnapshot(pin, snapshot).version).toBe('eosio::abi/1.2');
});
it.each(['beforeChainId', 'afterChainId', 'beforeCodeHash', 'afterCodeHash'] as const)(
  'rejects a changed %s without approving the snapshot',
  (field) => {
    expect(() => validateTokenSnapshot(pin, { ...snapshot, [field]: 'cd'.repeat(32) })).toThrow(
      'TELOS_TOKEN_SNAPSHOT_CHANGED',
    );
  },
);
it('rejects altered code/ABI, a non-WASM payload and malformed ABI bytes even if the caller hashes them', () => {
  expect(() =>
    validateTokenSnapshot(pin, { ...snapshot, wasm: new Uint8Array([...wasm, 0]) }),
  ).toThrow('TELOS_TOKEN_SNAPSHOT_CHANGED');
  expect(() =>
    validateTokenSnapshot(pin, { ...snapshot, rawAbi: new Uint8Array([...rawAbi, 0]) }),
  ).toThrow('TELOS_TOKEN_SNAPSHOT_CHANGED');
  const invalid = new Uint8Array([1, 2, 3, 4]);
  const changed = { ...pin, codeHash: hash(invalid), rawAbiHash: hash(invalid) };
  expect(() =>
    validateTokenSnapshot(changed, {
      ...snapshot,
      beforeCodeHash: changed.codeHash,
      afterCodeHash: changed.codeHash,
      wasm: invalid,
      rawAbi: invalid,
    }),
  ).toThrow('TELOS_TOKEN_SNAPSHOT_CHANGED');
  expect(() =>
    validateTokenSnapshot({ ...pin, rawAbiHash: hash(invalid) }, { ...snapshot, rawAbi: invalid }),
  ).toThrow();
});
