import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(process.cwd()),
  revision = '8a2c5f94622c219814d2bbd0689f49ac6ea12d65';
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
mkdirSync('.artifacts/ownership-policy1', { recursive: true });
const source = mkdtempSync('.artifacts/ownership-source-');
try {
  // Rebuild the real preceding policy, rather than manufacturing legacy table bytes.
  const archive = execFileSync('git', ['archive', revision, 'contracts'], {
    maxBuffer: 32 * 1024 * 1024,
  });
  execFileSync('tar', ['-x', '-C', source], { input: archive });
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
      `${source}/contracts/runtime/runtime.cpp`,
      '-I',
      `${source}/contracts/common`,
      '-I',
      `${source}/contracts/vendor`,
      '-o',
      '.artifacts/ownership-policy1/runtime.wasm',
      '--abigen',
      '-contract',
      'runtime',
    ],
    { env: environment, stdio: 'inherit' },
  );
} finally {
  rmSync(source, { recursive: true, force: true });
}
