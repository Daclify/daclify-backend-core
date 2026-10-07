import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { describe, expect, it } from 'vitest';
import {
  checksumAddress,
  linkMessage,
  personalDigest,
  recoverEvmAddress,
} from '../services/api/src/auth/evm-proof.js';

function sign(message: string, secret: Uint8Array): string {
  const signature = secp256k1.sign(personalDigest(message), secret, {
    prehash: false,
    format: 'recovered',
  });
  const eth = new Uint8Array(65);
  eth.set(signature.subarray(1), 0);
  eth[64] = (signature[0] ?? 0) + 27;
  return `0x${Buffer.from(eth).toString('hex')}`;
}

function addressOf(secret: Uint8Array): string {
  const encoded = secp256k1.getPublicKey(secret, false);
  const hash = keccak_256(encoded.subarray(1));
  return `0x${Buffer.from(hash.subarray(12)).toString('hex')}`;
}

describe('Telos EVM personal signatures', () => {
  it('recovers the address that signed the link message', () => {
    const secret = secp256k1.utils.randomSecretKey();
    const message = linkMessage(
      '4f3b1a0e-6c2d-4b7e-9a11-0d5e8c7b6a54',
      40,
      'nonce-value-0123456789',
    );
    const recovered = recoverEvmAddress(message, sign(message, secret));
    expect(recovered).toBe(addressOf(secret));
    expect(checksumAddress(recovered)).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('rejects a signature for a different message', () => {
    const secret = secp256k1.utils.randomSecretKey();
    const signed = linkMessage(
      '4f3b1a0e-6c2d-4b7e-9a11-0d5e8c7b6a54',
      41,
      'nonce-value-0123456789',
    );
    expect(recoverEvmAddress('different message', sign(signed, secret))).not.toBe(
      addressOf(secret),
    );
    expect(() => recoverEvmAddress(signed, '0x1234')).toThrow('EVM_SIGNATURE_INVALID');
  });
});
