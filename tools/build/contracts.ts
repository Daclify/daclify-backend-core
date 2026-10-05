import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(process.cwd());
mkdirSync('.artifacts/contracts', { recursive: true });
for (const contract of ['runtime', 'hub', 'permprobe', 'testtoken', 'boot']) {
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--platform',
      'linux/amd64',
      '-v',
      `${root}:/work`,
      'daclify-v2-toolchain:4.1.1-spring1.2.2',
      'cdt-cpp',
      `contracts/${contract}/${contract}.cpp`,
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
    { stdio: 'inherit' },
  );
}
