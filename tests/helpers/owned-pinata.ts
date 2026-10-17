// Synthetic provider qualification only; never reads customer database records or removes their files.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseEnvFile } from '../../services/api/src/env-file.js';
import { PinataStorage } from '../../services/api/src/content/pinata.js';
import type { ContentProvider } from '../../services/api/src/content/provider.js';

export function ownedPinata() {
  const env = parseEnvFile(readFileSync('/data/daclify-env/testnet.env', 'utf8'));
  const storage = new PinataStorage(
    z.string().min(1).parse(env.PINATA_JWT),
    z.url().parse(env.CONTENT_GATEWAY),
    env.CONTENT_GATEWAY_KEY,
  );
  const requests = new Set<string>(),
    ids = new Set<string>(),
    cids = new Set<string>();
  let uploaded = 0,
    retrieved = 0;
  mkdirSync('.artifacts/owned-provider', { recursive: true, mode: 0o700 });
  const journal = '.artifacts/owned-provider/' + randomUUID() + '.json';
  function save(cleanupVerified = false) {
    writeFileSync(
      journal,
      JSON.stringify({
        requests: [...requests],
        ids: [...ids],
        uploadedBytes: uploaded,
        retrievedBytes: retrieved,
        cleanupVerified,
      }) + '\n',
      { mode: 0o600 },
    );
  }
  function request(id: string) {
    z.uuid().parse(id);
    assert.ok(requests.has(id) || requests.size < 8, 'OWNED_PROVIDER_REQUEST_BOUND');
    requests.add(id);
    save();
  }
  const provider: ContentProvider = {
    async upload(id, bytes) {
      request(id);
      assert.ok(bytes.length > 0 && bytes.length <= 65536, 'OWNED_PROVIDER_FILE_BOUND');
      uploaded += bytes.length;
      assert.ok(uploaded <= 524288, 'OWNED_PROVIDER_UPLOAD_BOUND');
      const receipt = await storage.upload(id, bytes);
      ids.add(receipt.id);
      cids.add(receipt.cid);
      save();
      return receipt;
    },
    async find(id) {
      request(id);
      const files = await storage.find(id);
      for (const file of files) {
        ids.add(file.id);
        cids.add(file.cid);
      }
      save();
      return files;
    },
    async file(id) {
      assert.ok(ids.has(id), 'OWNED_PROVIDER_FILE_REQUIRED');
      return storage.file(id);
    },
    async retrieve(cid, bytes) {
      assert.ok(cids.has(cid), 'OWNED_PROVIDER_FILE_REQUIRED');
      z.int().positive().max(65536).parse(bytes);
      retrieved += bytes;
      assert.ok(retrieved <= 1048576, 'OWNED_PROVIDER_DOWNLOAD_BOUND');
      return storage.retrieve(cid, bytes);
    },
    async remove(id) {
      assert.ok(ids.has(id), 'OWNED_PROVIDER_FILE_REQUIRED');
      await storage.remove(id);
    },
  };
  return {
    provider,
    async close() {
      for (const id of requests)
        for (const file of await storage.find(id)) {
          // find validates the provider's exact daclify_upload UUID before returning any file.
          await storage.remove(file.id);
        }
      save(true);
      console.log(
        JSON.stringify({
          ownedProvider: 'Pinata',
          uploadedBytes: uploaded,
          retrievedBytes: retrieved,
          cleanupVerified: true,
        }),
      );
    },
  };
}
