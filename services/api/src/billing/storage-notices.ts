import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { DaoRefSchema } from '../../../../protocol/base.js';
import {
  StorageNoticeSchema,
  storageNotices,
  type StoragePricing,
} from '../../../../protocol/storage.js';
import type { ChainGateway } from '../chain.js';
import { contentDaoKey } from '../content/ledger.js';
import { ProviderScopeSchema } from '../content/ledger.js';
import { normalizeMailbox } from '../auth/email.js';
import { readAccount } from '../auth/account-session.js';
import type { MailSender } from '../auth/mail.js';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
import { storageFunding } from './storage-state.js';
import type { HostedStorage } from './storage.js';
const Payload = z.strictObject({ subscriptionId: z.uuid(), notice: StorageNoticeSchema });
const Subscription = z.object({
  id: z.uuid(),
  dao: DaoRefSchema,
  provider_scope: z.string(),
  account_id: z.uuid(),
});
export function readStorageNoticesEnabled(
  env: Record<string, string | undefined>,
  mailConfigured: boolean,
): boolean {
  const enabled = z
    .enum(['true', 'false'])
    .default('false')
    .safeParse(env.DACLIFY_STORAGE_NOTICES_ENABLED);
  if (!enabled.success || (enabled.data === 'true' && !mailConfigured))
    throw new Error('STORAGE_NOTICE_CONFIGURATION_INVALID');
  return enabled.data === 'true';
}
export class StorageNotices {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly storage: Pick<HostedStorage, 'status'>,
    private readonly scope: string,
    private readonly pricing: StoragePricing,
    private readonly send: MailSender,
  ) {
    ProviderScopeSchema.parse(scope);
  }
  async queue(now = new Date()): Promise<void> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const rows = await db.query<Record<string, unknown>>(
        `SELECT id,dao FROM storage_subscriptions s WHERE provider_scope=$1 AND (notice_checked_at IS NULL OR notice_checked_at<$2::timestamptz-interval '10 minutes') AND EXISTS(SELECT 1 FROM storage_invoices i WHERE i.subscription_id=s.id AND i.verified_at IS NOT NULL) ORDER BY notice_checked_at NULLS FIRST,id LIMIT 50 FOR UPDATE SKIP LOCKED`,
        [this.scope, now],
      );
      for (const value of rows.rows) {
        const row = z.object({ id: z.uuid(), dao: DaoRefSchema }).parse(value),
          funding = await storageFunding(db, row.dao, this.scope, this.pricing, now);
        for (const notice of storageNotices(funding, now)) {
          const key =
            'storage-notice:' +
            createHash('sha256')
              .update(JSON.stringify([this.scope, row.id, notice]))
              .digest('hex');
          await db.query(
            "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-storage-notices','deliver',$1,$2,now()) ON CONFLICT(job_key) DO NOTHING",
            [key, { subscriptionId: row.id, notice }],
          );
        }
        await db.query('UPDATE storage_subscriptions SET notice_checked_at=$2 WHERE id=$1', [
          row.id,
          now,
        ]);
      }
      await db.query('COMMIT');
    } catch (cause) {
      await db.query('ROLLBACK');
      throw cause;
    } finally {
      db.release();
    }
  }
  async process(owner: string): Promise<string> {
    const job = await leaseJob(this.pool, owner, {
      moduleId: 'core-storage-notices',
      kind: 'deliver',
    });
    if (!job) return 'idle';
    let outcome: 'completed' | 'retry' | 'manual' = 'manual',
      error: string | null = 'STORAGE_NOTICE_PAYLOAD_INVALID';
    const parsed = Payload.safeParse(job.payload);
    try {
      if (!parsed.success) throw new Error('STORAGE_NOTICE_PAYLOAD_INVALID');
      const payload = parsed.data,
        found = await this.pool.query<Record<string, unknown>>(
          `SELECT s.id,s.dao,s.provider_scope,COALESCE(a.approved_by,s.created_by) AS account_id FROM storage_subscriptions s LEFT JOIN storage_approvals a ON a.request_id=s.current_approval WHERE s.id=$1`,
          [payload.subscriptionId],
        );
      const row = Subscription.parse(found.rows[0]);
      if (row.provider_scope !== this.scope) throw new Error('STORAGE_NOTICE_SCOPE');
      const account = await readAccount(this.pool, row.account_id);
      if (!account) throw new Error('STORAGE_NOTICE_CONTACT_REQUIRED');
      const admin = (await this.chain.memberships(account)).some(
        (m) =>
          m.active &&
          m.admin &&
          contentDaoKey(m.dao) === contentDaoKey(row.dao) &&
          m.dao.interfaceVersion === row.dao.interfaceVersion,
      );
      if (!admin) {
        outcome = 'completed';
        error = null;
      } else {
        const status = await this.storage.status(account, row.dao);
        const current = status.notices.some(
          (notice) => JSON.stringify(notice) === JSON.stringify(payload.notice),
        );
        if (!current) {
          outcome = 'completed';
          error = null;
        } else {
          const contacts = await this.pool.query<{ provider_key: string }>(
            "SELECT provider_key FROM credentials WHERE account_id=$1 AND provider_key LIKE 'email:%' ORDER BY provider_key LIMIT 1",
            [account.id],
          );
          const contact = contacts.rows[0];
          if (!contact) {
            outcome = 'manual';
            error = 'STORAGE_NOTICE_CONTACT_REQUIRED';
          } else {
            const to = normalizeMailbox(contact.provider_key.slice(6)),
              notice = payload.notice;
            await this.send({
              to,
              subject:
                notice.stage === 'billing-review'
                  ? 'Daclify storage needs billing review'
                  : 'Daclify storage payment and retention reminder',
              text: `DAO ${row.dao.daoId} on ${row.dao.contract}. Storage notice: ${notice.stage}. Paid term ends ${notice.paidThrough}. Original retention grace ends ${notice.graceEndsAt}. Open Daclify Resources to review billing, choose whole files to retain or export your archives. The free allowance remains. Hosting removal does not erase blockchain rights or purchased RAM. Payment after removal does not guarantee lost files can be recovered.`,
              messageId: `<storage-${job.id}@daclify.com>`,
            });
            outcome = 'completed';
            error = null;
          }
        }
      }
    } catch {
      outcome = parsed.success && job.attempts < 12 ? 'retry' : 'manual';
      error = parsed.success ? 'STORAGE_NOTICE_DELIVERY_PENDING' : 'STORAGE_NOTICE_PAYLOAD_INVALID';
    }
    const changed = await this.pool.query(
      "UPDATE jobs SET state=$1,lease_owner=NULL,lease_until=NULL,last_error_code=$2,due_at=now()+($3::int*interval '1 second') WHERE id=$4 AND state='running' AND lease_owner=$5 AND lease_until>now()",
      [
        outcome === 'completed' ? 'completed' : outcome === 'manual' ? 'failed' : 'pending',
        error,
        Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)),
        job.id,
        owner,
      ],
    );
    return changed.rowCount === 1 ? outcome : 'lost';
  }
}
export function startStorageNoticesWorker(service: StorageNotices) {
  const owner = randomUUID();
  return startPollingWorker(async () => {
    await service.queue();
    return service.process(owner);
  }, 'STORAGE_NOTICE_WORKER_FAILED');
}
