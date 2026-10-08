import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import { Uint64Schema } from '../../../../protocol/base.js';
import { ProviderScopeSchema } from './ledger.js';
import { normalizeMailbox } from '../auth/email.js';
import type { MailSender } from '../auth/mail.js';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
const Payload = z.strictObject({
  providerScope: ProviderScopeSchema,
  objectId: z.uuid(),
  generation: Uint64Schema,
});
export function readStorageAlertEmail(
  env: Record<string, string | undefined>,
  mailConfigured: boolean,
): string | null {
  if (env.DACLIFY_STORAGE_ALERT_EMAIL === undefined) return null;
  try {
    if (!mailConfigured) throw new Error();
    return normalizeMailbox(env.DACLIFY_STORAGE_ALERT_EMAIL);
  } catch {
    throw new Error('STORAGE_ALERT_CONFIGURATION_INVALID');
  }
}
export class StorageAlerts {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly to: string,
    private readonly send: MailSender,
  ) {
    ProviderScopeSchema.parse(scope);
    normalizeMailbox(to);
  }
  async queue(): Promise<void> {
    await this.pool.query(
      `INSERT INTO jobs(module_id,kind,job_key,payload,due_at)
      SELECT 'core-storage-alerts','deliver','storage-alert:'||r.object_id::text||':'||r.generation::text,
        jsonb_build_object('providerScope',o.provider_scope,'objectId',r.object_id,'generation',r.generation::text),now()
      FROM hosted_removals r JOIN hosted_objects o ON o.id=r.object_id
      WHERE o.provider_scope=$1 AND r.state='review'
        AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.job_key='storage-alert:'||r.object_id::text||':'||r.generation::text)
      ORDER BY r.created_at,r.object_id LIMIT 50 ON CONFLICT(job_key) DO NOTHING`,
      [this.scope],
    );
  }
  async process(owner: string): Promise<string> {
    const job = await leaseJob(this.pool, owner, {
      moduleId: 'core-storage-alerts',
      kind: 'deliver',
      providerScope: this.scope,
    });
    if (!job) return 'idle';
    const parsed = Payload.safeParse(job.payload);
    let outcome: 'completed' | 'retry' | 'manual' = 'manual',
      error: string | null = 'STORAGE_ALERT_PAYLOAD_INVALID';
    try {
      if (!parsed.success || parsed.data.providerScope !== this.scope)
        throw new Error('STORAGE_ALERT_PAYLOAD_INVALID');
      const incident = await this.pool.query<{ state: string }>(
        `SELECT r.state FROM hosted_removals r JOIN hosted_objects o ON o.id=r.object_id WHERE r.object_id=$1 AND r.generation=$2 AND o.provider_scope=$3`,
        [parsed.data.objectId, parsed.data.generation, this.scope],
      );
      const state = z
        .enum(['prepared', 'removing', 'removed', 'canceled', 'review'])
        .parse(incident.rows[0]?.state);
      if (state === 'review') {
        await this.send({
          to: this.to,
          subject: 'Daclify storage recovery needs operator review',
          text: `Storage removal incident ${parsed.data.objectId}, generation ${parsed.data.generation}, needs review. Provider removal or compensation could not be confirmed. The worker retains its staged recovery bytes. Review the private operator database and restore verified pin availability before clearing the incident. Do not discard the staged copy or assume payment alone restores unavailable content.`,
          messageId: `<storage-alert-${job.id}@daclify.com>`,
        });
        outcome = 'completed';
        error = null;
      } else if (state === 'removed' || state === 'canceled') {
        outcome = 'completed';
        error = null;
      } else {
        outcome = job.attempts < 12 ? 'retry' : 'manual';
        error = 'STORAGE_ALERT_INCIDENT_PENDING';
      }
    } catch {
      outcome =
        parsed.success && parsed.data.providerScope === this.scope && job.attempts < 12
          ? 'retry'
          : 'manual';
      error =
        parsed.success && parsed.data.providerScope === this.scope
          ? 'STORAGE_ALERT_DELIVERY_PENDING'
          : 'STORAGE_ALERT_PAYLOAD_INVALID';
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
export function startStorageAlertsWorker(service: StorageAlerts) {
  const owner = randomUUID();
  return startPollingWorker(async () => {
    await service.queue();
    return service.process(owner);
  }, 'STORAGE_ALERT_WORKER_FAILED');
}
