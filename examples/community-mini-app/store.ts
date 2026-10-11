import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import {
  AppSourceRecordSchema,
  AppClaimsSchema,
  AppActivityPageSchema,
  AppSnapshotDraftSchema,
} from '@daclify/core-protocol';
import { z } from 'zod';
import { ActivityIntentSchema, type ActivityIntent } from '@daclify/modules/sdk';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const Task = z.strictObject({
  id: z.string(),
  title: z.string(),
  details: z.string(),
  state: z.enum(['open', 'completed', 'awaiting-review', 'accepted', 'rejected']),
  doneBy: z.string().nullable(),
});
const Row = z.object({ value: z.string() });
const Outbox = z.object({
  event_id: z.string(),
  member_id: z.string(),
  intent: z.string(),
  confirmed: z.number(),
});
export class Store {
  readonly db: DatabaseSync;
  constructor(
    path: string,
    readonly appId: string,
  ) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outbox(event_id TEXT PRIMARY KEY,source_id TEXT NOT NULL,member_id TEXT NOT NULL,intent TEXT NOT NULL,confirmed INTEGER NOT NULL DEFAULT 0,snapshot TEXT,needs_evidence INTEGER NOT NULL DEFAULT 0,UNIQUE(source_id));',
    );
    if (
      !this.db
        .prepare('PRAGMA table_info(outbox)')
        .all()
        .some((row) => row.name === 'snapshot')
    )
      this.db.exec('ALTER TABLE outbox ADD COLUMN snapshot TEXT');
    this.db.prepare('INSERT OR IGNORE INTO tasks(id,value) VALUES(?,?)').run(
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
  tasks() {
    return this.db
      .prepare('SELECT value FROM tasks')
      .all()
      .map((row) => Task.parse(JSON.parse(Row.parse(row).value)));
  }
  source(id: string) {
    const task = this.tasks().find((task) => hash(this.appId + ':' + task.id) === id);
    if (!task) throw new Error('SOURCE_UNKNOWN');
    return AppSourceRecordSchema.parse({
      schemaVersion: 1,
      sourceId: id,
      sourceRevision: hash(JSON.stringify(task)),
      title: task.title,
      details: task.details,
      state: task.state,
    });
  }
  complete(
    id: string,
    claims: z.infer<typeof AppClaimsSchema>,
    requireEvidence = false,
    review = false,
  ) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const sourceId = hash(this.appId + ':' + id),
        existing = this.db.prepare('SELECT * FROM outbox WHERE source_id=?').get(sourceId);
      if (existing) {
        const row = Outbox.parse(existing);
        if (row.member_id !== claims.memberId) throw new Error('TASK_ALREADY_COMPLETED');
        const intent = ActivityIntentSchema.parse(JSON.parse(row.intent)),
          needs = z.object({ needs_evidence: z.number() }).parse(existing).needs_evidence;
        if (requireEvidence && !needs) throw new Error('INTENT_ALREADY_SELECTED');
        if (needs && !intent.evidenceCid && !requireEvidence) throw new Error('EVIDENCE_PENDING');
        this.db.exec('COMMIT');
        return intent;
      }
      const task = Task.parse(
        JSON.parse(Row.parse(this.db.prepare('SELECT value FROM tasks WHERE id=?').get(id)).value),
      );
      task.state = review ? 'awaiting-review' : 'completed';
      task.doneBy = claims.memberId;
      this.db.prepare('UPDATE tasks SET value=? WHERE id=?').run(JSON.stringify(task), id);
      const intent: ActivityIntent = {
        action: review ? 'askreview' : 'recordact',
        sourceId,
        sourceRevision: hash(JSON.stringify(task)),
        eventId: randomBytes(32).toString('hex'),
      };
      this.db
        .prepare(
          'INSERT INTO outbox(event_id,source_id,member_id,intent,snapshot,needs_evidence) VALUES(?,?,?,?,?,?)',
        )
        .run(
          intent.eventId,
          sourceId,
          claims.memberId,
          JSON.stringify(intent),
          JSON.stringify(
            AppSnapshotDraftSchema.parse({
              eventId: intent.eventId,
              source: this.source(sourceId),
              files: [],
            }),
          ),
          requireEvidence ? 1 : 0,
        );
      this.db.exec('COMMIT');
      return intent;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  draft(event: string, member: string) {
    const row = this.db
      .prepare(
        'SELECT snapshot,member_id FROM outbox WHERE event_id=? AND confirmed=0 AND needs_evidence=1',
      )
      .get(event);
    const found = z.object({ snapshot: z.string(), member_id: z.literal(member) }).parse(row);
    return AppSnapshotDraftSchema.parse(JSON.parse(found.snapshot));
  }
  evidence(event: string, member: string, cid: string, commitment: string, epoch: string) {
    const row = Outbox.parse(
      this.db
        .prepare('SELECT * FROM outbox WHERE event_id=? AND confirmed=0 AND needs_evidence=1')
        .get(event),
    );
    if (row.member_id !== member) throw new Error('APP_SCOPE');
    const intent = z
      .object({
        eventId: z.string(),
        sourceId: z.string(),
        sourceRevision: z.string(),
        evidenceCid: z.string().optional(),
      })
      .passthrough()
      .parse(JSON.parse(row.intent));
    if (intent.evidenceCid) throw new Error('EVIDENCE_ALREADY_SELECTED');
    const next = { ...intent, evidenceCid: cid, evidenceHash: commitment, keyEpoch: epoch };
    const changed = this.db
      .prepare('UPDATE outbox SET intent=? WHERE event_id=? AND intent=? AND confirmed=0')
      .run(JSON.stringify(next), event, row.intent);
    if (changed.changes !== 1) throw new Error('OUTBOX_CHANGED');
    return next;
  }
  pending(member: string) {
    return this.db
      .prepare('SELECT * FROM outbox WHERE member_id=? AND confirmed=0')
      .all(member)
      .map((row) => ActivityIntentSchema.parse(JSON.parse(Outbox.parse(row).intent)));
  }
  confirm(event: string, page: z.infer<typeof AppActivityPageSchema>, member: string) {
    const row = Outbox.parse(this.db.prepare('SELECT * FROM outbox WHERE event_id=?').get(event));
    const intent = ActivityIntentSchema.parse(JSON.parse(row.intent));
    const receipt = page.receipts.find((receipt) => receipt.eventId === event);
    if (
      row.member_id !== member ||
      !receipt ||
      receipt.memberId !== member ||
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
      const draft = this.db.prepare('SELECT snapshot FROM outbox WHERE event_id=?').get(event),
        source = AppSnapshotDraftSchema.parse(
          JSON.parse(z.object({ snapshot: z.string() }).parse(draft).snapshot),
        ).source;
      const task = this.tasks().find(
        (task) => hash(this.appId + ':' + task.id) === intent.sourceId,
      );
      if (!task) throw new Error('SOURCE_UNKNOWN');
      if (hash(JSON.stringify(task)) === source.sourceRevision) {
        const previous = JSON.stringify(task);
        task.state = receipt.status === 'accepted' ? 'accepted' : 'rejected';
        this.db
          .prepare('UPDATE tasks SET value=? WHERE id=? AND value=?')
          .run(JSON.stringify(task), task.id, previous);
      }
    }
    this.db.prepare('UPDATE outbox SET confirmed=1 WHERE event_id=?').run(event);
    return { receiptId: receipt.receiptId, status: 'confirmed' };
  }
  close() {
    this.db.close();
  }
}
