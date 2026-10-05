import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Checksum256 } from '@wharfkit/antelope';

export const ZERO_CODE_HASH = '00'.repeat(32);

export function wasmCodeHash(file: string): string {
  const bytes = readFileSync(file);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (Checksum256.hash(bytes).toString() !== digest) throw new Error('WASM_HASH_MISMATCH');
  return digest;
}
