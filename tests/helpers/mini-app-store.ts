import { describe, expect, it } from 'vitest';
import { type AppBinding, type AppActor, AppActivityPageSchema } from '@daclify/core-protocol';
import type { MiniAppStore } from '../../examples/community-mini-app/database.js';

export const miniBinding: AppBinding = {
  schemaVersion: 1,
  chainId: 'ab'.repeat(32),
  runtime: 'daclifycore',
  daoId: '1',
  appId: '1',
  issuer: 'https://issuer.example',
  clientId: '550e8400-e29b-41d4-a716-446655440002',
};
export const miniActor: AppActor = {
  binding: miniBinding,
  subject: '550e8400-e29b-41d4-a716-446655440001',
  memberId: '1',
};
export interface MiniFixture {
  store: MiniAppStore;
  open(binding: AppBinding): Promise<MiniAppStore>;
  edit(details: string): Promise<void>;
  breakOutbox(): Promise<void>;
  outboxCount(): Promise<number>;
  backupAndRestore(): Promise<MiniAppStore>;
  cleanup(): Promise<void>;
}
export function miniAppConformance(engine: string, setup: () => Promise<MiniFixture>) {
  describe(engine + ' database contract', () => {
    const check = (name: string, test: (fixture: MiniFixture) => Promise<void>) =>
      it(name, async () => {
        const f = await setup();
        try {
          await test(f);
        } finally {
          await f.cleanup();
        }
      });
    check('separates two member-1 tenants and rejects a wrong DAO/client actor', async (f) => {
      const secondBinding = { ...miniBinding, daoId: '2' };
      const second = await f.open(secondBinding);
      const actor = { ...miniActor, binding: secondBinding };
      const firstIntent = await f.store.complete('chillies', miniActor, {});
      expect(await second.pending(actor)).toEqual([]);
      const secondIntent = await second.complete('chillies', actor, {});
      expect(secondIntent.eventId).not.toBe(firstIntent.eventId);
      for (const changed of [
        { daoId: '2' },
        { clientId: '550e8400-e29b-41d4-a716-446655440003' },
      ]) {
        await expect(
          f.store.pending({ ...miniActor, binding: { ...miniBinding, ...changed } }),
        ).rejects.toThrow('APP_ACTOR_BINDING');
      }
      expect(await f.store.pending(miniActor)).toEqual([firstIntent]);
    });
    check('refuses a forged subject or native member from inheriting history', async (f) => {
      await f.store.complete('chillies', miniActor, {});
      await expect(
        f.store.pending({ ...miniActor, subject: '550e8400-e29b-41d4-a716-446655440003' }),
      ).rejects.toThrow('APP_ACTOR_CHANGED');
      await expect(f.store.pending({ ...miniActor, memberId: '2' })).rejects.toThrow(
        'APP_ACTOR_CHANGED',
      );
    });
    check('rolls back task completion when durable outbox persistence fails', async (f) => {
      await f.breakOutbox();
      await expect(f.store.complete('chillies', miniActor, {})).rejects.toThrow();
      expect((await f.store.tasks(miniActor))[0]).toMatchObject({ state: 'open', doneBy: null });
    });
    check('serializes concurrent completion to one immutable event', async (f) => {
      const second = await f.open(miniBinding);
      const intents = await Promise.all([
        f.store.complete('chillies', miniActor, {}),
        second.complete('chillies', miniActor, {}),
      ]);
      expect(intents[0]).toEqual(intents[1]);
      expect(await f.outboxCount()).toBe(1);
    });
    check('preserves the frozen revision across edits, restart and database restore', async (f) => {
      const intent = await f.store.complete('chillies', miniActor, {});
      await f.edit('Updated after the original submission');
      const restarted = await f.open(miniBinding);
      expect(await restarted.complete('chillies', miniActor, {})).toEqual(intent);
      const restored = await f.backupAndRestore();
      expect(await restored.pending(miniActor)).toEqual([intent]);
      expect(await restored.complete('chillies', miniActor, {})).toEqual(intent);
    });
    check('stores maximum uint64 identities as lossless decimal strings', async (f) => {
      const binding = {
        ...miniBinding,
        daoId: '18446744073709551615',
        appId: '18446744073709551615',
      };
      const store = await f.open(binding);
      const actor = { ...miniActor, binding, memberId: '18446744073709551615' };
      const intent = await store.complete('chillies', actor, {});
      expect((await store.tasks(actor))[0]?.doneBy).toBe(actor.memberId);
      expect(await store.pending(actor)).toEqual([intent]);
    });
    check(
      'freezes evidence and reconciles reviews only against the submitted revision',
      async (f) => {
        const intent = await f.store.complete('chillies', miniActor, {
          requireEvidence: true,
          review: true,
        });
        await expect(f.store.complete('chillies', miniActor, {})).rejects.toThrow(
          'EVIDENCE_PENDING',
        );
        expect((await f.store.draft(intent.eventId, miniActor)).source.sourceRevision).toBe(
          intent.sourceRevision,
        );
        const selected = await f.store.evidence(
          intent.eventId,
          miniActor,
          'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          'ab'.repeat(32),
          '1',
        );
        await expect(
          f.store.evidence(
            intent.eventId,
            miniActor,
            'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'ab'.repeat(32),
            '1',
          ),
        ).rejects.toThrow('EVIDENCE_ALREADY_SELECTED');
        await f.edit('Edited after requesting independent review');
        const page = AppActivityPageSchema.parse({
          receipts: [
            {
              sourceId: selected.sourceId,
              sourceRevision: selected.sourceRevision,
              eventId: selected.eventId,
              evidenceCid: selected.evidenceCid,
              evidenceHash: selected.evidenceHash,
              keyEpoch: selected.keyEpoch,
              receiptId: '1',
              appId: miniBinding.appId,
              memberId: miniActor.memberId,
              kind: 'review-requested',
              status: 'accepted',
              createdAt: 1,
            },
          ],
          next: null,
        });
        await expect(
          f.store.confirm(
            intent.eventId,
            {
              ...page,
              receipts: page.receipts.map((r) => ({ ...r, sourceRevision: 'ff'.repeat(32) })),
            },
            miniActor,
          ),
        ).rejects.toThrow('RECEIPT_UNCONFIRMED');
        expect(await f.store.pending(miniActor)).toEqual([selected]);
        await f.store.confirm(intent.eventId, page, miniActor);
        expect((await f.store.tasks(miniActor))[0]?.state).toBe('awaiting-review');
        expect(await f.store.pending(miniActor)).toEqual([]);
      },
    );
  });
}
