import { mkdir, cp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { VERSION } from '../../protocol/base.js';
const development = process.argv.includes('--development');
const manifest = z
  .object({
    name: z.literal('@daclify/core-protocol'),
    version: z.literal(VERSION),
    dependencies: z.record(z.string(), z.string()),
  })
  .passthrough()
  .parse(JSON.parse(await readFile('sdk/public-package.json', 'utf8')));
if (
  Object.keys(manifest.dependencies).some(
    (name) => !['@wharfkit/antelope', 'zod', 'multiformats', 'semver'].includes(name),
  )
)
  throw new Error('Private service dependencies cannot enter the public protocol package');
if (!development) {
  throw new Error(
    'Release packaging is unavailable until the immutable verification manifest and held contract checks are resolved. Use --development for local review artifacts.',
  );
}
const stage = '.artifacts/public-package';
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
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
await writeFile(`${stage}/package.json`, JSON.stringify(manifest, null, 2) + '\n');
await cp('sdk/README.md', `${stage}/README.md`);
execFileSync('npm', ['pack', stage, '--pack-destination', '.artifacts'], { stdio: 'inherit' });
console.log(
  development
    ? 'Packaged a local development SDK; publishing still requires release verification.'
    : 'Packaged a release SDK.',
);
