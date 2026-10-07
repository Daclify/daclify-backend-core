import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { p256 } from '@noble/curves/nist.js';
import { canonicalR1, OpenBaoCustody } from '../services/custody/openbao.js';
import { createServer } from 'node:http';
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
  it('never forwards the custody token to a redirected endpoint', async () => {
    let redirectedRequests = 0;
    const destination = createServer((_request, response) => {
      redirectedRequests++;
      response.writeHead(503).end();
    });
    await new Promise<void>((resolve) => destination.listen(0, '127.0.0.1', resolve));
    const target = destination.address();
    if (!target || typeof target === 'string') throw new Error('LOOPBACK_FIXTURE_INVALID');
    const source = createServer((_request, response) => {
      response.writeHead(307, { location: `http://127.0.0.1:${target.port}/redirected` }).end();
    });
    await new Promise<void>((resolve) => source.listen(0, '127.0.0.1', resolve));
    try {
      const origin = source.address();
      if (!origin || typeof origin === 'string') throw new Error('LOOPBACK_FIXTURE_INVALID');
      const custody = new OpenBaoCustody(
        `http://127.0.0.1:${origin.port}`,
        'disposable-fixture-token',
      );
      await expect(custody.createSigner('redirect-test')).rejects.toThrow('CUSTODY_UNAVAILABLE');
      expect(redirectedRequests).toBe(0);
    } finally {
      await Promise.all(
        [source, destination].map(
          (server) =>
            new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            ),
        ),
      );
    }
  });
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
