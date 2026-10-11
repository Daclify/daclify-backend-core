import { z } from 'zod';
import { ApiOriginSchema } from '../../../../protocol/base.js';
import { EncryptionPrivateKeySchema } from '../../../../protocol/crypto.js';
export const AppIssuerKeySchema = EncryptionPrivateKeySchema.extend({
  kid: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});
export interface ConnectedAppsConfiguration {
  issuer: string;
  frontendOrigin: string;
  signingKey: z.infer<typeof AppIssuerKeySchema>;
}
export function readConnectedAppsConfiguration(
  env: NodeJS.ProcessEnv,
  issuer: string,
  frontendOrigin: string,
): ConnectedAppsConfiguration | undefined {
  if (!env.CONNECTED_APPS_SIGNING_JWK) return;
  try {
    return {
      issuer: ApiOriginSchema.parse(issuer),
      frontendOrigin: ApiOriginSchema.parse(frontendOrigin),
      signingKey: AppIssuerKeySchema.parse(JSON.parse(env.CONNECTED_APPS_SIGNING_JWK)),
    };
  } catch {
    throw new Error('CONNECTED_APPS_CONFIGURATION_INVALID');
  }
}
