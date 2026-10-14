import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const sourceRef = '50fb975e09a86b6d2e4f7b3890b6cb3eb180e6e0',
  expectedWasm = 'b0c1826a210d273b3250915b7db0a4c1a4cc70be465153195b52febfb3272fb4',
  expectedAbi = 'd31f9e6c7d2a3608956cbab683d5212c905b21ab9fe3ec751b6ea7e5e5f2652d';
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
const root = process.cwd(),
  directory = await mkdtemp(join(tmpdir(), 'daclify-profile-history-'));
try {
  const archive = join(directory, 'contracts.tar');
  execFileSync('git', ['archive', '--format=tar', '--output', archive, sourceRef, 'contracts'], {
    cwd: root,
  });
  execFileSync('tar', ['-xf', archive, '-C', directory]);
  await mkdir(join(directory, '.artifacts/contracts'), { recursive: true });
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
            `${directory}:/work`,
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
      '.artifacts/contracts/runtime.wasm',
      '--abigen',
      '-contract',
      'runtime',
    ],
    { cwd: directory, env: environment, stdio: 'inherit' },
  );
  const digest = async (extension: string) =>
    createHash('sha256')
      .update(await readFile(join(directory, '.artifacts/contracts/runtime.' + extension)))
      .digest('hex');
  if ((await digest('wasm')) !== expectedWasm || (await digest('abi')) !== expectedAbi)
    throw new Error('HISTORICAL_PROFILE_FIXTURE_MISMATCH');
  const target = resolve(root, '.artifacts/profile-legacy');
  await mkdir(target, { recursive: true });
  for (const extension of ['wasm', 'abi'])
    await copyFile(
      join(directory, '.artifacts/contracts/runtime.' + extension),
      join(target, 'runtime.' + extension),
    );
  await writeFile(
    join(target, 'source-pins.json'),
    JSON.stringify(
      { sourceRef, cdt: '4.1.1', optimization: '-O=s', wasm: expectedWasm, abi: expectedAbi },
      null,
      2,
    ) + '\n',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
