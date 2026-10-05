import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { PrivateKey } from '@wharfkit/antelope';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
const dao = String(Date.now());
function cleos(args: string[]): void {
  try {
    execFileSync(
      'docker',
      ['exec', 'daclify-v2-native', 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('NATIVE_MODULE_AUTHORITY_REJECTED');
  }
}
function push(account: string, action: string, data: unknown[], actor: string) {
  cleos(['push', 'action', account, action, JSON.stringify(data), '-p', `${actor}@active`]);
}
beforeAll(() => {
  unlockFixtureWallet('daclify-v2-native');
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
    [dao, 'works', 1, ['propose'], ['reserve', 'approve', 'cancel']],
    'alice',
  );
  push('eosio.token', 'transfer', ['alice', 'daclifycore', '2.0000 TLOS', `dao:${dao}`], 'alice');
});
describe('native module owner and contract authority are distinct', () => {
  it('does not let a module account owner bypass its contract review flow', () => {
    expect(() =>
      push('daclifycore', 'reserve', [dao, 'works', 1, 1, '1.0000 TLOS', 0], 'works'),
    ).toThrow('NATIVE_MODULE_AUTHORITY_REJECTED');
  });
});
