import { beforeEach, describe, it, expect } from 'vitest';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { loadContract, send, row } from './helpers/vert.js';
let core: ReturnType<typeof loadContract>;
const commitment = 'ab'.repeat(32);
beforeEach(async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice');
  core = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime');
  await send(core, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  await send(core, 'createdao', [1, 'alice', '{}', 2, 'eosio.token', '4,TLOS'], 'alice@active');
  for (const id of [1, 2])
    await send(
      core,
      'enroll',
      [1, id, '', PrivateKey.generate('K1').toPublic().toString(), 'key', 0],
      'alice@active',
    );
});
const commit = (epoch = 1, hash = commitment, member = 1) =>
  send(core, 'commitepoch', ['daclifycore', 1, member, epoch, hash, '{}'], 'daclifycore@active');
describe('one committed encryption key per DAO epoch', () => {
  it('rolls back a commitment when the atomic founder grant is invalid', async () => {
    await expect(
      send(
        core,
        'commitepoch',
        ['daclifycore', 1, 1, 1, commitment, 'not-json'],
        'daclifycore@active',
      ),
    ).rejects.toThrow('KEY_GRANT_JSON');
    expect(row(core, 'epochs', 1n, 1n)).toBeUndefined();
  });

  it('rejects distributing a key before committing the epoch identity', async () => {
    await expect(
      send(core, 'grantkey', ['daclifycore', 1, 1, 2, 1, '{}'], 'daclifycore@active'),
    ).rejects.toThrow('EPOCH_UNCOMMITTED');
  });
  it('persists the key commitment under administrator authority', async () => {
    await commit();
    expect(
      z
        .object({ epoch: z.number(), commitment: z.string(), creator: z.number() })
        .parse(row(core, 'epochs', 1n, 1n)),
    ).toEqual({ epoch: 1, commitment, creator: 1 });
  });
  it('prevents two administrators from committing different keys for the same epoch', async () => {
    await send(core, 'setroles', ['daclifycore', 1, 1, 2, true, false], 'daclifycore@active');
    await commit();
    await expect(commit(1, 'cd'.repeat(32), 2)).rejects.toThrow('EPOCH_COMMITTED');
  });
  it('rejects an ordinary member committing keys', async () => {
    await expect(commit(1, commitment, 2)).rejects.toThrow('ADMIN_REQUIRED');
  });
  it('requires a new commitment after offboarding rotates the epoch', async () => {
    await commit();
    await send(core, 'setactive', ['daclifycore', 1, 1, 2, false], 'daclifycore@active');
    await expect(
      send(
        core,
        'putjson',
        [
          'daclifycore',
          1,
          1,
          1,
          1,
          '{"version":1,"algorithm":"AES-256-GCM","iv":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA=="}',
          1,
          2,
        ],
        'daclifycore@active',
      ),
    ).rejects.toThrow('EPOCH_UNCOMMITTED');
    await commit(2);
    expect(row(core, 'epochs', 1n, 2n)).toBeDefined();
  });
});
