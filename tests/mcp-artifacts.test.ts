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
