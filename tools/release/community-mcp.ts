import { readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { McpReleaseManifestSchema } from '../../protocol/mcp.js';
import { mcpReleaseId, McpArtifacts } from '../../services/api/src/mcp/artifacts.js';
import { writeImmutableArtifact } from './artifact.js';
const run = promisify(execFile),
  info = z.object({
    name: z.string(),
    version: z.string(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
  });
export async function buildMcpRelease(
  coreArchive: string,
  modulesArchive: string,
  mcpArchive: string,
  outputDirectory: string,
) {
  const paths = [coreArchive, modulesArchive, mcpArchive],
    packages = [];
  for (const path of paths) {
    const { stdout } = await run('tar', ['-xOf', path, 'package/package.json'], {
      maxBuffer: 65536,
      timeout: 5000,
    });
    packages.push(info.parse(JSON.parse(stdout)));
  }
  const [core, modules, mcp] = packages;
  if (
    !core ||
    !modules ||
    !mcp ||
    core.name !== '@daclify/core-protocol' ||
    modules.name !== '@daclify/modules' ||
    mcp.name !== '@daclify/community-mcp' ||
    modules.peerDependencies?.['@daclify/core-protocol'] !== core.version ||
    mcp.peerDependencies?.['@daclify/core-protocol'] !== core.version ||
    mcp.peerDependencies?.['@daclify/modules'] !== modules.version
  )
    throw Error('MCP_RELEASE_PINS');
  const names = ['core.tgz', 'modules.tgz', 'mcp.tgz'] as const,
    files = [],
    bytes = [];
  for (const [index, path] of paths.entries()) {
    const value = await readFile(path),
      name = names[index];
    if (!name) throw Error('MCP_RELEASE_FILE');
    bytes.push(value);
    files.push({
      name,
      bytes: value.length,
      sha256: createHash('sha256').update(value).digest('hex'),
    });
  }
  const identity = {
      version: 1,
      coreVersion: core.version,
      modulesVersion: modules.version,
      mcpVersion: mcp.version,
      files,
    },
    manifest = McpReleaseManifestSchema.parse({ ...identity, releaseId: mcpReleaseId(identity) }),
    directory = resolve(outputDirectory, manifest.releaseId);
  await mkdir(directory, { recursive: true });
  for (const [index, file] of files.entries()) {
    const value = bytes[index];
    if (!value) throw Error('MCP_RELEASE_FILE');
    await writeImmutableArtifact(resolve(directory, file.name), value);
  }
  await writeImmutableArtifact(
    resolve(directory, 'manifest.json'),
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
  );
  return McpArtifacts.load(directory);
}
if (import.meta.main) {
  const core: unknown = JSON.parse(await readFile('sdk/public-package.json', 'utf8')),
    modules: unknown = JSON.parse(
      await readFile('../daclify-backend-modules/package.json', 'utf8'),
    ),
    mcp: unknown = JSON.parse(await readFile('packages/community-mcp/package.json', 'utf8'));
  const versions = z.object({ version: z.string() });
  const result = await buildMcpRelease(
    '.artifacts/daclify-core-protocol-' + versions.parse(core).version + '.tgz',
    '../daclify-backend-modules/.artifacts/daclify-modules-' +
      versions.parse(modules).version +
      '.tgz',
    '.artifacts/community-mcp/daclify-community-mcp-' + versions.parse(mcp).version + '.tgz',
    '.artifacts/community-mcp/releases',
  );
  console.log(
    JSON.stringify({ releaseId: result.manifest.releaseId, manifestHash: result.manifestHash }),
  );
}
