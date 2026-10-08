import { readHostingConfig } from './hosting-config.js';
import { ProviderScopeSchema } from '../content/ledger.js';
export function readStorageConfig(
  env: Record<string, string | undefined>,
  environment: 'local' | 'testnet' | 'mainnet',
  frontendOrigin: string,
  providerScope: string,
) {
  if (!env.DACLIFY_STORAGE_STRIPE_PRODUCT_ID && !env.DACLIFY_STORAGE_WEBHOOK_SECRET)
    return undefined;
  try {
    const config = readHostingConfig(
      {
        ...env,
        DACLIFY_HOSTING_STRIPE_PRODUCT_ID: env.DACLIFY_STORAGE_STRIPE_PRODUCT_ID,
        DACLIFY_HOSTING_WEBHOOK_SECRET: env.DACLIFY_STORAGE_WEBHOOK_SECRET,
        DACLIFY_HOSTING_LIVE_PAYMENTS: env.DACLIFY_STORAGE_LIVE_PAYMENTS,
      },
      environment,
      frontendOrigin,
    );
    if (!config) throw new Error('STORAGE_CONFIGURATION_INVALID');
    return { ...config, providerScope: ProviderScopeSchema.parse(providerScope) };
  } catch {
    throw new Error('STORAGE_CONFIGURATION_INVALID');
  }
}
export type StorageBillingConfig = NonNullable<ReturnType<typeof readStorageConfig>>;
