import { ProviderScopeSchema } from '../../../../protocol/storage.js';

export function readPinataStorageScope(
  env: Record<string, string | undefined>,
): string | undefined {
  const scope = env.PINATA_STORAGE_SCOPE;
  const legacy = env.PINATA_ACCOUNT_ID;
  if (scope !== undefined && legacy !== undefined && scope !== legacy)
    throw new Error('PINATA_STORAGE_SCOPE_CONFLICT');
  const value = scope ?? legacy;
  if (value === undefined) return undefined;
  const parsed = ProviderScopeSchema.safeParse(value);
  if (!parsed.success) throw new Error('PINATA_STORAGE_SCOPE_INVALID');
  return parsed.data;
}
