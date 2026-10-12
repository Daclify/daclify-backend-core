import type {
  AppActor,
  AppActivityPageSchema,
  AppSnapshotDraftSchema,
  AppSourceRecordSchema,
} from '@daclify/core-protocol';
import type { ActivityIntent } from '@daclify/modules/sdk';
import type { z } from 'zod';
import { Store, type Task } from './store.js';
export type { Task } from './store.js';
export type CompletionOptions = { requireEvidence?: boolean; review?: boolean };
export interface MiniAppStore {
  tasks(actor: AppActor): Promise<Task[]>;
  source(sourceId: string, actor: AppActor): Promise<z.infer<typeof AppSourceRecordSchema>>;
  complete(taskId: string, actor: AppActor, options: CompletionOptions): Promise<ActivityIntent>;
  draft(eventId: string, actor: AppActor): Promise<z.infer<typeof AppSnapshotDraftSchema>>;
  evidence(
    eventId: string,
    actor: AppActor,
    cid: string,
    hash: string,
    epoch: string,
  ): Promise<ActivityIntent>;
  pending(actor: AppActor): Promise<ActivityIntent[]>;
  confirm(
    eventId: string,
    page: z.infer<typeof AppActivityPageSchema>,
    actor: AppActor,
  ): Promise<{ receiptId: string; status: 'confirmed' }>;
  close(): Promise<void>;
}
export function sqliteStore(store: Store): MiniAppStore {
  return {
    async tasks(actor) {
      return store.tasks(actor);
    },
    async source(id, actor) {
      return store.source(id, actor);
    },
    async complete(id, actor, options) {
      return store.complete(id, actor, options.requireEvidence, options.review);
    },
    async draft(event, actor) {
      return store.draft(event, actor);
    },
    async evidence(event, actor, cid, hash, epoch) {
      return store.evidence(event, actor, cid, hash, epoch);
    },
    async pending(actor) {
      return store.pending(actor);
    },
    async confirm(event, page, actor) {
      return store.confirm(event, page, actor);
    },
    async close() {
      store.close();
    },
  };
}
