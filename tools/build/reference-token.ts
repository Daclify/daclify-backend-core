// Compile pinned official reference code only into ignored calibration artifacts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readBoundedResponse } from '../../services/api/src/http.js';
const commit = 'c526479a48370981a1e9f0ac6b3bb0e4f737afa2';
const files = [
  {
    path: 'src/eosio.token.cpp',
    sha256: 'abfeb90e0cbae7c7438c37f6e0de6bcc5a04b96e830bc5525e1bae92eeda3dbe',
  },
  {
    path: 'include/eosio.token/eosio.token.hpp',
    sha256: '6cd0c910eb4951fbdb1ce332530d4f5bf30094ea78c862c4ca5f6c4c12e9bdbd',
  },
];
for (const file of files) {
  const response = await fetch(
    `https://raw.githubusercontent.com/AntelopeIO/reference-contracts/${commit}/contracts/eosio.token/${file.path}`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) },
  );
  assert.ok(response.ok, 'REFERENCE_TOKEN_SOURCE_UNAVAILABLE');
  const bytes = await readBoundedResponse(response, 65536);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    file.sha256,
    'REFERENCE_TOKEN_SOURCE_CHANGED',
  );
  const output = '.artifacts/reference-token/' + file.path;
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, bytes);
}
execFileSync(
  'docker',
  [
    'run',
    '--rm',
    '--platform',
    'linux/amd64',
    '-v',
    `${resolve(process.cwd())}:/work`,
    'daclify-v2-toolchain:4.1.1-spring1.2.2',
    'cdt-cpp',
    '.artifacts/reference-token/src/eosio.token.cpp',
    '-I',
    '.artifacts/reference-token/include',
    '-o',
    '.artifacts/reference-token/reference.wasm',
    '--abigen',
    '-contract',
    'eosio.token',
  ],
  { stdio: 'inherit' },
);
writeFileSync(
  '.artifacts/reference-token/source-pins.json',
  JSON.stringify({ commit, files }, null, 2) + '\n',
);
