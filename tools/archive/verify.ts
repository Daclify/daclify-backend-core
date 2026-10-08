import { stat, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ChainIdSchema } from '../../protocol/base.js';
import { verifyArchiveBundle } from '@daclify/modules/archive';
try {
  const [file, commitment] = z
    .tuple([z.string().min(1).max(4096), ChainIdSchema])
    .parse(process.argv.slice(2));
  const info = await stat(file);
  if (!info.isFile() || info.size > 128 * 1024 * 1024) throw new Error('ARCHIVE_FILE_LIMIT');
  const parsed: unknown = JSON.parse(await readFile(file, 'utf8')),
    bundle = verifyArchiveBundle(parsed, commitment);
  console.log(
    JSON.stringify({
      id: bundle.id,
      dao: bundle.manifest.dao,
      families: bundle.manifest.families.length,
      records: bundle.manifest.families.reduce((n, f) => n + BigInt(f.records), 0n).toString(),
      chunks: bundle.chunks.length,
      pruningAuthorized: false,
    }),
  );
} catch {
  console.error('ARCHIVE_BUNDLE_VERIFICATION_FAILED');
  process.exitCode = 1;
}
