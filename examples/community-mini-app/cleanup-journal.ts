import {
  constants,
  mkdirSync,
  lstatSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  linkSync,
  unlinkSync,
  opendirSync,
  existsSync,
  rmdirSync,
} from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppActorSchema, appBindingHash, type AppActor } from '@daclify/core-protocol';
import { CleanupNoticeSchema, type CleanupNotice } from '@daclify/core-protocol';
export interface CleanupStorageOptions {
  exclusionsDirectory?: string;
  maxBackupAgeSeconds?: number;
}
const RecordSchema = z.strictObject({
  notice: CleanupNoticeSchema,
  excludeUntil: z.iso.datetime(),
});
function identity(n: CleanupNotice) {
  return JSON.stringify([n.eventId, appBindingHash(n.binding), n.subject, n.memberId, n.kind]);
}
const subjectHash = (n: { binding: AppActor['binding']; subject: string }) =>
  createHash('sha256')
    .update(appBindingHash(n.binding) + ':' + n.subject)
    .digest('hex');
function directory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const info = lstatSync(path);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (info.mode & 0o077) !== 0 ||
    info.uid !== process.getuid?.()
  )
    throw Error('APP_CLEANUP_STORAGE');
}
function read(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.size > 8192 ||
      (info.mode & 0o077) !== 0 ||
      info.uid !== process.getuid?.()
    )
      throw Error('APP_CLEANUP_STORAGE');
    return RecordSchema.parse(JSON.parse(readFileSync(fd, 'utf8')));
  } finally {
    closeSync(fd);
  }
}
export class CleanupJournal {
  private readonly memory = new Map<string, z.infer<typeof RecordSchema>>();
  private readonly retention: number;
  constructor(
    private readonly path: string | undefined,
    maxBackupAgeSeconds = 86400,
  ) {
    this.retention =
      z
        .int()
        .min(1)
        .max(90 * 86400)
        .parse(maxBackupAgeSeconds) + 3600;
    if (path) {
      if (!isAbsolute(path)) throw Error('APP_CLEANUP_STORAGE');
      directory(path);
      directory(join(path, 'events'));
      directory(join(path, 'subjects'));
    }
  }
  record(input: CleanupNotice): CleanupNotice {
    const notice = CleanupNoticeSchema.parse(input),
      entry = { notice, excludeUntil: new Date(Date.now() + this.retention * 1000).toISOString() };
    if (!this.path) {
      const previous = this.memory.get(notice.eventId);
      if (previous && identity(previous.notice) !== identity(notice))
        throw Error('APP_CLEANUP_EVENT_CHANGED');
      this.memory.set(notice.eventId, previous ?? entry);
      return previous?.notice ?? notice;
    }
    const target = join(this.path, 'events', notice.eventId + '.json');
    if (!existsSync(target)) {
      const temporary = join(this.path, 'events', '.' + randomUUID()),
        fd = openSync(
          temporary,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
          0o600,
        );
      try {
        writeFileSync(fd, JSON.stringify(entry));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      try {
        try {
          linkSync(temporary, target);
        } catch (error) {
          if (!z.object({ code: z.literal('EEXIST') }).safeParse(error).success) throw error;
        }
      } finally {
        unlinkSync(temporary);
      }
    }
    const saved = read(target);
    if (identity(saved.notice) !== identity(notice)) throw Error('APP_CLEANUP_EVENT_CHANGED');
    const subjectDirectory = join(this.path, 'subjects', subjectHash(notice));
    directory(subjectDirectory);
    try {
      linkSync(target, join(subjectDirectory, notice.eventId + '.json'));
    } catch (error) {
      if (!z.object({ code: z.literal('EEXIST') }).safeParse(error).success) throw error;
    }
    for (const path of [join(this.path, 'events'), subjectDirectory]) {
      const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    }
    return saved.notice;
  }
  *records(): Generator<CleanupNotice> {
    yield* this.scan(true);
  }
  cleanupExpired() {
    for (const notice of this.scan(false)) void notice;
  }
  private *scan(repair: boolean): Generator<CleanupNotice> {
    if (!this.path) {
      let removed = 0;
      for (const [id, entry] of this.memory.entries())
        if (Date.parse(entry.excludeUntil) > Date.now()) yield entry.notice;
        else if (removed++ < 25) this.memory.delete(id);
      return;
    }
    const handle = opendirSync(join(this.path, 'events'));
    let expired = 0;
    try {
      for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
        if (/^\.[a-f0-9-]{36}$/.test(entry.name) && entry.isFile()) {
          if (
            expired++ < 25 &&
            lstatSync(join(this.path, 'events', entry.name)).mtimeMs < Date.now() - 3600000
          )
            unlinkSync(join(this.path, 'events', entry.name));
          continue;
        }
        if (!/^[a-f0-9-]{36}\.json$/.test(entry.name) || !entry.isFile())
          throw Error('APP_CLEANUP_STORAGE');
        const path = join(this.path, 'events', entry.name),
          saved = read(path);
        if (Date.parse(saved.excludeUntil) > Date.now()) {
          if (repair) this.record(saved.notice);
          yield saved.notice;
        } else if (expired++ < 25) {
          const dir = join(this.path, 'subjects', subjectHash(saved.notice));
          try {
            unlinkSync(join(dir, entry.name));
          } catch (error) {
            if (!z.object({ code: z.literal('ENOENT') }).safeParse(error).success) throw error;
          }
          unlinkSync(path);
          try {
            rmdirSync(dir);
          } catch (error) {
            if (!z.object({ code: z.enum(['ENOENT', 'ENOTEMPTY']) }).safeParse(error).success)
              throw error;
          }
        }
      }
    } finally {
      handle.closeSync();
    }
  }
  excludes(input: AppActor): boolean {
    const actor = AppActorSchema.parse(input);
    if (!this.path)
      return [...this.memory.values()].some(
        (e) =>
          Date.parse(e.excludeUntil) > Date.now() && subjectHash(e.notice) === subjectHash(actor),
      );
    const path = join(this.path, 'subjects', subjectHash(actor));
    if (!existsSync(path)) return false;
    directory(path);
    const handle = opendirSync(path);
    try {
      for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
        if (!entry.isFile() || !/^[a-f0-9-]{36}\.json$/.test(entry.name))
          throw Error('APP_CLEANUP_STORAGE');
        const saved = read(join(path, entry.name));
        if (Date.parse(saved.excludeUntil) > Date.now()) return true;
      }
    } finally {
      handle.closeSync();
    }
    return false;
  }
}
