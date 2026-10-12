import {
  AppBindingSchema,
  AppClaimsSchema,
  ConnectedAppsRoutes,
  actorFromVerifiedClaims,
  type AppBinding,
} from '@daclify/core-protocol';
import { readAppResponse } from '@daclify/core-protocol/connected-apps';

export async function verifyAppAccess(
  input: AppBinding,
  authorization: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  const binding = AppBindingSchema.parse(input);
  if (!authorization || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
    throw new Error('LOGIN_REQUIRED');
  const url = new URL(ConnectedAppsRoutes.appMembership.path, binding.issuer);
  url.searchParams.set('clientId', binding.clientId);
  const response = await fetcher(url, {
    headers: { authorization },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('MEMBERSHIP_REQUIRED');
  const claims = AppClaimsSchema.parse(
    JSON.parse(new TextDecoder().decode(await readAppResponse(response, 65536))),
  );
  const verified = {
    issuer: binding.issuer,
    clientId: response.headers.get(ConnectedAppsRoutes.appMembership.clientHeader) ?? '',
  };
  return { claims, actor: actorFromVerifiedClaims(binding, claims, verified) };
}
