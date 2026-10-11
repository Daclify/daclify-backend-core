import { z } from 'zod';
export function readModuleFeesConfig(
  env: Record<string, string | undefined>,
  environment: 'local' | 'testnet' | 'mainnet',
  frontendOrigin: string,
) {
  if (!env.DACLIFY_MODULE_FEES_ENABLED || env.DACLIFY_MODULE_FEES_ENABLED === 'false')
    return undefined;
  const parsed = z
    .object({
      DACLIFY_MODULE_FEES_ENABLED: z.literal('true'),
      STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/),
      DACLIFY_MODULE_FEES_STRIPE_ACCOUNT_ID: z.string().regex(/^acct_[A-Za-z0-9]+$/),
      DACLIFY_MODULE_FEES_LIVE_PAYMENTS: z.enum(['true', 'false']).optional(),
    })
    .safeParse(env);
  if (!parsed.success) throw new Error('MODULE_BILLING_CONFIGURATION_INVALID');
  const origin = new URL(frontendOrigin),
    value = parsed.data;
  const livemode = /^(sk|rk)_live_/.test(value.STRIPE_SECRET_KEY);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== 'https:' &&
      !(
        environment === 'local' &&
        origin.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(origin.hostname)
      )) ||
    (environment === 'mainnet') !== livemode
  )
    throw new Error('MODULE_BILLING_CONFIGURATION_INVALID');
  return {
    secretKey: value.STRIPE_SECRET_KEY,
    accountId: value.DACLIFY_MODULE_FEES_STRIPE_ACCOUNT_ID,
    frontendOrigin: origin.origin,
    livemode,
    liveChargesEnabled:
      environment === 'mainnet' && value.DACLIFY_MODULE_FEES_LIVE_PAYMENTS === 'true',
  };
}
export type ModuleFeesConfig = NonNullable<ReturnType<typeof readModuleFeesConfig>>;
