import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildReleaseManifest,
  loadCheckoutManifest,
  publishRelease,
} from '../tools/release/manifest.js';

const repositories = [
  {
    name: 'daclify-backend-core',
    commit: 'a'.repeat(40),
    version: '0.1.0-alpha.1',
    lockfileSha256: 'b'.repeat(64),
  },
  {
    name: 'daclify-backend-modules',
    commit: 'c'.repeat(40),
    version: '0.1.0-alpha.1',
    lockfileSha256: 'd'.repeat(64),
  },
  {
    name: 'daclify-frontend',
    commit: 'e'.repeat(40),
    version: '0.1.0-alpha.2',
    lockfileSha256: 'f'.repeat(64),
  },
] as const;
const artifacts = {
  runtimeCodeHash: '1'.repeat(64),
  runtimeAbiSha256: '2'.repeat(64),
  runtimeRawAbiSha256: '4'.repeat(64),
  documentationSha256: '3'.repeat(64),
};

describe('release manifest', () => {
  it('records pins and still refuses publication', () => {
    const manifest = buildReleaseManifest({
      repositories: [...repositories],
      artifacts,
      moduleCapabilities: ['decide', 'payroll', 'works'],
      recordedPasses: ['core unit tests'],
      publication: 'published',
      qualified: true,
    });
    expect(manifest.publication).toBe('refused');
    expect(manifest.qualified).toBe(false);
    expect(manifest.checks.held.length).toBeGreaterThan(0);
    expect(manifest.repositories.map((repository) => repository.commit)).toEqual([
      'a'.repeat(40),
      'c'.repeat(40),
      'e'.repeat(40),
    ]);
    expect(() => publishRelease(manifest)).toThrow('PUBLICATION_REFUSED');
  });

  it('rejects a pin that is not a commit or artifact hash', () => {
    expect(() =>
      buildReleaseManifest({
        repositories: [{ ...repositories[0], commit: 'main' }, repositories[1], repositories[2]],
        artifacts,
        moduleCapabilities: ['works'],
      }),
    ).toThrow('MANIFEST_PIN');
  });

  it('loads this checkout without treating recorded history as qualification', () => {
    const manifest = loadCheckoutManifest(process.cwd());
    expect(manifest.publication).toBe('refused');
    expect(manifest.qualified).toBe(false);
    expect(manifest.checks.recordedPasses).toEqual([]);
    expect(manifest.artifacts.runtimeCodeHash).toHaveLength(64);
    expect(() => publishRelease(manifest)).toThrow('PUBLICATION_REFUSED');
  });

  it('keeps package:release from publishing', () => {
    const result = spawnSync('npm', ['run', 'package:release'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Release packaging is unavailable until the immutable verification manifest and held contract checks are resolved.',
    );
  });

  it('keeps the compatibility record unqualified', () => {
    const compatibility: unknown = JSON.parse(
      readFileSync('docs/releases/compatibility.json', 'utf8'),
    );
    expect(compatibility).toMatchObject({
      qualified: false,
      publication: 'refused',
      combinations: [],
    });
  });
});
