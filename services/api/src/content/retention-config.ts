import { z } from 'zod';
export function readRetentionEnabled(
  env: Record<string, string | undefined>,
  providerConfigured: boolean,
  paymentConfigured: boolean,
): boolean {
  const input = z
    .enum(['true', 'false'])
    .default('false')
    .safeParse(env.DACLIFY_STORAGE_CLEANUP_ENABLED);
  if (!input.success || (input.data === 'true' && (!providerConfigured || !paymentConfigured)))
    throw new Error('STORAGE_RETENTION_CONFIGURATION_INVALID');
  return input.data === 'true';
}
