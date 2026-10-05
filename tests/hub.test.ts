import { beforeEach, describe, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { loadContract, send, row } from './helpers/vert.js';
import { z } from 'zod';
let hub: ReturnType<typeof loadContract>;
beforeEach(() => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'daclifycore');
  hub = loadContract(chain, 'daclifyhub', '.artifacts/contracts/hub');
});
const metadata = '{}';
const codeHash = 'ab'.repeat(32);
const abiHash = 'cd'.repeat(32);
async function register(auth: string | string[] = ['daclifycore@active', 'alice@active']) {
  await send(
    hub,
    'regdeploy',
    ['daclifycore', 'alice', 'ef'.repeat(32), 1, codeHash, abiHash, metadata, true],
    auth,
  );
}
describe('discovery Hub without DAO authority', () => {
  it('requires deployment-account consent, not a claimant name alone', async () => {
    await expect(register('alice@active')).rejects.toThrow();
  });
  it('requires the advertised owner consent', async () => {
    await expect(register('daclifycore@active')).rejects.toThrow();
  });
  it('stores distinct code and ABI commitments', async () => {
    await register();
    const listing = z
      .object({ code_hash: z.string(), abi_hash: z.string() })
      .parse(row(hub, 'deployments', hub.toBigInt(), BigInt('0')));
    expect(listing.code_hash).toBe(codeHash);
    expect(listing.abi_hash).toBe(abiHash);
  });
  it('rejects incompatible interface versions', async () => {
    await expect(
      send(
        hub,
        'regdeploy',
        ['daclifycore', 'alice', 'ef'.repeat(32), 999, codeHash, abiHash, metadata, true],
        ['daclifycore@active', 'alice@active'],
      ),
    ).rejects.toThrow('INTERFACE_VERSION');
  });
  it('rejects oversized directory metadata', async () => {
    await expect(
      send(
        hub,
        'regdeploy',
        ['daclifycore', 'alice', 'ef'.repeat(32), 1, codeHash, abiHash, 'x'.repeat(5000), true],
        ['daclifycore@active', 'alice@active'],
      ),
    ).rejects.toThrow('METADATA_SIZE');
  });
  it('keeps an unlisted deployment connectable without public display', async () => {
    await send(
      hub,
      'regdeploy',
      ['daclifycore', 'alice', 'ef'.repeat(32), 1, codeHash, abiHash, '{}', false],
      ['daclifycore@active', 'alice@active'],
    );
    expect(
      z.object({ listed: z.boolean() }).parse(row(hub, 'deployments', hub.toBigInt(), 0n)).listed,
    ).toBe(false);
  });
});
