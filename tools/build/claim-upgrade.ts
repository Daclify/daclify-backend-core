// Preserve the deployed core18 compiler flags and hash for claim upgrade/rollback qualification.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('.artifacts/claim-upgrade18');
mkdirSync(root, { recursive: true });
const archive = resolve(root, 'source.tar');
execFileSync('git', [
  'archive',
  '--output=' + archive,
  '59319aca8b4578a4322447413dd4380fd29d4054',
  'contracts',
]);
execFileSync('tar', ['-xf', archive, '-C', root]);
const compiler = process.env.DACLIFY_CDT_BINARY;
const env = compiler
  ? { ...process.env, LD_LIBRARY_PATH: process.env.DACLIFY_NATIVE_LIBS ?? '' }
  : process.env;
if (
  compiler &&
  execFileSync(compiler, ['--version'], { env, encoding: 'utf8' }).trim() !==
    'cdt-cpp version 4.1.1'
)
  throw Error('PINNED_CDT_REQUIRED');
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
    'contracts/runtime/runtime.cpp',
    '-O=s',
    '-I',
    'contracts/common',
    '-I',
    'contracts/vendor',
    '-o',
    'runtime.wasm',
    '--abigen',
    '-contract',
    'runtime',
  ],
  { cwd: root, env, stdio: 'inherit' },
);
if (
  createHash('sha256')
    .update(readFileSync(resolve(root, 'runtime.wasm')))
    .digest('hex') !== 'e6aaeeccb949710444e0fe4ca32331ffeeb5a6eeae688a417ae3d22cd3469d95'
)
  throw Error('HISTORICAL_CLAIM_FIXTURE_HASH');
console.log('Preserved core18 upgrade fixture matches the deployed WASM hash.');
