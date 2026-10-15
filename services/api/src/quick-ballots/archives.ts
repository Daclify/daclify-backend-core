import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  OrdinaryPollArchivePlanSchema,
  archiveExportConsent,
  archiveManifestForPlan,
  encodeArchiveChunk,
  encodeArchiveManifest,
  decodeArchiveManifest,
  verifyArchiveBundle,
  verifyAnchoredArchive,
  archiveAttestation,
  archiveRecoveryId,
  quickArchivePruneBatch,
} from '@daclify/modules/archive';
import { QuickBallotRoutes } from '@daclify/modules';
import {
  DaoRefSchema,
  IdSchema,
  Uint64Schema,
  ChainIdSchema,
  CidSchema,
  type DaoRef,
} from '../../../../protocol/base.js';
import { RuntimeTableSchemas } from '../../../../sdk/index.js';
import type { ChainGateway } from '../chain.js';
import type { NativeQuickBallots } from './chain.js';
import type { ContentProvider } from '../content/provider.js';
import type { EncryptedArchiveBackup } from '../archive/backup.js';
import {
  contentDaoKey,
  storageUsed,
  recordVerifiedPin,
  recordArchiveGroup,
  ProviderScopeSchema,
} from '../content/ledger.js';
import { fundedStorage } from '../content/capacity.js';
import { withTransaction } from '../auth/account-session.js';
import { ApiError } from '../errors.js';
import { planQuickArchive } from './archive-worker.js';

export interface QuickArchiveGateway {
  configuration(): Promise<{ chainId: string; runtime: string; source: string }>;
  detail(
    id: string,
  ): Promise<{ ballot: Awaited<ReturnType<NativeQuickBallots['detail']>>['ballot'] }>;
  archiveSnapshot: NativeQuickBallots['archiveSnapshot'];
  archiveHistory: NonNullable<ChainGateway['archiveHistory']>;
  archiveAnchor: NonNullable<ChainGateway['archiveAnchor']>;
  attestArchive: NonNullable<ChainGateway['attestArchive']>;
  pruneArchiveRows: NativeQuickBallots['pruneArchiveRows'];
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const RowSchema = z.object({
  id: z.uuid(),
  dao: DaoRefSchema,
  dao_key: z.string(),
  source: z.string(),
  ballot_id: IdSchema,
  kind: z.enum(['quick-ballot-responses', 'quick-ballot-grants']),
  provider_scope: ProviderScopeSchema,
  plan: OrdinaryPollArchivePlanSchema.nullable(),
  completed: z.boolean(),
});
const FileSchema = z.object({
  ordinal: z.int().min(0).max(32),
  request_id: z.uuid(),
  expected_bytes: z.int().min(1).max(5242880),
  commitment: ChainIdSchema,
  cid: CidSchema.nullable(),
  storage_object_id: z.uuid().nullable(),
});
const CatalogSchema = z.object({
  kind: RowSchema.shape.kind,
  manifest_commitment: ChainIdSchema,
  chunk_ordinal: z.int().min(0).max(32),
  row_start: z.int().min(0).max(5000),
  completed: z.boolean(),
});
type Anchor = z.infer<typeof RuntimeTableSchemas.archives>;

export class QuickBallotArchives {
  constructor(
    private readonly pool: Pool,
    private readonly chain: QuickArchiveGateway,
    private readonly provider: ContentProvider,
    private readonly scope: string,
    private readonly freeBytes: bigint,
    private readonly backup: Pick<EncryptedArchiveBackup, 'put' | 'read'>,
  ) {
    ProviderScopeSchema.parse(scope);
  }
  private async domain(ballotId: string) {
    const config = await this.chain.configuration(),
      { ballot } = await this.chain.detail(IdSchema.parse(ballotId));
    return {
      config,
      ballot,
      dao: DaoRefSchema.parse({
        chainId: config.chainId,
        contract: config.runtime,
        daoId: ballot.dao_id,
        interfaceVersion: 1,
      }),
    };
  }
  private async catalog(dao: DaoRef, source: string, ballotId: string) {
    const result = await this.pool.query(
      'SELECT * FROM quick_ballot_archive_catalog WHERE dao_key=$1 AND source=$2 AND ballot_id=$3 ORDER BY kind',
      [contentDaoKey(dao), source, ballotId],
    );
    return result.rows.map((row) => CatalogSchema.parse(row));
  }
  private async remember(dao: DaoRef, source: string, anchor: Anchor) {
    const family = anchor.manifest.families[0];
    if (
      anchor.revoked ||
      anchor.manifest.source !== source ||
      anchor.manifest.families.length !== 1 ||
      !family ||
      !['quick-ballot-responses', 'quick-ballot-grants'].includes(family.kind)
    )
      return;
    await this.pool.query(
      'INSERT INTO quick_ballot_archive_catalog(dao_key,source,ballot_id,kind,manifest_commitment) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [contentDaoKey(dao), source, family.parent_id, family.kind, anchor.manifest_commitment],
    );
  }
  // A lost SQL projection is rebuilt twenty native anchors at a time, without an unbounded HTTP scan.
  async discover(dao: DaoRef, source: string) {
    const key = `quick-archive-catalog:${contentDaoKey(dao)}:${source}`;
    const saved = await this.pool.query('SELECT payload FROM jobs WHERE job_key=$1', [key]);
    const cursor = saved.rows[0]
      ? z.object({ after: Uint64Schema }).parse(saved.rows[0].payload).after
      : '0';
    const page = await this.chain.archiveHistory({ dao, cursor });
    await withTransaction(this.pool, async (db) => {
      for (const anchor of page.anchors) await this.remember(dao, source, anchor);
      const last = page.anchors.at(-1),
        after = page.next ?? (last ? String(BigInt(last.id) + 1n) : cursor);
      await db.query(
        "INSERT INTO jobs(module_id,kind,job_key,payload,state,due_at) VALUES('core-quick-archives','catalog',$1,$2,'completed',now()) ON CONFLICT(job_key) DO UPDATE SET payload=EXCLUDED.payload,state='completed',due_at=now()",
        [key, { after }],
      );
    });
    return page.next === null;
  }
  async stage(ballotId: string, signal?: AbortSignal) {
    const { config, ballot, dao } = await this.domain(ballotId),
      key = contentDaoKey(dao);
    if (!ballot.closed_at || !ballot.prepared || Date.now() / 1000 - ballot.closed_at < 30 * 86400)
      return [];
    if (!(await this.discover(dao, config.source))) return [];
    const prior = await this.pool.query(
      'SELECT * FROM quick_ballot_archive_exports WHERE dao_key=$1 AND source=$2 AND ballot_id=$3',
      [key, config.source, ballotId],
    );
    const existing = prior.rows.map((row) => RowSchema.parse(row));
    if (existing.some((row) => row.provider_scope !== this.scope))
      throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
    const known = new Set(
      [...existing, ...(await this.catalog(dao, config.source, ballotId))].map((row) => row.kind),
    );
    if (ballot.pruned || (known.has('quick-ballot-responses') && known.has('quick-ballot-grants')))
      return existing.map((row) => row.id);
    const { responses, grants, ...base } = await this.chain.archiveSnapshot(
      ballotId,
      !known.has('quick-ballot-responses'),
    );
    const plans: {
      plan: z.infer<typeof OrdinaryPollArchivePlanSchema>;
      kind: z.infer<typeof RowSchema>['kind'];
      budget: string;
    }[] = [];
    for (const [kind, rows] of [
      ['quick-ballot-responses', responses],
      ['quick-ballot-grants', grants],
    ] as const) {
      if (!rows.length || known.has(kind)) continue;
      const plan = await planQuickArchive({ ...base, kind, rows }, signal);
      if (plan.blocked.length) throw new ApiError('QUICK_ARCHIVE_RETENTION', 409);
      plans.push({ plan, kind, budget: archiveExportConsent(plan).maximumStoredBytes });
    }
    return withTransaction(this.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${key}`]);
      const ids = existing.map((row) => row.id);
      for (const { plan, kind, budget } of plans) {
        const raced = await db.query<{ id: string; provider_scope: string }>(
          'SELECT id,provider_scope FROM quick_ballot_archive_exports WHERE dao_key=$1 AND source=$2 AND ballot_id=$3 AND kind=$4',
          [key, config.source, ballotId, kind],
        );
        if (raced.rows[0]) {
          if (raced.rows[0].provider_scope !== this.scope)
            throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
          ids.push(raced.rows[0].id);
          continue;
        }
        const funding = await fundedStorage(db, dao, this.scope, this.freeBytes);
        if ((await storageUsed(db, key)) + BigInt(budget) > BigInt(funding.uploadCapacityBytes))
          throw new ApiError('STORAGE_QUOTA', 403);
        const id = randomUUID();
        await db.query(
          'INSERT INTO quick_ballot_archive_exports(id,dao_key,dao,source,ballot_id,kind,provider_scope,plan,maximum_bytes,remaining_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
          [id, key, dao, config.source, ballotId, kind, this.scope, plan, budget],
        );
        const chunks = plan.families.flatMap((family) => family.chunks);
        if (chunks.length > 32) throw new ApiError('QUICK_ARCHIVE_LIMIT', 409);
        for (const [ordinal, chunk] of chunks.entries()) {
          const bytes = encodeArchiveChunk(chunk.domain, chunk.rows);
          await db.query(
            'INSERT INTO quick_ballot_archive_files(export_id,ordinal,expected_bytes,commitment) VALUES($1,$2,$3,$4)',
            [id, ordinal, bytes.length, hash(bytes)],
          );
        }
        ids.push(id);
      }
      return ids;
    });
  }
  private async row(id: string) {
    const result = await this.pool.query('SELECT * FROM quick_ballot_archive_exports WHERE id=$1', [
      z.uuid().parse(id),
    ]);
    const row = RowSchema.parse(result.rows[0]);
    if (row.provider_scope !== this.scope) throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
    return row;
  }
  private async files(id: string) {
    return (
      await this.pool.query(
        'SELECT * FROM quick_ballot_archive_files WHERE export_id=$1 ORDER BY ordinal',
        [id],
      )
    ).rows.map((row) => FileSchema.parse(row));
  }
  private async pin(
    row: z.infer<typeof RowSchema>,
    file: z.infer<typeof FileSchema>,
    bytes: Uint8Array,
  ) {
    if (bytes.length !== file.expected_bytes || hash(bytes) !== file.commitment)
      throw new ApiError('ARCHIVE_CONTENT_COMMITMENT', 409);
    const found = await this.provider.find(file.request_id);
    if (found.length > 1) throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
    const pin = found[0] ?? (await this.provider.upload(file.request_id, bytes)),
      retrieved = await this.provider.retrieve(pin.cid, file.expected_bytes);
    if (
      pin.size !== file.expected_bytes ||
      retrieved.length !== file.expected_bytes ||
      hash(retrieved) !== file.commitment
    )
      throw new ApiError('ARCHIVE_CONTENT_COMMITMENT', 409);
    await withTransaction(this.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${row.dao_key}`]);
      const saved = (
        await db.query(
          'SELECT * FROM quick_ballot_archive_files WHERE export_id=$1 AND ordinal=$2 FOR UPDATE',
          [row.id, file.ordinal],
        )
      ).rows[0];
      const current = FileSchema.parse(saved);
      if (current.cid) return;
      const objectId = await recordVerifiedPin(
        db,
        this.scope,
        { kind: 'archive', referenceKey: `quick:${row.id}:${file.ordinal}` },
        { dao: row.dao, cid: pin.cid, bytes: pin.size, commitment: file.commitment },
        pin,
      );
      const charged = await db.query(
        'UPDATE quick_ballot_archive_exports SET remaining_bytes=remaining_bytes-$2 WHERE id=$1 AND remaining_bytes>=$2 RETURNING id',
        [row.id, file.expected_bytes],
      );
      if (charged.rowCount !== 1) throw new ApiError('STORAGE_QUOTA', 403);
      await db.query(
        'UPDATE quick_ballot_archive_files SET cid=$3,storage_object_id=$4 WHERE export_id=$1 AND ordinal=$2',
        [row.id, file.ordinal, pin.cid, objectId],
      );
    });
  }
  private async bundle(anchor: Anchor, allowBackup: boolean) {
    try {
      const bytes = await this.provider.retrieve(anchor.manifest_cid, anchor.manifest_bytes),
        manifest = decodeArchiveManifest(bytes, anchor.manifest_commitment),
        descriptors = manifest.families.flatMap((family) => family.chunks);
      if (descriptors.reduce((sum, chunk) => sum + chunk.bytes, bytes.length) > 64 * 1024 * 1024)
        throw new ApiError('QUICK_ARCHIVE_LIMIT', 409);
      const chunks = [];
      for (const chunk of descriptors)
        chunks.push({
          cid: chunk.cid,
          content: Buffer.from(await this.provider.retrieve(chunk.cid, chunk.bytes)).toString(
            'base64',
          ),
        });
      return verifyAnchoredArchive(
        {
          id: archiveRecoveryId(anchor.manifest_commitment),
          manifest,
          manifestFile: {
            cid: anchor.manifest_cid,
            bytes: anchor.manifest_bytes,
            commitment: anchor.manifest_commitment,
            content: Buffer.from(bytes).toString('base64'),
          },
          chunks,
        },
        anchor,
      );
    } catch (error) {
      if (!allowBackup) throw error;
      return verifyAnchoredArchive(
        await this.backup.read(
          archiveRecoveryId(anchor.manifest_commitment),
          anchor.manifest_commitment,
          anchor.backup_commitment,
        ),
        anchor,
      );
    }
  }
  async exportStep(id: string): Promise<'progress' | 'complete'> {
    const lock = await this.pool.connect(),
      key = `quick-archive-export:${z.uuid().parse(id)}`;
    let locked = false,
      discard = false;
    try {
      locked = z
        .boolean()
        .parse(
          (await lock.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key])).rows[0]
            ?.locked,
        );
      if (!locked) return 'progress';
      const row = await this.row(id);
      if (row.completed) return 'complete';
      const plan = row.plan;
      if (!plan) throw new ApiError('ARCHIVE_CONTENTS_INCOMPLETE', 409);
      const files = await this.files(id),
        next = files.find((file) => file.ordinal < 32 && !file.cid);
      if (next) {
        const chunk = plan.families.flatMap((family) => family.chunks)[next.ordinal];
        if (!chunk) throw new ApiError('ARCHIVE_CONTENTS_INCOMPLETE', 409);
        await this.pin(row, next, encodeArchiveChunk(chunk.domain, chunk.rows));
        return 'progress';
      }
      const receipts = files
        .filter((file) => file.ordinal < 32)
        .map((file) => ({
          cid: z.string().parse(file.cid),
          bytes: file.expected_bytes,
          commitment: file.commitment,
        }));
      const manifest = archiveManifestForPlan(plan, receipts),
        bytes = encodeArchiveManifest(manifest),
        commitment = hash(bytes);
      await this.pool.query(
        'INSERT INTO quick_ballot_archive_files(export_id,ordinal,expected_bytes,commitment) VALUES($1,32,$2,$3) ON CONFLICT DO NOTHING',
        [id, bytes.length, commitment],
      );
      const manifestFile = (await this.files(id)).find((file) => file.ordinal === 32);
      if (!manifestFile) throw new ApiError('ARCHIVE_CONTENTS_INCOMPLETE', 409);
      if (!manifestFile.cid) {
        await this.pin(row, manifestFile, bytes);
        return 'progress';
      }
      const chunks = [];
      for (const receipt of receipts)
        chunks.push({
          cid: receipt.cid,
          content: Buffer.from(await this.provider.retrieve(receipt.cid, receipt.bytes)).toString(
            'base64',
          ),
        });
      const actual = await this.provider.retrieve(manifestFile.cid, bytes.length);
      const bundle = verifyArchiveBundle(
        {
          id: archiveRecoveryId(commitment),
          manifest,
          manifestFile: {
            cid: manifestFile.cid,
            bytes: bytes.length,
            commitment,
            content: Buffer.from(actual).toString('base64'),
          },
          chunks,
        },
        commitment,
      );
      const backup = await this.backup.put(bundle);
      await this.backup.read(bundle.id, commitment, backup.commitment);
      const anchor = await this.chain.attestArchive(archiveAttestation(bundle, backup, 90 * 86400));
      verifyAnchoredArchive(bundle, anchor);
      await this.remember(row.dao, row.source, anchor);
      await withTransaction(this.pool, async (db) => {
        const members = (await this.files(id)).map((file) =>
          z.uuid().parse(file.storage_object_id),
        );
        await recordArchiveGroup(db, this.scope, row.dao, `quick:${id}`, members);
        await db.query(
          'UPDATE quick_ballot_archive_exports SET completed=true,plan=NULL,remaining_bytes=0 WHERE id=$1',
          [id],
        );
      });
      return 'complete';
    } finally {
      if (locked)
        try {
          await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
        } catch {
          discard = true;
        }
      lock.release(discard);
    }
  }
  async pruneStep(ballotId: string): Promise<'progress' | 'complete'> {
    const { dao, config } = await this.domain(ballotId),
      rows = await this.catalog(dao, config.source, ballotId),
      row = rows.find((row) => !row.completed);
    if (!row) return rows.length ? 'complete' : 'progress';
    const original = await this.chain.archiveAnchor(dao, row.manifest_commitment);
    if (!original || original.revoked) throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    // Cleanup needs both copies online now; backup-only recovery remains available to readers.
    const bundle = await this.bundle(original, false),
      backup = await this.backup.put(bundle);
    await this.backup.read(bundle.id, row.manifest_commitment, original.backup_commitment);
    if (backup.commitment !== original.backup_commitment)
      throw new ApiError('ARCHIVE_BACKUP_UNAVAILABLE', 503);
    const anchor = await this.chain.attestArchive(
      archiveAttestation(bundle, backup, original.retention_seconds),
    );
    const position = { chunkOrdinal: row.chunk_ordinal, start: row.row_start },
      batch = quickArchivePruneBatch(bundle, anchor, position),
      family = bundle.manifest.families[0];
    let chunk = row.chunk_ordinal,
      start = row.row_start;
    if (batch) {
      await this.chain.pruneArchiveRows(bundle, anchor, position);
      start += batch.action === 'prune' ? batch.data.proofs.length : 1;
    }
    const descriptor = family?.chunks[chunk];
    if (!descriptor) throw new ApiError('ARCHIVE_CONTENTS_INCOMPLETE', 409);
    if (start === descriptor.domain.leaf_count) {
      chunk++;
      start = 0;
    }
    const complete = chunk === (family?.chunks.length ?? 0);
    await this.pool.query(
      'UPDATE quick_ballot_archive_catalog SET chunk_ordinal=$5,row_start=$6,completed=$7 WHERE dao_key=$1 AND source=$2 AND ballot_id=$3 AND kind=$4 AND chunk_ordinal=$8 AND row_start=$9',
      [
        contentDaoKey(dao),
        config.source,
        ballotId,
        row.kind,
        chunk,
        start,
        complete,
        row.chunk_ordinal,
        row.row_start,
      ],
    );
    return 'progress';
  }
  async history(ballotId: string) {
    const { dao, config, ballot } = await this.domain(ballotId),
      scanned = await this.discover(dao, config.source),
      archives = [];
    for (const row of await this.catalog(dao, config.source, ballotId)) {
      const anchor = await this.chain.archiveAnchor(dao, row.manifest_commitment);
      if (!anchor || anchor.revoked) throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
      archives.push({ anchor, bundle: await this.bundle(anchor, true) });
    }
    return QuickBallotRoutes.quickArchive.response.parse({
      archives,
      complete:
        scanned &&
        archives.some((row) => row.bundle.manifest.families[0]?.kind === 'quick-ballot-grants') &&
        (!ballot.identities ||
          archives.some(
            (row) => row.bundle.manifest.families[0]?.kind === 'quick-ballot-responses',
          )),
    });
  }
}
