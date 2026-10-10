import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { createRecoveryBackup, createRecoveryRecipient } from '../sdk/recovery.js';
import type { ContentProvider } from '../services/api/src/content/provider.js';
import { EncryptedRecoveryStore } from '../services/api/src/auth/recovery-storage.js';
it('publishes only encrypted metadata and verifies an independently retrieved copy', async () => {
  const signing = PrivateKey.generate('K1'),
    encryption = await createRecoveryRecipient();
  const backup = await createRecoveryBackup(
    { signingKey: signing.toString(), encryptionPrivateKey: encryption.privateKey },
    {
      version: 1,
      id: crypto.randomUUID(),
      accountId: crypto.randomUUID(),
      origin: 'https://app.example.test',
      credentialKey: 'evm:41:0x' + '12'.repeat(20),
      mode: 'wallet-protected',
      signingPublicKey: signing.toPublic().toString(),
      encryptionPublicKey: encryption.publicKey,
      salt: Buffer.alloc(32, 2).toString('base64'),
    },
    new Uint8Array(32),
  );
  let bytes = new Uint8Array();
  const retained = new Map<string, Uint8Array>();
  const keys = {
    async wrap(_name: string, key: Uint8Array) {
      const id = createHash('sha256').update(key).digest('base64');
      retained.set(id, Uint8Array.from(key));
      return 'vault:v1:' + id;
    },
    async unwrap(_name: string, cipher: string) {
      const value = retained.get(cipher.slice(9));
      if (!value) throw new Error('Unavailable');
      return Uint8Array.from(value);
    },
  };
  const provider: ContentProvider = {
    async upload(id, payload) {
      bytes = Uint8Array.from(payload);
      return {
        id,
        cid: 'bafybeigdyrzt7yuysfz3obscvmc3qj7ghhqxqmgnxzlfeyy7ja7x3bg5e4',
        size: bytes.length,
      };
    },
    async retrieve() {
      return bytes.slice();
    },
    async find() {
      return [];
    },
    async remove() {},
  };
  const service = new EncryptedRecoveryStore(provider, keys, 'isolated-storage-scope');
  const receipt = await service.write(backup);
  expect(new TextDecoder().decode(bytes)).not.toContain(backup.context.accountId);
  expect(new TextDecoder().decode(bytes)).not.toContain(backup.context.credentialKey);
  expect(await service.read(receipt)).toEqual(backup);
  bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
  await expect(service.read(receipt)).rejects.toThrow();
});
