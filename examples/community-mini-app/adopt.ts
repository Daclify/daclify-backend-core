import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { AppBindingSchema } from '@daclify/core-protocol';
import { verifyAppAccess } from './access.js';
import { adoptLegacyDatabase } from './store.js';

async function main() {
  const { values } = parseArgs({
    options: {
      database: { type: 'string' },
      binding: { type: 'string' },
      backup: { type: 'string' },
      access: { type: 'string' },
    },
  });
  const files = z
    .strictObject({
      database: z.string().min(1),
      binding: z.string().min(1),
      backup: z.string().min(1),
      access: z.string().min(1),
    })
    .parse(values);
  if ((statSync(files.access).mode & 0o077) !== 0)
    throw new Error('APP_DATABASE_ACCESS_FILE_PRIVATE');
  if (statSync(files.binding).size > 16384 || statSync(files.access).size > 1048576)
    throw new Error('APP_DATABASE_ADOPTION_SIZE');
  const binding = AppBindingSchema.parse(JSON.parse(readFileSync(files.binding, 'utf8')));
  const tokens = z
    .array(z.string().regex(/^[A-Za-z0-9_-]{43}$/))
    .max(1024)
    .parse(JSON.parse(readFileSync(files.access, 'utf8')));
  const actors = [];
  for (const token of tokens)
    actors.push((await verifyAppAccess(binding, 'Bearer ' + token)).actor);
  await adoptLegacyDatabase(files.database, binding, files.backup, actors);
  console.log(
    'Adopted binding v1. Keep the consistent backup under its disclosed retention policy.',
  );
}
try {
  await main();
} catch (error) {
  const code =
    error instanceof Error && /^APP_[A-Z_]{1,60}$/.test(error.message)
      ? error.message
      : 'APP_DATABASE_ADOPTION_FAILED';
  console.error(code);
  process.exitCode = 1;
}
