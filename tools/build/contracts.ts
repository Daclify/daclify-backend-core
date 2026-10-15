import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(process.cwd());
const compiler = process.env.DACLIFY_CDT_BINARY;
const optimizer = process.env.DACLIFY_WASM_OPT_BINARY;
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
const contracts = [
  'runtime',
  'quickauth',
  'quickprobe',
  'appjoin',
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
];
const selected = process.argv.slice(2);
if (selected.some((contract) => !contracts.includes(contract))) throw new Error('UNKNOWN_CONTRACT');
for (const contract of selected.length ? selected : contracts) {
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
      '-O=s',
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
  if (contract === 'runtime') {
    const binary = optimizer ?? 'wasm-opt';
    const prefix = compiler
      ? []
      : [
          'run',
          '--rm',
          '--platform',
          'linux/amd64',
          '-v',
          `${root}:/work`,
          'daclify-v2-toolchain:4.1.1-spring1.2.2',
        ];
    const run = (args: string[], capture = false) =>
      execFileSync(
        compiler ? binary : 'docker',
        [...prefix, ...(compiler ? [] : [binary]), ...args],
        {
          env: environment,
          ...(capture ? { encoding: 'utf8' as const } : { stdio: 'inherit' as const }),
        },
      );
    if (String(run(['--version'], true)).trim() !== 'wasm-opt version 108')
      throw new Error('PINNED_WASM_OPT_REQUIRED');
    // Keep the runtime below Spring's 1 MiB decoder limit without adding non-MVP instructions.
    run([
      `.artifacts/contracts/${contract}.wasm`,
      '--mvp-features',
      '-Oz',
      '-o',
      `.artifacts/contracts/${contract}.wasm`,
    ]);
  }
}
