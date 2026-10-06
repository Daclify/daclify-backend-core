import { execFileSync } from 'node:child_process';

function cleos(args: string[]): void {
  try {
    execFileSync(
      'docker',
      ['exec', 'daclify-v2-native', 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(stderr || 'Native command failed');
  }
}

export function listFirstPartyModule(account: string, codeHash: string, title: string): void {
  cleos([
    'push',
    'action',
    'daclifycore',
    'listmod',
    JSON.stringify([account, 'fees', 0, 1, '0.0000 TLOS', codeHash, title]),
    '-p',
    'daclifycore@active',
  ]);
}

export function unlistModule(account: string): void {
  cleos([
    'push',
    'action',
    'daclifycore',
    'unlistmod',
    JSON.stringify([account]),
    '-p',
    'daclifycore@active',
  ]);
}
