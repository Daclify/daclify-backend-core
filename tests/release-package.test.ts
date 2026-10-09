// Synthetic clean repositories exercise packaging policy; these reports qualify no real deployment.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../protocol/base.js';
import { loadCheckoutManifest, releaseSubject, ReleaseChecks } from '../tools/release/manifest.js';
it('packages complete synthetic evidence immutably and refuses a dirty source tree', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'daclify-package-policy-')),
    core = join(workspace, 'daclify-backend-core');
  const put = (file: string, data: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
  };
  try {
    for (const [directory, name] of [
      ['daclify-backend-core', '@daclify/backend-core'],
      ['daclify-backend-modules', '@daclify/modules'],
      ['daclify-frontend', '@daclify/frontend'],
    ] as const) {
      const root = join(workspace, directory);
      put(join(root, 'package.json'), JSON.stringify({ name, version: VERSION }));
      put(join(root, 'package-lock.json'), '{}');
      put(join(root, '.gitignore'), '.artifacts/\ndist/\n');
    }
    put(
      join(core, 'docs/evidence/toolchain.json'),
      JSON.stringify({ compiler: 'Antelope CDT 4.1.1', nativeRuntime: 'Antelope Spring 1.2.2' }),
    );
    put(join(core, '.artifacts/contracts/runtime.wasm'), 'synthetic runtime');
    put(
      join(core, '.artifacts/contracts/runtime.abi'),
      JSON.stringify({ version: 'eosio::abi/1.2', structs: [], actions: [] }),
    );
    put(join(core, 'docs/generated/reference.json'), '{}');
    put(
      join(core, 'sdk/public-package.json'),
      JSON.stringify({
        name: '@daclify/core-protocol',
        version: VERSION,
        type: 'module',
        dependencies: {},
        files: [
          'dist/protocol',
          'dist/sdk',
          'contracts/common',
          'docs/generated',
          'README.md',
          'LICENSE',
          'LICENSING.md',
        ],
      }),
    );
    put(join(core, 'sdk/README.md'), 'Synthetic packaging-policy test');
    put(join(core, 'LICENSE'), 'Synthetic fixture');
    put(join(core, 'LICENSING.md'), 'Synthetic fixture');
    put(join(core, 'dist/protocol/index.js'), 'export const fixture=true;');
    put(join(core, 'dist/sdk/index.js'), 'export const fixture=true;');
    put(join(core, 'contracts/common/fixture.hpp'), '// Synthetic fixture');
    put(
      join(workspace, 'daclify-backend-modules/contracts/works/works.cpp'),
      '// Synthetic fixture',
    );
    put(
      join(workspace, 'daclify-backend-modules/.artifacts/contracts/works.wasm'),
      'synthetic works',
    );
    put(join(workspace, 'daclify-backend-modules/.artifacts/contracts/works.abi'), '{}');
    put(
      join(workspace, 'daclify-backend-modules/.artifacts', `daclify-modules-${VERSION}.tgz`),
      'synthetic modules package',
    );
    put(join(workspace, 'daclify-frontend/dist/index.html'), '<p>synthetic frontend</p>');
    for (const directory of [
      'daclify-backend-core',
      'daclify-backend-modules',
      'daclify-frontend',
    ]) {
      const cwd = join(workspace, directory);
      execFileSync('git', ['init', '--template='], { cwd, stdio: 'pipe' });
      execFileSync('git', ['add', '.'], { cwd, stdio: 'pipe' });
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Release policy fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '-m',
          'Synthetic release-policy fixture',
        ],
        { cwd, stdio: 'pipe' },
      );
    }
    const development = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)),
        fileURLToPath(new URL('../tools/release/package.ts', import.meta.url)),
        '--development',
      ],
      { cwd: core, encoding: 'utf8' },
    );
    expect(development.status).toBe(0);
    const manifest = loadCheckoutManifest(core),
      subject = releaseSubject(manifest),
      evidenceRoot = join(core, '.artifacts/evidence');
    const checks = Object.keys(ReleaseChecks).map((id) => {
      const data = JSON.stringify({
          schemaVersion: 1,
          check: id,
          subject,
          status: 'passed',
          method: 'operator',
          reviewer: 'Synthetic packaging-policy fixture',
          assertions: 1,
          failed: 0,
          skipped: 0,
        }),
        path = id + '.json';
      put(join(evidenceRoot, path), data);
      return { id, path, sha256: createHash('sha256').update(data).digest('hex') };
    });
    const bundle = join(evidenceRoot, 'bundle.json');
    put(bundle, JSON.stringify({ schemaVersion: 1, subject, checks }));
    const run = () =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)),
          fileURLToPath(new URL('../tools/release/package.ts', import.meta.url)),
          '--evidence',
          bundle,
        ],
        { cwd: core, encoding: 'utf8' },
      );
    const first = run();
    expect(first.stderr).toBe('');
    expect(first.status).toBe(0);
    const file = join(core, '.artifacts/releases', VERSION, `daclify-core-protocol-${VERSION}.tgz`),
      bytes = readFileSync(file);
    expect(run().status).toBe(0);
    expect(readFileSync(file)).toEqual(bytes);
    put(join(core, 'dist/sdk/index.js'), 'export const fixture=false;');
    const changedBuild = run();
    expect(changedBuild.status).not.toBe(0);
    expect(changedBuild.stderr).toContain('RELEASE_EVIDENCE');
    expect(readFileSync(file)).toEqual(bytes);
    put(join(core, 'dist/sdk/index.js'), 'export const fixture=true;');
    put(
      join(workspace, 'daclify-backend-modules/.artifacts/contracts/works.abi'),
      '{"changed":true}',
    );
    expect(run().status).not.toBe(0);
    put(join(workspace, 'daclify-backend-modules/.artifacts/contracts/works.abi'), '{}');
    put(join(core, 'sdk/README.md'), 'Changed source');
    const dirty = run();
    expect(dirty.status).not.toBe(0);
    expect(dirty.stderr).toContain('RELEASE_DIRTY_CHECKOUT');
    expect(readFileSync(file)).toEqual(bytes);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}, 20000);
