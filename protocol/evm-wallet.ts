import { z } from 'zod';
import { AccountControlChallengeSchema } from './sign-in.js';
import { RuntimeActionSchemas, RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { TelosEvmChainSchema, EvmAddressSchema, EvmSignatureSchema } from './base.js';
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
