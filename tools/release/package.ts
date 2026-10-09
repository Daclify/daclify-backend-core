import { mkdir, cp, readFile, writeFile, rm, access, mkdtemp, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { valid } from 'semver';
import { z } from 'zod';
import { VERSION } from '../../protocol/base.js';
import {
  loadCheckoutManifest,
  qualifyRelease,
  publishRelease,
  type ReleaseManifest,
} from './manifest.js';
import { writeImmutableArtifact } from './artifact.js';
const flags = process.argv.slice(2);
const development = flags.length === 1 && flags[0] === '--development';
const evidenceFile = flags.length === 2 && flags[0] === '--evidence' ? flags[1] : undefined;
if (!development && !evidenceFile) {
  if (flags.length)
    throw new Error('RELEASE_ARGUMENTS: use --development or --evidence <bundle.json>.');
  throw new Error(
    'Release packaging is unavailable until the immutable verification manifest and held contract checks are resolved. Use --development for local review artifacts, or --evidence with complete source-bound reports.',
  );
}
let qualification: ReleaseManifest | undefined;
if (evidenceFile) {
  for (const repository of [
    'daclify-backend-core',
    'daclify-backend-modules',
    'daclify-frontend',
  ]) {
    const cwd = resolve(dirname(process.cwd()), repository);
    if (
      execFileSync('git', ['status', '--porcelain'], {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
    )
      throw new Error('RELEASE_DIRTY_CHECKOUT: ' + repository);
  }
  if ((await stat(evidenceFile)).size > 256 * 1024) throw new Error('RELEASE_EVIDENCE_TOO_LARGE');
  qualification = qualifyRelease(
    loadCheckoutManifest(process.cwd()),
    dirname(resolve(evidenceFile)),
    JSON.parse(await readFile(evidenceFile, 'utf8')),
  );
  publishRelease(qualification);
}
const manifestSource = await readFile('sdk/public-package.json', 'utf8');
const manifest = z
  .object({
    name: z.literal('@daclify/core-protocol'),
    version: z.literal(VERSION),
    dependencies: z.record(z.string(), z.string()),
  })
  .passthrough()
  .parse(JSON.parse(manifestSource));
if (
  Object.entries(manifest.dependencies).some(
    ([name, version]) =>
      !['@wharfkit/antelope', '@noble/hashes', 'zod', 'multiformats', 'semver'].includes(name) ||
      !valid(version),
  )
)
  throw new Error(
    'PUBLIC_PACKAGE_DEPENDENCIES: only exact approved runtime dependencies are allowed.',
  );
await mkdir('.artifacts', { recursive: true });
const stage = await mkdtemp('.artifacts/public-package-');
try {
  for (const path of ['dist/protocol', 'dist/sdk', 'contracts/common']) {
    await mkdir(`${stage}/${path.split('/').slice(0, -1).join('/')}`, { recursive: true });
    await cp(path, `${stage}/${path}`, { recursive: true });
  }
  try {
    await access('docs/generated');
    await cp('docs/generated', `${stage}/docs/generated`, { recursive: true });
  } catch {
    if (!development) throw new Error('Generated documentation required');
  }
  await writeFile(`${stage}/package.json`, manifestSource);
  await cp('sdk/README.md', `${stage}/README.md`);
  for (const name of ['LICENSE', 'LICENSING.md']) await cp(name, `${stage}/${name}`);
  const result: unknown = JSON.parse(
    execFileSync(
      'npm',
      ['pack', './' + stage, '--ignore-scripts', '--json', '--pack-destination', stage],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ),
  );
  const packed = z
    .tuple([z.object({ filename: z.literal(`daclify-core-protocol-${VERSION}.tgz`) })])
    .parse(result)[0];
  const bytes = await readFile(stage + '/' + packed.filename);
  if (development) await writeFile('.artifacts/' + packed.filename, bytes);
  else {
    if (!qualification) throw new Error('RELEASE_EVIDENCE_REQUIRED');
    if (
      createHash('sha256').update(bytes).digest('hex') !== qualification.artifacts.corePackageSha256
    )
      throw new Error(
        'RELEASE_PACKAGE_PIN: packed SDK differs from the qualified consumer artifact.',
      );
    const destination = '.artifacts/releases/' + VERSION;
    await mkdir(destination, { recursive: true });
    writeImmutableArtifact(destination + '/' + packed.filename, bytes);
    writeImmutableArtifact(
      destination + '/manifest.json',
      Buffer.from(
        JSON.stringify(
          {
            qualification,
            package: {
              name: manifest.name,
              version: manifest.version,
              file: packed.filename,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            },
          },
          null,
          2,
        ) + '\n',
      ),
    );
  }
} finally {
  await rm(stage, { recursive: true, force: true });
}
console.log(
  development
    ? 'Packaged a local development SDK; publishing still requires release verification.'
    : 'Packaged an immutable qualified SDK; no registry publication or deployment was performed.',
);
