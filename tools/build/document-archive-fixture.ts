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
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '--platform',
    'linux/amd64',
    '-v',
    resolve('.') + ':/work',
    'daclify-v2-toolchain:4.1.1-spring1.2.2',
    'cdt-cpp',
    directory + '/runtime.cpp',
    '-I',
    'contracts/common',
    '-I',
    'contracts/vendor',
    '-o',
    directory + '/runtime.wasm',
    '--abigen',
    '-contract',
    'runtime',
  ],
  { stdio: 'pipe', maxBuffer: 4 * 1024 * 1024 },
);
