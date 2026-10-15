import { expect, it } from 'vitest';
import { z } from 'zod';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { buildMcpRelease, checkoutMcpArchives } from '../tools/release/community-mcp.js';

it('restores an independent MCP cohort in source-only backend checkouts without changing its package or lock', async () => {
  const root = mkdtempSync(join(tmpdir(), 'owned-mcp-bootstrap-'));
  const core = join(root, 'daclify-backend-core');
  const modules = join(root, 'daclify-backend-modules');
  const companion = join(core, 'packages/community-mcp');
  const source = resolve('packages/community-mcp');
  try {
    mkdirSync(companion, { recursive: true });
    mkdirSync(modules, { recursive: true });
    for (const name of ['package.json', 'package-lock.json', 'vendor'])
      cpSync(join(source, name), join(companion, name), { recursive: true });
    const before = readFileSync(join(companion, 'package-lock.json'));
    const run = () =>
      execFileSync(process.execPath, [resolve('tools/bootstrap/mcp.ts'), core, modules], {
        stdio: 'pipe',
      });
    run();
    run();
    expect(readFileSync(join(companion, 'package-lock.json'))).toEqual(before);
    expect(readFileSync(join(companion, 'package.json'))).toEqual(
      readFileSync(join(source, 'package.json')),
    );
    const archives = checkoutMcpArchives(core, modules);
    expect(archives.coreVersion).toBe('0.15.0-alpha.30');
    expect(archives.modulesVersion).toBe('0.10.0-alpha.40');
    mkdirSync(join(core, '.artifacts/community-mcp'), { recursive: true });
    cpSync(
      '.artifacts/community-mcp/daclify-community-mcp-0.1.0-alpha.20.tgz',
      archives.mcpArchive,
    );
    const release = await buildMcpRelease(
      archives.coreArchive,
      archives.modulesArchive,
      archives.mcpArchive,
      join(root, 'releases'),
    );
    expect(release.manifest.releaseId).toBe(
      'ad170b5f2dd3c79da54c50bc9bac17f1786ac6bc59ec121b0197d813468a5d81',
    );
    for (const name of ['dist', 'README.md'])
      cpSync(join(source, name), join(companion, name), { recursive: true });
    const pack = () =>
      spawnSync(
        process.execPath,
        [resolve('node_modules/tsx/dist/cli.mjs'), resolve('tools/release/community-mcp.ts')],
        { cwd: core, encoding: 'utf8' },
      );
    expect(pack().status).toBe(0);
    const mcpBytes = readFileSync(archives.mcpArchive);
    writeFileSync(join(companion, 'README.md'), 'Changed packaged source without a version bump');
    const replacement = pack();
    expect(replacement.status).not.toBe(0);
    expect(replacement.stderr).toContain('RELEASE_ARTIFACT_IMMUTABLE');
    expect(readFileSync(archives.mcpArchive)).toEqual(mcpBytes);
    const original = readFileSync(archives.coreArchive);
    writeFileSync(archives.coreArchive, 'tampered');
    expect(() => run()).toThrow();
    expect(readFileSync(archives.coreArchive, 'utf8')).toBe('tampered');
    writeFileSync(archives.coreArchive, original);
    const vendored = join(companion, 'vendor', basename(archives.coreArchive));
    rmSync(archives.coreArchive);
    writeFileSync(vendored, 'changed vendor bytes');
    expect(() => run()).toThrow('MCP_RELEASE_INTEGRITY');
    expect(existsSync(archives.coreArchive)).toBe(false);
    writeFileSync(vendored, original);
    run();
    const malformed = z
      .object({ peerDependencies: z.record(z.string(), z.string()) })
      .passthrough()
      .parse(JSON.parse(readFileSync(join(companion, 'package.json'), 'utf8')));
    malformed.peerDependencies['@daclify/core-protocol'] = '^0.15.0-alpha.30';
    writeFileSync(join(companion, 'package.json'), JSON.stringify(malformed));
    expect(
      spawnSync(process.execPath, [resolve('tools/bootstrap/mcp.ts'), core, modules]).status,
    ).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
