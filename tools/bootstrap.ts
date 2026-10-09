// Node 24 can run this dependency-free TS entry point before the repository is installed.
// It coordinates three separate checkouts; it is not a workspace or a release publisher.
import { readFile, mkdir, cp, writeFile, access, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const core = fileURLToPath(new URL('../', import.meta.url));
const modules = join(dirname(core), 'daclify-backend-modules');
const frontend = join(dirname(core), 'daclify-frontend');
if (!/^24\./.test(process.versions.node) || Number(process.versions.node.split('.')[1]) < 21)
  throw new Error('Node 24.21 or newer in the Node 24 line is required');
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== '--contracts')) throw new Error('Supported option: --contracts');
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function json(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!record(value)) throw new Error(`Invalid object: ${path}`);
  return value;
}
function command(file: string, args: string[], cwd: string) {
  execFileSync(file, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` },
  });
}
function npm(args: string[], cwd: string) {
  command('npm', args, cwd);
}
const npmVersion = execFileSync('npm', ['--version'], {
  encoding: 'utf8',
  env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}` },
}).trim();
if (!/^11\./.test(npmVersion) || Number(npmVersion.split('.')[1]) < 19)
  throw new Error('npm 11.19 or newer in the npm 11 line is required');
for (const repo of [core, modules, frontend]) await access(join(repo, 'package.json'));
const publicManifest = await json(join(core, 'sdk/public-package.json'));
const builderManifest = await json(join(core, 'tools/bootstrap/builder/package.json'));
const rootManifest = await json(join(core, 'package.json'));
const moduleManifest = await json(join(modules, 'package.json'));
if (
  !record(publicManifest.dependencies) ||
  !record(builderManifest.dependencies) ||
  !record(builderManifest.devDependencies) ||
  !record(rootManifest.devDependencies)
)
  throw new Error('Builder dependency metadata missing');
for (const [name, version] of Object.entries(publicManifest.dependencies))
  if (builderManifest.dependencies[name] !== version)
    throw new Error(`Regenerate the builder lock for ${name}`);
if (
  Object.keys(publicManifest.dependencies).length !==
  Object.keys(builderManifest.dependencies).length
)
  throw new Error('The builder runtime dependencies must match the public SDK');
for (const [name, version] of Object.entries(builderManifest.devDependencies))
  if (rootManifest.devDependencies[name] !== version)
    throw new Error(`Regenerate the builder compiler lock for ${name}`);
const version = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
if (
  typeof publicManifest.version !== 'string' ||
  !version.test(publicManifest.version) ||
  typeof moduleManifest.version !== 'string' ||
  !version.test(moduleManifest.version)
)
  throw new Error('Valid independent package versions required');
const artifacts = join(core, '.artifacts');
const stage = join(artifacts, 'bootstrap-public');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(join(core, 'tools/bootstrap/builder'), stage, { recursive: true });
for (const path of ['protocol', 'sdk', 'contracts/common', 'docs/generated'])
  await cp(join(core, path), join(stage, path), { recursive: true });
const sourceConfig = await json(join(core, 'tsconfig.json'));
if (!record(sourceConfig.compilerOptions)) throw new Error('Compiler options missing');
await writeFile(
  join(stage, 'tsconfig.json'),
  JSON.stringify(
    { compilerOptions: sourceConfig.compilerOptions, include: ['protocol/**/*.ts', 'sdk/**/*.ts'] },
    null,
    2,
  ) + '\n',
);
npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], stage);
command(
  process.execPath,
  [join(stage, 'node_modules/typescript/bin/tsc'), '-p', join(stage, 'tsconfig.json')],
  stage,
);
await writeFile(join(stage, 'package.json'), JSON.stringify(publicManifest, null, 2) + '\n');
await cp(join(core, 'sdk/README.md'), join(stage, 'README.md'));
for (const name of ['LICENSE', 'LICENSING.md']) await cp(join(core, name), join(stage, name));
npm(['pack', '--pack-destination', artifacts], stage);
const coreTar = `../daclify-backend-core/.artifacts/daclify-core-protocol-${publicManifest.version}.tgz`;
const moduleTar = `../daclify-backend-modules/.artifacts/daclify-modules-${moduleManifest.version}.tgz`;
async function installFrontendPackages() {
  const coreFile = `daclify-core-protocol-${publicManifest.version}.tgz`;
  const moduleFile = `daclify-modules-${moduleManifest.version}.tgz`;
  await mkdir(join(frontend, 'vendor'), { recursive: true });
  await cp(join(artifacts, coreFile), join(frontend, 'vendor', coreFile));
  await cp(join(modules, '.artifacts', moduleFile), join(frontend, 'vendor', moduleFile));
  npm(
    [
      'install',
      '--package-lock-only',
      '--save-prod',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      `./vendor/${coreFile}`,
      `./vendor/${moduleFile}`,
    ],
    frontend,
  );
  npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], frontend);
}
// Development artifacts have not been published. Refresh their lock integrities explicitly;
// --save-dev preserves the module's exact released-core peer range.
await mkdir(join(modules, '.artifacts'), { recursive: true });
npm(
  [
    'install',
    '--package-lock-only',
    '--save-dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    coreTar,
  ],
  modules,
);
npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], modules);
npm(['run', 'build'], modules);
npm(['pack', '--pack-destination', '.artifacts'], modules);
npm(
  [
    'install',
    '--package-lock-only',
    '--save-prod',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    `.artifacts/daclify-core-protocol-${publicManifest.version}.tgz`,
    moduleTar,
  ],
  core,
);
npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], core);
await installFrontendPackages();
if (flags.includes('--contracts')) {
  // Requires the documented checksum-verified local toolchain image. No chain deployment.
  npm(['run', 'build:contracts'], core);
  npm(['run', 'codegen'], core);
  npm(['run', 'docs:generate'], core);
  npm(['run', 'build'], core);
  npm(['run', 'package:protocol'], core);
  npm(
    [
      'install',
      '--save-prod',
      '--ignore-scripts',
      `.artifacts/daclify-core-protocol-${publicManifest.version}.tgz`,
    ],
    core,
  );
  npm(['install', '--save-dev', '--ignore-scripts', coreTar], modules);
  npm(['run', 'build:contracts'], modules);
  npm(['run', 'codegen'], modules);
  npm(['run', 'docs:generate'], modules);
  npm(['run', 'build'], modules);
  npm(['pack', '--pack-destination', '.artifacts'], modules);
  await mkdir(join(modules, '.artifacts/core-release'), { recursive: true });
  for (const name of ['runtime', 'testtoken'])
    for (const extension of ['wasm', 'abi'])
      await cp(
        join(core, `.artifacts/contracts/${name}.${extension}`),
        join(modules, `.artifacts/core-release/${name}.${extension}`),
      );
  npm(['install', '--save-prod', '--ignore-scripts', moduleTar], core);
  await installFrontendPackages();
}
console.log(
  'Development checkouts bootstrapped from locked dependencies. No package was published and no chain was deployed.',
);
