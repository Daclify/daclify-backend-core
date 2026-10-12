import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { AppBindingSchema, appBindingHash } from '../../../../protocol/mini-app-database.js';
import { CleanupAckSchema, CleanupNoticeSchema } from '../../../../protocol/account-exit.js';
import { ConnectedAppConfigSchema } from '../../../../protocol/connected-apps.js';
import type { ConnectedApps } from '../connected-apps/service.js';
import { isPublicAddress, pinnedHttpsRequest, probeDependencies, type Address } from './probe.js';
export interface CleanupDelivery {
  lookup(hostname: string): Promise<readonly Address[]>;
  request(
    url: URL,
    address: Address,
    signal: AbortSignal,
    token: string,
  ): Promise<{ status: number; bytes: Uint8Array }>;
}
const delivery: CleanupDelivery = {
  lookup: probeDependencies.lookup,
  request: (url, address, signal, token) => pinnedHttpsRequest(url, address, signal, { token }),
};
const Row = z.object({
  event_id: z.uuid(),
  operation_id: z.uuid(),
  client_id: z.uuid(),
  subject: z.uuid(),
  member_id: z.string(),
  binding: AppBindingSchema,
  configuration: ConnectedAppConfigSchema,
  configuration_hash: z.string(),
  kind: CleanupNoticeSchema.shape.kind,
  expires_at: z.date(),
  attempts: z.int(),
});
export class MiniAppCleanup {
  constructor(
    private readonly pool: Pool,
    private readonly apps: ConnectedApps,
    private readonly network: CleanupDelivery = delivery,
  ) {}
  async freeze(db: Pool | PoolClient, operationId: string) {
    await db.query(
      'INSERT INTO account_exit_app_subjects(operation_id,client_id,subject,member_id,configuration_hash) SELECT $1,s.client_id,s.subject,s.member_id,s.configuration_hash FROM connected_app_subjects s JOIN account_exit_scope o ON o.account_id=s.account_id WHERE o.operation_id=$1 AND NOT EXISTS(SELECT 1 FROM mini_app_cleanup_notices WHERE operation_id=$1) ON CONFLICT DO NOTHING',
      [operationId],
    );
    // Freeze the configuration verified at login; drafts never select a cleanup endpoint.
    await db.query(
      `INSERT INTO mini_app_cleanup_notices(event_id,operation_id,client_id,subject,member_id,binding,configuration,configuration_hash,kind,state,reason,expires_at)
   SELECT gen_random_uuid(),o.id,s.client_id,s.subject,s.member_id,
    jsonb_build_object('schemaVersion',1,'chainId',a.chain_id,'runtime',a.runtime,'daoId',a.dao_id::text,'appId',a.app_id::text,'issuer',$2::text,'clientId',a.id::text),c.config,c.config_hash,
    CASE WHEN o.mode='delete-account' THEN 'account-erased' ELSE 'membership-left' END,
    CASE WHEN s.member_id IS NULL OR c.config->>'cleanupUrl' IS NULL THEN 'unavailable' ELSE 'pending' END,
    CASE WHEN s.member_id IS NULL THEN 'APP_MEMBER_REFERENCE_UNAVAILABLE' WHEN c.config IS NULL THEN 'APP_CLEANUP_CONFIGURATION_UNVERIFIED' WHEN c.config->>'cleanupUrl' IS NULL THEN 'APP_CLEANUP_ENDPOINT_MISSING' ELSE 'APP_CLEANUP_PENDING' END,o.expires_at
   FROM account_exit_operations o JOIN account_exit_app_subjects s ON s.operation_id=o.id JOIN connected_apps a ON a.id=s.client_id
   LEFT JOIN LATERAL(SELECT config,config_hash FROM connected_app_configs WHERE client_id=a.id AND config_hash=s.configuration_hash LIMIT 1)c ON true
   WHERE o.id=$1 AND NOT EXISTS(SELECT 1 FROM mini_app_cleanup_notices n WHERE n.operation_id=o.id) ON CONFLICT(operation_id,client_id,subject) DO NOTHING`,
      [z.uuid().parse(operationId), this.apps.config.issuer],
    );
    await db.query(
      "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) SELECT 'core-account-exit','app-cleanup',$1,$2,now() WHERE EXISTS(SELECT 1 FROM account_exit_app_subjects WHERE operation_id=$3) ON CONFLICT(job_key) DO NOTHING",
      ['app-cleanup:' + operationId, { operationId }, operationId],
    );
  }
  async cleanupExpired() {
    await this.pool.query(
      "UPDATE mini_app_cleanup_notices SET state='unavailable',reason='APP_CLEANUP_WINDOW_EXPIRED',subject=NULL,member_id=NULL,binding=NULL,configuration=NULL,lease_owner=NULL,lease_until=NULL WHERE event_id IN(SELECT event_id FROM mini_app_cleanup_notices WHERE expires_at<=now() AND subject IS NOT NULL LIMIT 25)",
    );
  }
  async process(operationId: string): Promise<'retry' | 'completed' | 'progress'> {
    const owner = randomUUID();
    await this.pool.query(
      "UPDATE mini_app_cleanup_notices SET state='unavailable',reason='APP_CLEANUP_WINDOW_EXPIRED',subject=NULL,member_id=NULL,binding=NULL,configuration=NULL,lease_owner=NULL,lease_until=NULL WHERE event_id IN(SELECT event_id FROM mini_app_cleanup_notices WHERE operation_id=$1 AND expires_at<=now() AND subject IS NOT NULL LIMIT 25)",
      [operationId],
    );
    const claimed = await this.pool.query(
      `UPDATE mini_app_cleanup_notices SET lease_owner=$2,lease_until=now()+interval '60 seconds',attempts=attempts+1
   WHERE event_id IN(SELECT n.event_id FROM mini_app_cleanup_notices n JOIN account_exit_operations o ON o.id=n.operation_id
    WHERE n.operation_id=$1 AND n.state='pending' AND n.due_at<=now() AND n.expires_at>now() AND n.attempts<12 AND (n.lease_until IS NULL OR n.lease_until<=now())
    AND (n.kind='account-erased' OR EXISTS(SELECT 1 FROM jsonb_array_elements(o.components)c WHERE c->>'id'='membership:'||concat_ws(':',n.binding->>'chainId',n.binding->>'runtime',n.binding->>'daoId',n.member_id::text) AND c->>'state'='confirmed'))
    ORDER BY n.due_at,n.event_id FOR UPDATE OF n SKIP LOCKED LIMIT 1) RETURNING *,member_id::text`,
      [operationId, owner],
    );
    for (const input of claimed.rows) {
      const row = Row.parse(input);
      let ack: unknown = null,
        state = 'pending',
        reason = 'APP_ENDPOINT_UNAVAILABLE';
      try {
        const client = await this.apps.client(row.client_id, false);
        if (
          client.configHash !== row.configuration_hash ||
          !('cleanupUrl' in client.config) ||
          !client.config.cleanupUrl
        )
          throw Error('APP_REGISTRATION_CHANGED');
        const url = new URL(client.config.cleanupUrl);
        if (
          url.protocol !== 'https:' ||
          url.username ||
          url.password ||
          url.hash ||
          url.search ||
          (url.port && url.port !== '443')
        )
          throw Error('APP_CLEANUP_URL');
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 5000);
        try {
          const work = async () => {
            const addresses = await this.network.lookup(url.hostname);
            if (
              controller.signal.aborted ||
              !addresses.length ||
              addresses.length > 16 ||
              addresses.some((a) => !isPublicAddress(a.address) || isIP(a.address) !== a.family)
            )
              throw Error('APP_CLEANUP_ADDRESS');
            const address = addresses[0];
            if (!address) throw Error('APP_CLEANUP_ADDRESS');
            const now = Date.now(),
              notice = CleanupNoticeSchema.parse({
                version: 1,
                eventId: row.event_id,
                binding: row.binding,
                subject: row.subject,
                memberId: row.member_id,
                kind: row.kind,
                issuedAt: new Date(now).toISOString(),
                expiresAt: new Date(Math.min(now + 300000, row.expires_at.getTime())).toISOString(),
              });
            const token = await this.apps.signCleanupNotice(notice);
            if (token.length > 16384) throw Error('APP_CLEANUP_SIZE');
            const result = await this.network.request(url, address, controller.signal, token);
            if (result.status !== 200 || result.bytes.length > 16384)
              throw Error('APP_CLEANUP_RESPONSE');
            const received = CleanupAckSchema.parse(
              JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.bytes)),
            );
            if (
              received.eventId !== row.event_id ||
              received.bindingHash !== appBindingHash(row.binding)
            )
              throw Error('APP_CLEANUP_ACK');
            return received;
          };
          const received = await Promise.race([
            work(),
            new Promise<never>((_, reject) =>
              controller.signal.addEventListener(
                'abort',
                () => reject(Error('APP_CLEANUP_TIMEOUT')),
                { once: true },
              ),
            ),
          ]);
          ack = received;
          state = received.state;
          reason =
            state === 'confirmed' ? 'APP_OPERATOR_ACKNOWLEDGED' : 'APP_OPERATOR_RETAINED_RECORDS';
        } finally {
          clearTimeout(timer);
          controller.abort();
        }
      } catch {
        if (row.attempts >= 12) {
          state = 'unavailable';
          reason = 'APP_CLEANUP_ATTEMPTS_EXHAUSTED';
        }
      }
      const updated = await this.pool.query(
        `UPDATE mini_app_cleanup_notices SET state=$3,reason=$4,acknowledgment=$5,due_at=now()+($6::int*interval '1 second'),lease_owner=NULL,lease_until=NULL,
    subject=CASE WHEN $3='pending' THEN subject ELSE NULL END,member_id=CASE WHEN $3='pending' THEN member_id ELSE NULL END,binding=CASE WHEN $3='pending' THEN binding ELSE NULL END,configuration=CASE WHEN $3='pending' THEN configuration ELSE NULL END
    WHERE event_id=$1 AND lease_owner=$2 AND lease_until>now()`,
        [
          row.event_id,
          owner,
          state,
          reason,
          ack,
          Math.min(3600, 30 * 2 ** Math.min(row.attempts, 7)),
        ],
      );
      if (updated.rowCount === 1 && state !== 'pending')
        await this.pool.query(
          'DELETE FROM account_exit_app_subjects WHERE operation_id=$1 AND client_id=$2 AND subject=$3',
          [operationId, row.client_id, row.subject],
        );
    }
    const states = z
      .array(z.object({ state: z.string() }))
      .parse(
        (
          await this.pool.query(
            'SELECT DISTINCT state FROM mini_app_cleanup_notices WHERE operation_id=$1',
            [operationId],
          )
        ).rows,
      );
    const state = states.some((s) => s.state === 'pending')
      ? 'pending'
      : states.some((s) => s.state === 'unavailable')
        ? 'unavailable'
        : states.some((s) => s.state === 'retained')
          ? 'retained'
          : 'confirmed';
    const reason =
      state === 'confirmed'
        ? 'APP_OPERATOR_ACKNOWLEDGED'
        : state === 'retained'
          ? 'APP_OPERATOR_RETAINED_RECORDS'
          : state === 'unavailable'
            ? 'APP_CLEANUP_UNAVAILABLE'
            : 'APP_CLEANUP_PENDING';
    await this.pool.query(
      "UPDATE account_exit_operations SET components=(SELECT jsonb_agg(CASE WHEN c->>'id'='apps' THEN c||jsonb_build_object('state',$2::text,'reason',$3::text) ELSE c END) FROM jsonb_array_elements(components)c) WHERE id=$1",
      [operationId, state, reason],
    );
    await this.pool.query(
      "UPDATE account_exit_operations SET state=CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(components)c WHERE c->>'state' NOT IN('confirmed','retained')) THEN 'processing' ELSE 'complete' END WHERE id=$1 AND state<>'expired'",
      [operationId],
    );
    if (state !== 'pending') return 'completed';
    const ready = await this.pool.query(
      "SELECT 1 FROM mini_app_cleanup_notices WHERE operation_id=$1 AND state='pending' AND due_at<=now() AND (lease_until IS NULL OR lease_until<=now()) LIMIT 1",
      [operationId],
    );
    return claimed.rows.length && ready.rowCount ? 'progress' : 'retry';
  }
}
