// Owned native fixture only: age existing clocks, then restore exact production WASM.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const directory = '.artifacts/document-aged';
mkdirSync(directory, { recursive: true });
const source = readFileSync('contracts/runtime/runtime.cpp', 'utf8')
  .replace(
    '  ACTION backfilldocs(',
    `  ACTION agedoc(uint64_t dao_id,uint64_t id){require_auth(get_self());document_clocks rows(get_self(),dao_id);const auto& clock=rows.get(id);rows.modify(clock,same_payer,[&](auto& r){r.created_at=current_time_point().sec_since_epoch()-100*86400;});}\n  ACTION backfilldocs(`,
  )
  .replace('(backfilldocs)(prunedocs)', '(backfilldocs)(agedoc)(prunedocs)');
writeFileSync(directory + '/runtime.cpp', source);
const compiler = process.env.DACLIFY_CDT_BINARY;
const environment = compiler
  ? { ...process.env, LD_LIBRARY_PATH: process.env.DACLIFY_NATIVE_LIBS ?? '' }
  : process.env;
if (
  compiler &&
  execFileSync(compiler, ['--version'], { env: environment, encoding: 'utf8' }).trim() !==
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
          resolve('.') + ':/work',
          'daclify-v2-toolchain:4.1.1-spring1.2.2',
          'cdt-cpp',
        ]),
    directory + '/runtime.cpp',
    '-O=s',
    '-I',
    'contracts/common',
    '-I',
    'contracts/runtime',
    '-I',
    'contracts/vendor',
    '-o',
    directory + '/runtime.wasm',
    '--abigen',
    '-contract',
    'runtime',
  ],
  { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024, env: environment },
);

const optimizer = process.env.DACLIFY_WASM_OPT_BINARY ?? 'wasm-opt';
if (
  execFileSync(optimizer, ['--version'], { env: environment, encoding: 'utf8' }).trim() !==
  'wasm-opt version 108'
)
  throw Error('PINNED_WASM_OPT_REQUIRED');
execFileSync(
  optimizer,
  [directory + '/runtime.wasm', '--mvp-features', '-Oz', '-o', directory + '/runtime.wasm'],
  { env: environment, stdio: 'pipe' },
);
