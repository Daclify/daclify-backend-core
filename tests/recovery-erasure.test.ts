import { it, expect } from 'vitest';
import { EncryptedRecoveryStore } from '../services/api/src/auth/recovery-storage.js';
import type { ContentProvider } from '../services/api/src/content/provider.js';
it('removes only verified controlled recovery pins and rejects conflicting provider identities', async () => {
  const id = crypto.randomUUID(),
    cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
  let files = [{ id: crypto.randomUUID(), cid, size: 32 }],
    removed: string[] = [];
  const provider: ContentProvider = {
    upload: async () => {
      throw Error('unused');
    },
    find: async () => files,
    retrieve: async () => {
      throw Error('unused');
    },
    remove: async (pin) => {
      removed.push(pin);
      files = files.filter((item) => item.id !== pin);
    },
  };
  const store = new EncryptedRecoveryStore(
    provider,
    {
      wrap: async () => {
        throw Error('unused');
      },
      unwrap: async () => {
        throw Error('unused');
      },
    },
    'fixture',
  );
  const receipt = {
    storeId: 'fixture',
    reference: JSON.stringify({ id, cid, bytes: 32 }),
    commitment: 'ab'.repeat(32),
    verifiedAt: new Date().toISOString(),
  };
  await store.remove(receipt);
  expect(removed.length).toBe(1);
  await store.remove(receipt);
  expect(removed.length).toBe(1);
  files = [
    {
      id: crypto.randomUUID(),
      cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      size: 32,
    },
  ];
  await expect(store.remove(receipt)).rejects.toThrow('RECOVERY_STORAGE_CONTEXT');
  expect(removed.length).toBe(1);
});
