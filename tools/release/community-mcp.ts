import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
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
export function checkoutMcpArchives(coreRoot: string, modulesRoot: string) {
  const mcp = info
    .extend({
      peerDependencies: z.object({
        '@daclify/core-protocol': z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
        '@daclify/modules': z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
      }),
    })
    .parse(JSON.parse(readFileSync(join(coreRoot, 'packages/community-mcp/package.json'), 'utf8')));
  if (mcp.name !== '@daclify/community-mcp') throw Error('MCP_RELEASE_PINS');
  return {
    coreVersion: mcp.peerDependencies['@daclify/core-protocol'],
    modulesVersion: mcp.peerDependencies['@daclify/modules'],
    mcpVersion: mcp.version,
    coreArchive: join(
      coreRoot,
      `.artifacts/daclify-core-protocol-${mcp.peerDependencies['@daclify/core-protocol']}.tgz`,
    ),
    modulesArchive: join(
      modulesRoot,
      `.artifacts/daclify-modules-${mcp.peerDependencies['@daclify/modules']}.tgz`,
    ),
    mcpArchive: join(coreRoot, `.artifacts/community-mcp/daclify-community-mcp-${mcp.version}.tgz`),
  };
}
if (import.meta.main) {
  const archives = checkoutMcpArchives(process.cwd(), resolve('../daclify-backend-modules'));
  await mkdir('.artifacts/community-mcp', { recursive: true });
  const stage = await mkdtemp('.artifacts/community-mcp/pack-');
  try {
    const { stdout } = await run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', resolve(stage)],
      { cwd: 'packages/community-mcp', maxBuffer: 65536 },
    );
    const [packed] = z
      .array(
        z.object({ filename: z.string().regex(/^daclify-community-mcp-[0-9A-Za-z.-]+\.tgz$/) }),
      )
      .length(1)
      .parse(JSON.parse(stdout));
    if (!packed) throw Error('MCP_RELEASE_FILE');
    await writeImmutableArtifact(archives.mcpArchive, await readFile(join(stage, packed.filename)));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  const result = await buildMcpRelease(
    archives.coreArchive,
    archives.modulesArchive,
    archives.mcpArchive,
    '.artifacts/community-mcp/releases',
  );
  console.log(
    JSON.stringify({ releaseId: result.manifest.releaseId, manifestHash: result.manifestHash }),
  );
}
