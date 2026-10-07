import { z } from 'zod';
import {
  canonicalEvmSignInMessage,
  EvmSignInMessageContextSchema,
} from '../../../../protocol/evm-wallet.js';
import { checksumAddress, recoverEvmAddress } from './evm-proof.js';
import { ApiError } from '../errors.js';
export function siweMessage(
  input: Omit<z.infer<typeof EvmSignInMessageContextSchema>, 'audience'> & { audience?: string },
): string {
  return canonicalEvmSignInMessage({
    ...input,
    audience: input.audience ?? input.origin,
    address: checksumAddress(input.address),
  });
}
export function verifySiweSignature(message: string, address: string, signature: string): void {
  // Verify only a server-issued canonical message, never arbitrary client-supplied SIWE text.
  try {
    if (recoverEvmAddress(message, signature) !== address.toLowerCase())
      throw new Error('Address mismatch');
  } catch {
    throw new ApiError('EVM_SIGNATURE_INVALID', 401);
  }
}
