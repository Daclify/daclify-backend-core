import { it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { McpArtifacts, mcpReleaseId } from '../services/api/src/mcp/artifacts.js';
it('verifies every immutable MCP download and refuses replacement bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-mcp-artifacts-'));
  try {
    const files = [];
    for (const name of ['core.tgz', 'modules.tgz', 'mcp.tgz']) {
      const bytes = Buffer.from('Owned integrity fixture ' + name);
      await writeFile(join(directory, name), bytes);
      files.push({
        name,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    const identity = {
        version: 1,
        coreVersion: '0.15.0-alpha.13',
        modulesVersion: '0.10.0-alpha.20',
        mcpVersion: '0.1.0-alpha.3',
        files,
      },
      manifest = { ...identity, releaseId: mcpReleaseId(identity) };
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
    const artifacts = await McpArtifacts.load(directory);
    expect(artifacts.manifest.releaseId).toBe(manifest.releaseId);
    const handle = await artifacts.openFile('mcp.tgz');
    await handle.close();
    await writeFile(join(directory, 'mcp.tgz'), 'Changed bytes');
    await expect(artifacts.openFile('mcp.tgz')).rejects.toThrow();
    await expect(McpArtifacts.load(directory)).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it('retains verified previous MCP cohorts without changing the active release', async () => {
  const root = await mkdtemp(join(tmpdir(), 'owned-mcp-archives-'));
  try {
    const directories: string[] = [];
    const ids: string[] = [];
    for (const version of ['0.1.0-alpha.9', '0.1.0-alpha.11']) {
      const directory = await mkdtemp(join(root, 'cohort-'));
      directories.push(directory);
      const files = [];
      for (const name of ['core.tgz', 'modules.tgz', 'mcp.tgz']) {
        const bytes = Buffer.from(version + name);
        await writeFile(join(directory, name), bytes);
        files.push({
          name,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
      const identity = {
        version: 1,
        coreVersion: '0.15.0-alpha.20',
        modulesVersion: '0.10.0-alpha.28',
        mcpVersion: version,
        files,
      };
      const releaseId = mcpReleaseId(identity);
      ids.push(releaseId);
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({ ...identity, releaseId }));
    }
    const [previous, current] = directories,
      [oldId, activeId] = ids;
    if (!previous || !current || !oldId || !activeId) throw Error('Owned cohorts absent');
    const artifacts = await McpArtifacts.load(current, [previous]);
    expect(artifacts.manifest.releaseId).toBe(activeId);
    const old = artifacts.findRelease(oldId);
    expect(old?.manifest.mcpVersion).toBe('0.1.0-alpha.9');
    const handle = await old?.openFile('mcp.tgz');
    expect(handle).toBeDefined();
    await handle?.close();
    expect(artifacts.findRelease('00'.repeat(32))).toBeUndefined();
    await expect(McpArtifacts.load(current, [current])).rejects.toThrow();
    await expect(McpArtifacts.load(current, Array(9).fill(previous))).rejects.toThrow();
    await writeFile(join(previous, 'mcp.tgz'), 'Changed archived bytes');
    await expect(McpArtifacts.load(current, [previous])).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
