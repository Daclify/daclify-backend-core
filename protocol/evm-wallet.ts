import { z } from 'zod';
import { AccountControlChallengeSchema } from './sign-in.js';
import { RuntimeActionSchemas, RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { TelosEvmChainSchema, EvmAddressSchema, EvmSignatureSchema } from './base.js';
import { ApiOriginSchema } from './base.js';
export { TelosEvmChainSchema, EvmAddressSchema, EvmSignatureSchema } from './base.js';
export const EvmChainInputSchema = z.strictObject({ chainId: TelosEvmChainSchema });
export const EvmLinkInputSchema = EvmChainInputSchema.extend({
  address: EvmAddressSchema,
  signature: EvmSignatureSchema,
});
export const EvmIntentSchema = z.strictObject({
  purpose: z.enum(['login', 'pair']),
  chainId: TelosEvmChainSchema,
  address: EvmAddressSchema,
});
export const EvmFinishSchema = z.strictObject({ id: z.uuid(), signature: EvmSignatureSchema });
export const EvmSignInChallengeSchema = AccountControlChallengeSchema.extend({
  chainId: TelosEvmChainSchema,
  address: EvmAddressSchema,
});
export const EvmGovernanceBindingSchema = z.strictObject({
  binding: RuntimeTableSchemas.evmbindings.nullable(),
});
export const EvmRelaySchema = RuntimeActionSchemas.submitevm;
export type EvmRelay = z.infer<typeof EvmRelaySchema>;
export const EvmSignInMessageContextSchema = z.strictObject({
  origin: ApiOriginSchema,
  audience: ApiOriginSchema,
  address: EvmAddressSchema,
  chainId: TelosEvmChainSchema,
  nonce: z.string().regex(/^[a-zA-Z0-9]{8,64}$/),
  id: z.uuid(),
  issued: z.iso.datetime(),
  expires: z.iso.datetime(),
  purpose: z.enum(['login', 'pair']),
  accountId: z.uuid().nullable(),
});
export function canonicalEvmSignInMessage(
  input: z.infer<typeof EvmSignInMessageContextSchema>,
): string {
  const value = EvmSignInMessageContextSchema.parse(input);
  if ((value.purpose === 'pair') !== (value.accountId !== null))
    throw new Error('SIWE_CONTEXT_INVALID');
  return `${value.origin} wants you to sign in with your Ethereum account:\n${value.address}\n\n${value.purpose === 'login' ? 'Sign in to your paired Daclify account.' : 'Pair this wallet with your existing Daclify account.'}\n\nURI: ${value.origin}/account\nVersion: 1\nChain ID: ${value.chainId}\nNonce: ${value.nonce}\nIssued At: ${value.issued}\nExpiration Time: ${value.expires}\nRequest ID: ${value.id}\nResources:\n- urn:daclify:intent:${value.purpose}${value.accountId ? `\n- urn:daclify:account:${value.accountId}` : ''}\n- urn:daclify:api:${value.audience}`;
}
