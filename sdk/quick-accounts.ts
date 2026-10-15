import {
  ABI,
  Bytes,
  Checksum160,
  Checksum256,
  Name,
  PermissionLevel,
  PublicKey,
  Serializer,
  UInt8,
  UInt64,
} from '@wharfkit/antelope';
import { QuickAccountAnchorSchema, QuickAccountDomainSchema } from '../protocol/quick-accounts.js';
import { quickauthAbi, type QuickauthActions } from './generated/quickauth.js';
import { QuickauthActionSchemas } from './generated/quickauth-schemas.js';
export { quickauthAbi as quickAuthAbi } from './generated/quickauth.js';
export {
  QuickauthActionSchemas as QuickAuthActionSchemas,
  QuickauthTableSchemas as QuickAuthTableSchemas,
} from './generated/quickauth-schemas.js';
export { QuickAuthCodeHash, QuickAuthRawAbiHash } from './generated/quickauth-release.js';
export type QuickAuthActions = QuickauthActions;

const requestTypes = {
  qregister: 'quick_registration',
  qdefault: 'quick_default',
  qsubmit: 'quick_instruction',
  qdeactivate: 'quick_control',
} as const;
export function quickAccountDigest<K extends keyof typeof requestTypes>(
  action: K,
  request: QuickauthActions[K]['request'],
): Checksum256 {
  const parsed = QuickauthActionSchemas[action].shape.request.parse(request);
  const tag = Serializer.encode({
    object: `daclify.quick-account.${action}.v1`,
    type: 'string',
  }).array;
  const data = Serializer.encode({
    abi: ABI.from(quickauthAbi),
    type: requestTypes[action],
    object: parsed,
  }).array;
  const bytes = new Uint8Array(tag.length + data.length);
  bytes.set(tag);
  bytes.set(data, tag.length);
  return Checksum256.hash(bytes);
}
export function encodeQuickAuth<K extends keyof QuickauthActions>(
  action: K,
  value: QuickauthActions[K],
): Uint8Array {
  return Serializer.encode({
    abi: ABI.from(quickauthAbi),
    type: action,
    object: QuickauthActionSchemas[action].parse(value),
  }).array;
}

export function encodeQuickAnchor(value: unknown): { kind: number; credential: string } {
  const anchor = QuickAccountAnchorSchema.parse(value);
  if (anchor.kind === 'key')
    return {
      kind: 0,
      credential: Serializer.encode({ object: PublicKey.from(anchor.publicKey) }).hexString,
    };
  if (anchor.kind === 'native')
    return {
      kind: 1,
      credential: Serializer.encode({
        object: PermissionLevel.from({ actor: anchor.account, permission: anchor.permission }),
      }).hexString,
    };
  return {
    kind: 2,
    credential:
      Serializer.encode({ object: UInt64.from(anchor.chainId) }).hexString +
      Checksum160.from(anchor.address.slice(2)).toString(),
  };
}

export function quickAccountIdentity(chainId: string, runtime: string, value: unknown): string {
  QuickAccountDomainSchema.parse({ chainId, runtime });
  const anchor = encodeQuickAnchor(value);
  const parts = [
    Serializer.encode({ object: 'daclify.quick-account.v1', type: 'string' }).array,
    Checksum256.from(chainId).array,
    Serializer.encode({ object: Name.from(runtime) }).array,
    Serializer.encode({ object: UInt8.from(anchor.kind) }).array,
    Serializer.encode({ object: Bytes.from(anchor.credential) }).array,
  ];
  const input = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    input.set(part, offset);
    offset += part.length;
  }
  return Checksum256.hash(input).toString();
}
