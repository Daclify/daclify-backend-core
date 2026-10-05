import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { p256 } from '@noble/curves/nist.js';
import { canonicalR1 } from '../services/custody/openbao.js';
const order = p256.Point.CURVE().n;
function scalar(value: bigint): Uint8Array {
  return Uint8Array.from(Buffer.from(value.toString(16).padStart(64, '0'), 'hex'));
}
function signature(s: bigint): Uint8Array {
  return Uint8Array.from([...scalar(1n), ...scalar(s)]);
}
function sValue(value: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(value.subarray(32)).toString('hex')}`);
}
describe('Antelope R1 canonical signature boundary', () => {
  it('normalizes an OpenBao high S signature rejected by Spring', () =>
    expect(sValue(canonicalR1(signature(order - 1n)))).toBe(1n));
  it('preserves an already low S value', () =>
    expect(sValue(canonicalR1(signature(42n)))).toBe(42n));
  it.each([0n, order])('rejects invalid s scalar %s', (s) =>
    expect(() => canonicalR1(signature(s))).toThrow('CUSTODY_UNAVAILABLE'),
  );
  it('rejects a malformed compact signature', () =>
    expect(() => canonicalR1(new Uint8Array(65))).toThrow('CUSTODY_UNAVAILABLE'));
  it('always emits native-compatible S without changing R', () =>
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: order - 1n }), (s) => {
        const value = canonicalR1(signature(s));
        return (
          sValue(value) > 0n &&
          sValue(value) <= order / 2n &&
          Buffer.from(value.subarray(0, 32)).equals(Buffer.from(scalar(1n)))
        );
      }),
      { numRuns: 400, seed: 20261005 },
    ));
});
