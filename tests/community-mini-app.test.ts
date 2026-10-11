import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppClaimsSchema, AppActivityPageSchema } from '../protocol/connected-apps.js';
import { Store } from '../examples/community-mini-app/store.js';
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
  const store = new Store(path, '1'),
    intent = z
      .object({ eventId: z.string(), sourceId: z.string(), sourceRevision: z.string() })
      .parse(store.complete('chillies', member));
  store.close();
  const restored = new Store(path, '1');
  expect(restored.complete('chillies', member)).toMatchObject(intent);
  expect(restored.pending('3')).toHaveLength(1);
  expect(() => restored.complete('chillies', member, true)).toThrow('INTENT_ALREADY_SELECTED');
  expect(restored.pending('4')).toHaveLength(0);
  expect(() => restored.complete('chillies', { ...member, memberId: '4' })).toThrow(
    'TASK_ALREADY_COMPLETED',
  );
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
      '3',
    ),
  ).toThrow('RECEIPT_UNCONFIRMED');
  expect(restored.confirm(intent.eventId, page, '3').status).toBe('confirmed');
  expect(restored.pending('3')).toHaveLength(0);
  restored.close();
  rmSync(dir, { recursive: true });
});
it('keeps a requested snapshot pending through pinning failure and freezes its selected commitment', () => {
  const store = new Store(':memory:', '1'),
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
    intent = z.object({ eventId: z.string() }).parse(store.complete('chillies', member, true));
  expect(() => store.complete('chillies', member)).toThrow('EVIDENCE_PENDING');
  expect(store.draft(intent.eventId, '3').source.title).toContain('chillies');
  expect(() => store.draft(intent.eventId, '4')).toThrow();
  const selected = store.evidence(
    intent.eventId,
    '3',
    'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'ab'.repeat(32),
    '9',
  );
  expect(store.complete('chillies', member)).toMatchObject(selected);
  expect(() => store.evidence(intent.eventId, '3', 'other', 'cd'.repeat(32), '9')).toThrow(
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
    const store = new Store(':memory:', '1'),
      intent = z
        .object({ sourceId: z.string(), sourceRevision: z.string(), eventId: z.string() })
        .parse(store.complete('chillies', member, false, true));
    if (changed) {
      const task = store.tasks()[0];
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
    store.confirm(intent.eventId, page, '3');
    expect(store.tasks()[0]?.state).toBe(changed ? 'awaiting-review' : 'accepted');
    store.close();
  }
});
