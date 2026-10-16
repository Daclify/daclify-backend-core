// Reproduce the exact released pre-privacy cohort; never rebuild historical fixtures with newer headers.
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  copyFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ABI, Serializer } from '@wharfkit/antelope';
const root = resolve('.'),
  destination = resolve('.artifacts/privacy-upgrade');
const core = '38514071e531bc8cbc1d77f641ea1018917529aa',
  modules = '491e9dbed0fd0895bc54c75bbfe4198aec132a9c';
const pins = {
  runtime: 'afa80071de5578e915c5b4c37d02f294c612a713299fa264116e7f338d65ca2d',
  decide: '1dbbd528e111c750e1b33eeef21db2252243de134fede3dea02ebb4341f1b95c',
  payroll: 'c5b6aa9975709b6094c716df00b7a1c7134b1e9e9597c632090e54bbbb9184fc',
};
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
mkdirSync(destination, { recursive: true });
const compiler = process.env.DACLIFY_CDT_BINARY,
  optimizer = process.env.DACLIFY_WASM_OPT_BINARY;
const environment = { ...process.env, LD_LIBRARY_PATH: process.env.DACLIFY_NATIVE_LIBS ?? '' };
if (
  !compiler ||
  !optimizer ||
  execFileSync(compiler, ['--version'], { env: environment, encoding: 'utf8' }).trim() !==
    'cdt-cpp version 4.1.1' ||
  execFileSync(optimizer, ['--version'], { encoding: 'utf8' }).trim() !== 'wasm-opt version 108'
)
  throw Error('PINNED_TOOLCHAIN_REQUIRED');
const scratch = mkdtempSync(resolve('.artifacts/privacy-upgrade-build-'));
try {
  for (const [repository, commit, directory] of [
    [root, core, 'core'],
    [resolve('../daclify-backend-modules'), modules, 'modules'],
  ]) {
    if (!repository || !commit || !directory) throw Error('FIXTURE_SOURCE');
    const target = resolve(scratch, directory);
    mkdirSync(target, { recursive: true });
    const archive = target + '/contracts.tar';
    writeFileSync(
      archive,
      execFileSync('git', ['-C', repository, 'archive', commit, 'contracts'], {
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
    execFileSync('tar', ['-xf', archive, '-C', target]);
  }
  const target = resolve(scratch, 'modules/node_modules/@daclify/core-protocol/contracts/common');
  mkdirSync(target, { recursive: true });
  cpSync(resolve(scratch, 'core/contracts/common'), target, { recursive: true });
  for (const [contract, pin] of Object.entries(pins)) {
    const output = destination + '/' + contract;
    if (!existsSync(output + '.wasm') || !existsSync(output + '.abi')) {
      const source = resolve(scratch, contract === 'runtime' ? 'core' : 'modules');
      execFileSync(
        compiler,
        [
          'contracts/' + contract + '/' + contract + '.cpp',
          '-O=s',
          '-I',
          contract === 'runtime'
            ? 'contracts/common'
            : 'node_modules/@daclify/core-protocol/contracts/common',
          '-I',
          'contracts/common',
          '-I',
          'contracts/vendor',
          '-o',
          source + '/' + contract + '.wasm',
          '--abigen',
          '-contract',
          contract,
        ],
        { cwd: source, env: environment, stdio: 'inherit' },
      );
      if (contract === 'runtime')
        execFileSync(
          optimizer,
          [
            source + '/' + contract + '.wasm',
            '--mvp-features',
            '-Oz',
            '-o',
            source + '/' + contract + '.wasm',
          ],
          { stdio: 'inherit' },
        );
      copyFileSync(source + '/' + contract + '.wasm', output + '.wasm');
      copyFileSync(source + '/' + contract + '.abi', output + '.abi');
    }
    if (hash(readFileSync(output + '.wasm')) !== pin)
      throw Error('HISTORICAL_PRIVACY_FIXTURE_PIN_CHANGED');
    console.log(
      contract,
      pin,
      hash(Serializer.encode({ object: ABI.from(readFileSync(output + '.abi', 'utf8')) }).array),
    );
  }
  writeFileSync(
    destination + '/provenance.json',
    JSON.stringify(
      { core, modules, compiler: 'CDT4.1.1 -O=s; runtime MVP wasm-opt108 -Oz', pins },
      null,
      2,
    ) + '\n',
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
