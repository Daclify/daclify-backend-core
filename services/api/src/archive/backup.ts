import { constants } from 'node:fs';
import { mkdir, lstat, open, link, unlink } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { DaoRefSchema, ChainIdSchema } from '../../../../protocol/base.js';
import {
  ArchiveBackupReceiptSchema,
  ArchiveBundleSchema,
  verifyArchiveBundle,
  type ArchiveBackupReceipt,
} from '@daclify/modules/archive';
import { ApiError } from '../errors.js';
const limit = 128 * 1024 * 1024,
  magic = Buffer.from('DACLBAK1');
const ConfigSchema = z.strictObject({
  directory: z.string().min(1).max(4096).refine(isAbsolute),
  storeId: ArchiveBackupReceiptSchema.shape.storeId,
  keyId: ArchiveBackupReceiptSchema.shape.keyId,
  key: z.instanceof(Uint8Array).refine((v) => v.length === 32),
});
export type ArchiveBackupConfig = z.infer<typeof ConfigSchema>;
export function readArchiveBackupConfig(
  env: Record<string, string | undefined>,
): ArchiveBackupConfig | undefined {
  const fields = [
    env.ARCHIVE_BACKUP_DIRECTORY,
    env.ARCHIVE_BACKUP_STORE_ID,
    env.ARCHIVE_BACKUP_KEY_ID,
    env.ARCHIVE_BACKUP_KEY,
  ];
  if (fields.every((v) => !v)) return undefined;
  try {
    const key = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(env.ARCHIVE_BACKUP_KEY);
    return ConfigSchema.parse({
      directory: env.ARCHIVE_BACKUP_DIRECTORY,
      storeId: env.ARCHIVE_BACKUP_STORE_ID,
      keyId: env.ARCHIVE_BACKUP_KEY_ID,
      key: Buffer.from(key, 'hex'),
    });
  } catch {
    throw new Error('ARCHIVE_BACKUP_CONFIGURATION_INVALID');
  }
}
const HeaderSchema = ArchiveBackupReceiptSchema.omit({ commitment: true, bytes: true }).extend({
  exportId: z.uuid(),
  dao: DaoRefSchema,
});
function decrypt(bytes: Uint8Array, key: Uint8Array, expected: string) {
  if (bytes.length > limit || bytes.length < 40 || key.length !== 32)
    throw new Error('ARCHIVE_BACKUP_INVALID');
  const buffer = Buffer.from(bytes),
    headerBytes = buffer.readUInt32BE(8),
    end = 12 + headerBytes;
  if (!buffer.subarray(0, 8).equals(magic) || headerBytes > 4096 || end + 28 >= buffer.length)
    throw new Error('ARCHIVE_BACKUP_INVALID');
  const headerText = buffer.subarray(12, end).toString('utf8'),
    parsed: unknown = JSON.parse(headerText),
    header = HeaderSchema.parse(parsed);
  if (
    JSON.stringify(header) !== headerText ||
    header.manifestCommitment !== ChainIdSchema.parse(expected)
  )
    throw new Error('ARCHIVE_BACKUP_DOMAIN');
  const cipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(end, end + 12));
  cipher.setAAD(buffer.subarray(0, end));
  cipher.setAuthTag(buffer.subarray(end + 12, end + 28));
  const plaintext = Buffer.concat([cipher.update(buffer.subarray(end + 28)), cipher.final()]),
    value: unknown = JSON.parse(plaintext.toString('utf8')),
    bundle = verifyArchiveBundle(value, expected);
  if (
    bundle.id !== header.exportId ||
    JSON.stringify(bundle.manifest.dao) !== JSON.stringify(header.dao)
  )
    throw new Error('ARCHIVE_BACKUP_DOMAIN');
  return { header, bundle };
}
export function decryptArchiveBackup(bytes: Uint8Array, key: Uint8Array, expected: string) {
  return decrypt(bytes, key, expected).bundle;
}
// The operator must qualify this directory's independent failure domain; a pathname cannot prove it.
export class EncryptedArchiveBackup {
  private readonly config: ArchiveBackupConfig;
  constructor(config: ArchiveBackupConfig) {
    this.config = ConfigSchema.parse(config);
  }
  private path(id: string) {
    return join(this.config.directory, z.uuid().parse(id) + '.daclify-archive.enc');
  }
  private async directory() {
    await mkdir(this.config.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.config.directory);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.())
      throw new Error('ARCHIVE_BACKUP_DIRECTORY');
  }
  private async load(id: string, expected: string) {
    const file = await open(this.path(id), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.size > limit ||
        (stat.mode & 0o077) !== 0 ||
        stat.uid !== process.getuid?.()
      )
        throw new Error('ARCHIVE_BACKUP_FILE');
      const bytes = await file.readFile(),
        restored = decrypt(bytes, this.config.key, expected);
      if (
        restored.header.exportId !== id ||
        restored.header.storeId !== this.config.storeId ||
        restored.header.keyId !== this.config.keyId
      )
        throw new Error('ARCHIVE_BACKUP_DOMAIN');
      return {
        bundle: restored.bundle,
        receipt: ArchiveBackupReceiptSchema.parse({
          formatVersion: 1,
          storeId: restored.header.storeId,
          keyId: restored.header.keyId,
          manifestCommitment: restored.header.manifestCommitment,
          verifiedAt: restored.header.verifiedAt,
          commitment: createHash('sha256').update(bytes).digest('hex'),
          bytes: bytes.length.toString(),
        }),
      };
    } finally {
      await file.close();
    }
  }
  async read(id: string, expected: string, expectedBackupCommitment?: string) {
    z.uuid().parse(id);
    ChainIdSchema.parse(expected);
    try {
      await this.directory();
      const restored = await this.load(id, expected);
      if (
        expectedBackupCommitment &&
        restored.receipt.commitment !== ChainIdSchema.parse(expectedBackupCommitment)
      )
        throw new Error('ARCHIVE_BACKUP_COMMITMENT');
      return restored.bundle;
    } catch {
      throw new ApiError('ARCHIVE_BACKUP_UNAVAILABLE', 503);
    }
  }
  async put(value: z.infer<typeof ArchiveBundleSchema>): Promise<ArchiveBackupReceipt> {
    const bundle = verifyArchiveBundle(value, value.manifestFile.commitment),
      expected = bundle.manifestFile.commitment;
    const temporary = join(this.config.directory, randomUUID() + '.pending');
    try {
      await this.directory();
      const existing = await lstat(this.path(bundle.id)).then(
        () => true,
        (error: unknown) => {
          if (z.object({ code: z.literal('ENOENT') }).safeParse(error).success) return false;
          throw error;
        },
      );
      if (!existing) {
        const header = HeaderSchema.parse({
            formatVersion: 1,
            storeId: this.config.storeId,
            keyId: this.config.keyId,
            manifestCommitment: expected,
            verifiedAt: new Date().toISOString(),
            exportId: bundle.id,
            dao: bundle.manifest.dao,
          }),
          headerBytes = Buffer.from(JSON.stringify(header)),
          size = Buffer.alloc(4);
        size.writeUInt32BE(headerBytes.length);
        const aad = Buffer.concat([magic, size, headerBytes]),
          nonce = randomBytes(12),
          cipher = createCipheriv('aes-256-gcm', this.config.key, nonce);
        cipher.setAAD(aad);
        const data = Buffer.concat([cipher.update(JSON.stringify(bundle), 'utf8'), cipher.final()]),
          bytes = Buffer.concat([aad, nonce, cipher.getAuthTag(), data]);
        if (bytes.length > limit) throw new Error('ARCHIVE_BACKUP_FILE_LIMIT');
        const file = await open(
          temporary,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        try {
          await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        try {
          await link(temporary, this.path(bundle.id));
        } catch (error) {
          if (!z.object({ code: z.literal('EEXIST') }).safeParse(error).success) throw error;
        }
        const directory = await open(
          this.config.directory,
          constants.O_RDONLY | constants.O_NOFOLLOW,
        );
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
      const restored = await this.load(bundle.id, expected);
      if (JSON.stringify(restored.bundle) !== JSON.stringify(bundle))
        throw new Error('ARCHIVE_BACKUP_DOMAIN');
      return restored.receipt;
    } catch {
      throw new ApiError('ARCHIVE_BACKUP_UNAVAILABLE', 503);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}
