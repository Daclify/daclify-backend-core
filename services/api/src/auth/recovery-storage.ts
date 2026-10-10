import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { CidSchema } from '../../../../protocol/base.js';
import { ProviderScopeSchema } from '../../../../protocol/storage.js';
import { RecoveryBackupSchema, type RecoveryBackup } from '../../../../protocol/recovery.js';
import type { ContentProvider } from '../content/provider.js';
import {
  RecoveryReceiptSchema,
  recoveryCommitment,
  type RecoveryBackupStore,
  type RecoveryReceipt,
} from './recovery.js';

export interface RecoveryKeyProvider {
  wrap(name: string, bytes: Uint8Array): Promise<string>;
  unwrap(name: string, ciphertext: string): Promise<Uint8Array>;
}
export const RECOVERY_TRANSIT_KEY = 'recovery-v1';
const WrappedKeySchema = z.strictObject({
  domain: z.string().min(1).max(4096),
  key: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
});
export async function wrapRecoveryKey(
  provider: RecoveryKeyProvider,
  key: Uint8Array,
  domain: string,
): Promise<string> {
  if (key.length !== 32) throw new Error('RECOVERY_KEY_INVALID');
  const bytes = Buffer.from(
    JSON.stringify(WrappedKeySchema.parse({ domain, key: Buffer.from(key).toString('base64') })),
  );
  try {
    return await provider.wrap(RECOVERY_TRANSIT_KEY, bytes);
  } finally {
    bytes.fill(0);
  }
}
export async function unwrapRecoveryKey(
  provider: RecoveryKeyProvider,
  cipher: string,
  domain: string,
): Promise<Uint8Array> {
  const bytes = await provider.unwrap(RECOVERY_TRANSIT_KEY, cipher);
  try {
    const result = WrappedKeySchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    if (result.domain !== domain) throw new Error('RECOVERY_KEY_CONTEXT');
    return Uint8Array.from(Buffer.from(result.key, 'base64'));
  } finally {
    bytes.fill(0);
  }
}
const OpaqueSchema = z.strictObject({
  version: z.literal(1),
  id: z.uuid(),
  keyWrap: z
    .string()
    .max(8192)
    .regex(/^vault:v[1-9][0-9]*:[A-Za-z0-9+/]+={0,2}$/),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  ciphertext: z
    .string()
    .max(65536)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
const ReferenceSchema = z.strictObject({
  id: z.uuid(),
  cid: CidSchema,
  bytes: z.int().min(1).max(65536),
});

export class EncryptedRecoveryStore implements RecoveryBackupStore {
  constructor(
    private readonly provider: ContentProvider,
    private readonly keys: RecoveryKeyProvider,
    private readonly scope: string,
  ) {
    ProviderScopeSchema.parse(scope);
  }
  private domain(id: string): string {
    return `daclify.recovery.storage.v1:${this.scope}:${id}`;
  }
  async write(input: RecoveryBackup): Promise<RecoveryReceipt> {
    const record = RecoveryBackupSchema.parse(input),
      id = crypto.randomUUID(),
      domain = this.domain(id);
    const key = randomBytes(32),
      iv = randomBytes(12),
      plaintext = Buffer.from(JSON.stringify(record));
    try {
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(domain));
      const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
        cipher.getAuthTag(),
      ]);
      const opaque = OpaqueSchema.parse({
        version: 1,
        id,
        keyWrap: await wrapRecoveryKey(this.keys, key, domain),
        iv: iv.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      });
      const bytes = Buffer.from(JSON.stringify(opaque));
      if (bytes.length > 65536) throw new Error('RECOVERY_SIZE');
      const published = await this.provider.upload(id, bytes);
      const receipt = RecoveryReceiptSchema.parse({
        storeId: this.scope,
        reference: JSON.stringify(
          ReferenceSchema.parse({ id, cid: published.cid, bytes: bytes.length }),
        ),
        commitment: recoveryCommitment(record),
        verifiedAt: new Date().toISOString(),
      });
      if (recoveryCommitment(await this.read(receipt)) !== receipt.commitment)
        throw new Error('RECOVERY_BACKUP_UNAVAILABLE');
      return receipt;
    } finally {
      key.fill(0);
      plaintext.fill(0);
    }
  }
  async read(input: RecoveryReceipt): Promise<RecoveryBackup> {
    const receipt = RecoveryReceiptSchema.parse(input);
    if (receipt.storeId !== this.scope) throw new Error('RECOVERY_STORAGE_SCOPE');
    const reference = ReferenceSchema.parse(JSON.parse(receipt.reference));
    const bytes = await this.provider.retrieve(reference.cid, reference.bytes);
    if (bytes.length !== reference.bytes || bytes.length > 65536) throw new Error('RECOVERY_SIZE');
    const opaque = OpaqueSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    if (opaque.id !== reference.id) throw new Error('RECOVERY_STORAGE_CONTEXT');
    const domain = this.domain(opaque.id),
      key = await unwrapRecoveryKey(this.keys, opaque.keyWrap, domain);
    let plaintext: Buffer | undefined;
    try {
      const ciphertext = Buffer.from(opaque.ciphertext, 'base64');
      if (ciphertext.length < 16) throw new Error('RECOVERY_SIZE');
      const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(opaque.iv, 'base64'));
      cipher.setAAD(Buffer.from(domain));
      cipher.setAuthTag(ciphertext.subarray(-16));
      plaintext = Buffer.concat([cipher.update(ciphertext.subarray(0, -16)), cipher.final()]);
      const record = RecoveryBackupSchema.parse(JSON.parse(plaintext.toString('utf8')));
      if (recoveryCommitment(record) !== receipt.commitment)
        throw new Error('RECOVERY_STORAGE_COMMITMENT');
      return record;
    } finally {
      key.fill(0);
      plaintext?.fill(0);
    }
  }
}
