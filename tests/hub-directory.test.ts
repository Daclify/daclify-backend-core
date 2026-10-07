import { describe, it, expect } from 'vitest';
import { registryDirectory, HubMetadataSchema } from '../protocol/directory.js';
const chainId = 'ab'.repeat(32);
const metadata = {
  schemaVersion: 1,
  operator: 'Independent operator',
  daos: [
    {
      daoId: '1',
      title: 'A community',
      description: 'Our own DAO',
      portal: { mode: 'external', url: 'https://dao.example/portal' },
    },
  ],
};
const row = {
  id: 0,
  runtime: 'daoone',
  owner: 'alice',
  chain_id: chainId,
  interface_version: 1,
  code_hash: 'cd'.repeat(32),
  abi_hash: 'ef'.repeat(32),
  metadata: JSON.stringify(metadata),
  listed: true,
};
describe('public Hub metadata routing', () => {
  it('accepts native RPC integer IDs and displays only public registry data', () => {
    const result = registryDirectory([row], chainId);
    expect(result.entries[0]?.portal).toEqual({
      mode: 'external',
      url: 'https://dao.example/portal',
    });
    expect(result.entries[0]).not.toHaveProperty('members');
    expect(result.entries[0]?.verification).toBe('owner-registered');
  });
  it('omits unlisted/foreign-chain entries and unsafe endpoint metadata', () => {
    expect(
      registryDirectory(
        [
          { ...row, id: '0', listed: false },
          { ...row, id: '1', chain_id: 'ff'.repeat(32) },
          {
            ...row,
            id: '2',
            metadata: JSON.stringify({
              ...metadata,
              daos: [
                { ...metadata.daos[0], portal: { mode: 'external', url: 'javascript:alert(1)' } },
              ],
            }),
          },
        ],
        chainId,
      ),
    ).toEqual({ entries: [], skipped: 1 });
    expect(HubMetadataSchema.safeParse({ ...metadata, secretKey: 'sk_secret' }).success).toBe(
      false,
    );
  });
});
