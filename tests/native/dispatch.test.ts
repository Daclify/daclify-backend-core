import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { ABI, Name, PrivateKey, Serializer } from '@wharfkit/antelope';
import { z } from 'zod';
import { makeInstruction, instructionDigest } from '../../sdk/index.js';
import { DaoRefSchema } from '../../protocol/index.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
const network = z
  .strictObject({ url: z.string(), chainId: z.string(), container: z.string() })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const key = PrivateKey.generate('K1');
let value = BigInt(Date.now());
let suffix = '';
while (value > 0n) {
  suffix = String.fromCharCode(97 + Number(value % 26n)) + suffix;
  value /= 26n;
}
const destination = `t${suffix}`;
const daoId = Name.from(destination).value.toString();
const memberId = '10000';
const victim = String(Date.now());
function cleos(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('NATIVE_ACTION_REJECTED');
  }
}
function push(account: string, action: string, data: unknown[], actor: string) {
  return cleos(['push', 'action', account, action, JSON.stringify(data), '-p', `${actor}@active`]);
}
function balance(): string {
  return cleos(['get', 'currency', 'balance', 'eosio.token', 'daclifycore', 'TLOS']).trim();
}
beforeAll(() => {
  unlockFixtureWallet(network.container);
  const publicKey = fixtureKey('bob').toPublic().toString();
  cleos(['create', 'account', 'eosio', destination, publicKey, publicKey]);
  push('daclifycore', 'createdao', [victim, 'alice', '{}', 0, 'eosio.token', '4,TLOS'], 'alice');
  push(
    'eosio.token',
    'transfer',
    ['alice', 'daclifycore', '10.0000 TLOS', `dao:${victim}`],
    'alice',
  );
  push('daclifycore', 'createdao', [daoId, 'bob', '{}', 0, 'eosio.token', '4,TLOS'], 'bob');
  push(
    'daclifycore',
    'enroll',
    [daoId, memberId, '', key.toPublic().toString(), 'fixture-encryption-key', 0],
    'bob',
  );
  push('daclifycore', 'setmodule', [daoId, 'eosio.token', 1, ['transfer'], []], 'bob');
});
describe('native dispatcher permission boundary', () => {
  it('cannot dispatch an ABI-compatible token transfer under runtime spending authority', () => {
    const abi = ABI.from(readFileSync('.artifacts/contracts/testtoken.abi', 'utf8'));
    const bytes = Serializer.encode({
      abi,
      type: 'transfer',
      object: {
        from: 'daclifycore',
        to: destination,
        quantity: '1.0000 TLOS',
        memo: 'Local permission regression',
      },
    });
    const domain = DaoRefSchema.parse({
      chainId: network.chainId,
      contract: 'daclifycore',
      daoId,
      interfaceVersion: 1,
    });
    const request = makeInstruction(
      domain,
      memberId,
      '0',
      Math.floor(Date.now() / 1000) + 300,
      'eosio.token',
      'transfer',
      bytes.array,
    );
    const before = balance();
    expect(() =>
      push(
        'daclifycore',
        'submit',
        [request, key.signDigest(instructionDigest(request)).toString()],
        'relay',
      ),
    ).toThrow('NATIVE_ACTION_REJECTED');
    expect(balance()).toBe(before);
  });
});
