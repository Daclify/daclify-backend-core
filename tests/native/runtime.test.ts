import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { makeInstruction, instructionDigest, encodeAction } from '../../sdk/index.js';
import { DaoRefSchema } from '../../protocol/index.js';
import { OpenBaoCustody } from '../../services/custody/openbao.js';
const network = z
  .object({ url: z.string(), chainId: z.string(), container: z.string() })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const dao = String(Math.floor(Date.now() / 1000));
const key = PrivateKey.generate('K1');
function cleos(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--url',
        'http://127.0.0.1:8888',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const diagnostic =
      typeof error === 'object' && error !== null && 'stderr' in error
        ? z.union([z.string(), z.instanceof(Buffer)]).safeParse(error.stderr)
        : undefined;
    throw new Error(
      `NATIVE_ACTION_REJECTED: ${diagnostic?.success ? diagnostic.data.toString().slice(-1600) : 'No diagnostic'}`,
    );
  }
}
function push(action: string, data: object | unknown[], actor = 'alice'): string {
  return cleos([
    'push',
    'action',
    'daclifycore',
    action,
    JSON.stringify(data),
    '-p',
    `${actor}@active`,
  ]);
}
beforeAll(() => {
  unlockFixtureWallet('daclify-v2-native');
  push('createdao', [
    dao,
    'alice',
    '{"schemaVersion":1,"title":"Native fixture"}',
    0,
    'eosio.token',
    '4,TLOS',
  ]);
  push('enroll', [dao, 1, '', key.toPublic().toString(), 'disposable-encryption-key', 0]);
});
describe('actual native authority and R1 execution', () => {
  it('rejects missing DAO owner authority', () =>
    expect(() => push('grantcredit', [dao, 1, 100], 'bob')).toThrow('NATIVE_ACTION_REJECTED'));
  it('runs an internal instruction and rejects its replay on the real permission graph', () => {
    const domain = DaoRefSchema.parse({
      chainId: network.chainId,
      contract: 'daclifycore',
      daoId: dao,
      interfaceVersion: 1,
    });
    const request = makeInstruction(
      domain,
      '1',
      '0',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        runtime: 'daclifycore',
        dao_id: dao,
        member_id: '1',
        metadata: '{}',
      }),
    );
    const data = [request, key.signDigest(instructionDigest(request)).toString()];
    push('submit', data, 'relay');
    expect(() => push('submit', data, 'relay')).toThrow('NATIVE_ACTION_REJECTED');
  });
  it('accepts a real OpenBao R1 signature on the C++ native runtime', async () => {
    const address = process.env.OPENBAO_URL;
    const token = process.env.OPENBAO_TOKEN;
    if (!address || !token) throw new Error('OpenBao access required for native R1 acceptance');
    const provider = new OpenBaoCustody(address, token);
    const signer = `native-${dao}`;
    const publicKey = await provider.createSigner(signer);
    const privateDao = (BigInt(dao) + 1n).toString();
    push('createdao', [privateDao, 'alice', '{}', 1, 'eosio.token', '4,TLOS']);
    push('enroll', [privateDao, 1, '', publicKey.toString(), 'managed-encryption-key', 1]);
    const domain = DaoRefSchema.parse({
      chainId: network.chainId,
      contract: 'daclifycore',
      daoId: privateDao,
      interfaceVersion: 1,
    });
    const request = makeInstruction(
      domain,
      '1',
      '0',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        runtime: 'daclifycore',
        dao_id: privateDao,
        member_id: '1',
        metadata: '{}',
      }),
    );
    for (let nonce = 0; nonce < 16; nonce++) {
      const fresh = { ...request, nonce: String(nonce) };
      push(
        'submit',
        [fresh, (await provider.sign(signer, instructionDigest(fresh))).toString()],
        'relay',
      );
    }
    expect(() =>
      push(
        'submit',
        [
          { ...request, nonce: '16' },
          key.signDigest(instructionDigest({ ...request, nonce: '16' })).toString(),
        ],
        'relay',
      ),
    ).toThrow();
  });
  it('rejects a direct relayer callback that lacks runtime code authority', () =>
    expect(() => push('setmeta', ['daclifycore', dao, 1, '{}'], 'relay')).toThrow());
});
