import { AppBindingSchema, type AppBinding } from '@daclify/core-protocol';
import {
  VerifiedIssuerKeysSchema,
  verifyCleanupNotice,
} from '@daclify/core-protocol/mini-app-cleanup';
import { readAppResponse } from '@daclify/core-protocol/connected-apps';
export async function verifyCleanupAccess(
  input: AppBinding,
  authorization: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  const binding = AppBindingSchema.parse(input);
  if (
    !authorization ||
    authorization.length > 16391 ||
    !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)
  )
    throw Error('APP_CLEANUP_TOKEN');
  const response = await fetcher(binding.issuer + '/v1/connected-apps/jwks', {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw Error('APP_CLEANUP_ISSUER_UNAVAILABLE');
  const keys = VerifiedIssuerKeysSchema.parse(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(await readAppResponse(response, 16384)),
    ),
  );
  return verifyCleanupNotice(authorization.substring(7), binding.issuer, keys, binding);
}
