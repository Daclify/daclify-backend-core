import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  AppBindingSchema,
  AppActorSchema,
  appBindingHash,
  IdSchema,
  AppActivityPageSchema,
  AppSnapshotDraftSchema,
  type AppBinding,
  type AppActor,
  CleanupNoticeSchema,
  CleanupAckSchema,
  type CleanupNotice,
} from '@daclify/core-protocol';
import { ActivityIntentSchema } from '@daclify/modules/sdk';
import { TaskSchema, taskSource } from './store.js';
import type { MiniAppStore } from './database.js';
import { CleanupJournal, type CleanupStorageOptions } from './cleanup-journal.js';

const TaskRow = z.object({ value: TaskSchema });
const Outbox = z.object({
  event_id: z.string(),
  source_id: z.string(),
  member_id: IdSchema,
  subject: z.uuid().nullable(),
  intent: ActivityIntentSchema,
  snapshot: AppSnapshotDraftSchema,
  needs_evidence: z.boolean(),
  confirmed: z.boolean(),
});
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function transaction<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
export async function createPostgresStore(
  pool: Pool,
  input: AppBinding,
  options: CleanupStorageOptions = {},
): Promise<MiniAppStore> {
  const binding = Object.freeze(AppBindingSchema.parse(input));
  const journal = new CleanupJournal(options.exclusionsDirectory, options.maxBackupAgeSeconds);
  const namespace = appBindingHash(binding);
  await transaction(pool, async (db) => {
    // PostgreSQL IF NOT EXISTS alone does not serialize simultaneous schema creation.
    await db.query("SELECT pg_advisory_xact_lock(hashtext('daclify-mini-app-schema-v1'))");
    await db.query(readFileSync(new URL('./postgres-schema.sql', import.meta.url), 'utf8'));
    const created = await db.query(
      'INSERT INTO mini_app.bindings(namespace,value) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING namespace',
      [namespace, binding],
    );
    const row = z
      .object({ value: AppBindingSchema })
      .parse(
        (await db.query('SELECT value FROM mini_app.bindings WHERE namespace=$1', [namespace]))
          .rows[0],
      );
    if (appBindingHash(row.value) !== namespace) throw new Error('APP_DATABASE_BINDING');
    if (created.rowCount)
      await db.query('INSERT INTO mini_app.tasks(namespace,id,value) VALUES($1,$2,$3)', [
        namespace,
        'chillies',
        TaskSchema.parse({
          id: 'chillies',
          title: 'Trim and organize the chillies inside the Nests.',
          details: 'The project keeps instructions and photos in its own database.',
          state: 'open',
          doneBy: null,
        }),
      ]);
  });
  async function actor(input: AppActor, db: Pool | PoolClient = pool): Promise<AppActor> {
    const actor = AppActorSchema.parse(input);
    if (appBindingHash(actor.binding) !== namespace) throw new Error('APP_ACTOR_BINDING');
    if (journal.excludes(actor)) throw Error('APP_ACTOR_ERASED');
    await db.query(
      'INSERT INTO mini_app.actors(namespace,subject,member_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [namespace, actor.subject, actor.memberId],
    );
    const rows = z
      .array(z.object({ subject: z.uuid(), member_id: IdSchema }))
      .parse(
        (
          await db.query(
            'SELECT subject,member_id::text FROM mini_app.actors WHERE namespace=$1 AND (subject=$2 OR member_id=$3)',
            [namespace, actor.subject, actor.memberId],
          )
        ).rows,
      );
    if (
      rows.length !== 1 ||
      rows[0]?.subject !== actor.subject ||
      rows[0]?.member_id !== actor.memberId
    )
      throw new Error('APP_ACTOR_CHANGED');
    if (journal.excludes(actor)) {
      await db.query(
        'DELETE FROM mini_app.actors WHERE namespace=$1 AND subject=$2 AND member_id=$3',
        [namespace, actor.subject, actor.memberId],
      );
      throw Error('APP_ACTOR_ERASED');
    }
    return actor;
  }
  async function ownedOutbox(event: string, input: AppActor, db: PoolClient) {
    const current = await actor(input, db);
    const result = await db.query(
      'SELECT *,member_id::text FROM mini_app.outbox WHERE namespace=$1 AND event_id=$2 FOR UPDATE',
      [namespace, event],
    );
    const row = result.rows[0] && Outbox.parse(result.rows[0]);
    if (!row || row.subject !== current.subject || row.member_id !== current.memberId)
      throw new Error('APP_SCOPE');
    return row;
  }
  const store: MiniAppStore = {
    async cleanupExpired() {
      journal.cleanupExpired();
    },
    async cleanup(input) {
      const notice = CleanupNoticeSchema.parse(input);
      if (appBindingHash(notice.binding) !== namespace) throw Error('APP_CLEANUP_BINDING');
      return transaction(pool, async (db) => {
        const owner = (
          await db.query(
            'SELECT member_id::text FROM mini_app.actors WHERE namespace=$1 AND subject=$2 FOR UPDATE',
            [namespace, notice.subject],
          )
        ).rows[0];
        if (owner && z.object({ member_id: z.string() }).parse(owner).member_id !== notice.memberId)
          throw Error('APP_CLEANUP_ACTOR');
        journal.record(notice);
        return applyCleanup(db, notice);
      });
    },
    async tasks(input) {
      await actor(input);
      return (
        await pool.query('SELECT value FROM mini_app.tasks WHERE namespace=$1 ORDER BY id', [
          namespace,
        ])
      ).rows.map((row) => TaskRow.parse(row).value);
    },
    async source(id, input) {
      const task = (await store.tasks(input)).find(
        (task) => hash(binding.appId + ':' + task.id) === id,
      );
      if (!task) throw new Error('SOURCE_UNKNOWN');
      return taskSource(binding.appId, task);
    },
    async complete(id, input, options) {
      return transaction(pool, async (db) => {
        const current = await actor(input, db);
        const found = (
          await db.query(
            'SELECT value FROM mini_app.tasks WHERE namespace=$1 AND id=$2 FOR UPDATE',
            [namespace, id],
          )
        ).rows[0];
        if (!found) throw new Error('SOURCE_UNKNOWN');
        const task = TaskRow.parse(found).value,
          sourceId = hash(binding.appId + ':' + id);
        // Read after acquiring the task lock so a competing writer's commit is visible.
        const existing = (
          await db.query(
            'SELECT *,member_id::text FROM mini_app.outbox WHERE namespace=$1 AND source_id=$2',
            [namespace, sourceId],
          )
        ).rows[0];
        if (existing) {
          const row = Outbox.parse(existing);
          if (row.subject !== current.subject || row.member_id !== current.memberId)
            throw new Error('TASK_ALREADY_COMPLETED');
          if (options.requireEvidence && !row.needs_evidence)
            throw new Error('INTENT_ALREADY_SELECTED');
          if (row.needs_evidence && !row.intent.evidenceCid && !options.requireEvidence)
            throw new Error('EVIDENCE_PENDING');
          return row.intent;
        }
        if (task.state !== 'open' || task.doneBy !== null)
          throw new Error('TASK_ALREADY_COMPLETED');
        task.state = options.review ? 'awaiting-review' : 'completed';
        task.doneBy = current.memberId;
        const source = taskSource(binding.appId, task);
        const intent = ActivityIntentSchema.parse({
          action: options.review ? 'askreview' : 'recordact',
          sourceId,
          sourceRevision: source.sourceRevision,
          eventId: randomBytes(32).toString('hex'),
        });
        await db.query('UPDATE mini_app.tasks SET value=$3 WHERE namespace=$1 AND id=$2', [
          namespace,
          id,
          task,
        ]);
        await db.query(
          'INSERT INTO mini_app.outbox(namespace,event_id,source_id,member_id,subject,intent,snapshot,needs_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            namespace,
            intent.eventId,
            sourceId,
            current.memberId,
            current.subject,
            intent,
            AppSnapshotDraftSchema.parse({ eventId: intent.eventId, source, files: [] }),
            options.requireEvidence ?? false,
          ],
        );
        return intent;
      });
    },
    async draft(event, input) {
      return transaction(pool, async (db) => {
        const row = await ownedOutbox(event, input, db);
        if (row.confirmed || !row.needs_evidence) throw new Error('APP_SCOPE');
        return row.snapshot;
      });
    },
    async evidence(event, input, cid, commitment, epoch) {
      return transaction(pool, async (db) => {
        const row = await ownedOutbox(event, input, db);
        if (row.confirmed || !row.needs_evidence) throw new Error('APP_SCOPE');
        if (row.intent.evidenceCid) throw new Error('EVIDENCE_ALREADY_SELECTED');
        const next = ActivityIntentSchema.parse({
          ...row.intent,
          evidenceCid: cid,
          evidenceHash: commitment,
          keyEpoch: epoch,
        });
        await db.query('UPDATE mini_app.outbox SET intent=$3 WHERE namespace=$1 AND event_id=$2', [
          namespace,
          event,
          next,
        ]);
        return next;
      });
    },
    async pending(input) {
      const current = await actor(input);
      return (
        await pool.query(
          'SELECT *,member_id::text FROM mini_app.outbox WHERE namespace=$1 AND member_id=$2 AND subject=$3 AND confirmed=false ORDER BY event_id',
          [namespace, current.memberId, current.subject],
        )
      ).rows.map((row) => Outbox.parse(row).intent);
    },
    async confirm(event, inputPage, input) {
      const page = AppActivityPageSchema.parse(inputPage);
      return transaction(pool, async (db) => {
        const row = await ownedOutbox(event, input, db),
          intent = row.intent;
        const receipt = page.receipts.find((receipt) => receipt.eventId === event);
        if (
          !receipt ||
          receipt.memberId !== row.member_id ||
          receipt.appId !== binding.appId ||
          receipt.sourceId !== intent.sourceId ||
          receipt.sourceRevision !== intent.sourceRevision ||
          receipt.kind !== (intent.action === 'askreview' ? 'review-requested' : 'completed') ||
          receipt.evidenceCid !== intent.evidenceCid ||
          receipt.evidenceHash !== intent.evidenceHash ||
          receipt.keyEpoch !== intent.keyEpoch
        )
          throw new Error('RECEIPT_UNCONFIRMED');
        if (intent.action === 'askreview' && ['accepted', 'rejected'].includes(receipt.status)) {
          const tasks = (
            await db.query(
              'SELECT value FROM mini_app.tasks WHERE namespace=$1 ORDER BY id FOR UPDATE',
              [namespace],
            )
          ).rows.map((row) => TaskRow.parse(row).value);
          const task = tasks.find(
            (task) => hash(binding.appId + ':' + task.id) === intent.sourceId,
          );
          if (!task) throw new Error('SOURCE_UNKNOWN');
          if (
            taskSource(binding.appId, task).sourceRevision === row.snapshot.source.sourceRevision
          ) {
            task.state = receipt.status === 'accepted' ? 'accepted' : 'rejected';
            await db.query('UPDATE mini_app.tasks SET value=$3 WHERE namespace=$1 AND id=$2', [
              namespace,
              task.id,
              task,
            ]);
          }
        }
        await db.query(
          'UPDATE mini_app.outbox SET confirmed=true WHERE namespace=$1 AND event_id=$2',
          [namespace, event],
        );
        return { receiptId: receipt.receiptId, status: 'confirmed' };
      });
    },
    // No connections are held between calls; the caller owns and closes the shared pool.
    async close() {},
  };
  async function applyCleanup(db: PoolClient, notice: CleanupNotice) {
    const retained = (
      await db.query('SELECT 1 FROM mini_app.outbox WHERE namespace=$1 AND member_id=$2 LIMIT 1', [
        namespace,
        notice.memberId,
      ])
    ).rowCount;
    await db.query(
      'UPDATE mini_app.outbox SET subject=NULL WHERE namespace=$1 AND subject=$2 AND member_id=$3',
      [namespace, notice.subject, notice.memberId],
    );
    await db.query(
      'DELETE FROM mini_app.actors WHERE namespace=$1 AND subject=$2 AND member_id=$3',
      [namespace, notice.subject, notice.memberId],
    );
    return CleanupAckSchema.parse({
      eventId: notice.eventId,
      bindingHash: namespace,
      state: retained ? 'retained' : 'confirmed',
      retentionCodes: retained ? ['DAO_COMPLETION_EVIDENCE'] : [],
    });
  }
  for (const notice of journal.records())
    if (appBindingHash(notice.binding) === namespace)
      await transaction(pool, (db) => applyCleanup(db, notice));
  return store;
}
