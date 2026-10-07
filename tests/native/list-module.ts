import { fixtureNetwork } from '../../tools/native/network.js';
const ownedNetwork = fixtureNetwork();
import { z } from 'zod';
import { execFileSync } from 'node:child_process';

function cleos(args: string[]): void {
  try {
    execFileSync(
      'docker',
      ['exec', ownedNetwork.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(stderr || 'Native command failed');
  }
}

export function listFirstPartyModule(account: string, codeHash: string, title: string): void {
  const config = z
    .object({ rows: z.array(z.object({ treasury: z.string() })) })
    .parse(
      JSON.parse(
        execFileSync(
          'docker',
          [
            'exec',
            ownedNetwork.container,
            'cleos',
            'get',
            'table',
            'daclifycore',
            'daclifycore',
            'feecfg',
            '--limit',
            '1',
          ],
          { encoding: 'utf8' },
        ),
      ),
    );
  const treasury = config.rows[0]?.treasury;
  if (!treasury) throw new Error('FIXTURE_FEE_CONFIGURATION');
  cleos([
    'push',
    'action',
    'daclifycore',
    'listmod',
    JSON.stringify([account, treasury, 0, 1, '0.0000 TLOS', codeHash, title]),
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
