import { describe, expect, it } from 'vitest';
import { PrivateKey, Signature } from '@wharfkit/antelope';
import { DaoRefSchema } from '../protocol/index.js';
import { encodeAction, instructionDigest, makeInstruction, runtimeAbiHash } from '../sdk/index.js';
const key = PrivateKey.generate('K1');
const domain = DaoRefSchema.parse({
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
});
describe('ABI-produced signing SDK', () => {
  it('encodes the exact setmeta actor prefix and payload', () => {
    const bytes = encodeAction('setmeta', {
      runtime: 'daclifycore',
      dao_id: '1',
      member_id: '2',
      metadata: '{}',
    });
    expect(bytes.length).toBe(27);
  });
  it('binds every replay-domain dimension', () => {
    const request = makeInstruction(
      domain,
      '2',
      '0',
      300,
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        runtime: 'daclifycore',
        dao_id: '1',
        member_id: '2',
        metadata: '{}',
      }),
    );
    const hash = instructionDigest(request);
    const signature = key.signDigest(hash);
    expect(Signature.from(signature).recoverDigest(hash).equals(key.toPublic())).toBe(true);
    for (const changed of [
      { dao_id: '2' },
      { member_id: '3' },
      { nonce: '1' },
      { chain_id: 'cd'.repeat(32) },
      { deployment: 'other' },
      { expires: 301 },
      { target: 'other' },
      { action: 'other' },
      { data: '00' },
    ])
      expect(instructionDigest({ ...request, ...changed }).equals(hash)).toBe(false);
  });
  it('exposes the exact compiled ABI commitment', () =>
    expect(runtimeAbiHash).toMatch(/^[0-9a-f]{64}$/));
  it('rejects an unsafe nonce before signing', () =>
    expect(() =>
      makeInstruction(domain, '2', '01', 300, 'daclifycore', 'setmeta', new Uint8Array()),
    ).toThrow());
});
