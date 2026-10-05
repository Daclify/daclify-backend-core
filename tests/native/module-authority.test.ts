import { beforeAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { PrivateKey } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { z } from 'zod';
const dao = String(Date.now());
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
    [dao, 'works', 1, ['propose', 'accept'], ['reserve', 'approve', 'cancel']],
    'alice',
  );
  push('eosio.token', 'transfer', ['alice', 'daclifycore', '2.0000 TLOS', `dao:${dao}`], 'alice');
});
describe('native module owner and contract authority are distinct', () => {
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
});
