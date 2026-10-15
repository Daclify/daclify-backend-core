import {
  ABI,
  Action,
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
import {
  QuickAccountAnchorSchema,
  QuickAccountDomainSchema,
  QuickAccountContextSchema,
  QuickAccountIntentSchema,
  QuickAccountRequestSchema,
  QuickAccountPreparedSchema,
  QuickAccountProofsSchema,
  type QuickAccountContext,
  type QuickAccountIntent,
} from '../protocol/quick-accounts.js';
import { QuickAuthCodeHash } from './generated/quickauth-release.js';
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

export function decodeQuickAnchor(value: { kind: number; credential: string }) {
  let anchor: ReturnType<typeof QuickAccountAnchorSchema.parse>;
  if (value.kind === 3 && value.credential === '') return null;
  if (value.kind === 0)
    anchor = QuickAccountAnchorSchema.parse({
      kind: 'key',
      publicKey: Serializer.decode({ type: PublicKey, data: value.credential }).toString(),
    });
  else if (value.kind === 1) {
    const permission = Serializer.decode({ type: PermissionLevel, data: value.credential });
    anchor = QuickAccountAnchorSchema.parse({
      kind: 'native',
      account: permission.actor.toString(),
      permission: permission.permission.toString(),
    });
  } else if (value.kind === 2)
    anchor = QuickAccountAnchorSchema.parse({
      kind: 'evm',
      chainId: Number(
        Serializer.decode({ type: UInt64, data: value.credential.slice(0, 16) }).toString(),
      ),
      address: '0x' + value.credential.slice(16),
    });
  else throw new Error('QUICK_ANCHOR');
  const canonical = encodeQuickAnchor(anchor);
  if (canonical.kind !== value.kind || canonical.credential !== value.credential)
    throw new Error('QUICK_ANCHOR');
  return anchor;
}

function checkedContext(value: unknown): QuickAccountContext {
  const context = QuickAccountContextSchema.parse(value);
  if (context.authorityCodeHash !== QuickAuthCodeHash) throw new Error('QUICK_AUTH_CODE');
  if (
    quickAccountIdentity(context.chainId, context.runtime, context.anchor) !== context.identity ||
    (context.record && context.record.identity !== context.identity)
  )
    throw new Error('QUICK_IDENTITY');
  return context;
}
export function quickAccountRequest(value: unknown, operation: unknown, expires: number) {
  const context = checkedContext(value),
    intent = QuickAccountIntentSchema.parse(operation),
    record = context.record;
  const domain = {
    version: 1,
    chain_id: context.chainId,
    runtime: context.runtime,
    authority: context.authority,
    anchor: encodeQuickAnchor(context.anchor),
    account_id: record?.id ?? '0',
    epoch: record?.epoch ?? '0',
    expires,
  };
  if (intent.operation === 'register') {
    if (record?.active) throw new Error('QUICK_ACCOUNT_EXISTS');
    return QuickAccountRequestSchema.parse({ action: 'qregister', request: domain });
  }
  if (!record?.active) throw new Error('QUICK_ACCOUNT_INACTIVE');
  const control = {
    ...domain,
    nonce: record.nonce,
    use_default: 'useDefault' in intent ? intent.useDefault : false,
  };
  if (control.use_default && !decodeQuickAnchor(record.approval))
    throw new Error('QUICK_APPROVAL_REQUIRED');
  if (intent.operation === 'default')
    return QuickAccountRequestSchema.parse({
      action: 'qdefault',
      request: {
        control,
        method: intent.method ? encodeQuickAnchor(intent.method) : { kind: 3, credential: '' },
      },
    });
  if (intent.operation === 'deactivate')
    return QuickAccountRequestSchema.parse({ action: 'qdeactivate', request: control });
  return QuickAccountRequestSchema.parse({
    action: 'qsubmit',
    request: {
      control,
      target: context.source,
      action: intent.action,
      code_hash: context.sourceCodeHash,
      data: intent.data,
    },
  });
}
export function validateQuickPreparation(
  value: unknown,
  state: unknown,
  operation: QuickAccountIntent,
) {
  const prepared = QuickAccountPreparedSchema.parse(value),
    expectedContext = checkedContext(state),
    now = Math.floor(Date.now() / 1000);
  const { frozen: _frozen, ...actual } = checkedContext(prepared.context),
    { frozen: _expectedFrozen, ...expected } = expectedContext;
  const expires = Date.parse(prepared.expiresAt) / 1000;
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + 300)
    throw new Error('QUICK_PREPARATION');
  const packet = quickAccountRequest(expectedContext, operation, expires);
  if (
    JSON.stringify(actual) !== JSON.stringify(expected) ||
    JSON.stringify({ action: prepared.action, request: prepared.request }) !==
      JSON.stringify(packet)
  )
    throw new Error('QUICK_PREPARATION');
  return prepared;
}
export function quickAccountAction(value: unknown, proofValues: unknown): Action {
  const prepared = QuickAccountPreparedSchema.parse(value),
    context = checkedContext(prepared.context),
    proofs = QuickAccountProofsSchema.parse(proofValues);
  const control =
    prepared.action === 'qregister' || prepared.action === 'qdeactivate'
      ? prepared.request
      : prepared.request.control;
  const anchor =
    prepared.action !== 'qregister' && 'use_default' in control && control.use_default
      ? context.record?.approval
      : control.anchor;
  if (!anchor) throw new Error('QUICK_APPROVAL_REQUIRED');
  const primary = decodeQuickAnchor(anchor);
  if (
    !primary ||
    proofs.proof.length !== (primary.kind === 'key' ? 132 : primary.kind === 'evm' ? 130 : 0)
  )
    throw new Error('QUICK_PROOF');
  const incoming =
    prepared.action === 'qdefault' ? decodeQuickAnchor(prepared.request.method) : null;
  if (proofs.incoming.length !== (incoming?.kind === 'evm' ? 130 : 0))
    throw new Error('QUICK_PROOF');
  const authorization = [
    context.gateway,
    ...[primary, incoming].flatMap((method) =>
      method?.kind === 'native' ? [{ actor: method.account, permission: method.permission }] : [],
    ),
  ];
  const unique = [
    ...new Map(
      authorization.map((permission) => [
        permission.actor + '@' + permission.permission,
        permission,
      ]),
    ).values(),
  ];
  const data =
    prepared.action === 'qregister'
      ? encodeQuickAuth('qregister', { request: prepared.request, proof: proofs.proof })
      : prepared.action === 'qdefault'
        ? encodeQuickAuth('qdefault', { request: prepared.request, ...proofs })
        : prepared.action === 'qsubmit'
          ? encodeQuickAuth('qsubmit', { request: prepared.request, proof: proofs.proof })
          : encodeQuickAuth('qdeactivate', { request: prepared.request, proof: proofs.proof });
  return Action.from({
    account: context.authority,
    name: prepared.action,
    authorization: unique,
    data,
  });
}
