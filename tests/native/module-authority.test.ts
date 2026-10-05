import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { PrivateKey } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { ZERO_CODE_HASH, wasmCodeHash } from '../helpers/code-hash.js';
import { z } from 'zod';
const dao = String(Date.now());
const rpc = 'http://127.0.0.1:18888';
function cleos(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      ['exec', 'daclify-v2-native', 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(stderr || 'Native command failed');
  }
}
function push(account: string, action: string, data: unknown[], actor: string) {
  cleos(['push', 'action', account, action, JSON.stringify(data), '-p', `${actor}@active`]);
}
async function liveCodeHash(account: string): Promise<string> {
  const response = await fetch(`${rpc}/v1/chain/get_code_hash`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  if (!response.ok) throw new Error('CODE_HASH_UNAVAILABLE');
  return z.object({ code_hash: z.string().regex(/^[0-9a-f]{64}$/) }).parse(await response.json())
    .code_hash;
}
function wasmWithMarker(wasm: Buffer): Buffer {
  const name = Buffer.from('daclify-pin-probe');
  const body = Buffer.concat([unsignedLeb128(name.length), name, Buffer.from([7])]);
  return Buffer.concat([wasm, Buffer.from([0]), unsignedLeb128(body.length), body]);
}
function unsignedLeb128(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return Buffer.from(bytes);
}
let worksHash = '';
beforeAll(async () => {
  unlockFixtureWallet('daclify-v2-native');
  worksHash = await liveCodeHash('works');
  if (worksHash !== wasmCodeHash('../daclify-backend-modules/.artifacts/contracts/works.wasm'))
    throw new Error('WORKS_ARTIFACT_HASH');
  push('daclifycore', 'createdao', [dao, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice');
  push(
    'daclifycore',
    'enroll',
    [dao, 1, '', PrivateKey.generate('K1').toPublic().toString(), 'fixture', 0],
    'alice',
  );
  push(
    'daclifycore',
    'setmodule',
    [dao, 'works', 1, ['propose', 'accept'], ['reserve', 'approve', 'cancel'], worksHash],
    'alice',
  );
  push('eosio.token', 'transfer', ['alice', 'daclifycore', '2.0000 TLOS', `dao:${dao}`], 'alice');
});
function aliceKey(): string {
  const account = z
    .object({
      permissions: z.array(
        z.object({
          perm_name: z.string(),
          required_auth: z.object({ keys: z.array(z.object({ key: z.string() })) }),
        }),
      ),
    })
    .parse(JSON.parse(cleos(['get', 'account', 'alice', '-j'])));
  const key = account.permissions.find((item) => item.perm_name === 'active')?.required_auth.keys[0]
    ?.key;
  if (!key) throw new Error('ALICE_KEY');
  return key;
}
function pinAccount(): string {
  let value = BigInt(Date.now());
  let suffix = '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz12345';
  while (suffix.length < 9) {
    suffix = alphabet[Number(value % 31n)] + suffix;
    value /= 31n;
  }
  return `pin${suffix}`;
}
function deployRelay(account: string, wasm: Buffer) {
  const dir = mkdtempSync(join(tmpdir(), 'daclify-modpin-'));
  writeFileSync(join(dir, 'modrelay.wasm'), wasm);
  writeFileSync(join(dir, 'modrelay.abi'), readFileSync('.artifacts/contracts/modrelay.abi'));
  execFileSync('docker', ['exec', 'daclify-v2-native', 'rm', '-rf', `/tmp/${account}`]);
  execFileSync('docker', ['cp', dir, `daclify-v2-native:/tmp/${account}`]);
  cleos([
    'set',
    'contract',
    account,
    `/tmp/${account}`,
    'modrelay.wasm',
    'modrelay.abi',
    '-p',
    `${account}@active`,
  ]);
}
describe('native module owner and contract authority are distinct', () => {
  it('rejects a module pin that does not match the deployed code', () => {
    expect(() =>
      push(
        'daclifycore',
        'setmodule',
        [dao, 'works', 1, ['propose'], ['reserve'], 'ab'.repeat(32)],
        'alice',
      ),
    ).toThrow('MODULE_CODE');
  });
  it('does not let a module account owner bypass its contract review flow', () => {
    expect(() =>
      push('daclifycore', 'reserve', [dao, 'works', 1, 1, '1.0000 TLOS', 0], 'works'),
    ).toThrow('SOURCE_SENDER');
  });
  it('lets the works contract reserve through its own inline action', async () => {
    const cid = CID.createV1(
      0x55,
      await sha256.digest(new TextEncoder().encode('deliverable')),
    ).toString();
    push(
      'daclifycore',
      'putdoc',
      ['daclifycore', dao, 1, 1, 1, cid, '{}', 'ab'.repeat(32), 11, 0, 0],
      'daclifycore',
    );
    push(
      'works',
      'propose',
      ['daclifycore', dao, 1, dao, 1, 1, 1, ['1.0000 TLOS'], [0]],
      'daclifycore',
    );
    push('works', 'accept', ['daclifycore', dao, 1, dao], 'daclifycore');
    const table = z
      .object({
        rows: z.array(
          z.object({
            id: z.union([z.string(), z.number()]),
            reserved: z.union([z.string(), z.number()]),
          }),
        ),
      })
      .parse(
        JSON.parse(
          cleos([
            'get',
            'table',
            'daclifycore',
            'daclifycore',
            'daos',
            '--lower',
            dao,
            '--limit',
            '1',
          ]),
        ),
      );
    expect(String(table.rows[0]?.id)).toBe(dao);
    expect(String(table.rows[0]?.reserved)).toBe('10000');
  });
  it('rejects the callback after that module account changes code', async () => {
    const account = pinAccount();
    const key = aliceKey();
    cleos(['create', 'account', 'eosio', account, key, key]);
    const wasm = readFileSync('.artifacts/contracts/modrelay.wasm');
    deployRelay(account, wasm);
    cleos([
      'set',
      'account',
      'permission',
      account,
      'active',
      '--add-code',
      '-p',
      `${account}@active`,
    ]);
    const hash = await liveCodeHash(account);
    expect(hash).toBe(wasmCodeHash('.artifacts/contracts/modrelay.wasm'));
    push('daclifycore', 'setmodule', [dao, account, 1, [], ['reserve'], hash], 'alice');
    push(account, 'reserve', ['daclifycore', dao, 77, 1, '1.0000 TLOS', 0], account);
    deployRelay(account, wasmWithMarker(wasm));
    expect(await liveCodeHash(account)).not.toBe(hash);
    expect(() =>
      push(account, 'reserve', ['daclifycore', dao, 78, 1, '1.0000 TLOS', 0], account),
    ).toThrow('MODULE_CODE');
    push('daclifycore', 'setmodule', [dao, account, 1, [], [], ZERO_CODE_HASH], 'alice');
  });
});
