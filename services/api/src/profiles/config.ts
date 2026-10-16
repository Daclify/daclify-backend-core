import { z } from 'zod';
import { FileProfileExclusions } from './exclusions.js';
import type { ProfileKeysConfiguration } from './keys.js';
export async function readProfileKeysConfiguration(
  env: Record<string, string | undefined>,
): Promise<ProfileKeysConfiguration | undefined> {
  if (!env.PROFILE_KEYS_ENABLED || env.PROFILE_KEYS_ENABLED === '0') return undefined;
  try {
    if (env.PROFILE_KEYS_ENABLED !== '1') throw new Error();
    const backupRetentionSeconds = z.coerce
      .number()
      .int()
      .min(1)
      .max(90 * 86400)
      .parse(env.PROFILE_KEYS_MAX_BACKUP_AGE_SECONDS);
    const directory = z
      .string()
      .startsWith('/')
      .max(4096)
      .parse(env.PROFILE_KEYS_EXCLUSIONS_DIRECTORY);
    if (
      env.NETWORK_ENVIRONMENT === 'mainnet' &&
      ['/tmp', '/var/tmp', '/dev/shm'].some(
        (path) => directory === path || directory.startsWith(path + '/'),
      )
    )
      throw new Error();
    const exclusions = new FileProfileExclusions(directory);
    try {
      await exclusions.scan(1);
    } finally {
      await exclusions.close();
    }
    return { backupRetentionSeconds, exclusions };
  } catch {
    throw new Error('PROFILE_KEYS_CONFIGURATION_INVALID');
  }
}
