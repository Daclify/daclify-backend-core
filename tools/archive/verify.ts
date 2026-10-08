import { stat, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ChainIdSchema } from '../../protocol/base.js';
import { verifyArchiveBundle } from '@daclify/modules/archive';
import { decryptArchiveBackup } from '../../services/api/src/archive/backup.js';
try {
  const encrypted = process.argv[2] === '--encrypted';
  const [file, commitment] = z
    .tuple([z.string().min(1).max(4096), ChainIdSchema])
    .parse(process.argv.slice(encrypted ? 3 : 2));
  const info = await stat(file);
  if (!info.isFile() || info.size > 128 * 1024 * 1024) throw new Error('ARCHIVE_FILE_LIMIT');
  const bytes = await readFile(file);
  const bundle = encrypted
    ? decryptArchiveBackup(
        bytes,
        Buffer.from(
          z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(process.env.ARCHIVE_BACKUP_KEY),
          'hex',
        ),
        commitment,
      )
    : verifyArchiveBundle(JSON.parse(bytes.toString('utf8')), commitment);
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
