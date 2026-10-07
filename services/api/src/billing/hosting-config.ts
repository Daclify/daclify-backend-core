import { z } from 'zod';
export function readHostingConfig(
  env: Record<string, string | undefined>,
  environment: 'local' | 'testnet' | 'mainnet',
  frontendOrigin: string,
) {
  if (!env.DACLIFY_HOSTING_STRIPE_PRODUCT_ID && !env.DACLIFY_HOSTING_WEBHOOK_SECRET)
    return undefined;
  const result = z
    .object({
      STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/),
      DACLIFY_HOSTING_STRIPE_PRODUCT_ID: z.string().regex(/^prod_[A-Za-z0-9]+$/),
      DACLIFY_HOSTING_WEBHOOK_SECRET: z.string().regex(/^whsec_[A-Za-z0-9]{12,}$/),
      DACLIFY_HOSTING_LIVE_PAYMENTS: z.enum(['true', 'false']).optional(),
    })
    .safeParse(env);
  if (!result.success) throw new Error('HOSTING_CONFIGURATION_INVALID');
  const url = new URL(frontendOrigin),
    value = result.data;
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(
        environment === 'local' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )) ||
    (environment !== 'mainnet' && !/^(sk|rk)_test_/.test(value.STRIPE_SECRET_KEY))
  )
    throw new Error('HOSTING_CONFIGURATION_INVALID');
  return {
    secretKey: value.STRIPE_SECRET_KEY,
    productId: value.DACLIFY_HOSTING_STRIPE_PRODUCT_ID,
    webhookSecret: value.DACLIFY_HOSTING_WEBHOOK_SECRET,
    frontendOrigin: url.origin,
    livemode: /^(sk|rk)_live_/.test(value.STRIPE_SECRET_KEY),
    liveChargesEnabled: environment === 'mainnet' && value.DACLIFY_HOSTING_LIVE_PAYMENTS === 'true',
  };
}
export type HostingConfig = NonNullable<ReturnType<typeof readHostingConfig>>;
