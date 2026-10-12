import { it, expect } from 'vitest';
import { z } from 'zod';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { backup } from 'node:sqlite';
import { Store } from '../examples/community-mini-app/store.js';
import { CleanupNoticeSchema } from '../protocol/account-exit.js';
import { miniBinding, miniActor } from './helpers/mini-app-store.js';
it('unlinks the exact local actor, preserves once-only evidence, and applies exclusions before restored access', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-app-cleanup-')),
    path = join(dir, 'tasks.sqlite'),
    restoredPath = join(dir, 'restored.sqlite'),
    journal = join(dir, 'separate-exclusions');
  const store = new Store(path, miniBinding, {
    exclusionsDirectory: journal,
    maxBackupAgeSeconds: 86400,
  });
  try {
    const intent = store.complete('chillies', miniActor);
    await backup(store.db, restoredPath);
    const notice = CleanupNoticeSchema.parse({
      version: 1,
      eventId: randomUUID(),
      binding: miniBinding,
      subject: miniActor.subject,
      memberId: miniActor.memberId,
      kind: 'account-erased',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });
    expect(store.cleanup(notice)).toMatchObject({
      eventId: notice.eventId,
      state: 'retained',
      retentionCodes: ['DAO_COMPLETION_EVIDENCE'],
    });
    expect(
      store.db.prepare('SELECT subject FROM outbox WHERE event_id=?').get(intent.eventId)?.subject,
    ).toBeNull();
    expect(store.db.prepare('SELECT count(*) AS count FROM actors').get()?.count).toBe(0);
    expect(() => store.tasks(miniActor)).toThrow('APP_ACTOR_ERASED');
    expect(
      store.cleanup({
        ...notice,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      }),
    ).toMatchObject({ state: 'retained' });
    expect(() => store.cleanup({ ...notice, memberId: '2' })).toThrow('APP_CLEANUP_EVENT_CHANGED');
    writeFileSync(
      join(journal, 'events', '.' + randomUUID()),
      'interrupted unpublished journal write',
      { mode: 0o600 },
    );
    const restored = new Store(restoredPath, miniBinding, {
      exclusionsDirectory: journal,
      maxBackupAgeSeconds: 86400,
    });
    try {
      expect(() => restored.tasks(miniActor)).toThrow('APP_ACTOR_ERASED');
      expect(restored.db.prepare('SELECT subject FROM outbox').get()?.subject).toBeNull();
    } finally {
      restored.close();
    }
    const eventPath = join(journal, 'events', notice.eventId + '.json'),
      saved = z
        .object({ notice: CleanupNoticeSchema, excludeUntil: z.string() })
        .parse(JSON.parse(readFileSync(eventPath, 'utf8')));
    writeFileSync(
      eventPath,
      JSON.stringify({ ...saved, excludeUntil: new Date(Date.now() - 1).toISOString() }),
    );
    store.cleanupExpired();
    expect(existsSync(eventPath)).toBe(false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
