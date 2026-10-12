import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppClaimsSchema, AppActivityPageSchema } from '../protocol/connected-apps.js';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { actorFromVerifiedClaims, type AppClaims } from '../protocol/index.js';
import { Store, adoptLegacyDatabase } from '../examples/community-mini-app/store.js';
import { z } from 'zod';
it('persists one member-bound completion across retries and database restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-app-')),
    path = join(dir, 'tasks.sqlite'),
    member = AppClaimsSchema.parse({
      sub: '550e8400-e29b-41d4-a716-446655440001',
      dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      memberId: '3',
      admin: false,
      reviewer: false,
      nonce: '0',
      appId: '1',
      appRevision: '1',
      sessionId: null,
      sessionExpires: null,
    });
  const store = new Store(path, boundApp),
    intent = z
      .object({ eventId: z.string(), sourceId: z.string(), sourceRevision: z.string() })
      .parse(store.complete('chillies', asActor(member)));
  store.close();
  const restored = new Store(path, boundApp);
  expect(restored.complete('chillies', asActor(member))).toMatchObject(intent);
  expect(restored.pending(boundActor)).toHaveLength(1);
  expect(() => restored.complete('chillies', asActor(member), true)).toThrow(
    'INTENT_ALREADY_SELECTED',
  );
  expect(restored.pending(otherActor)).toHaveLength(0);
  expect(() =>
    restored.complete('chillies', asActor({ ...member, sub: otherActor.subject, memberId: '4' })),
  ).toThrow('TASK_ALREADY_COMPLETED');
  const page = AppActivityPageSchema.parse({
    receipts: [
      {
        receiptId: '1',
        appId: '1',
        memberId: '3',
        ...intent,
        kind: 'completed',
        status: 'recorded',
        createdAt: 1,
        evidenceCid: '',
        evidenceHash: '00'.repeat(32),
        keyEpoch: '0',
      },
    ],
    next: null,
  });
  expect(() =>
    restored.confirm(
      intent.eventId,
      { ...page, receipts: page.receipts.map((r) => ({ ...r, sourceRevision: 'ff'.repeat(32) })) },
      boundActor,
    ),
  ).toThrow('RECEIPT_UNCONFIRMED');
  expect(restored.confirm(intent.eventId, page, boundActor).status).toBe('confirmed');
  expect(restored.pending(boundActor)).toHaveLength(0);
  restored.close();
  rmSync(dir, { recursive: true });
});
it('keeps a requested snapshot pending through pinning failure and freezes its selected commitment', () => {
  const store = new Store(':memory:', boundApp),
    member = AppClaimsSchema.parse({
      sub: '550e8400-e29b-41d4-a716-446655440001',
      dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      memberId: '3',
      admin: false,
      reviewer: false,
      nonce: '0',
      appId: '1',
      appRevision: '1',
      sessionId: null,
      sessionExpires: null,
    }),
    intent = z
      .object({ eventId: z.string() })
      .parse(store.complete('chillies', asActor(member), true));
  expect(() => store.complete('chillies', asActor(member))).toThrow('EVIDENCE_PENDING');
  expect(store.draft(intent.eventId, boundActor).source.title).toContain('chillies');
  expect(() => store.draft(intent.eventId, otherActor)).toThrow();
  const selected = store.evidence(
    intent.eventId,
    boundActor,
    'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'ab'.repeat(32),
    '9',
  );
  expect(store.complete('chillies', asActor(member))).toMatchObject(selected);
  expect(() => store.evidence(intent.eventId, boundActor, 'other', 'cd'.repeat(32), '9')).toThrow(
    'EVIDENCE_ALREADY_SELECTED',
  );
  store.close();
});
it('applies independent review only to the exact still-current submitted source revision', () => {
  const member = AppClaimsSchema.parse({
    sub: '550e8400-e29b-41d4-a716-446655440001',
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    memberId: '3',
    admin: false,
    reviewer: false,
    nonce: '0',
    appId: '1',
    appRevision: '1',
    sessionId: null,
    sessionExpires: null,
  });
  for (const changed of [false, true]) {
    const store = new Store(':memory:', boundApp),
      intent = z
        .object({ sourceId: z.string(), sourceRevision: z.string(), eventId: z.string() })
        .parse(store.complete('chillies', asActor(member), false, true));
    if (changed) {
      const task = store.tasks(boundActor)[0];
      if (!task) throw new Error('FIXTURE_TASK');
      task.details = 'Edited after submission';
      store.db.prepare('UPDATE tasks SET value=? WHERE id=?').run(JSON.stringify(task), task.id);
    }
    const page = AppActivityPageSchema.parse({
      receipts: [
        {
          receiptId: '1',
          appId: '1',
          memberId: '3',
          ...intent,
          kind: 'review-requested',
          status: 'accepted',
          createdAt: 1,
          evidenceCid: '',
          evidenceHash: '00'.repeat(32),
          keyEpoch: '0',
        },
      ],
      next: null,
    });
    store.confirm(intent.eventId, page, boundActor);
    expect(store.tasks(boundActor)[0]?.state).toBe(changed ? 'awaiting-review' : 'accepted');
    store.close();
  }
});

const boundApp = {
  schemaVersion: 1 as const,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '1',
  appId: '1',
  issuer: 'https://issuer.example',
  clientId: '550e8400-e29b-41d4-a716-446655440002',
};
const boundActor = {
  binding: boundApp,
  subject: '550e8400-e29b-41d4-a716-446655440001',
  memberId: '3',
};
it('rejects_rebound_database_before_reads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-app-binding-'));
  const path = join(dir, 'bound.sqlite');
  const initial = new Store(path, boundApp);
  initial.complete('chillies', boundActor);
  initial.close();
  try {
    for (const changed of [
      { daoId: '2' },
      { appId: '2' },
      { chainId: 'cd'.repeat(32) },
      { runtime: 'otherdao' },
      { issuer: 'https://other.example' },
      { clientId: '550e8400-e29b-41d4-a716-446655440003' },
    ]) {
      expect(() => new Store(path, { ...boundApp, ...changed })).toThrow('APP_DATABASE_BINDING');
    }
    const restored = new Store(path, boundApp);
    expect(restored.pending(boundActor)).toHaveLength(1);
    restored.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
it('rejects_actor_from_other_dao', () => {
  const store = new Store(':memory:', boundApp);
  try {
    const wrong = { ...boundActor, binding: { ...boundApp, daoId: '2' } };
    expect(() => store.tasks(wrong)).toThrow('APP_ACTOR_BINDING');
    expect(() => store.complete('chillies', wrong)).toThrow('APP_ACTOR_BINDING');
    expect(store.tasks(boundActor)[0]?.state).toBe('open');
  } finally {
    store.close();
  }
});

const otherActor = {
  ...boundActor,
  subject: '550e8400-e29b-41d4-a716-446655440004',
  memberId: '4',
};
function asActor(claims: AppClaims) {
  return actorFromVerifiedClaims(boundApp, claims, boundApp);
}
it('reconciles_original_intent_after_source_edit', () => {
  const store = new Store(':memory:', boundApp);
  try {
    const intent = store.complete('chillies', boundActor);
    const task = store.tasks(boundActor)[0];
    if (!task) throw new Error('FIXTURE_TASK');
    task.details = 'A different current revision';
    store.db.prepare('UPDATE tasks SET value=? WHERE id=?').run(JSON.stringify(task), task.id);
    expect(store.complete('chillies', boundActor)).toMatchObject(intent);
    expect(store.pending(boundActor)).toHaveLength(1);
  } finally {
    store.close();
  }
});
it('does_not_duplicate_after_restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-app-restart-'));
  const path = join(dir, 'app.sqlite');
  try {
    const first = new Store(path, boundApp);
    const intent = first.complete('chillies', boundActor);
    first.close();
    const second = new Store(path, boundApp);
    expect(second.complete('chillies', boundActor)).toMatchObject(intent);
    expect(second.pending(boundActor)).toHaveLength(1);
    second.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
it('refuses a changed subject or member mapping rather than giving away old history', () => {
  const store = new Store(':memory:', boundApp);
  try {
    store.complete('chillies', boundActor);
    expect(() => store.pending({ ...boundActor, subject: otherActor.subject })).toThrow(
      'APP_ACTOR_CHANGED',
    );
    expect(() => store.tasks({ ...boundActor, memberId: '4' })).toThrow('APP_ACTOR_CHANGED');
    expect(store.pending(otherActor)).toHaveLength(0);
    expect(store.pending(boundActor)).toHaveLength(1);
  } finally {
    store.close();
  }
});
it('rolls back the task when outbox insertion fails', () => {
  const store = new Store(':memory:', boundApp);
  try {
    store.db.exec(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'fixture outbox failure'); END",
    );
    expect(() => store.complete('chillies', boundActor)).toThrow('fixture outbox failure');
    expect(store.tasks(boundActor)[0]?.state).toBe('open');
    expect(store.pending(boundActor)).toHaveLength(0);
  } finally {
    store.close();
  }
});
it('keeps two database handles from creating a second completion while another writer holds the lock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-app-lock-'));
  const path = join(dir, 'app.sqlite');
  const first = new Store(path, boundApp),
    second = new Store(path, boundApp);
  try {
    second.db.exec('PRAGMA busy_timeout=1');
    first.db.exec('BEGIN IMMEDIATE');
    expect(() => second.complete('chillies', boundActor)).toThrow();
    first.db.exec('ROLLBACK');
    const intent = first.complete('chillies', boundActor);
    expect(second.complete('chillies', boundActor)).toMatchObject(intent);
    expect(second.pending(boundActor)).toHaveLength(1);
  } finally {
    first.close();
    second.close();
    rmSync(dir, { recursive: true });
  }
});
it('requires a consistent backup and verified actor mappings for explicit legacy adoption', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-app-adopt-'));
  const path = join(dir, 'legacy.sqlite'),
    backupPath = join(dir, 'backup.sqlite');
  const db = new DatabaseSync(path);
  const task = {
    id: 'chillies',
    title: 'A legacy task',
    details: 'Frozen local work',
    state: 'completed',
    doneBy: '3',
  };
  const sourceId = createHash('sha256').update('1:chillies').digest('hex');
  const sourceRevision = createHash('sha256').update(JSON.stringify(task)).digest('hex');
  const intent = { action: 'recordact', eventId: 'ab'.repeat(32), sourceId, sourceRevision };
  db.exec(
    'CREATE TABLE tasks(id TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE outbox(event_id TEXT PRIMARY KEY,source_id TEXT NOT NULL,member_id TEXT NOT NULL,intent TEXT NOT NULL,confirmed INTEGER NOT NULL DEFAULT 0,snapshot TEXT,needs_evidence INTEGER NOT NULL DEFAULT 0,UNIQUE(source_id))',
  );
  db.prepare('INSERT INTO tasks VALUES(?,?)').run(task.id, JSON.stringify(task));
  db.prepare('INSERT INTO outbox(event_id,source_id,member_id,intent) VALUES(?,?,?,?)').run(
    intent.eventId,
    sourceId,
    '3',
    JSON.stringify(intent),
  );
  db.close();
  try {
    expect(() => new Store(path, boundApp)).toThrow('APP_DATABASE_ADOPTION_REQUIRED');
    await expect(
      adoptLegacyDatabase(path, { ...boundApp, appId: '2' }, backupPath, [
        { ...boundActor, binding: { ...boundApp, appId: '2' } },
      ]),
    ).rejects.toThrow('APP_DATABASE_ADOPTION_RECORD');
    await adoptLegacyDatabase(path, boundApp, backupPath, [boundActor]);
    const restored = new Store(path, boundApp);
    expect(restored.pending(boundActor)).toMatchObject([intent]);
    restored.close();
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    expect(
      backup.prepare("SELECT name FROM sqlite_schema WHERE name='app_binding'").get(),
    ).toBeUndefined();
    expect(backup.prepare('SELECT event_id FROM outbox').get()).toMatchObject({
      event_id: intent.eventId,
    });
    backup.close();
    await expect(
      adoptLegacyDatabase(path, boundApp, join(dir, 'second-backup.sqlite'), [boundActor]),
    ).rejects.toThrow('APP_DATABASE_ALREADY_BOUND');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
it('refuses to replace a completed author when its outbox record is missing', () => {
  const store = new Store(':memory:', boundApp);
  try {
    store.complete('chillies', boundActor);
    store.db.exec('DELETE FROM outbox');
    expect(() => store.complete('chillies', otherActor)).toThrow('TASK_ALREADY_COMPLETED');
    expect(store.tasks(boundActor)[0]?.doneBy).toBe('3');
  } finally {
    store.close();
  }
});
it('stores uint64 maxima as exact strings in the binding and completing author', () => {
  const maximum = '18446744073709551615';
  const binding = { ...boundApp, appId: maximum, daoId: maximum };
  const actor = { ...boundActor, binding, memberId: maximum };
  const store = new Store(':memory:', binding);
  try {
    store.complete('chillies', actor);
    expect(store.tasks(actor)[0]?.doneBy).toBe(maximum);
    expect(store.binding.daoId).toBe(maximum);
    expect(store.pending(actor)).toHaveLength(1);
  } finally {
    store.close();
  }
});
