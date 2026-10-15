import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const compiler = process.env.DACLIFY_CDT_BINARY;
if (!compiler) throw new Error('PINNED_CDT_BINARY_REQUIRED');
const environment = { ...process.env, LD_LIBRARY_PATH: process.env.DACLIFY_NATIVE_LIBS ?? '' };
if (
  execFileSync(compiler, ['--version'], { env: environment, encoding: 'utf8' }).trim() !==
  'cdt-cpp version 4.1.1'
)
  throw new Error('PINNED_CDT_REQUIRED');
mkdirSync('.artifacts/contracts', { recursive: true });
for (const contract of ['boot', 'ballotprobe']) {
  const directory = '.artifacts/contracts';
  execFileSync(
    compiler,
    [
      `contracts/${contract}/${contract}.cpp`,
      '-O=s',
      ...(contract === 'ballotprobe' ? ['-std=c++2a', '-I', 'node_modules/@daclify/modules/contracts/common'] : []),
      '-o',
      `${directory}/${contract}.wasm`,
      '--abigen',
      '-contract',
      contract,
    ],
    { env: environment, stdio: 'inherit' },
  );
}
