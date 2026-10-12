import { constants, type Dir } from 'node:fs';
import { mkdir, lstat, open, link, unlink, opendir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import {
  ProfileContextSchema,
  profileCipherDomain,
  type ProfileContext,
} from '../../../../protocol/profiles.js';
export const ProfileExclusionSchema = z.strictObject({
  version: z.literal(1),
  context: ProfileContextSchema,
  ownerAccountId: z.uuid(),
  ciphertextCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  deletedAt: z.iso.datetime(),
  backupExpiresAt: z.iso.datetime(),
});
export type ProfileExclusion = z.infer<typeof ProfileExclusionSchema>;
export interface ProfileExclusions {
  read(context: ProfileContext): Promise<ProfileExclusion | null>;
  write(record: ProfileExclusion): Promise<ProfileExclusion>;
  scan(limit: number): Promise<{ records: ProfileExclusion[]; done: boolean }>;
  forget(context: ProfileContext): Promise<void>;
  close?(): Promise<void>;
}
// Qualify this mount and its restore procedure separately from PostgreSQL; a pathname cannot prove independence.
export class FileProfileExclusions implements ProfileExclusions {
  private cursor: Dir | undefined;
  constructor(private readonly directory: string) {
    if (!isAbsolute(directory) || directory.length > 4096)
      throw new Error('PROFILE_EXCLUSION_DIRECTORY');
  }
  private name(context: ProfileContext) {
    return createHash('sha256').update(profileCipherDomain(context)).digest('hex') + '.json';
  }
  private async prepare() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.directory);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.())
      throw new Error('PROFILE_EXCLUSION_DIRECTORY');
  }
  private async load(name: string): Promise<ProfileExclusion | null> {
    let file: Awaited<ReturnType<typeof open>>;
    try {
      file = await open(join(this.directory, name), constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (z.object({ code: z.literal('ENOENT') }).safeParse(error).success) return null;
      throw error;
    }
    try {
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.size > 4096 ||
        (stat.mode & 0o077) !== 0 ||
        stat.uid !== process.getuid?.()
      )
        throw new Error('PROFILE_EXCLUSION_FILE');
      const record = ProfileExclusionSchema.parse(JSON.parse(await file.readFile('utf8')));
      if (this.name(record.context) !== name) throw new Error('PROFILE_EXCLUSION_CONTEXT');
      return record;
    } finally {
      await file.close();
    }
  }
  async read(context: ProfileContext) {
    await this.prepare();
    return this.load(this.name(context));
  }
  private async syncDirectory() {
    const directory = await open(
      this.directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  async write(input: ProfileExclusion) {
    const record = ProfileExclusionSchema.parse(input);
    await this.prepare();
    const name = this.name(record.context),
      temporary = '.pending-' + randomUUID();
    const destination = join(this.directory, name),
      staging = join(this.directory, temporary);
    const file = await open(
      staging,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      try {
        await file.writeFile(JSON.stringify(record) + '\n');
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await link(staging, destination);
      } catch (error) {
        if (!z.object({ code: z.literal('EEXIST') }).safeParse(error).success) throw error;
      }
      await this.syncDirectory();
      const saved = await this.load(name);
      if (!saved) throw new Error('PROFILE_EXCLUSION_UNAVAILABLE');
      return saved;
    } finally {
      await unlink(staging);
    }
  }
  async scan(limit: number) {
    z.int().min(1).max(25).parse(limit);
    await this.prepare();
    this.cursor ??= await opendir(this.directory);
    const records: ProfileExclusion[] = [];
    for (let inspected = 0; inspected < limit; inspected++) {
      const entry = await this.cursor.read();
      if (!entry) {
        await this.close();
        break;
      }
      if (/^\.pending-[0-9a-f-]{36}$/.test(entry.name)) {
        const path = join(this.directory, entry.name);
        const stat = await lstat(path);
        if (stat.isFile() && stat.uid === process.getuid?.() && stat.mtimeMs < Date.now() - 900000)
          await unlink(path);
        continue;
      }
      if (!/^[0-9a-f]{64}\.json$/.test(entry.name)) continue;
      const record = await this.load(entry.name);
      if (record) records.push(record);
    }
    return { records, done: this.cursor === undefined };
  }
  async forget(context: ProfileContext) {
    await this.prepare();
    try {
      await unlink(join(this.directory, this.name(context)));
    } catch (error) {
      if (!z.object({ code: z.literal('ENOENT') }).safeParse(error).success) throw error;
    }
    await this.syncDirectory();
  }
  async close() {
    const cursor = this.cursor;
    this.cursor = undefined;
    await cursor?.close();
  }
}
