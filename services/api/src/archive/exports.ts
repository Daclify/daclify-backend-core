import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  ArchiveExportRequestSchema,
  ArchiveExportStatusSchema,
  OrdinaryPollArchivePlanSchema,
  archiveExportConsent,
  archiveManifestForPlan,
  encodeArchiveChunk,
  encodeArchiveManifest,
  verifyArchiveChunkDescriptor,
  decodeArchiveManifest,
  type ArchiveExportRequest,
  ArchiveBundleSchema,
  verifyArchiveChunks,
  ArchiveExportListRequestSchema,
  ArchiveExportListSchema,
  verifyArchiveBundle,
  ArchiveBackupReceiptSchema,
  ArchiveRoutes,
  archiveAttestation,
  archivePruneBatch,
} from '@daclify/modules/archive';
import { AccountSchema, type Account } from '../../../../protocol/api.js';
import { HostedAssetReceiptSchema, HostedAssetUploadSchema } from '../../../../protocol/storage.js';
import type { ChainGateway } from '../chain.js';
import type { ContentProvider } from '../content/provider.js';
import type { HostedAssets } from '../content/assets.js';
import {
  contentDaoKey,
  storageUsed,
  ProviderScopeSchema,
  recordArchiveGroup,
} from '../content/ledger.js';
import { fundedStorage } from '../content/capacity.js';
import { archivePreview } from './service.js';
import { ApiError } from '../errors.js';
import type { EncryptedArchiveBackup } from './backup.js';
import { ArchiveHistory } from './history.js';
import { RuntimeTableSchemas } from '../../../../sdk/index.js';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const RowSchema = z.object({
  id: z.uuid(),
  requested_by: z.uuid(),
  request_hash: z.instanceof(Uint8Array),
  dao: ArchiveExportStatusSchema.shape.dao,
  provider_scope: ProviderScopeSchema,
  plan: OrdinaryPollArchivePlanSchema,
  descriptor_commitment: ArchiveRoutes.attest.input.shape.descriptorCommitment.nullable(),
  anchor_id: RuntimeTableSchemas.archives.shape.id.nullable(),
  anchor_transaction: RuntimeTableSchemas.archives.shape.attestation_transaction.nullable(),
  request: ArchiveExportRequestSchema,
  state: ArchiveExportStatusSchema.shape.state,
  maximum_stored_bytes: ArchiveExportStatusSchema.shape.maximumStoredBytes,
  manifest_request_id: z.uuid(),
  manifest_cid: ArchiveExportStatusSchema.shape.manifest.unwrap().shape.cid.nullable(),
  manifest_bytes: ArchiveExportStatusSchema.shape.manifest.unwrap().shape.bytes.nullable(),
  manifest_commitment: ArchiveExportStatusSchema.shape.manifest
    .unwrap()
    .shape.commitment.nullable(),
});
type ExportRow = z.infer<typeof RowSchema>;
const ChunkSchema = z.object({
  family: z.int(),
  ordinal: z.int(),
  asset_request_id: z.uuid(),
  state: z.enum(['planned', 'uploading', 'pinned', 'verified', 'review']),
  cid: HostedAssetReceiptSchema.shape.cid.nullable(),
  expected_bytes: z.int(),
  commitment: HostedAssetReceiptSchema.shape.commitment,
});
type ChunkRow = z.infer<typeof ChunkSchema>;

export class ArchiveExports {
  readonly history: ArchiveHistory;
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly assets: HostedAssets,
    private readonly provider: ContentProvider,
    private readonly freeBytes: bigint,
    private readonly scope: string,
    private readonly backupStore?: EncryptedArchiveBackup,
  ) {
    ProviderScopeSchema.parse(scope);
    this.history = new ArchiveHistory(chain, provider);
  }

  private async authorize(account: Account, dao: ExportRow['dao']) {
    const network = await this.chain.network();
    if (
      dao.chainId !== network.chainId ||
      dao.contract !== network.runtime ||
      dao.interfaceVersion !== network.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    if (
      !(await this.chain.memberships(account)).some(
        (m) => m.active && m.admin && contentDaoKey(m.dao) === contentDaoKey(dao),
      )
    )
      throw new ApiError('ARCHIVE_ADMIN_REQUIRED', 403);
  }
  private async row(id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM archive_exports WHERE id=$1',
      [z.uuid().parse(id)],
    );
    if (!result.rows[0]) throw new ApiError('ARCHIVE_NOT_FOUND', 404);
    const row = RowSchema.parse(result.rows[0]);
    if (row.provider_scope !== this.scope) throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
    return row;
  }
  private async chunks(id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM archive_chunks WHERE export_id=$1 ORDER BY family,ordinal',
      [id],
    );
    return result.rows.map((row) => ChunkSchema.parse(row));
  }
  async status(account: Account, id: string) {
    const row = await this.row(id);
    await this.authorize(account, row.dao);
    return this.statusRow(row);
  }
  private async statusRow(row: ExportRow) {
    const chunks = await this.chunks(row.id),
      hold = await this.pool.query<{ remaining_bytes: string }>(
        'SELECT remaining_bytes FROM archive_storage_holds WHERE id=$1',
        [row.id],
      );
    const backup = await this.pool.query<{ receipt: unknown }>(
      'SELECT receipt FROM archive_backups WHERE export_id=$1',
      [row.id],
    );
    const anchor =
      row.anchor_id && row.manifest_commitment && this.chain.archiveAnchor
        ? await this.chain.archiveAnchor(row.dao, row.manifest_commitment)
        : null;
    if (
      row.anchor_id &&
      (!anchor ||
        anchor.id !== row.anchor_id ||
        anchor.dao_id !== row.dao.daoId ||
        anchor.manifest.chain_id !== row.dao.chainId ||
        anchor.manifest.runtime !== row.dao.contract ||
        anchor.manifest_commitment !== row.manifest_commitment ||
        anchor.descriptor_commitment !== row.descriptor_commitment ||
        anchor.retention_seconds !== row.request.selection.retentionSeconds)
    )
      throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    return ArchiveExportStatusSchema.parse({
      id: row.id,
      dao: row.dao,
      retentionSeconds: row.request.selection.retentionSeconds,
      anchor,
      state: row.state,
      maximumStoredBytes: row.maximum_stored_bytes,
      heldBytes: hold.rows[0]?.remaining_bytes,
      verifiedChunks: chunks.filter((c) => c.state === 'verified').length,
      totalChunks: chunks.length,
      manifest: row.manifest_cid
        ? { cid: row.manifest_cid, bytes: row.manifest_bytes, commitment: row.manifest_commitment }
        : null,
      backup: backup.rows[0] ? ArchiveBackupReceiptSchema.parse(backup.rows[0].receipt) : null,
      backupSupported: !!this.backupStore,
      pruningAuthorized: !!(
        anchor &&
        !anchor.revoked &&
        anchor.approved_by !== '0' &&
        this.chain.pruneArchive &&
        this.chain.archiveProgress &&
        (await this.chain.archiveProgress(row.dao, anchor.manifest_commitment)).enabled
      ),
    });
  }
  async create(account: Account, value: ArchiveExportRequest) {
    const input = ArchiveExportRequestSchema.parse(value),
      digest = hash(JSON.stringify(input));
    await this.authorize(account, input.selection.dao);
    const previous = await this.pool.query<{
      id: string;
      request_hash: Buffer;
      provider_scope: string;
    }>(
      'SELECT id,request_hash,provider_scope FROM archive_exports WHERE requested_by=$1 AND request_id=$2',
      [account.id, input.requestId],
    );
    if (previous.rows[0]) {
      if (
        previous.rows[0].request_hash.toString('hex') !== digest ||
        previous.rows[0].provider_scope !== this.scope
      )
        throw new ApiError('ARCHIVE_REQUEST_CONFLICT', 409);
      return this.status(account, previous.rows[0].id);
    }
    const plan = await archivePreview(this.chain, account, input.selection),
      eligible = plan.families.length > 0 && plan.blocked.length === 0;
    if (!eligible) throw new ApiError('ARCHIVE_NOT_ELIGIBLE', 409);
    const consent = archiveExportConsent(plan);
    if (
      consent.selectionCommitment !== input.selectionCommitment ||
      consent.maximumStoredBytes !== input.maximumStoredBytes
    )
      throw new ApiError('ARCHIVE_PLAN_CHANGED', 409);
    const id = randomUUID(),
      client = await this.pool.connect();
    let savedId: string = id;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `archive-request:${account.id}:${input.requestId}`,
      ]);
      const raced = await client.query<{
        id: string;
        request_hash: Buffer;
        provider_scope: string;
      }>(
        'SELECT id,request_hash,provider_scope FROM archive_exports WHERE requested_by=$1 AND request_id=$2',
        [account.id, input.requestId],
      );
      if (raced.rows[0]) {
        if (
          raced.rows[0].request_hash.toString('hex') !== digest ||
          raced.rows[0].provider_scope !== this.scope
        )
          throw new ApiError('ARCHIVE_REQUEST_CONFLICT', 409);
        savedId = raced.rows[0].id;
      } else {
        const daoKey = contentDaoKey(plan.dao);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${daoKey}`]);
        const funding = await fundedStorage(client, plan.dao, this.scope, this.freeBytes),
          used = await storageUsed(client, daoKey);
        if (used + BigInt(consent.maximumStoredBytes) > BigInt(funding.uploadCapacityBytes))
          throw new ApiError('STORAGE_QUOTA', 403);
        await client.query(
          `INSERT INTO archive_exports(id,request_id,requested_by,request_hash,dao_key,dao,source,source_code_hash,source_abi_hash,snapshot_number,snapshot_id,snapshot_time,plan,provider_scope,request,maximum_stored_bytes)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            id,
            input.requestId,
            account.id,
            Buffer.from(digest, 'hex'),
            daoKey,
            plan.dao,
            plan.source.account,
            plan.source.codeHash,
            plan.source.abiHash,
            plan.snapshot.blockNumber,
            plan.snapshot.blockId,
            plan.snapshot.timestamp,
            plan,
            this.scope,
            input,
            consent.maximumStoredBytes,
          ],
        );
        await client.query(
          'INSERT INTO archive_storage_holds(id,requested_by,dao_key,provider_scope,maximum_bytes,remaining_bytes) VALUES($1,$2,$3,$4,$5,$5)',
          [id, account.id, daoKey, this.scope, consent.maximumStoredBytes],
        );
        for (const [family, f] of plan.families.entries())
          for (const [ordinal, c] of f.chunks.entries()) {
            const bytes = encodeArchiveChunk(c.domain, c.rows);
            await client.query(
              'INSERT INTO archive_chunks(export_id,family,ordinal,domain,root,first_key,last_key,rows,expected_bytes,commitment) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
              [
                id,
                family,
                ordinal,
                c.domain,
                c.root,
                c.rows[0]?.primaryKey,
                c.rows.at(-1)?.primaryKey,
                c.rows.length,
                bytes.length,
                hash(bytes),
              ],
            );
          }
        await client.query(
          "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-archive','reconcile',$1,$2,now())",
          [`archive-export:${id}`, { uploadId: id }],
        );
      }
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
    return this.status(account, savedId);
  }
  private async upload(
    row: ExportRow,
    account: Account,
    requestId: string,
    referenceKey: string,
    bytes: Uint8Array,
  ) {
    const saved = await this.pool.query<{ id: string; state: string }>(
      'SELECT id,state FROM asset_uploads WHERE account_id=$1 AND request_id=$2',
      [account.id, requestId],
    );
    if (saved.rows[0] && !['verified', 'published'].includes(saved.rows[0].state)) {
      const outcome = await this.assets.reconcile(saved.rows[0].id);
      if (outcome !== 'completed') {
        if (outcome === 'manual')
          await this.pool.query(
            "UPDATE archive_exports SET state='review',last_error_code='ARCHIVE_PROVIDER_REVIEW',updated_at=now() WHERE id=$1",
            [row.id],
          );
        return outcome;
      }
    }
    const request = HostedAssetUploadSchema.parse({
      dao: row.dao,
      requestId,
      kind: 'archive',
      referenceKey,
      bytes: bytes.length,
      commitment: hash(bytes),
      content: Buffer.from(bytes).toString('base64'),
    });
    return this.assets.upload(account, request, row.id);
  }
  async reconcile(id: string): Promise<'completed' | 'retry' | 'manual'> {
    z.uuid().parse(id);
    const client = await this.pool.connect();
    const lock = `archive-export:${id}`;
    let locked = false;
    try {
      locked =
        (
          await client.query<{ locked: boolean }>(
            'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
            [lock],
          )
        ).rows[0]?.locked === true;
      if (!locked) return 'retry';
      const row = await this.row(id);
      if (row.state === 'verified') return 'completed';
      if (!['planned', 'exporting', 'review'].includes(row.state)) return 'manual';
      const accountResult = await client.query<Record<string, unknown>>(
          'SELECT id,signing_key AS "signingKey",encryption_key AS "encryptionKey",custody FROM accounts WHERE id=$1',
          [row.requested_by],
        ),
        account = AccountSchema.parse(accountResult.rows[0]);
      try {
        await this.authorize(account, row.dao);
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.code !== 'ARCHIVE_ADMIN_REQUIRED') throw cause;
        await client.query(
          "UPDATE archive_exports SET state='review',last_error_code='ARCHIVE_ADMIN_REQUIRED' WHERE id=$1",
          [id],
        );
        return 'manual';
      }
      const chunks = await this.chunks(id),
        next = chunks.find((c) => c.state !== 'verified');
      if (next) return await this.exportChunk(row, account, next);
      const receipts = chunks.map((c) => ({
          cid: c.cid,
          bytes: c.expected_bytes,
          commitment: c.commitment,
        })),
        manifest = archiveManifestForPlan(
          row.plan,
          receipts.map((r) =>
            HostedAssetReceiptSchema.pick({ cid: true, bytes: true, commitment: true }).parse(r),
          ),
        ),
        bytes = encodeArchiveManifest(manifest),
        receipt = await this.upload(
          row,
          account,
          row.manifest_request_id,
          `archive:${id}:manifest`,
          bytes,
        );
      if (typeof receipt === 'string') return receipt;
      decodeArchiveManifest(
        await this.provider.retrieve(receipt.cid, receipt.bytes),
        receipt.commitment,
      );
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `upload-dao:${contentDaoKey(row.dao)}`,
      ]);
      await client.query(
        "UPDATE archive_exports SET manifest=$2,manifest_cid=$3,manifest_bytes=$4,manifest_commitment=$5,descriptor_commitment=$6,state='verified',verified_at=COALESCE(verified_at,now()),last_error_code=NULL,updated_at=now() WHERE id=$1 AND state IN ('planned','exporting','review')",
        [
          id,
          manifest,
          receipt.cid,
          receipt.bytes,
          receipt.commitment,
          manifest.descriptorCommitment,
        ],
      );
      const members = await client.query<{ id: string }>(
        `SELECT storage_object_id AS id FROM asset_uploads WHERE account_id=$1 AND request_id=$2 AND storage_object_id IS NOT NULL UNION SELECT storage_object_id AS id FROM archive_chunks WHERE export_id=$3 AND state='verified' AND storage_object_id IS NOT NULL`,
        [account.id, row.manifest_request_id, id],
      );
      await recordArchiveGroup(
        client,
        this.scope,
        row.dao,
        `export:${id}`,
        members.rows.map((r) => r.id),
      );
      await client.query(
        "UPDATE archive_storage_holds SET remaining_bytes=0,state='released' WHERE id=$1",
        [id],
      );
      await client.query('COMMIT');
      return 'completed';
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lock]);
      client.release();
    }
  }
  private async exportChunk(
    row: ExportRow,
    account: Account,
    chunk: ChunkRow,
  ): Promise<'retry' | 'manual'> {
    const planned = row.plan.families[chunk.family]?.chunks[chunk.ordinal];
    if (!planned) throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
    const bytes = encodeArchiveChunk(planned.domain, planned.rows);
    if (bytes.length !== chunk.expected_bytes || hash(bytes) !== chunk.commitment)
      throw new ApiError('ARCHIVE_CONTENT_COMMITMENT', 409);
    const receipt = await this.upload(
      row,
      account,
      chunk.asset_request_id,
      `archive:${row.id}:${chunk.family}:${chunk.ordinal}`,
      bytes,
    );
    if (typeof receipt === 'string') return receipt;
    const firstKey = planned.rows[0]?.primaryKey,
      lastKey = planned.rows.at(-1)?.primaryKey;
    if (!firstKey || !lastKey) throw new ApiError('ARCHIVE_COVERAGE_INCOMPLETE', 409);
    verifyArchiveChunkDescriptor(
      {
        cid: receipt.cid,
        bytes: receipt.bytes,
        commitment: receipt.commitment,
        domain: planned.domain,
        root: planned.root,
        firstKey,
        lastKey,
      },
      await this.provider.retrieve(receipt.cid, receipt.bytes),
    );
    const object = await this.pool.query<{ storage_object_id: string }>(
      "SELECT storage_object_id FROM asset_uploads WHERE account_id=$1 AND request_id=$2 AND state='verified'",
      [account.id, chunk.asset_request_id],
    );
    if (!object.rows[0]?.storage_object_id) throw new ApiError('ARCHIVE_CONTENTS_INCOMPLETE', 409);
    await this.pool.query(
      "UPDATE archive_chunks SET cid=$4,storage_object_id=$5,state='verified',verified_at=COALESCE(verified_at,now()) WHERE export_id=$1 AND family=$2 AND ordinal=$3 AND state<>'verified'",
      [row.id, chunk.family, chunk.ordinal, receipt.cid, object.rows[0].storage_object_id],
    );
    await this.pool.query(
      "UPDATE archive_exports SET state='exporting',updated_at=now(),last_error_code=NULL WHERE id=$1 AND state IN ('planned','exporting','review')",
      [row.id],
    );
    return 'retry';
  }
  async refresh(account: Account, id: string) {
    await this.status(account, id);
    await this.reconcile(id);
    return this.status(account, id);
  }
  async list(account: Account, value: unknown) {
    const input = ArchiveExportListRequestSchema.parse(value);
    await this.authorize(account, input.dao);
    const key = contentDaoKey(input.dao);
    if (
      input.cursor &&
      !(
        await this.pool.query(
          'SELECT id FROM archive_exports WHERE id=$1 AND dao_key=$2 AND provider_scope=$3',
          [input.cursor, key, this.scope],
        )
      ).rowCount
    )
      throw new ApiError('ARCHIVE_CURSOR_INVALID', 400);
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM archive_exports WHERE dao_key=$1 AND provider_scope=$2 AND request IS NOT NULL AND maximum_stored_bytes IS NOT NULL
      ${input.cursor ? 'AND (created_at,id)<(SELECT created_at,id FROM archive_exports WHERE id=$3)' : ''} ORDER BY created_at DESC,id DESC LIMIT 21`,
      input.cursor ? [key, this.scope, input.cursor] : [key, this.scope],
    );
    const rows = result.rows.slice(0, 20).map((r) => RowSchema.parse(r)),
      exports = [];
    for (const row of rows) exports.push(await this.statusRow(row));
    return ArchiveExportListSchema.parse({
      dao: input.dao,
      exports,
      next: result.rows.length > 20 ? rows.at(-1)?.id : null,
    });
  }
  async attest(account: Account, id: string, value: unknown) {
    const input = ArchiveRoutes.attest.input.parse(value),
      row = await this.row(id);
    await this.authorize(account, row.dao);
    if (!this.backupStore || !this.chain.attestArchive || !this.chain.archiveAnchor)
      throw new ApiError('ARCHIVE_VERIFIER_UNCONFIGURED', 503);
    const status = await this.statusRow(row);
    if (
      !status.backup ||
      !status.manifest ||
      status.manifest.commitment !== input.manifestCommitment ||
      status.backup.commitment !== input.backupCommitment ||
      row.request.selection.retentionSeconds !== input.retentionSeconds
    )
      throw new ApiError('ARCHIVE_COMMITMENT', 409);
    await this.bundle(account, id, false);
    const restored = await this.backupStore.read(
      id,
      input.manifestCommitment,
      input.backupCommitment,
    );
    if (restored.manifest.descriptorCommitment !== input.descriptorCommitment)
      throw new ApiError('ARCHIVE_COMMITMENT', 409);
    const native = archiveAttestation(restored, status.backup, input.retentionSeconds),
      anchor = await this.chain.attestArchive(native);
    if (
      anchor.dao_id !== row.dao.daoId ||
      anchor.manifest.chain_id !== row.dao.chainId ||
      anchor.manifest.runtime !== row.dao.contract ||
      anchor.manifest_commitment !== input.manifestCommitment ||
      anchor.backup_commitment !== input.backupCommitment ||
      anchor.descriptor_commitment !== input.descriptorCommitment ||
      anchor.retention_seconds !== input.retentionSeconds
    )
      throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    await this.authorize(account, row.dao);
    if (row.anchor_id && row.anchor_id !== anchor.id)
      throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    await this.pool.query(
      'UPDATE archive_exports SET anchor_id=$2,anchor_transaction=COALESCE(anchor_transaction,$3) WHERE id=$1 AND (anchor_id IS NULL OR anchor_id=$2)',
      [id, anchor.id, anchor.attestation_transaction],
    );
    return this.status(account, id);
  }
  async prune(account: Account, id: string, expected: string) {
    const status = await this.status(account, id);
    if (
      !this.chain.archiveProgress ||
      !this.chain.pruneArchive ||
      !status.manifest ||
      status.manifest.commitment !== expected
    )
      throw new ApiError('ARCHIVE_PRUNING_DISABLED', 409);
    if (
      !status.anchor ||
      status.anchor.revoked ||
      status.anchor.approved_by === '0' ||
      !status.backup
    )
      throw new ApiError('ARCHIVE_APPROVAL_REQUIRED', 409);
    // Every bounded batch revalidates both providers and preserves the administrator's exact approval.
    await this.attest(account, id, {
      manifestCommitment: expected,
      descriptorCommitment: status.anchor.descriptor_commitment,
      backupCommitment: status.backup.commitment,
      retentionSeconds: status.retentionSeconds,
    });
    const progress = await this.chain.archiveProgress(status.dao, expected);
    if (!progress.enabled) throw new ApiError('ARCHIVE_PRUNING_DISABLED', 409);
    const bundle = await this.bundle(account, id, false);
    let pending = false;
    for (const position of progress.positions) {
      const batch = archivePruneBatch(bundle, progress.anchor, position);
      if (!batch) continue;
      await this.authorize(account, status.dao);
      await this.chain.pruneArchive(status.dao, expected, batch);
      pending = true;
      break;
    }
    await this.pool.query('UPDATE archive_exports SET state=$2 WHERE id=$1', [
      id,
      pending ? 'pruning' : 'completed',
    ]);
    return this.status(account, id);
  }
  async backup(account: Account, id: string, expected: string) {
    const status = await this.status(account, id);
    if (!this.backupStore) throw new ApiError('ARCHIVE_BACKUP_NOT_CONFIGURED', 503);
    if (!status.manifest || status.manifest.commitment !== expected)
      throw new ApiError('ARCHIVE_MANIFEST_CHANGED', 409);
    const receipt = await this.backupStore.put(await this.bundle(account, id));
    await this.authorize(account, status.dao);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM archive_exports WHERE id=$1 FOR UPDATE', [id]);
      await client.query(
        'INSERT INTO archive_backups(export_id,receipt) VALUES($1,$2) ON CONFLICT(export_id) DO NOTHING',
        [id, receipt],
      );
      const saved = await client.query<{ receipt: unknown }>(
          'SELECT receipt FROM archive_backups WHERE export_id=$1',
          [id],
        ),
        previous = ArchiveBackupReceiptSchema.parse(saved.rows[0]?.receipt);
      if (JSON.stringify(previous) !== JSON.stringify(receipt))
        throw new ApiError('ARCHIVE_BACKUP_CONFLICT', 409);
      await client.query(
        'UPDATE archive_exports SET backup_verified_at=$2 WHERE id=$1 AND backup_verified_at IS NULL',
        [id, receipt.verifiedAt],
      );
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
    return this.status(account, id);
  }
  async bundle(account: Account, id: string, allowBackup = true) {
    const status = await this.status(account, id);
    if (
      !['verified', 'approved', 'pruning', 'completed'].includes(status.state) ||
      !status.manifest
    )
      throw new ApiError('ARCHIVE_NOT_READY', 409);
    try {
      const file = status.manifest,
        manifestBytes = await this.provider.retrieve(file.cid, file.bytes),
        manifest = decodeArchiveManifest(manifestBytes, file.commitment),
        descriptors = manifest.families.flatMap((f) => f.chunks);
      if (contentDaoKey(manifest.dao) !== contentDaoKey(status.dao))
        throw new ApiError('DAO_REFERENCE');
      if (descriptors.reduce((sum, c) => sum + c.bytes, manifestBytes.length) > 64 * 1024 * 1024)
        throw new ApiError('ARCHIVE_RESTORE_LIMIT', 409);
      const contents: { cid: string; bytes: Uint8Array }[] = [];
      for (const chunk of descriptors)
        contents.push({
          cid: chunk.cid,
          bytes: await this.provider.retrieve(chunk.cid, chunk.bytes),
        });
      verifyArchiveChunks(manifest, contents);
      return verifyArchiveBundle(
        ArchiveBundleSchema.parse({
          id,
          manifest,
          manifestFile: { ...file, content: Buffer.from(manifestBytes).toString('base64') },
          chunks: contents.map((c) => ({
            cid: c.cid,
            content: Buffer.from(c.bytes).toString('base64'),
          })),
        }),
        file.commitment,
      );
    } catch (cause) {
      if (allowBackup && status.backup && this.backupStore) {
        try {
          return await this.backupStore.read(
            id,
            status.manifest.commitment,
            status.backup.commitment,
          );
        } catch {
          throw new ApiError('ARCHIVE_BUNDLE_UNAVAILABLE', 503);
        }
      }
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('ARCHIVE_BUNDLE_UNAVAILABLE', 503);
    }
  }
}
