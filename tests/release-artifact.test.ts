import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeImmutableArtifact } from '../tools/release/artifact.js';
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function target() {
  const root = mkdtempSync(join(tmpdir(), 'daclify-artifact-'));
  roots.push(root);
  return { root, file: join(root, 'sdk.tgz') };
}
it('writes a version once and permits only an exact retry', () => {
  const f = target(),
    bytes = Buffer.from('test artifact');
  writeImmutableArtifact(f.file, bytes);
  writeImmutableArtifact(f.file, bytes);
  expect(readFileSync(f.file)).toEqual(bytes);
  expect(() => writeImmutableArtifact(f.file, Buffer.from('replacement'))).toThrow(
    'RELEASE_ARTIFACT_IMMUTABLE',
  );
  expect(readFileSync(f.file)).toEqual(bytes);
});
it('refuses to treat a symlink as an existing released artifact', () => {
  const f = target(),
    outside = join(f.root, 'outside');
  writeFileSync(outside, 'original');
  symlinkSync(outside, f.file);
  expect(() => writeImmutableArtifact(f.file, Buffer.from('original'))).toThrow(
    'RELEASE_ARTIFACT_IMMUTABLE',
  );
  expect(readFileSync(outside, 'utf8')).toBe('original');
});
it('reports failure if the release directory is unavailable', () => {
  const f = target();
  expect(() =>
    writeImmutableArtifact(join(f.root, 'missing', 'sdk.tgz'), Buffer.from('test')),
  ).toThrow('RELEASE_ARTIFACT_WRITE_FAILED');
});

it('refuses empty artifacts', () => {
  const f = target();
  expect(() => writeImmutableArtifact(f.file, new Uint8Array())).toThrow('RELEASE_ARTIFACT_EMPTY');
});

it.each([['--development', '--evidence', 'bundle.json'], ['--evidence'], ['--unknown']])(
  'rejects invalid packaging arguments before accessing build files: %j',
  async (...flags) => {
    const { spawnSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const f = target();
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)),
        fileURLToPath(new URL('../tools/release/package.ts', import.meta.url)),
        ...flags,
      ],
      { cwd: f.root, encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RELEASE_ARGUMENTS');
  },
);
