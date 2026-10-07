import { z } from 'zod';
export function readConnectConfig(
  env: Record<string, string | undefined>,
  environment: 'local' | 'testnet' | 'mainnet',
  frontendOrigin: string,
) {
  if (!env.STRIPE_CONNECT_CLIENT_ID && !env.STRIPE_CONNECT_WEBHOOK_SECRET) return undefined;
  const result = z
    .object({
      STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/),
      STRIPE_CONNECT_CLIENT_ID: z.string().regex(/^ca_[A-Za-z0-9]+$/),
      STRIPE_CONNECT_WEBHOOK_SECRET: z.string().regex(/^whsec_[A-Za-z0-9]{12,}$/),
      API_PUBLIC_ORIGIN: z.url(),
      DACLIFY_CONNECT_LIVE_PAYMENTS: z.enum(['true', 'false']).optional(),
    })
    .safeParse(env);
  if (!result.success) throw new Error('STRIPE_CONNECT_CONFIGURATION_INVALID');
  const value = result.data,
    api = new URL(value.API_PUBLIC_ORIGIN),
    front = new URL(frontendOrigin);
  const local = (url: URL) =>
    environment === 'local' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    [api, front].some(
      (url) =>
        (url.protocol !== 'https:' && !local(url)) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash,
    ) ||
    (environment !== 'mainnet' && !/^(sk|rk)_test_/.test(value.STRIPE_SECRET_KEY))
  )
    throw new Error('STRIPE_CONNECT_CONFIGURATION_INVALID');
  return {
    secretKey: value.STRIPE_SECRET_KEY,
    clientId: value.STRIPE_CONNECT_CLIENT_ID,
    webhookSecret: value.STRIPE_CONNECT_WEBHOOK_SECRET,
    apiOrigin: api.origin,
    frontendOrigin: front.origin,
    livemode: /^(sk|rk)_live_/.test(value.STRIPE_SECRET_KEY),
    liveChargesEnabled: environment === 'mainnet' && value.DACLIFY_CONNECT_LIVE_PAYMENTS === 'true',
  };
}
export type ConnectConfig = NonNullable<ReturnType<typeof readConnectConfig>>;
