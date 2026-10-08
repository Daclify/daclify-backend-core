import { z } from 'zod';
import { readHostingConfig } from '../billing/hosting-config.js';
export function readRamCardConfig(
  env: Record<string, string | undefined>,
  environment: 'local' | 'testnet' | 'mainnet',
  origin: string,
) {
  if (
    !env.DACLIFY_RAM_STRIPE_PRODUCT_ID &&
    !env.DACLIFY_RAM_WEBHOOK_SECRET &&
    !env.DACLIFY_RAM_STRIPE_ACCOUNT_ID
  )
    return undefined;
  const shared = readHostingConfig(
    {
      ...env,
      DACLIFY_HOSTING_STRIPE_PRODUCT_ID: env.DACLIFY_RAM_STRIPE_PRODUCT_ID,
      DACLIFY_HOSTING_WEBHOOK_SECRET: env.DACLIFY_RAM_WEBHOOK_SECRET,
      DACLIFY_HOSTING_LIVE_PAYMENTS: env.DACLIFY_RAM_LIVE_PAYMENTS,
    },
    environment,
    origin,
  );
  if (!shared) throw new Error('RAM_BILLING_CONFIGURATION_INVALID');
  if (environment === 'mainnet' && !shared.livemode)
    throw new Error('RAM_BILLING_CONFIGURATION_INVALID');
  return {
    ...shared,
    accountId: z
      .string()
      .regex(/^acct_[A-Za-z0-9]+$/)
      .parse(env.DACLIFY_RAM_STRIPE_ACCOUNT_ID),
  };
}
export type RamCardConfig = NonNullable<ReturnType<typeof readRamCardConfig>>;
