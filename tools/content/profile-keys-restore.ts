import { Pool } from 'pg';
import { readProfileKeysConfiguration } from '../../services/api/src/profiles/config.js';
import { applyProfileRestoreExclusions } from '../../services/api/src/profiles/keys.js';
const configuration = await readProfileKeysConfiguration(process.env);
if (!configuration || !process.env.DATABASE_URL)
  throw new Error('PROFILE_RESTORE_CONFIGURATION_REQUIRED');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const removed = await applyProfileRestoreExclusions(pool, configuration.exclusions);
  process.stdout.write(
    JSON.stringify({ excludedRowsRemoved: removed, journalPreserved: true }) + '\n',
  );
} catch {
  throw new Error('PROFILE_RESTORE_EXCLUSIONS_UNAVAILABLE');
} finally {
  await pool.end();
  await configuration.exclusions.close?.();
}
