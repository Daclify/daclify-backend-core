import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(process.cwd());
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
mkdirSync('.artifacts/contracts', { recursive: true });
for (const contract of [
  'runtime',
  'hub',
  'permprobe',
  'authorityprobe',
  'ramprobe',
  'migprobe',
  'testtoken',
  'boot',
  'modrelay',
  'names',
  'eosstub',
]) {
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
            `${root}:/work`,
            'daclify-v2-toolchain:4.1.1-spring1.2.2',
            'cdt-cpp',
          ]),
      `contracts/${contract}/${contract}.cpp`,
      // Names fits the existing testnet RAM allocation with size optimization.
      ...(contract === 'names' ? ['-O=s'] : []),
      '-I',
      'contracts/common',
      '-I',
      'contracts/vendor',
      '-o',
      `.artifacts/contracts/${contract}.wasm`,
      '--abigen',
      '-contract',
      contract,
    ],
    { stdio: 'inherit', env: environment },
  );
}
