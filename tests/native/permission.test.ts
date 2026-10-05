import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { PrivateKey } from '@wharfkit/antelope';
import { fixtureKey } from '../../tools/native/keys.js';
const fixture = { publicKey: fixtureKey('alice').toPublic().toString() };
const wrongKey = PrivateKey.generate('K1').toPublic().toString();
function cleos(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      ['exec', 'daclify-v2-native', 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('NATIVE_PERMISSION_REJECTED');
  }
}
beforeAll(() => {
  unlockFixtureWallet('daclify-v2-native');
  try {
    cleos(['get', 'account', 'permprobe']);
  } catch {
    cleos([
      'create',
      'account',
      'eosio',
      'permprobe',
      fixtureKey('permprobe').toPublic().toString(),
      fixtureKey('permprobe').toPublic().toString(),
    ]);
  }
  cleos([
    'set',
    'contract',
    'permprobe',
    '/work/.artifacts/contracts',
    'permprobe.wasm',
    'permprobe.abi',
  ]);
});
describe('native permission intrinsic unavailable in VERT', () => {
  it('confirms a matching key satisfies the active permission', () => {
    cleos([
      'push',
      'action',
      'permprobe',
      'checkauth',
      JSON.stringify(['alice', 'active', fixture.publicKey, true]),
      '-p',
      'alice@active',
    ]);
  });
  it('rejects a wrong key asserted as authorized', () => {
    expect(() =>
      cleos([
        'push',
        'action',
        'permprobe',
        'checkauth',
        JSON.stringify(['alice', 'active', wrongKey, true]),
        '-p',
        'alice@active',
      ]),
    ).toThrow('NATIVE_PERMISSION_REJECTED');
  });
  it('confirms a wrong key does not satisfy the active permission', () => {
    cleos([
      'push',
      'action',
      'permprobe',
      'checkauth',
      JSON.stringify(['alice', 'active', wrongKey, false]),
      '-p',
      'alice@active',
    ]);
  });
});
