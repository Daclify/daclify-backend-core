import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { writeImmutableArtifact } from '../release/artifact.js';
const sourceRef = '2d3df11d84dab3450f7aac2e74fc26cb082d43ab';
const pins = {
  wasm: '5cb464cc861f1662781f6fa56267403e22c217bfbd5041158953a07f0007bc58',
  abi: '300b7f5029c9b9d4f13935db1b152cee3b42ad5d78c69b5d7f5e11a9b0b0eaee',
};
const compiler = process.env.DACLIFY_CDT_BINARY;
if (!compiler) throw new Error('PINNED_CDT_REQUIRED');
const environment = { ...process.env, LD_LIBRARY_PATH: process.env.DACLIFY_NATIVE_LIBS ?? '' };
if (
  execFileSync(compiler, ['--version'], { env: environment, encoding: 'utf8' }).trim() !==
  'cdt-cpp version 4.1.1'
)
  throw new Error('PINNED_CDT_REQUIRED');
const root = process.cwd(),
  directory = await mkdtemp(join(tmpdir(), 'daclify-exit-history-'));
try {
  const archive = join(directory, 'contracts.tar');
  execFileSync('git', ['archive', '--format=tar', '--output', archive, sourceRef, 'contracts'], {
    cwd: root,
  });
  execFileSync('tar', ['-xf', archive, '-C', directory]);
  await mkdir(join(directory, '.artifacts/contracts'), { recursive: true });
  execFileSync(
    compiler,
    [
      'contracts/runtime/runtime.cpp',
      '-O=s',
      '-I',
      'contracts/common',
      '-I',
      'contracts/vendor',
      '-o',
      '.artifacts/contracts/runtime.wasm',
      '--abigen',
      '-contract',
      'runtime',
    ],
    { cwd: directory, env: environment, stdio: 'inherit' },
  );
  const target = resolve(root, '.artifacts/account-exit-legacy');
  await mkdir(target, { recursive: true });
  for (const extension of ['wasm', 'abi'] as const) {
    const bytes = await readFile(join(directory, '.artifacts/contracts/runtime.' + extension));
    if (createHash('sha256').update(bytes).digest('hex') !== pins[extension])
      throw new Error('HISTORICAL_ACCOUNT_EXIT_FIXTURE_MISMATCH');
    writeImmutableArtifact(join(target, 'runtime.' + extension), bytes);
  }
  writeImmutableArtifact(
    join(target, 'source-pins.json'),
    new TextEncoder().encode(
      JSON.stringify({ sourceRef, cdt: '4.1.1', optimization: '-O=s', ...pins }, null, 2) + '\n',
    ),
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
