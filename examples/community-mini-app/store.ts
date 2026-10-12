import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import {
  AppSourceRecordSchema,
  AppActivityPageSchema,
  AppSnapshotDraftSchema,
  AppBindingSchema,
  AppActorSchema,
  appBindingHash,
  IdSchema,
  type AppBinding,
  type AppActor,
} from '@daclify/core-protocol';
import { z } from 'zod';
import { ActivityIntentSchema, type ActivityIntent } from '@daclify/modules/sdk';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const TaskSchema = z.strictObject({
  id: z.string().min(1).max(64),
  title: z.string().max(256),
  details: z.string().max(4096),
  state: z.enum(['open', 'completed', 'awaiting-review', 'accepted', 'rejected']),
  doneBy: IdSchema.nullable(),
});
export type Task = z.infer<typeof TaskSchema>;
const Row = z.object({ value: z.string() });
const LegacyOutbox = z.object({
  event_id: z.string(),
  source_id: z.string(),
  member_id: IdSchema,
  intent: z.string(),
  confirmed: z.number().int().min(0).max(1),
  snapshot: z.string().nullable(),
  needs_evidence: z.number().int().min(0).max(1),
});
const Outbox = LegacyOutbox.extend({ subject: z.uuid() });
const ActorRow = z.object({ subject: z.uuid(), member_id: IdSchema });
const schema = `
CREATE TABLE IF NOT EXISTS app_binding(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS actors(subject TEXT NOT NULL,member_id TEXT NOT NULL,
 PRIMARY KEY(subject,member_id),UNIQUE(subject),UNIQUE(member_id));
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox(event_id TEXT PRIMARY KEY,source_id TEXT NOT NULL,
 member_id TEXT NOT NULL,subject TEXT NOT NULL,intent TEXT NOT NULL,
 confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN(0,1)),snapshot TEXT,
 needs_evidence INTEGER NOT NULL DEFAULT 0 CHECK(needs_evidence IN(0,1)),UNIQUE(source_id),
 FOREIGN KEY(subject,member_id) REFERENCES actors(subject,member_id));`;
function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function taskSource(appId: string, task: Task) {
  return AppSourceRecordSchema.parse({
    schemaVersion: 1,
    sourceId: hash(appId + ':' + task.id),
    sourceRevision: hash(JSON.stringify(task)),
    title: task.title,
    details: task.details,
    state: task.state,
  });
}
export class Store {
  readonly db: DatabaseSync;
  readonly binding: AppBinding;
  constructor(path: string, binding: AppBinding) {
    this.binding = Object.freeze(AppBindingSchema.parse(binding));
    this.db = new DatabaseSync(path);
    try {
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
      transaction(this.db, () => {
        const tables = this.db
          .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all();
        if (tables.some((row) => row.name === 'app_binding')) {
          const row = this.db.prepare('SELECT value FROM app_binding WHERE id=1').get();
          const previous = AppBindingSchema.safeParse(row && JSON.parse(Row.parse(row).value));
          if (!previous.success || appBindingHash(previous.data) !== appBindingHash(this.binding))
            throw new Error('APP_DATABASE_BINDING');
        } else {
          if (tables.length) throw new Error('APP_DATABASE_ADOPTION_REQUIRED');
          this.db.exec(schema);
          this.db
            .prepare('INSERT INTO app_binding(id,value) VALUES(1,?)')
            .run(JSON.stringify(this.binding));
          this.db.prepare('INSERT INTO tasks(id,value) VALUES(?,?)').run(
            'chillies',
            JSON.stringify({
              id: 'chillies',
              title: 'Trim and organize the chillies inside the Nests.',
              details: 'The project keeps instructions and photos in its own database.',
              state: 'open',
              doneBy: null,
            }),
          );
        }
      });
      this.db.exec('PRAGMA journal_mode=WAL');
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  get appId() {
    return this.binding.appId;
  }
  private actor(input: AppActor): AppActor {
    const actor = AppActorSchema.parse(input);
    if (appBindingHash(actor.binding) !== appBindingHash(this.binding))
      throw new Error('APP_ACTOR_BINDING');
    this.db
      .prepare('INSERT OR IGNORE INTO actors(subject,member_id) VALUES(?,?)')
      .run(actor.subject, actor.memberId);
    const rows = this.db
      .prepare('SELECT subject,member_id FROM actors WHERE subject=? OR member_id=?')
      .all(actor.subject, actor.memberId)
      .map((row) => ActorRow.parse(row));
    if (
      rows.length !== 1 ||
      rows[0]?.subject !== actor.subject ||
      rows[0]?.member_id !== actor.memberId
    )
      throw new Error('APP_ACTOR_CHANGED');
    return actor;
  }
  tasks(input: AppActor): Task[] {
    this.actor(input);
    return this.db
      .prepare('SELECT value FROM tasks ORDER BY id')
      .all()
      .map((row) => TaskSchema.parse(JSON.parse(Row.parse(row).value)));
  }
  source(id: string, input: AppActor) {
    const task = this.tasks(input).find((task) => hash(this.appId + ':' + task.id) === id);
    if (!task) throw new Error('SOURCE_UNKNOWN');
    return taskSource(this.appId, task);
  }
  complete(id: string, input: AppActor, requireEvidence = false, review = false): ActivityIntent {
    const actor = this.actor(input);
    return transaction(this.db, () => {
      const sourceId = hash(this.appId + ':' + id),
        existing = this.db.prepare('SELECT * FROM outbox WHERE source_id=?').get(sourceId);
      if (existing) {
        const row = Outbox.parse(existing);
        if (row.member_id !== actor.memberId || row.subject !== actor.subject)
          throw new Error('TASK_ALREADY_COMPLETED');
        const intent = ActivityIntentSchema.parse(JSON.parse(row.intent));
        if (requireEvidence && !row.needs_evidence) throw new Error('INTENT_ALREADY_SELECTED');
        if (row.needs_evidence && !intent.evidenceCid && !requireEvidence)
          throw new Error('EVIDENCE_PENDING');
        return intent;
      }
      const found = this.db.prepare('SELECT value FROM tasks WHERE id=?').get(id);
      if (!found) throw new Error('SOURCE_UNKNOWN');
      const task = TaskSchema.parse(JSON.parse(Row.parse(found).value));
      if (task.state !== 'open' || task.doneBy !== null) throw new Error('TASK_ALREADY_COMPLETED');
      task.state = review ? 'awaiting-review' : 'completed';
      task.doneBy = actor.memberId;
      const draft = taskSource(this.appId, task);
      const intent = ActivityIntentSchema.parse({
        action: review ? 'askreview' : 'recordact',
        sourceId,
        sourceRevision: draft.sourceRevision,
        eventId: randomBytes(32).toString('hex'),
      });
      this.db.prepare('UPDATE tasks SET value=? WHERE id=?').run(JSON.stringify(task), id);
      this.db
        .prepare(
          'INSERT INTO outbox(event_id,source_id,member_id,subject,intent,snapshot,needs_evidence) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          intent.eventId,
          sourceId,
          actor.memberId,
          actor.subject,
          JSON.stringify(intent),
          JSON.stringify(
            AppSnapshotDraftSchema.parse({ eventId: intent.eventId, source: draft, files: [] }),
          ),
          requireEvidence ? 1 : 0,
        );
      return intent;
    });
  }
  draft(event: string, input: AppActor) {
    const actor = this.actor(input);
    const row = this.db
      .prepare(
        'SELECT snapshot FROM outbox WHERE event_id=? AND subject=? AND member_id=? AND confirmed=0 AND needs_evidence=1',
      )
      .get(event, actor.subject, actor.memberId);
    if (!row) throw new Error('APP_SCOPE');
    return AppSnapshotDraftSchema.parse(
      JSON.parse(z.object({ snapshot: z.string() }).parse(row).snapshot),
    );
  }
  evidence(
    event: string,
    input: AppActor,
    cid: string,
    commitment: string,
    epoch: string,
  ): ActivityIntent {
    const actor = this.actor(input),
      found = this.db
        .prepare('SELECT * FROM outbox WHERE event_id=? AND confirmed=0 AND needs_evidence=1')
        .get(event);
    if (!found) throw new Error('APP_SCOPE');
    const row = Outbox.parse(found);
    if (row.member_id !== actor.memberId || row.subject !== actor.subject)
      throw new Error('APP_SCOPE');
    const intent = ActivityIntentSchema.parse(JSON.parse(row.intent));
    if (intent.evidenceCid) throw new Error('EVIDENCE_ALREADY_SELECTED');
    const next = ActivityIntentSchema.parse({
      ...intent,
      evidenceCid: cid,
      evidenceHash: commitment,
      keyEpoch: epoch,
    });
    const changed = this.db
      .prepare('UPDATE outbox SET intent=? WHERE event_id=? AND intent=? AND confirmed=0')
      .run(JSON.stringify(next), event, row.intent);
    if (changed.changes !== 1) throw new Error('OUTBOX_CHANGED');
    return next;
  }
  pending(input: AppActor): ActivityIntent[] {
    const actor = this.actor(input);
    return this.db
      .prepare(
        'SELECT * FROM outbox WHERE member_id=? AND subject=? AND confirmed=0 ORDER BY event_id',
      )
      .all(actor.memberId, actor.subject)
      .map((row) => ActivityIntentSchema.parse(JSON.parse(Outbox.parse(row).intent)));
  }
  confirm(event: string, inputPage: z.infer<typeof AppActivityPageSchema>, input: AppActor) {
    const actor = this.actor(input),
      page = AppActivityPageSchema.parse(inputPage);
    return transaction(this.db, () => {
      const row = Outbox.parse(this.db.prepare('SELECT * FROM outbox WHERE event_id=?').get(event)),
        intent = ActivityIntentSchema.parse(JSON.parse(row.intent)),
        receipt = page.receipts.find((receipt) => receipt.eventId === event);
      if (
        row.member_id !== actor.memberId ||
        row.subject !== actor.subject ||
        !receipt ||
        receipt.memberId !== actor.memberId ||
        receipt.appId !== this.appId ||
        receipt.sourceId !== intent.sourceId ||
        receipt.sourceRevision !== intent.sourceRevision ||
        receipt.kind !== (intent.action === 'askreview' ? 'review-requested' : 'completed') ||
        receipt.evidenceCid !== intent.evidenceCid ||
        receipt.evidenceHash !== intent.evidenceHash ||
        receipt.keyEpoch !== intent.keyEpoch
      )
        throw new Error('RECEIPT_UNCONFIRMED');
      if (intent.action === 'askreview' && ['accepted', 'rejected'].includes(receipt.status)) {
        const submitted = AppSnapshotDraftSchema.parse(
          JSON.parse(z.string().parse(row.snapshot)),
        ).source;
        const task = this.tasks(actor).find(
          (task) => hash(this.appId + ':' + task.id) === intent.sourceId,
        );
        if (!task) throw new Error('SOURCE_UNKNOWN');
        if (hash(JSON.stringify(task)) === submitted.sourceRevision) {
          const previous = JSON.stringify(task);
          task.state = receipt.status === 'accepted' ? 'accepted' : 'rejected';
          this.db
            .prepare('UPDATE tasks SET value=? WHERE id=? AND value=?')
            .run(JSON.stringify(task), task.id, previous);
        }
      }
      this.db.prepare('UPDATE outbox SET confirmed=1 WHERE event_id=?').run(event);
      return { receiptId: receipt.receiptId, status: 'confirmed' as const };
    });
  }
  close() {
    this.db.close();
  }
}

export async function adoptLegacyDatabase(
  path: string,
  input: AppBinding,
  backupPath: string,
  inputs: AppActor[],
): Promise<void> {
  const binding = AppBindingSchema.parse(input),
    actors = inputs.map((actor) => AppActorSchema.parse(actor));
  if (resolve(path) === resolve(backupPath) || existsSync(backupPath))
    throw new Error('APP_DATABASE_BACKUP_EXISTS');
  if (!existsSync(path)) throw new Error('APP_DATABASE_ADOPTION_RECORD');
  const byMember = new Map(actors.map((actor) => [actor.memberId, actor]));
  if (
    byMember.size !== actors.length ||
    new Set(actors.map((actor) => actor.subject)).size !== actors.length ||
    actors.some((actor) => appBindingHash(actor.binding) !== appBindingHash(binding))
  )
    throw new Error('APP_ACTOR_BINDING');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    if (tables.some((row) => row.name === 'app_binding'))
      throw new Error('APP_DATABASE_ALREADY_BOUND');
    if (tables.some((row) => row.name !== 'tasks' && row.name !== 'outbox'))
      throw new Error('APP_DATABASE_ADOPTION_RECORD');
    const tasks = db
      .prepare('SELECT value FROM tasks')
      .all()
      .map((row) => TaskSchema.parse(JSON.parse(Row.parse(row).value)));
    const rows = db
      .prepare('SELECT * FROM outbox')
      .all()
      .map((row) => LegacyOutbox.parse(row));
    const migrated = rows.map((row) => {
      const intent = ActivityIntentSchema.parse(JSON.parse(row.intent)),
        actor = byMember.get(row.member_id);
      const task = tasks.find((task) => hash(binding.appId + ':' + task.id) === row.source_id);
      if (!actor || !task || intent.sourceId !== row.source_id || intent.eventId !== row.event_id)
        throw new Error('APP_DATABASE_ADOPTION_RECORD');
      let snapshot = row.snapshot;
      if (snapshot) {
        const draft = AppSnapshotDraftSchema.parse(JSON.parse(snapshot));
        if (
          draft.eventId !== row.event_id ||
          draft.source.sourceId !== row.source_id ||
          draft.source.sourceRevision !== intent.sourceRevision
        )
          throw new Error('APP_DATABASE_ADOPTION_RECORD');
      } else {
        const saved = taskSource(binding.appId, task);
        if (saved.sourceRevision !== intent.sourceRevision)
          throw new Error('APP_DATABASE_ADOPTION_RECORD');
        snapshot = JSON.stringify(
          AppSnapshotDraftSchema.parse({ eventId: row.event_id, source: saved, files: [] }),
        );
      }
      return { ...row, subject: actor.subject, snapshot };
    });
    const readOnly = new DatabaseSync(path, { readOnly: true });
    try {
      await backup(readOnly, backupPath);
    } finally {
      readOnly.close();
    }
    db.exec('ALTER TABLE outbox RENAME TO legacy_outbox');
    db.exec(schema);
    db.prepare('INSERT INTO app_binding(id,value) VALUES(1,?)').run(JSON.stringify(binding));
    for (const actor of actors)
      db.prepare('INSERT INTO actors(subject,member_id) VALUES(?,?)').run(
        actor.subject,
        actor.memberId,
      );
    for (const row of migrated)
      db.prepare(
        'INSERT INTO outbox(event_id,source_id,member_id,subject,intent,confirmed,snapshot,needs_evidence) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        row.event_id,
        row.source_id,
        row.member_id,
        row.subject,
        row.intent,
        row.confirmed,
        row.snapshot,
        row.needs_evidence,
      );
    db.exec('DROP TABLE legacy_outbox; COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}
