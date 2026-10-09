import { describe, it, expect } from 'vitest';
import {
  registryDirectory,
  HubMetadataSchema,
  HubDeploymentRowSchema,
} from '../protocol/directory.js';
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
  it.each([true, 1])('accepts native listed=%s and includes the registered DAO', (listed) => {
    expect(registryDirectory([{ ...row, listed }], chainId).entries).toHaveLength(1);
    expect(HubDeploymentRowSchema.parse({ ...row, listed }).listed).toBe(true);
  });
  it.each([false, 0])('normalizes native listed=%s and excludes unlisted deployments', (listed) => {
    expect(registryDirectory([{ ...row, listed }], chainId)).toEqual({ entries: [], skipped: 0 });
    expect(HubDeploymentRowSchema.parse({ ...row, listed }).listed).toBe(false);
  });
  it.each([2, -1, '0', '1', 'false', null])(
    'rejects malformed listed=%s at the registry boundary',
    (listed) => {
      expect(HubDeploymentRowSchema.safeParse({ ...row, listed }).success).toBe(false);
    },
  );
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
