import { z } from 'zod';
import { ChainIdSchema, NativeAccountSchema, ApiOriginSchema } from './base.js';
import { AccountControlChallengeSchema, NativeProofSchema } from './sign-in.js';
export { NativeProofSchema } from './sign-in.js';
export const NativeIdentitySchema = z.strictObject({
  chainId: ChainIdSchema,
  account: NativeAccountSchema,
  permission: z.literal('active'),
});
export const NativeUnlinkSchema = z.strictObject({ chainId: ChainIdSchema });
export const NativeIntentSchema = NativeIdentitySchema.omit({ chainId: true }).extend({
  purpose: z.enum(['login', 'pair']),
});
export const NativeSignInMessageSchema = z.strictObject({
  domain: z.literal('daclify.native-sign-in.v2'),
  purpose: z.enum(['login', 'pair']),
  origin: z.url(),
  audience: ApiOriginSchema,
  accountId: z.uuid().nullable(),
  identity: NativeIdentitySchema,
  runtime: NativeAccountSchema,
  id: z.uuid(),
  expires: z.iso.datetime(),
});
export const NativeFinishSchema = z.strictObject({ id: z.uuid(), proof: NativeProofSchema });
export const NativeChallengeSchema = AccountControlChallengeSchema.extend({
  identity: NativeIdentitySchema,
  runtime: NativeAccountSchema,
});
export const NativeLinksSchema = z.strictObject({ links: z.array(NativeIdentitySchema) });
export type NativeIdentity = z.infer<typeof NativeIdentitySchema>;
export type NativeProof = z.infer<typeof NativeProofSchema>;
