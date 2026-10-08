import '../../services/api/src/load-local-env.js';
import { Pool } from 'pg';
import { z } from 'zod';
import { PinataStorage } from '../../services/api/src/content/pinata.js';
import { ProviderScopeSchema } from '../../services/api/src/content/ledger.js';
import { claimLegacyUpload } from '../../services/api/src/content/migrate.js';
import { ApiError } from '../../services/api/src/errors.js';
const env = z
  .object({
    DATABASE_URL: z.url(),
    PINATA_JWT: z.string().min(1),
    CONTENT_GATEWAY: z.url(),
    PINATA_ACCOUNT_ID: ProviderScopeSchema,
  })
  .safeParse(process.env);
const args = process.argv.slice(2);
const id = z.uuid().safeParse(args[1]);
if (!env.success || args.length !== 2 || args[0] !== '--claim-upload' || !id.success) {
  process.stderr.write(
    'Usage: DACLIFY_ENV_FILE=<private API env> npm run storage:claim -- --claim-upload <upload UUID>\n',
  );
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: env.data.DATABASE_URL, max: 1 });
  try {
    await claimLegacyUpload(
      pool,
      new PinataStorage(env.data.PINATA_JWT, env.data.CONTENT_GATEWAY),
      env.data.PINATA_ACCOUNT_ID,
      id.data,
    );
    process.stdout.write(
      'Selected upload ownership and bytes verified; storage reference recorded.\n',
    );
  } catch (cause) {
    process.stderr.write(
      `${cause instanceof ApiError ? cause.code : 'STORAGE_OWNERSHIP_REVIEW'}\n`,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
