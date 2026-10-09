import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
export function writeImmutableArtifact(file: string, bytes: Uint8Array): void {
  if (!bytes.length) throw new Error('RELEASE_ARTIFACT_EMPTY');
  try {
    writeFileSync(file, bytes, { flag: 'wx', mode: 0o644 });
  } catch (cause) {
    const error = z.object({ code: z.literal('EEXIST') }).safeParse(cause);
    if (!error.success) throw new Error('RELEASE_ARTIFACT_WRITE_FAILED');
    try {
      if (lstatSync(file).isFile() && readFileSync(file).equals(bytes)) return;
    } catch {
      throw new Error('RELEASE_ARTIFACT_WRITE_FAILED');
    }
    throw new Error('RELEASE_ARTIFACT_IMMUTABLE');
  }
}
