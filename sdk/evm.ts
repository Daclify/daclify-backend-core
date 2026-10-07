import { Checksum256, Name } from '@wharfkit/antelope';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { z } from 'zod';
import { DaoRefSchema, Uint64Schema, type DaoRef } from '../protocol/base.js';
import { EvmAddressSchema, TelosEvmChainSchema } from '../protocol/evm-wallet.js';
import { RuntimeActionSchemas } from './generated/schemas.js';
import type { instruction } from './generated/runtime.js';
const BindingSchema = z.strictObject({
  chainId: TelosEvmChainSchema,
  address: EvmAddressSchema,
  epoch: Uint64Schema,
});
export type EvmBinding = z.infer<typeof BindingSchema>;
interface Field {
  name: string;
  type: string;
}
const domainFields: Field[] = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'salt', type: 'bytes32' },
];
const bindingFields: Field[] = [
  { name: 'nativeChain', type: 'bytes32' },
  { name: 'runtime', type: 'uint64' },
  { name: 'daoId', type: 'uint64' },
  { name: 'memberId', type: 'uint64' },
  { name: 'evmChainId', type: 'uint64' },
  { name: 'wallet', type: 'address' },
  { name: 'epoch', type: 'uint64' },
  { name: 'nonce', type: 'uint64' },
  { name: 'expires', type: 'uint32' },
  { name: 'signatureVersion', type: 'uint16' },
];
const instructionFields: Field[] = [
  { name: 'version', type: 'uint16' },
  ...bindingFields.slice(0, 6),
  { name: 'bindingEpoch', type: 'uint64' },
  ...bindingFields.slice(7, 9),
  { name: 'target', type: 'uint64' },
  { name: 'action', type: 'uint64' },
  { name: 'dataHash', type: 'bytes32' },
  { name: 'signatureVersion', type: 'uint16' },
];
const unhex = (value: string) =>
  Uint8Array.from(value.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16));
const hex = (value: Uint8Array): `0x${string}` =>
  `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
function uintWord(value: string | number, bits = 256): Uint8Array {
  const amount = BigInt(value);
  if (amount < 0n || amount >= 1n << BigInt(bits)) throw new Error('EVM_INTEGER_RANGE');
  return unhex(amount.toString(16).padStart(64, '0'));
}
function join(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function domain(native: DaoRef, chain: number) {
  DaoRefSchema.parse(native);
  TelosEvmChainSchema.parse(chain);
  const salt = hex(
    keccak_256(
      join([unhex(native.chainId), uintWord(Name.from(native.contract).value.toString(), 64)]),
    ),
  );
  return { name: 'Daclify', version: '1', chainId: chain, salt };
}
function common(
  native: DaoRef,
  member: string,
  binding: EvmBinding,
  nonce: string,
  expires: number,
) {
  const parsed = BindingSchema.parse(binding);
  Uint64Schema.parse(member);
  Uint64Schema.parse(nonce);
  z.int().min(0).max(0xffffffff).parse(expires);
  return {
    nativeChain: `0x${native.chainId}`,
    runtime: Name.from(native.contract).value.toString(),
    daoId: native.daoId,
    memberId: member,
    evmChainId: parsed.chainId,
    wallet: parsed.address,
    nonce,
    expires,
    signatureVersion: 1,
  };
}
export function bindingTypedData(
  native: DaoRef,
  member: string,
  binding: EvmBinding,
  nonce: string,
  expires: number,
) {
  return {
    domain: domain(native, binding.chainId),
    types: { EIP712Domain: domainFields, DaclifyBinding: bindingFields },
    primaryType: 'DaclifyBinding' as const,
    message: { ...common(native, member, binding, nonce, expires), epoch: binding.epoch },
  };
}
export function governanceTypedData(input: instruction, binding: EvmBinding) {
  const request = RuntimeActionSchemas.submit.shape.request.parse(input);
  const native = DaoRefSchema.parse({
    chainId: request.chain_id,
    contract: request.deployment,
    daoId: request.dao_id,
    interfaceVersion: request.version,
  });
  return {
    domain: domain(native, binding.chainId),
    types: { EIP712Domain: domainFields, DaclifyInstruction: instructionFields },
    primaryType: 'DaclifyInstruction' as const,
    message: {
      ...common(native, request.member_id, binding, request.nonce, request.expires),
      version: request.version,
      bindingEpoch: binding.epoch,
      target: Name.from(request.target).value.toString(),
      action: Name.from(request.action).value.toString(),
      dataHash: `0x${Checksum256.hash(unhex(request.data))}`,
    },
  };
}
function hashStruct(
  name: string,
  fields: Field[],
  message: Record<string, string | number>,
): Uint8Array {
  const type = keccak_256(
    new TextEncoder().encode(
      `${name}(${fields.map((field) => `${field.type} ${field.name}`).join(',')})`,
    ),
  );
  return keccak_256(
    join([
      type,
      ...fields.map((field) => {
        const value = message[field.name];
        if (value === undefined) throw new Error('EVM_FIELD_MISSING');
        if (field.type === 'string') return keccak_256(new TextEncoder().encode(String(value)));
        if (field.type === 'bytes32') {
          const text = z
            .string()
            .regex(/^0x[0-9a-f]{64}$/)
            .parse(value);
          return unhex(text.slice(2));
        }
        if (field.type === 'address') {
          const address = EvmAddressSchema.parse(value);
          return unhex(address.slice(2).toLowerCase().padStart(64, '0'));
        }
        if (/^uint(16|32|64|256)$/.test(field.type))
          return uintWord(value, Number(field.type.slice(4)));
        throw new Error('EVM_FIELD_TYPE');
      }),
    ]),
  );
}
export function evmTypedDigest(
  data: ReturnType<typeof bindingTypedData> | ReturnType<typeof governanceTypedData>,
): Uint8Array {
  const fields = data.primaryType === 'DaclifyBinding' ? bindingFields : instructionFields;
  return keccak_256(
    join([
      new Uint8Array([0x19, 0x01]),
      hashStruct('EIP712Domain', domainFields, data.domain),
      hashStruct(data.primaryType, fields, data.message),
    ]),
  );
}
export function canonicalEvmSignature(signature: string): string {
  const bytes = unhex(
    z
      .string()
      .regex(/^0x[0-9a-fA-F]{130}$/)
      .parse(signature)
      .slice(2),
  );
  const parity = bytes[64];
  if (parity !== 0 && parity !== 1 && parity !== 27 && parity !== 28)
    throw new Error('EVM_SIGNATURE_INVALID');
  bytes[64] = parity < 27 ? parity + 27 : parity;
  const s = BigInt(hex(bytes.subarray(32, 64)));
  if (s === 0n || s > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n)
    throw new Error('EVM_SIGNATURE_CANONICAL');
  return hex(bytes);
}
