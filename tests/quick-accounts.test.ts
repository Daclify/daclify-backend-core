import { describe, expect, it } from 'vitest';
import { Bytes, Checksum256, Name, PrivateKey, Serializer, UInt8 } from '@wharfkit/antelope';
import { QuickAccountAnchorSchema } from '../protocol/quick-accounts.js';
import {
  encodeQuickAnchor,
  quickAccountIdentity,
  quickAccountDigest,
} from '../sdk/quick-accounts.js';
import { quickAccountTypedData, evmTypedDigest } from '../sdk/evm.js';
import { hashTypedData } from 'viem';

const chainId = '11'.repeat(32);
const runtime = 'daclifycore1';

describe('canonical Quick ballot account anchors', () => {
  it('binds registration signatures to both authorities, expiry and the exact anchor', () => {
    const request = {
      version: 1,
      chain_id: chainId,
      runtime,
      authority: 'quickauth',
      anchor: encodeQuickAnchor({ kind: 'native', account: 'alice', permission: 'active' }),
      account_id: '0',
      epoch: '0',
      expires: 1234,
    };
    const original = quickAccountDigest('qregister', request).toString();
    for (const change of [
      { authority: 'otherauth' },
      { runtime: 'othercore' },
      { expires: 1235 },
      { epoch: '1' },
      { chain_id: '22'.repeat(32) },
    ])
      expect(quickAccountDigest('qregister', { ...request, ...change }).toString()).not.toBe(
        original,
      );
  });
  it('matches an independent EIP-712 digest without inventing a DAO membership', () => {
    const typed = quickAccountTypedData({ chainId, runtime }, 41, '33'.repeat(32));
    expect(typed.primaryType).toBe('QuickAccount');
    expect(typed.message).toEqual({ operation: '0x' + '33'.repeat(32) });
    const independent = hashTypedData({
      types: { QuickAccount: [{ name: 'operation', type: 'bytes32' }] },
      primaryType: 'QuickAccount',
      domain: typed.domain,
      message: typed.message,
    });
    expect(Bytes.from(evmTypedDigest(typed)).hexString).toBe(independent.slice(2));
    expect(
      evmTypedDigest(quickAccountTypedData({ chainId, runtime }, 40, '33'.repeat(32))),
    ).not.toEqual(evmTypedDigest(typed));
    expect(() => quickAccountTypedData({ chainId, runtime }, 41, 'not-a-digest')).toThrow();
  });
  it('matches an independently assembled native identity transcript', () => {
    const anchor = { kind: 'native', account: 'alice', permission: 'active' };
    const packedAnchor = '0000000000855c3400000000a8ed3232';
    expect(encodeQuickAnchor(anchor)).toEqual({ kind: 1, credential: packedAnchor });
    const parts = [
      Serializer.encode({ object: 'daclify.quick-account.v1', type: 'string' }).array,
      Checksum256.from(chainId).array,
      Serializer.encode({ object: Name.from(runtime) }).array,
      Serializer.encode({ object: UInt8.from(1) }).array,
      Serializer.encode({ object: Bytes.from(packedAnchor) }).array,
    ];
    const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    expect(quickAccountIdentity(chainId, runtime, anchor)).toBe(Checksum256.hash(bytes).toString());
  });

  it('binds identity to the actual root, chain and runtime', () => {
    const anchor = { kind: 'key', publicKey: PrivateKey.generate('K1').toPublic().toString() };
    const identity = quickAccountIdentity(chainId, runtime, anchor);
    expect(encodeQuickAnchor(anchor).credential).toHaveLength(68);
    expect(quickAccountIdentity('22'.repeat(32), runtime, anchor)).not.toBe(identity);
    expect(quickAccountIdentity(chainId, 'anothercore', anchor)).not.toBe(identity);
    expect(
      quickAccountIdentity(chainId, runtime, {
        kind: 'native',
        account: 'alice',
        permission: 'active',
      }),
    ).not.toBe(identity);
    expect(() => quickAccountIdentity('bad', runtime, anchor)).toThrow();
  });

  it('normalizes EVM spelling while retaining the chain namespace', () => {
    const upper = { kind: 'evm', chainId: 41, address: '0x' + 'AB'.repeat(20) };
    const lower = { ...upper, address: upper.address.toLowerCase() };
    expect(QuickAccountAnchorSchema.parse(upper)).toEqual(lower);
    expect(encodeQuickAnchor(lower)).toEqual({
      kind: 2,
      credential: '2900000000000000' + 'ab'.repeat(20),
    });
    expect(quickAccountIdentity(chainId, runtime, upper)).toBe(
      quickAccountIdentity(chainId, runtime, lower),
    );
    expect(quickAccountIdentity(chainId, runtime, { ...lower, chainId: 40 })).not.toBe(
      quickAccountIdentity(chainId, runtime, lower),
    );
  });

  it('rejects noncanonical anchors and unrelated account fields', () => {
    for (const value of [
      { kind: 'native', account: 'alice.', permission: 'active' },
      { kind: 'native', account: 'alice', permission: 'owner' },
      { kind: 'native', account: 'alice', permission: 'active', accountId: 'untrusted-uuid' },
      { kind: 'evm', chainId: 1, address: '0x' + 'ab'.repeat(20) },
      { kind: 'key', publicKey: PrivateKey.generate('R1').toPublic().toString() },
      { kind: 'key', publicKey: 'not-a-key' },
    ])
      expect(QuickAccountAnchorSchema.safeParse(value).success).toBe(false);
  });
});
