import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { satisfies } from 'semver';
import { VERSION } from '../../protocol/base.js';
import { VERSION as MODULES_VERSION } from '@daclify/modules';
import { MiniAppReleaseManifestSchema } from '../../protocol/mini-apps.js';
import { MiniAppArtifacts, miniAppReleaseId } from '../../services/api/src/mini-apps/artifacts.js';
import { writeImmutableArtifact } from './artifact.js';
const run = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const packageInfo = z.object({
  name: z.string(),
  version: z.string(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});
async function archivePackage(path: string) {
  const { stdout } = await run('tar', ['-xOf', path, 'package/package.json'], {
    timeout: 5000,
    maxBuffer: 65536,
  });
  return packageInfo.parse(JSON.parse(stdout));
}
export async function buildMiniAppStarter(input: {
  coreArchive: string;
  modulesArchive: string;
  outputDirectory: string;
}): Promise<MiniAppArtifacts> {
  const core = await archivePackage(input.coreArchive),
    modules = await archivePackage(input.modulesArchive);
  if (
    core.name !== '@daclify/core-protocol' ||
    core.version !== VERSION ||
    modules.name !== '@daclify/modules' ||
    modules.version !== MODULES_VERSION ||
    !modules.peerDependencies?.['@daclify/core-protocol'] ||
    !satisfies(core.version, modules.peerDependencies['@daclify/core-protocol'])
  )
    throw new Error('MINI_APP_RELEASE_VERSION');
  const temporary = await mkdtemp(join(tmpdir(), 'daclify-starter-'));
  try {
    await mkdir(join(temporary, 'vendor'));
    await mkdir(join(temporary, 'examples/community-mini-app'), { recursive: true });
    await copyFile(input.coreArchive, join(temporary, 'vendor/core.tgz'));
    await copyFile(input.modulesArchive, join(temporary, 'vendor/modules.tgz'));
    const files = [
      'browser.ts',
      'callback.ts',
      'access.ts',
      'adopt.ts',
      'database.ts',
      'store.ts',
      'postgres-store.ts',
      'postgres-schema.sql',
      'server.ts',
      'build.ts',
    ];
    for (const file of files)
      await copyFile(
        join(root, 'examples/community-mini-app', file),
        join(temporary, 'examples/community-mini-app', file),
      );
    await copyFile(join(root, 'LICENSE'), join(temporary, 'LICENSE'));
    await copyFile(
      join(root, 'tools/release/mini-app-starter/README.md'),
      join(temporary, 'README.md'),
    );
    await copyFile(
      join(root, 'tools/release/mini-app-starter/configure.mjs'),
      join(temporary, 'configure.mjs'),
    );
    await writeFile(
      join(temporary, 'package.json'),
      JSON.stringify(
        {
          name: 'daclify-community-mini-app-starter',
          version: '1.0.0',
          private: true,
          type: 'module',
          license: 'AGPL-3.0-only',
          engines: { node: '>=24.21 <25', npm: '>=11.19 <12' },
          scripts: { build: 'node --import tsx examples/community-mini-app/build.ts' },
          dependencies: {
            '@daclify/core-protocol': 'file:vendor/core.tgz',
            '@daclify/modules': 'file:vendor/modules.tgz',
            '@wharfkit/antelope': '4.0.2',
            zod: '4.6.5',
            tsx: '4.23.15',
            esbuild: '0.28.2',
            pg: '8.23.1',
          },
        },
        null,
        2,
      ) + '\n',
    );
    await run(
      'npm',
      [
        'install',
        '--package-lock-only',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--registry=https://registry.npmjs.org',
      ],
      { cwd: temporary, timeout: 60000, maxBuffer: 1024 * 1024 },
    );
    const packageLock = await readFile(join(temporary, 'package-lock.json'));
    const archive = join(
      tmpdir(),
      'daclify-starter-' + createHash('sha256').update(temporary).digest('hex') + '.tgz',
    );
    try {
      await run(
        'tar',
        [
          '--sort=name',
          '--mtime=@0',
          '--owner=0',
          '--group=0',
          '--numeric-owner',
          '-czf',
          archive,
          '-C',
          temporary,
          '.',
        ],
        { timeout: 30000, maxBuffer: 65536 },
      );
      const coreBytes = await readFile(input.coreArchive),
        modulesBytes = await readFile(input.modulesArchive),
        starterBytes = await readFile(archive);
      const manifest = MiniAppReleaseManifestSchema.parse({
        version: 1,
        releaseId: '00'.repeat(32),
        coreVersion: core.version,
        modulesVersion: modules.version,
        packageLockHash: hash(packageLock),
        files: [
          { name: 'core.tgz', bytes: coreBytes.length, sha256: hash(coreBytes) },
          { name: 'modules.tgz', bytes: modulesBytes.length, sha256: hash(modulesBytes) },
          { name: 'starter.tgz', bytes: starterBytes.length, sha256: hash(starterBytes) },
        ],
      });
      manifest.releaseId = miniAppReleaseId(manifest);
      const output = resolve(input.outputDirectory, manifest.releaseId);
      await mkdir(output, { recursive: true });
      for (const [name, bytes] of [
        ['core.tgz', coreBytes],
        ['modules.tgz', modulesBytes],
        ['starter.tgz', starterBytes],
        ['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
      ] satisfies [string, Uint8Array][])
        writeImmutableArtifact(join(output, name), bytes);
      return MiniAppArtifacts.load(output);
    } finally {
      await rm(archive, { force: true });
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
if (import.meta.main) {
  const result = await buildMiniAppStarter({
    coreArchive: resolve('.artifacts/daclify-core-protocol-' + VERSION + '.tgz'),
    modulesArchive: resolve(
      '../daclify-backend-modules/.artifacts/daclify-modules-' + MODULES_VERSION + '.tgz',
    ),
    outputDirectory: resolve('.artifacts/mini-apps'),
  });
  process.stdout.write(
    JSON.stringify({ releaseId: result.manifest.releaseId, manifestHash: result.manifestHash }) +
      '\n',
  );
}
