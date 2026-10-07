import { z } from 'zod';
import { EvmAddressSchema, TelosEvmChainSchema } from '../../../../protocol/evm-wallet.js';
import { checksumAddress, recoverEvmAddress } from './evm-proof.js';
import { ApiError } from '../errors.js';
const SiweInputSchema = z.strictObject({
  origin: z.url(),
  address: EvmAddressSchema,
  chainId: TelosEvmChainSchema,
  nonce: z.string().regex(/^[a-zA-Z0-9]{8,64}$/),
  id: z.uuid(),
  issued: z.string().datetime(),
  expires: z.string().datetime(),
  purpose: z.enum(['login', 'pair']),
  accountId: z.uuid().nullable(),
});
export function siweMessage(input: z.infer<typeof SiweInputSchema>): string {
  const value = SiweInputSchema.parse(input),
    site = new URL(value.origin);
  if (site.origin !== value.origin || (value.purpose === 'pair') !== (value.accountId !== null))
    throw new Error('SIWE_CONTEXT_INVALID');
  return `${site.origin} wants you to sign in with your Ethereum account:\n${checksumAddress(value.address)}\n\n${value.purpose === 'login' ? 'Sign in to your paired Daclify account.' : 'Pair this wallet with your existing Daclify account.'}\n\nURI: ${site.origin}/account\nVersion: 1\nChain ID: ${value.chainId}\nNonce: ${value.nonce}\nIssued At: ${value.issued}\nExpiration Time: ${value.expires}\nRequest ID: ${value.id}\nResources:\n- urn:daclify:intent:${value.purpose}${value.accountId ? `\n- urn:daclify:account:${value.accountId}` : ''}`;
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
