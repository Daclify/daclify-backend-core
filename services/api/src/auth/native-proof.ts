import { createHash } from 'node:crypto';
import {
  Action,
  Authority,
  APIClient,
  Serializer,
  Signature,
  Transaction,
} from '@wharfkit/antelope';
import { NativeProofSchema, type NativeIdentity } from '../../../../protocol/native-wallet.js';
import { runtimeAbi, encodeAction } from '../../../../sdk/index.js';
import { ApiError } from '../errors.js';

export function checkNativeProof(
  input: unknown,
  identity: NativeIdentity,
  runtime: string,
  message: string,
  expires: Date,
  authority: Authority,
  now = Date.now(),
): void {
  try {
    const proof = NativeProofSchema.parse(input);
    const bytes = Buffer.from(proof.packedTransaction, 'hex');
    const transaction = Serializer.decode({ data: bytes, type: Transaction });
    if (
      Serializer.encode({ object: transaction }).hexString !== proof.packedTransaction ||
      transaction.context_free_actions.length ||
      transaction.transaction_extensions.length ||
      transaction.actions.length !== 1 ||
      Number(transaction.delay_sec) !== 0 ||
      transaction.expiration.toMilliseconds() <= now ||
      transaction.expiration.toMilliseconds() > expires.getTime()
    )
      throw new Error('Wrong transaction');
    const expected = Action.from(
      {
        account: runtime,
        name: 'authproof',
        authorization: [{ actor: identity.account, permission: identity.permission }],
        data: encodeAction('authproof', {
          account: identity.account,
          intent: createHash('sha256').update(message).digest('hex'),
        }),
      },
      runtimeAbi,
    );
    if (!transaction.actions[0]?.equals(expected)) throw new Error('Wrong intent');
    // Explicitly qualify direct-key authority only; delegated accounts/waits need chain evaluation.
    if (
      authority.accounts.length ||
      authority.waits.length ||
      Number(authority.threshold) < 1 ||
      authority.keys.length > 32
    )
      throw new ApiError('NATIVE_AUTHORITY_UNSUPPORTED', 409);
    const unique = new Set<string>();
    let weight = 0;
    for (const text of proof.signatures) {
      const key = Signature.from(text).recoverDigest(transaction.signingDigest(identity.chainId));
      const canonical = key.toString();
      if (unique.has(canonical)) throw new Error('Duplicate key');
      unique.add(canonical);
      weight += authority.keyWeight(key);
    }
    if (weight < Number(authority.threshold)) throw new Error('Insufficient authority');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('NATIVE_PROOF_INVALID', 401);
  }
}
export async function verifyNativeProof(
  input: unknown,
  identity: NativeIdentity,
  runtime: string,
  message: string,
  expires: Date,
  rpc: APIClient,
): Promise<void> {
  let authority: Authority;
  try {
    const info = await rpc.v1.chain.get_info();
    if (info.chain_id.toString() !== identity.chainId) throw new Error('Chain mismatch');
    const account = await rpc.v1.chain.get_account(identity.account);
    const permission = account.permissions.find(
      (item) => item.perm_name.toString() === identity.permission,
    );
    if (!permission) throw new Error('Permission absent');
    authority = permission.required_auth;
  } catch {
    throw new ApiError('NATIVE_AUTHORITY_UNAVAILABLE', 503);
  }
  checkNativeProof(input, identity, runtime, message, expires, authority);
}
