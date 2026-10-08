import { afterEach, expect, it } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, symlink, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import {
  ArchiveBundleSchema,
  archiveManifestForPlan,
  archiveSourceSchema,
  encodeArchiveManifest,
  OrdinaryPollArchivePlanSchema,
} from '@daclify/modules/archive';
import {
  EncryptedArchiveBackup,
  decryptArchiveBackup,
  readArchiveBackupConfig,
} from '../services/api/src/archive/backup.js';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'daclify-backup-'));
  directories.push(directory);
  const schema = archiveSourceSchema('ordinary-poll-votes');
  const plan = OrdinaryPollArchivePlanSchema.parse({
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    source: { account: 'decide', codeHash: schema.codeHash, abiHash: schema.rawAbiHash },
    snapshot: {
      blockNumber: 1,
      blockId: '00000001' + 'ab'.repeat(28),
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    pruningAuthorized: false,
    grossRamBytes: '0',
    blocked: [],
    families: [{ kind: 'ordinary-poll-votes', parentId: '7', grossRamBytes: '0', chunks: [] }],
  });
  const manifest = archiveManifestForPlan(plan, []),
    bytes = encodeArchiveManifest(manifest),
    commitment = createHash('sha256').update(bytes).digest('hex'),
    cid = CID.createV1(0x55, create(0x12, Buffer.from(commitment, 'hex'))).toString(),
    bundle = ArchiveBundleSchema.parse({
      id: randomUUID(),
      manifest,
      manifestFile: {
        cid,
        bytes: bytes.length,
        commitment,
        content: Buffer.from(bytes).toString('base64'),
      },
      chunks: [],
    }),
    config = {
      directory,
      storeId: 'independent-fixture',
      keyId: 'fixture-key-1',
      key: randomBytes(32),
    };
  return { directory, bundle, config, backup: new EncryptedArchiveBackup(config) };
}
it('writes only authenticated ciphertext and verifies an independent restore before returning its receipt', async () => {
  const f = await fixture(),
    receipt = await f.backup.put(f.bundle),
    bytes = await readFile(join(f.directory, f.bundle.id + '.daclify-archive.enc'));
  expect(bytes.includes(Buffer.from('ordinary-poll-votes'))).toBe(false);
  expect(receipt).toMatchObject({
    formatVersion: 1,
    storeId: f.config.storeId,
    keyId: f.config.keyId,
    manifestCommitment: f.bundle.manifestFile.commitment,
  });
  expect(receipt.commitment).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(await f.backup.read(f.bundle.id, f.bundle.manifestFile.commitment)).toEqual(f.bundle);
  await expect(
    f.backup.read(f.bundle.id, f.bundle.manifestFile.commitment, 'ab'.repeat(32)),
  ).rejects.toThrow('ARCHIVE_BACKUP_UNAVAILABLE');
  expect(decryptArchiveBackup(bytes, f.config.key, f.bundle.manifestFile.commitment)).toEqual(
    f.bundle,
  );
});
it('recovers an existing backup after a lost receipt and serializes concurrent attempts without replacing ciphertext', async () => {
  const f = await fixture(),
    other = new EncryptedArchiveBackup(f.config),
    [a, b] = await Promise.all([f.backup.put(f.bundle), other.put(f.bundle)]);
  expect(a.commitment).toBe(b.commitment);
  expect((await f.backup.put(f.bundle)).commitment).toBe(a.commitment);
});
it('rejects tampering, wrong keys, wrong trusted commitments and changed export identity', async () => {
  const f = await fixture();
  await f.backup.put(f.bundle);
  const bytes = await readFile(join(f.directory, f.bundle.id + '.daclify-archive.enc'));
  expect(() =>
    decryptArchiveBackup(bytes, randomBytes(32), f.bundle.manifestFile.commitment),
  ).toThrow();
  expect(() => decryptArchiveBackup(bytes, f.config.key, 'cd'.repeat(32))).toThrow();
  const modified = Buffer.from(bytes);
  modified[modified.length - 1] = (modified.at(-1) ?? 0) ^ 1;
  expect(() =>
    decryptArchiveBackup(modified, f.config.key, f.bundle.manifestFile.commitment),
  ).toThrow();
  await writeFile(join(f.directory, f.bundle.id + '.daclify-archive.enc'), modified);
  await expect(f.backup.put(f.bundle)).rejects.toThrow('ARCHIVE_BACKUP_UNAVAILABLE');
  await expect(f.backup.read('../escape', f.bundle.manifestFile.commitment)).rejects.toThrow();
});
it('does not follow a backup file symlink or accept a file readable by other users', async () => {
  const f = await fixture(),
    path = join(f.directory, f.bundle.id + '.daclify-archive.enc');
  await f.backup.put(f.bundle);
  const original = path + '.original';
  await writeFile(original, await readFile(path), { mode: 0o600 });
  await rm(path);
  await symlink(original, path);
  await expect(f.backup.read(f.bundle.id, f.bundle.manifestFile.commitment)).rejects.toThrow(
    'ARCHIVE_BACKUP_UNAVAILABLE',
  );
  await rm(path);
  await writeFile(path, await readFile(original), { mode: 0o644 });
  await chmod(path, 0o644);
  await expect(f.backup.read(f.bundle.id, f.bundle.manifestFile.commitment)).rejects.toThrow(
    'ARCHIVE_BACKUP_UNAVAILABLE',
  );
});
it('leaves the feature off by default and requires the complete bounded configuration', () => {
  expect(readArchiveBackupConfig({})).toBeUndefined();
  for (const value of [
    { ARCHIVE_BACKUP_DIRECTORY: '/backups' },
    {
      ARCHIVE_BACKUP_DIRECTORY: 'relative',
      ARCHIVE_BACKUP_STORE_ID: 'backup',
      ARCHIVE_BACKUP_KEY_ID: 'key',
      ARCHIVE_BACKUP_KEY: 'ab'.repeat(32),
    },
    {
      ARCHIVE_BACKUP_DIRECTORY: '/backups',
      ARCHIVE_BACKUP_STORE_ID: 'backup',
      ARCHIVE_BACKUP_KEY_ID: 'key',
      ARCHIVE_BACKUP_KEY: 'secret',
    },
  ])
    expect(() => readArchiveBackupConfig(value)).toThrow('ARCHIVE_BACKUP_CONFIGURATION_INVALID');
});
