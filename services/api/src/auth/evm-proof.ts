import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

export const TELOS_EVM_CHAIN_IDS = [40, 41] as const;
export type TelosEvmChainId = (typeof TELOS_EVM_CHAIN_IDS)[number];

export function isTelosEvmChain(value: number): value is TelosEvmChainId {
  return value === 40 || value === 41;
}

export function personalDigest(message: string): Uint8Array {
  const body = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\u0019Ethereum Signed Message:\n${body.length}`);
  const joined = new Uint8Array(prefix.length + body.length);
  joined.set(prefix, 0);
  joined.set(body, prefix.length);
  return keccak_256(joined);
}

export function checksumAddress(address: string): string {
  const hex = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(hex)) throw new Error('EVM_ADDRESS_INVALID');
  const body = hex.slice(2);
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(body))).toString('hex');
  let out = '0x';
  for (let index = 0; index < body.length; index += 1) {
    const symbol = body[index];
    const nibble = hash[index];
    if (symbol === undefined || nibble === undefined) throw new Error('EVM_ADDRESS_INVALID');
    out += Number.parseInt(nibble, 16) >= 8 ? symbol.toUpperCase() : symbol;
  }
  return out;
}

function reject(): never {
  throw new Error('EVM_SIGNATURE_INVALID');
}

// Ethereum personal_sign uses recovery id 0/1 or 27/28. It is not an Antelope signature.
export function recoverEvmAddress(message: string, signature: string): string {
  return recoverEvmDigest(personalDigest(message), signature);
}
export function recoverEvmDigest(digest: Uint8Array, signature: string): string {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) reject();
  const eth = Buffer.from(signature.slice(2), 'hex');
  const parity = eth[64];
  if (parity === undefined) reject();
  const recovery = parity >= 27 ? parity - 27 : parity;
  if (recovery !== 0 && recovery !== 1) reject();
  // noble's recovered form is recovery || r || s. Ethereum personal_sign is r || s || v.
  const noble = new Uint8Array(65);
  noble[0] = recovery;
  noble.set(eth.subarray(0, 64), 1);
  try {
    const point = secp256k1.Signature.fromBytes(noble, 'recovered').recoverPublicKey(digest);
    const encoded = point.toBytes(false);
    if (encoded.length !== 65 || encoded[0] !== 0x04) reject();
    const hash = keccak_256(encoded.subarray(1));
    return `0x${Buffer.from(hash.subarray(12)).toString('hex')}`;
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'EVM_SIGNATURE_INVALID') throw cause;
    reject();
  }
}

export function linkMessage(accountId: string, chainId: TelosEvmChainId, nonce: string): string {
  const network = chainId === 40 ? 'Telos EVM' : 'Telos EVM Testnet';
  return `Link this Telos EVM address to Daclify account ${accountId}.\nChain: ${chainId} (${network})\nNonce: ${nonce}`;
}
