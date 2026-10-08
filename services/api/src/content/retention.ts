import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { DaoRefSchema, type DaoRef } from '../../../../protocol/base.js';
import {
  StorageCurationRoutes,
  selectRetainedObjects,
  StorageArchiveGroupSchema,
} from '../../../../protocol/storage-retention.js';
import type { Account } from '../../../../protocol/api.js';
import type { ChainGateway } from '../chain.js';
import type { ContentProvider } from './provider.js';
import { contentDaoKey, ProviderScopeSchema } from './ledger.js';
import { fundedStorage } from './capacity.js';
import { ApiError } from '../errors.js';
import { leaseJob } from '../store.js';
import { startPollingWorker } from '../jobs.js';
const ObjectRow = z.object({
  id: z.uuid(),
  cid: StorageCurationRoutes.curation.response.shape.objects.element.shape.cid,
  bytes: z.string(),
  commitment: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.date(),
  kinds: z.array(StorageCurationRoutes.curation.response.shape.objects.element.shape.kinds.element),
  released_at: z.date().nullable(),
  state: z.enum(['pinned', 'removing', 'removed', 'review']),
});
const CurationRow = z.object({ generation: z.string(), object_ids: z.array(z.uuid()) });
const RemovalRow = z.object({
  object_id: z.uuid(),
  generation: z.string(),
  lease_token: z.uuid(),
  recovery_request: z.uuid(),
  previous_state: z.enum(['prepared', 'removing', 'review']).optional(),
  state: z.enum(['prepared', 'removing', 'removed', 'canceled', 'review']),
  staged_bytes: z.instanceof(Uint8Array),
  provider_ids: z.array(z.uuid()),
  affected_daos: z.array(DaoRefSchema),
});
export class StorageRetention {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly provider: ContentProvider,
    private readonly freeBytes: bigint,
    private readonly scope: string,
    private readonly reconcilePayment: (dao: DaoRef) => Promise<void>,
    readonly cleanupEnabled = false,
  ) {
    ProviderScopeSchema.parse(scope);
  }
  private async admin(account: Account, dao: DaoRef) {
    const network = await this.chain.network();
    if (
      network.chainId !== dao.chainId ||
      network.runtime !== dao.contract ||
      network.interfaceVersion !== dao.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    if (
      !(await this.chain.memberships(account)).some(
        (m) => m.active && m.admin && contentDaoKey(m.dao) === contentDaoKey(dao),
      )
    )
      throw new ApiError('STORAGE_ADMIN_REQUIRED', 403);
  }
  private async lock(db: PoolClient, dao: DaoRef) {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `upload-dao:${contentDaoKey(dao)}`,
    ]);
  }
  private async objects(db: Pool | PoolClient, dao: DaoRef) {
    const result = await db.query<Record<string, unknown>>(
      `SELECT o.id,o.cid,o.state,o.verified_bytes::text AS bytes,o.commitment,min(r.created_at) AS created_at,array_agg(DISTINCT r.kind) AS kinds,CASE WHEN bool_and(r.released_at IS NOT NULL) THEN max(r.released_at) ELSE NULL END AS released_at FROM hosted_references r JOIN hosted_objects o ON o.id=r.object_id WHERE r.dao_key=$1 AND o.provider_scope=$2 GROUP BY o.id ORDER BY min(r.created_at) DESC,o.id LIMIT 10001`,
      [contentDaoKey(dao), this.scope],
    );
    if (result.rows.length > 10000) throw new ApiError('STORAGE_CURATION_LIMIT', 409);
    return result.rows.map((r) => ObjectRow.parse(r));
  }
  private async curation(db: Pool | PoolClient, dao: DaoRef) {
    const result = await db.query<Record<string, unknown>>(
      'SELECT generation::text,object_ids FROM storage_curation WHERE dao_key=$1 AND provider_scope=$2',
      [contentDaoKey(dao), this.scope],
    );
    return result.rows[0] ? CurationRow.parse(result.rows[0]) : { generation: '0', object_ids: [] };
  }
  private async bundles(db: Pool | PoolClient, dao: DaoRef) {
    const rows = await db.query<Record<string, unknown>>(
      `SELECT bundle_key AS key,array_agg(object_id ORDER BY object_id) AS "objectIds" FROM hosted_archive_members WHERE dao_key=$1 AND provider_scope=$2 GROUP BY bundle_key ORDER BY bundle_key LIMIT 10001`,
      [contentDaoKey(dao), this.scope],
    );
    if (rows.rows.length > 10000) throw new ApiError('STORAGE_CURATION_LIMIT', 409);
    return rows.rows.map((row) => StorageArchiveGroupSchema.parse(row));
  }
  private async decision(db: PoolClient, dao: DaoRef) {
    const funding = await fundedStorage(db, dao, this.scope, this.freeBytes),
      objects = await this.objects(db, dao),
      curation = await this.curation(db, dao),
      bundles = await this.bundles(db, dao);

    const available = objects.filter((o) => o.state !== 'removed');
    const existing = new Set(available.map((o) => o.id)),
      priorities = curation.object_ids.filter((id) => existing.has(id));
    const kept = selectRetainedObjects(
      objects.map((o) => ({ id: o.id, bytes: o.bytes, createdAt: o.created_at.toISOString() })),
      funding.retainedCapacityBytes,
      priorities,
      bundles.map((b) => b.objectIds),
      objects.filter((o) => o.state === 'removed').map((o) => o.id),
    );
    return { funding, objects, curation, bundles, kept: new Set(kept) };
  }
  async status(account: Account, value: unknown) {
    const input = StorageCurationRoutes.curation.input.parse(value);
    await this.admin(account, input.dao);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await this.lock(db, input.dao);
      const { funding, objects, curation, kept, bundles } = await this.decision(db, input.dao);
      await db.query('COMMIT');
      return StorageCurationRoutes.curation.response.parse({
        dao: input.dao,
        generation: curation.generation,
        funding,
        cleanup: this.cleanupEnabled ? 'qualified' : 'disabled',
        bundles,
        objects: objects.map((o) => ({
          id: o.id,
          cid: o.cid,
          bytes: o.bytes,
          createdAt: o.created_at.toISOString(),
          kinds: o.kinds,
          selected: curation.object_ids.includes(o.id),
          retained: kept.has(o.id),
          releasedAt: o.released_at?.toISOString() ?? null,
        })),
      });
    } catch (cause) {
      await db.query('ROLLBACK');
      throw cause;
    } finally {
      db.release();
    }
  }
  async retain(account: Account, value: unknown) {
    const input = StorageCurationRoutes.retain.input.parse(value);
    await this.admin(account, input.dao);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await this.lock(db, input.dao);
      const { funding, objects, curation, bundles } = await this.decision(db, input.dao);
      if (input.generation !== curation.generation)
        throw new ApiError('STORAGE_CURATION_CHANGED', 409);
      selectRetainedObjects(
        objects.map((o) => ({ id: o.id, bytes: o.bytes, createdAt: o.created_at.toISOString() })),
        funding.pricing.freeBytes,
        input.keep,
        bundles.map((b) => b.objectIds),
        objects.filter((o) => o.state === 'removed').map((o) => o.id),
      );
      await db.query(
        `INSERT INTO storage_curation(dao_key,provider_scope,generation,object_ids,updated_by) VALUES($1,$2,1,$3,$4) ON CONFLICT(dao_key,provider_scope) DO UPDATE SET generation=storage_curation.generation+1,object_ids=EXCLUDED.object_ids,updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [contentDaoKey(input.dao), this.scope, input.keep, account.id],
      );
      await db.query('COMMIT');
    } catch (cause) {
      await db.query('ROLLBACK');
      if (cause instanceof RangeError) throw new ApiError(cause.message, 409);
      throw cause;
    } finally {
      db.release();
    }
    return this.status(account, { dao: input.dao });
  }
  async prepare(dao: DaoRef) {
    if (!this.cleanupEnabled) throw new ApiError('STORAGE_CLEANUP_DISABLED', 409);
    await this.reconcilePayment(dao);
    const db = await this.pool.connect();
    let id: string | undefined;
    try {
      await db.query('BEGIN');
      await this.lock(db, dao);
      const { funding, objects, kept } = await this.decision(db, dao);
      if (funding.state === 'review') throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
      const eligible = await db.query<{ eligible: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM storage_subscriptions s JOIN storage_invoices i ON i.subscription_id=s.id WHERE s.dao_key=$1 AND s.provider_scope=$2 AND i.verified_at IS NOT NULL AND i.period_end+interval '2592000 seconds'<=now()) AS eligible`,
        [contentDaoKey(dao), this.scope],
      );
      if (!z.boolean().parse(eligible.rows[0]?.eligible))
        throw new ApiError('STORAGE_GRACE_ACTIVE', 409);
      // Unknown provider results and unfinished exports cannot be discarded by this worker.
      const held = await db.query<{ held: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM uploads WHERE dao_key=$1 AND storage_object_id IS NULL AND (state<>'failed' OR provider_id IS NOT NULL) UNION ALL SELECT 1 FROM asset_uploads WHERE dao_key=$1 AND storage_object_id IS NULL UNION ALL SELECT 1 FROM archive_storage_holds WHERE dao_key=$1 AND state='held') AS held`,
        [contentDaoKey(dao)],
      );
      if (z.boolean().parse(held.rows[0]?.held)) throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
      for (const object of objects) {
        if (kept.has(object.id) || object.released_at) continue;
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `hosted-object:${this.scope}:public-cidv1-file-v1:${object.cid}`,
        ]);
        await db.query(
          'UPDATE hosted_references SET released_at=now(),generation=generation+1 WHERE dao_key=$1 AND object_id=$2 AND released_at IS NULL',
          [contentDaoKey(dao), object.id],
        );
        await db.query(
          'UPDATE uploads SET storage_released_at=now() WHERE dao_key=$1 AND storage_object_id=$2',
          [contentDaoKey(dao), object.id],
        );
        await db.query(
          'UPDATE asset_uploads SET storage_released_at=now() WHERE dao_key=$1 AND storage_object_id=$2',
          [contentDaoKey(dao), object.id],
        );
        const refs = await db.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM (SELECT id FROM hosted_references WHERE object_id=$1 AND released_at IS NULL UNION ALL SELECT id FROM uploads WHERE storage_object_id=$1 AND storage_released_at IS NULL AND (state<>'failed' OR provider_id IS NOT NULL) UNION ALL SELECT request_id AS id FROM asset_uploads WHERE storage_object_id=$1 AND storage_released_at IS NULL) retained",
          [object.id],
        );
        if (refs.rows[0]?.count !== '0') continue;
        const row = await db.query<{ state: string }>(
          'SELECT state FROM hosted_objects WHERE id=$1 FOR UPDATE',
          [object.id],
        );
        if (row.rows[0]?.state !== 'pinned') continue;
        id = object.id;
        break;
      }
      await db.query('COMMIT');
    } catch (cause) {
      await db.query('ROLLBACK');
      throw cause;
    } finally {
      db.release();
    }
    if (!id) return null;
    try {
      return await this.stage(dao, id);
    } catch (cause) {
      await this.pool.query(
        'UPDATE hosted_references SET released_at=NULL,generation=generation+1 WHERE dao_key=$1 AND object_id=$2',
        [contentDaoKey(dao), id],
      );
      await this.pool.query(
        'UPDATE uploads SET storage_released_at=NULL WHERE dao_key=$1 AND storage_object_id=$2',
        [contentDaoKey(dao), id],
      );
      await this.pool.query(
        'UPDATE asset_uploads SET storage_released_at=NULL WHERE dao_key=$1 AND storage_object_id=$2',
        [contentDaoKey(dao), id],
      );
      throw cause;
    }
  }
  private async stage(dao: DaoRef, id: string) {
    const object = (await this.objects(this.pool, dao)).find((o) => o.id === id);
    if (!object) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
    const bytes = await this.provider.retrieve(object.cid, Number(object.bytes));
    if (
      bytes.length !== Number(object.bytes) ||
      createHash('sha256').update(bytes).digest('hex') !== object.commitment
    )
      throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await this.lock(db, dao);
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `hosted-object:${this.scope}:public-cidv1-file-v1:${object.cid}`,
      ]);
      const prior = await db.query(
        "SELECT object_id FROM hosted_removals WHERE object_id=$1 AND state IN ('prepared','removing','review')",
        [id],
      );
      if (prior.rowCount) {
        await db.query('COMMIT');
        return id;
      }
      const active = await db.query<{ active: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM hosted_references WHERE object_id=$1 AND released_at IS NULL UNION ALL SELECT 1 FROM uploads WHERE storage_object_id=$1 AND storage_released_at IS NULL AND (state<>'failed' OR provider_id IS NOT NULL) UNION ALL SELECT 1 FROM asset_uploads WHERE storage_object_id=$1 AND storage_released_at IS NULL) AS active",
        [id],
      );
      if (active.rows[0]?.active) {
        await db.query('COMMIT');
        return null;
      }
      const pins = await db.query<{ provider_id: string }>(
        "SELECT provider_id FROM hosted_pins WHERE object_id=$1 AND state='pinned' ORDER BY provider_id LIMIT 101",
        [id],
      );
      if (!pins.rowCount || pins.rowCount > 100) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
      const changed = await db.query<{ generation: string }>(
        "UPDATE hosted_objects SET state='removing',generation=generation+1 WHERE id=$1 AND provider_scope=$2 AND state='pinned' RETURNING generation::text",
        [id, this.scope],
      );
      if (changed.rowCount !== 1) throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
      const keys = await db.query<{ dao_key: string }>(
        'SELECT DISTINCT dao_key FROM hosted_references WHERE object_id=$1 ORDER BY dao_key',
        [id],
      );
      const daos = keys.rows.map((r) => {
        const tuple = z.tuple([z.string(), z.string(), z.string()]).parse(JSON.parse(r.dao_key));
        return DaoRefSchema.parse({
          chainId: tuple[0],
          contract: tuple[1],
          daoId: tuple[2],
          interfaceVersion: 1,
        });
      });
      await db.query(
        `INSERT INTO hosted_removals(object_id,generation,lease_token,lease_until,state,staged_bytes,provider_ids,affected_daos) VALUES($1,$2,$3,now()-interval '1 second','prepared',$4,$5,$6)`,
        [
          id,
          changed.rows[0]?.generation,
          randomUUID(),
          Buffer.from(bytes),
          pins.rows.map((p) => p.provider_id),
          JSON.stringify(daos),
        ],
      );
      await db.query('COMMIT');
      return id;
    } catch (cause) {
      await db.query('ROLLBACK');
      throw cause;
    } finally {
      db.release();
    }
  }
  private async revived(row: z.infer<typeof RemovalRow>) {
    for (const dao of row.affected_daos) {
      await this.reconcilePayment(dao);
      const db = await this.pool.connect();
      try {
        await db.query('BEGIN');
        await this.lock(db, dao);
        const decision = await this.decision(db, dao);
        if (decision.funding.state === 'review') throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
        if (decision.kept.has(row.object_id)) {
          await db.query('COMMIT');
          return true;
        }
        await db.query('COMMIT');
      } catch (cause) {
        await db.query('ROLLBACK');
        throw cause;
      } finally {
        db.release();
      }
    }
    const active = await this.pool.query<{ active: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM hosted_references WHERE object_id=$1 AND released_at IS NULL UNION ALL SELECT 1 FROM uploads WHERE storage_object_id=$1 AND storage_released_at IS NULL AND (state<>'failed' OR provider_id IS NOT NULL) UNION ALL SELECT 1 FROM asset_uploads WHERE storage_object_id=$1 AND storage_released_at IS NULL) AS active",
      [row.object_id],
    );
    return z.boolean().parse(active.rows[0]?.active);
  }
  async remove(id: string) {
    if (!this.cleanupEnabled) throw new ApiError('STORAGE_CLEANUP_DISABLED', 409);
    z.uuid().parse(id);
    const claimed = await this.pool.query<Record<string, unknown>>(
      `WITH candidate AS (SELECT * FROM hosted_removals WHERE object_id=$1 AND state IN ('prepared','removing','review') AND lease_until<=now() FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE hosted_removals SET lease_token=$2,lease_until=now()+interval '120 seconds',state='removing' FROM candidate WHERE hosted_removals.object_id=candidate.object_id AND hosted_removals.generation=candidate.generation RETURNING hosted_removals.*,candidate.state AS previous_state`,
      [id, randomUUID()],
    );
    if (!claimed.rowCount) return 'idle';
    const row = RemovalRow.parse(claimed.rows[0]);
    try {
      const object = (
        await this.pool.query<Record<string, unknown>>(
          'SELECT cid,commitment,verified_bytes::text AS bytes FROM hosted_objects WHERE id=$1 AND provider_scope=$2 AND generation=$3',
          [id, this.scope, row.generation],
        )
      ).rows[0];
      const descriptor = z
        .object({ cid: z.string(), commitment: z.string(), bytes: z.string() })
        .parse(object);
      if (
        createHash('sha256').update(row.staged_bytes).digest('hex') !== descriptor.commitment ||
        row.staged_bytes.length !== Number(descriptor.bytes)
      )
        throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
      const wasInFlight = row.previous_state !== 'prepared';
      if (!wasInFlight && (await this.revived(row))) {
        await this.finish(row, 'canceled');
        return 'canceled';
      }
      const fenced = await this.pool.query(
        `UPDATE hosted_removals SET state='removing' WHERE object_id=$1 AND lease_token=$2 AND lease_until>now()`,
        [id, row.lease_token],
      );
      if (fenced.rowCount !== 1) return 'lost';
      for (const providerId of row.provider_ids) {
        const lease = await this.pool.query(
          `UPDATE hosted_removals SET lease_until=now()+interval '120 seconds' WHERE object_id=$1 AND lease_token=$2 AND lease_until>now()`,
          [id, row.lease_token],
        );
        if (lease.rowCount !== 1) return 'lost';
        await this.provider.remove(providerId);
      }
      if (await this.revived(row)) {
        const found = await this.provider.find(row.recovery_request);
        if (found.length > 1) throw new ApiError('STORAGE_COMPENSATION_FAILED', 503);
        const pin =
          found[0] ?? (await this.provider.upload(row.recovery_request, row.staged_bytes));
        if (pin.cid !== descriptor.cid || pin.size !== row.staged_bytes.length)
          throw new ApiError('STORAGE_COMPENSATION_FAILED', 503);
        const recovered = await this.provider.retrieve(pin.cid, pin.size);
        if (createHash('sha256').update(recovered).digest('hex') !== descriptor.commitment)
          throw new ApiError('STORAGE_COMPENSATION_FAILED', 503);
        await this.pool.query(
          `INSERT INTO hosted_pins(provider_scope,provider_id,object_id) VALUES($1,$2,$3) ON CONFLICT(provider_scope,provider_id) DO UPDATE SET state='pinned' WHERE hosted_pins.object_id=EXCLUDED.object_id`,
          [this.scope, pin.id, id],
        );
        await this.finish(row, 'canceled');
        return 'compensated';
      }
      await this.finish(row, 'removed');
      return 'removed';
    } catch {
      await this.pool.query(
        `UPDATE hosted_removals SET state='review',last_error_code='STORAGE_REMOVAL_REVIEW',lease_until=now()+interval '60 seconds' WHERE object_id=$1 AND lease_token=$2`,
        [id, row.lease_token],
      );
      throw new ApiError('STORAGE_REMOVAL_REVIEW', 503);
    }
  }
  async sweep() {
    if (!this.cleanupEnabled) return 'disabled';
    const pending = await this.pool.query<{ object_id: string }>(
      "SELECT r.object_id FROM hosted_removals r JOIN hosted_objects o ON o.id=r.object_id WHERE o.provider_scope=$1 AND r.state IN ('prepared','removing','review') AND r.lease_until<=now() ORDER BY r.created_at LIMIT 1",
      [this.scope],
    );
    if (pending.rows[0]) return this.remove(pending.rows[0].object_id);
    await this.pool.query(
      `INSERT INTO jobs(module_id,kind,job_key,payload,due_at)
      SELECT 'core-retention','plan','storage-retention:'||s.id::text||':'||extract(epoch from i.period_end)::text,jsonb_build_object('dao',s.dao,'providerScope',s.provider_scope),now()
      FROM storage_subscriptions s JOIN storage_invoices i ON i.subscription_id=s.id
      WHERE s.provider_scope=$1 AND i.verified_at IS NOT NULL AND i.period_end+interval '2592000 seconds'<=now()
      AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.job_key='storage-retention:'||s.id::text||':'||extract(epoch from i.period_end)::text)
      ORDER BY i.period_end,s.id LIMIT 100 ON CONFLICT(job_key) DO NOTHING`,
      [this.scope],
    );
    const owner = randomUUID(),
      job = await leaseJob(this.pool, owner, { moduleId: 'core-retention', kind: 'plan' });
    if (!job) return 'idle';
    const input = z
      .strictObject({ dao: DaoRefSchema, providerScope: ProviderScopeSchema })
      .safeParse(job.payload);
    let outcome = 'review',
      error: string | null = 'STORAGE_RETENTION_JOB_INVALID';
    if (input.success && input.data.providerScope === this.scope) {
      try {
        const id = await this.prepare(input.data.dao);
        outcome = id ? 'prepared' : 'completed';
        error = null;
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === 'STORAGE_GRACE_ACTIVE') {
          outcome = 'completed';
          error = null;
        } else {
          outcome = 'retry';
          error = 'STORAGE_RETENTION_REVIEW';
        }
      }
    }
    const changed = await this.pool.query(
      `UPDATE jobs SET state=$1,last_error_code=$2,lease_owner=NULL,lease_until=NULL,due_at=now()+($3::int*interval '1 second') WHERE id=$4 AND lease_owner=$5 AND lease_until>now()`,
      [
        outcome === 'completed' ? 'completed' : outcome === 'review' ? 'failed' : 'pending',
        error,
        Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)),
        job.id,
        owner,
      ],
    );
    return changed.rowCount === 1 ? outcome : 'lost';
  }
  private async finish(row: z.infer<typeof RemovalRow>, state: 'removed' | 'canceled') {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      for (const dao of row.affected_daos) {
        await this.lock(db, dao);
        const decision = await this.decision(db, dao);
        if (decision.kept.has(row.object_id)) {
          if (state === 'removed') throw new ApiError('STORAGE_REMOVAL_INVALIDATED', 409);
          await db.query(
            'UPDATE hosted_references SET released_at=NULL,generation=generation+1 WHERE dao_key=$1 AND object_id=$2',
            [contentDaoKey(dao), row.object_id],
          );
          await db.query(
            'UPDATE uploads SET storage_released_at=NULL WHERE dao_key=$1 AND storage_object_id=$2',
            [contentDaoKey(dao), row.object_id],
          );
          await db.query(
            'UPDATE asset_uploads SET storage_released_at=NULL WHERE dao_key=$1 AND storage_object_id=$2',
            [contentDaoKey(dao), row.object_id],
          );
        }
      }
      const changed = await db.query(
        `UPDATE hosted_removals SET state=$3,completed_at=now(),last_error_code=NULL,staged_bytes=NULL WHERE object_id=$1 AND lease_token=$2 AND lease_until>now() RETURNING object_id`,
        [row.object_id, row.lease_token, state],
      );
      if (changed.rowCount !== 1) throw new ApiError('STORAGE_REMOVAL_LEASE_LOST', 409);
      await db.query(`UPDATE hosted_objects SET state=$2 WHERE id=$1 AND generation=$3`, [
        row.object_id,
        state === 'removed' ? 'removed' : 'pinned',
        row.generation,
      ]);
      if (state === 'removed')
        await db.query(
          `UPDATE hosted_pins SET state='removed' WHERE object_id=$1 AND provider_id=ANY($2::uuid[])`,
          [row.object_id, row.provider_ids],
        );
      await db.query('COMMIT');
    } catch (cause) {
      await db.query('ROLLBACK');
      throw cause;
    } finally {
      db.release();
    }
  }
}

export function startRetentionWorker(service: StorageRetention) {
  return startPollingWorker(() => service.sweep(), 'STORAGE_RETENTION_WORKER_FAILED');
}
