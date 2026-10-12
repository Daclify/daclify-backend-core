import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ApiOriginSchema, ChainIdSchema, IdSchema, NativeAccountSchema } from './base.js';
import { AppClaimsSchema, type AppClaims } from './connected-apps.js';

export const AppBindingSchema = z.strictObject({
  schemaVersion: z.literal(1),
  chainId: ChainIdSchema,
  runtime: NativeAccountSchema,
  daoId: IdSchema,
  appId: IdSchema,
  issuer: ApiOriginSchema,
  clientId: z.uuid(),
});
export type AppBinding = z.infer<typeof AppBindingSchema>;
export const AppActorSchema = z.strictObject({
  binding: AppBindingSchema,
  subject: z.uuid(),
  memberId: IdSchema,
});
export type AppActor = z.infer<typeof AppActorSchema>;

export function appBindingHash(input: AppBinding): string {
  const b = AppBindingSchema.parse(input);
  const value = JSON.stringify({
    schemaVersion: b.schemaVersion,
    chainId: b.chainId,
    runtime: b.runtime,
    daoId: b.daoId,
    appId: b.appId,
    issuer: b.issuer,
    clientId: b.clientId,
  });
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

export function actorFromVerifiedClaims(
  input: AppBinding,
  inputClaims: AppClaims,
  verified: { issuer: string; clientId: string },
): AppActor {
  const binding = AppBindingSchema.parse(input),
    claims = AppClaimsSchema.parse(inputClaims);
  if (
    binding.issuer !== verified.issuer ||
    binding.clientId !== verified.clientId ||
    binding.chainId !== claims.dao.chainId ||
    binding.runtime !== claims.dao.contract ||
    binding.daoId !== claims.dao.daoId ||
    binding.appId !== claims.appId
  )
    throw new Error('APP_ACTOR_BINDING');
  return AppActorSchema.parse({ binding, subject: claims.sub, memberId: claims.memberId });
}
