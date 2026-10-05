import { ABI, Serializer, Checksum256 } from '@wharfkit/antelope';
import {
  type DaoRef,
  DaoRefSchema,
  IdSchema,
  Uint64Schema,
  NativeAccountSchema,
} from '../protocol/index.js';
import { runtimeAbi, type RuntimeActions, type instruction } from './generated/runtime.js';
export { runtimeAbi, runtimeAbiHash } from './generated/runtime.js';
export type { RuntimeActions, instruction } from './generated/runtime.js';
export { RuntimeActionSchemas, RuntimeTableSchemas } from './generated/schemas.js';
const abi = ABI.from(runtimeAbi);
export function encodeAction<K extends keyof RuntimeActions>(
  name: K,
  args: RuntimeActions[K],
): Uint8Array {
  return Serializer.encode({ abi, type: name, object: args }).array;
}
export function instructionDigest(request: instruction): Checksum256 {
  return Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request }));
}
export function makeInstruction(
  domain: DaoRef,
  member: string,
  nonce: string,
  expires: number,
  target: string,
  action: string,
  data: Uint8Array,
): instruction {
  DaoRefSchema.parse(domain);
  IdSchema.parse(member);
  Uint64Schema.parse(nonce);
  NativeAccountSchema.parse(target);
  NativeAccountSchema.parse(action);
  if (!Number.isInteger(expires) || expires < 0 || expires > 0xffffffff)
    throw new Error('Invalid expiry');
  return {
    version: domain.interfaceVersion,
    chain_id: domain.chainId,
    deployment: domain.contract,
    dao_id: domain.daoId,
    member_id: member,
    nonce,
    expires,
    target,
    action,
    data: Array.from(data, (byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
}
