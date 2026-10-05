import { readFileSync } from 'node:fs';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
const KeysSchema = z.record(
  z.string(),
  z.strictObject({ privateKey: z.string(), publicKey: z.string() }),
);
// Disposable fixtures only. Production services never import this file.
export function fixtureKey(account: string): PrivateKey {
  const keys = KeysSchema.parse(
    JSON.parse(readFileSync('.artifacts/native/accounts.json', 'utf8')),
  );
  const entry = keys[account];
  if (!entry) throw new Error('Local fixture account unavailable');
  const key = PrivateKey.from(entry.privateKey);
  if (key.toPublic().toString() !== entry.publicKey) throw new Error('Local fixture key mismatch');
  return key;
}
