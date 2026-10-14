// Reproduce the actual pre-research release; fixtures upgrade these rows on the native chain.
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const compiler = process.env.DACLIFY_CDT_BINARY;
const environment = compiler
  ? { ...process.env, LD_LIBRARY_PATH: process.env.DACLIFY_NATIVE_LIBS ?? '' }
  : process.env;
if (
  compiler &&
  execFileSync(compiler, ['--version'], { env: environment, encoding: 'utf8' }).trim() !==
    'cdt-cpp version 4.1.1'
)
  throw new Error('PINNED_CDT_REQUIRED');
const observer = process.argv.includes('--observer');
const root = resolve(observer ? '.artifacts/observer-upgrade-old' : '.artifacts/upgrade');
mkdirSync(root, { recursive: true });
for (const [name, repository, revision] of observer
  ? [['core', '.', '81afcba']]
  : ([
      ['core', '.', '933f57e'],
      ['modules', '../daclify-backend-modules', '3a06bea'],
    ] as const)) {
  const target = resolve(root, name);
  mkdirSync(target, { recursive: true });
  const archive = resolve(root, name + '.tar');
  execFileSync('git', ['archive', '--output=' + archive, revision, 'contracts'], {
    cwd: repository,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  execFileSync('tar', ['-xf', archive, '-C', target], { stdio: ['pipe', 'pipe', 'pipe'] });
}
for (const [directory, contract] of observer
  ? [['core', 'runtime']]
  : ([
      ['core', 'runtime'],
      ['modules', 'decide'],
      ['modules', 'works'],
    ] as const))
  execFileSync(
    compiler ?? 'docker',
    [
      ...(compiler
        ? []
        : [
            'run',
            '--rm',
            '--platform',
            'linux/amd64',
            '-v',
            root + ':/work',
            'daclify-v2-toolchain:4.1.1-spring1.2.2',
            'cdt-cpp',
          ]),
      `${directory}/contracts/${contract}/${contract}.cpp`,
      '-I',
      'core/contracts/common',
      '-I',
      `${directory}/contracts/common`,
      '-I',
      `${directory}/contracts/vendor`,
      '-o',
      `${directory}/${contract}.wasm`,
      '--abigen',
      '-contract',
      contract,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'], cwd: root, env: environment },
  );
if (observer)
  for (const suffix of ['wasm', 'abi'])
    copyFileSync(resolve(root, 'core/runtime.' + suffix), resolve(root, 'runtime.' + suffix));
console.log('Reproduced baseline C++ artifacts for the owned upgrade fixture only.');
