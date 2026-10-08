import type { Pool } from 'pg';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import type { Account } from '../../../../protocol/api.js';
import { ChainIdSchema, NativeAccountSchema, IdSchema } from '../../../../protocol/base.js';
import {
  HostedAssetIntentSchema,
  HostedAssetUploadSchema,
  HostedAssetReceiptSchema,
  type HostedAssetUpload,
  type HostedAssetReceipt,
} from '../../../../protocol/storage.js';
import type { ChainGateway } from '../chain.js';
import type { ContentProvider, PinnedFile } from './provider.js';
import { ApiError } from '../errors.js';
import {
  CONTENT_IMPORT_PROFILE,
  ProviderScopeSchema,
  contentDaoKey,
  storageUsed,
  objectCharged,
  reusableObject,
  recordVerifiedPin,
} from './ledger.js';
import { fundedStorage } from './capacity.js';
const RowSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  dao_key: z.string(),
  provider_scope: ProviderScopeSchema,
  import_profile: z.literal(CONTENT_IMPORT_PROFILE),
  request_id: z.uuid(),
  kind: HostedAssetIntentSchema.shape.kind,
  reference_key: HostedAssetIntentSchema.shape.referenceKey,
  expected_bytes: HostedAssetIntentSchema.shape.bytes,
  commitment: ChainIdSchema,
  request_hash: ChainIdSchema,
  state: z.enum(['reserved', 'uploaded', 'verified', 'published', 'review']),
  provider_id: z.uuid().nullable(),
  cid: HostedAssetReceiptSchema.shape.cid.nullable(),
  storage_object_id: z.uuid().nullable(),
  storage_released_at: z.date().nullable(),
  expires_at: z.date(),
  archive_hold_id: z.uuid().nullable(),
});
type AssetRow = z.infer<typeof RowSchema>;
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function intent(row: AssetRow) {
  const [chainId, contract, daoId] = z
    .tuple([ChainIdSchema, NativeAccountSchema, IdSchema])
    .parse(JSON.parse(row.dao_key));
  return HostedAssetIntentSchema.parse({
    dao: { chainId, contract, daoId, interfaceVersion: 1 },
    requestId: row.request_id,
    kind: row.kind,
    referenceKey: row.reference_key,
    bytes: row.expected_bytes,
    commitment: row.commitment,
  });
}
// Internal artifact transport; publication and archive eligibility belong to their caller.
export class HostedAssets {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly provider: ContentProvider,
    private readonly freeBytes: bigint,
    private readonly scope: string,
  ) {
    ProviderScopeSchema.parse(scope);
    if (freeBytes < 0n || freeBytes > (1n << 63n) - 1n) throw new Error('CONTENT_ALLOWANCE');
  }
  async upload(
    account: Account,
    value: HostedAssetUpload,
    archiveHoldId?: string,
  ): Promise<HostedAssetReceipt> {
    const input = HostedAssetUploadSchema.parse(value),
      bytes = Buffer.from(input.content, 'base64');
    if (bytes.length !== input.bytes || hash(bytes) !== input.commitment)
      throw new ApiError('DOCUMENT_INTEGRITY');
    const requestHash = hash(JSON.stringify(HostedAssetIntentSchema.strip().parse(input)));
    return this.uploadIntent(
      account,
      input,
      bytes,
      requestHash,
      archiveHoldId === undefined ? null : z.uuid().parse(archiveHoldId),
    );
  }
  private async uploadIntent(
    account: Account,
    input: HostedAssetUpload,
    bytes: Uint8Array,
    requestHash: string,
    archiveHoldId: string | null,
  ): Promise<HostedAssetReceipt> {
    const network = await this.chain.network();
    if (
      input.dao.chainId !== network.chainId ||
      input.dao.contract !== network.runtime ||
      input.dao.interfaceVersion !== network.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    if (
      !(await this.chain.memberships(account)).some(
        (member) =>
          member.active && member.admin && contentDaoKey(member.dao) === contentDaoKey(input.dao),
      )
    )
      throw new ApiError('ADMIN_REQUIRED', 403);
    const client = await this.pool.connect();
    let row: AssetRow;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `asset-request:${account.id}:${input.requestId}`,
      ]);
      const key = contentDaoKey(input.dao);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${key}`]);
      const existing = await client.query<Record<string, unknown>>(
        'SELECT * FROM asset_uploads WHERE account_id=$1 AND request_id=$2 FOR UPDATE',
        [account.id, input.requestId],
      );
      if (existing.rows[0]) {
        row = RowSchema.parse(existing.rows[0]);
        if (
          row.request_hash !== requestHash ||
          row.provider_scope !== this.scope ||
          row.archive_hold_id !== archiveHoldId
        )
          throw new ApiError('UPLOAD_REQUEST_CONFLICT', 409);
        await client.query('COMMIT');
        if ((row.state === 'verified' || row.state === 'published') && row.cid) {
          if (row.storage_released_at) throw new ApiError('CONTENT_HOSTING_ENDED', 410);
          return HostedAssetReceiptSchema.parse({ ...intent(row), cid: row.cid });
        }
        throw new ApiError('UPLOAD_PENDING', 409);
      }
      const funding = await fundedStorage(client, input.dao, this.scope, this.freeBytes);
      const reusable = await reusableObject(client, this.scope, input.commitment, input.bytes);
      const used = await storageUsed(client, key),
        charged = reusable && (await objectCharged(client, key, reusable.id));
      const growth = charged ? 0n : BigInt(input.bytes);
      if (archiveHoldId) {
        if (input.kind !== 'archive') throw new ApiError('ARCHIVE_HOLD_INVALID', 409);
        const debit = await client.query(
          "UPDATE archive_storage_holds SET remaining_bytes=remaining_bytes-$1 WHERE id=$2 AND requested_by=$3 AND dao_key=$4 AND provider_scope=$5 AND state='held' AND remaining_bytes>=$1 RETURNING id",
          [growth.toString(), archiveHoldId, account.id, key, this.scope],
        );
        if (!debit.rowCount) throw new ApiError('ARCHIVE_HOLD_INVALID', 409);
      } else if (used + growth > BigInt(funding.uploadCapacityBytes))
        throw new ApiError('STORAGE_QUOTA', 403);
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO asset_uploads(id,account_id,dao_key,provider_scope,import_profile,request_id,kind,reference_key,expected_bytes,commitment,request_hash,storage_object_id,provider_id,cid,archive_hold_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          randomUUID(),
          account.id,
          key,
          this.scope,
          CONTENT_IMPORT_PROFILE,
          input.requestId,
          input.kind,
          input.referenceKey,
          input.bytes,
          input.commitment,
          requestHash,
          reusable?.id ?? null,
          reusable?.provider_id ?? null,
          reusable?.cid ?? null,
          archiveHoldId,
        ],
      );
      row = RowSchema.parse(inserted.rows[0]);
      await client.query(
        "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-assets','reconcile',$1,$2,now()+interval '60 seconds') ON CONFLICT(job_key) DO NOTHING",
        [`asset-upload:${row.id}`, { uploadId: row.id }],
      );
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
    try {
      const pin =
        row.provider_id && row.cid
          ? { id: row.provider_id, cid: row.cid, size: row.expected_bytes }
          : await this.provider.upload(row.id, bytes);
      return await this.verify(row, pin);
    } catch {
      await this.pool.query(
        "UPDATE asset_uploads SET last_error_code='UPLOAD_PENDING' WHERE id=$1",
        [row.id],
      );
      throw new ApiError('UPLOAD_PENDING', 503);
    }
  }
  private async verify(row: AssetRow, file: PinnedFile): Promise<HostedAssetReceipt> {
    if (row.provider_scope !== this.scope || row.import_profile !== CONTENT_IMPORT_PROFILE)
      throw new ApiError('STORAGE_OWNERSHIP_REVIEW', 409);
    const pin = z
      .strictObject({
        id: z.uuid(),
        cid: HostedAssetReceiptSchema.shape.cid,
        size: HostedAssetIntentSchema.shape.bytes,
      })
      .parse(file);
    if (
      pin.size !== row.expected_bytes ||
      (row.cid && row.cid !== pin.cid) ||
      (row.provider_id && row.provider_id !== pin.id)
    )
      throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
    const stage = await this.pool.query(
      `UPDATE asset_uploads SET provider_id=$1,cid=$2,state='uploaded' WHERE id=$3 AND state IN ('reserved','uploaded','review') AND (provider_id IS NULL OR provider_id=$1) AND (cid IS NULL OR cid=$2) RETURNING id`,
      [pin.id, pin.cid, row.id],
    );
    if (!stage.rowCount) {
      const saved = await this.pool.query<Record<string, unknown>>(
        'SELECT * FROM asset_uploads WHERE id=$1',
        [row.id],
      );
      const current = RowSchema.parse(saved.rows[0]);
      if (
        current.provider_id !== pin.id ||
        current.cid !== pin.cid ||
        current.request_hash !== row.request_hash ||
        !['verified', 'published'].includes(current.state)
      )
        throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
    }
    const bytes = await this.provider.retrieve(pin.cid, row.expected_bytes);
    if (bytes.length !== row.expected_bytes || hash(bytes) !== row.commitment)
      throw new ApiError('DOCUMENT_INTEGRITY', 502);
    const receipt = HostedAssetReceiptSchema.parse({ ...intent(row), cid: pin.cid });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `upload-dao:${row.dao_key}`,
      ]);
      const saved = await client.query<Record<string, unknown>>(
        'SELECT * FROM asset_uploads WHERE id=$1 FOR UPDATE',
        [row.id],
      );
      const current = RowSchema.parse(saved.rows[0]);
      if (
        current.request_hash !== row.request_hash ||
        current.provider_id !== pin.id ||
        current.cid !== pin.cid ||
        current.provider_scope !== this.scope
      )
        throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
      const objectId = await recordVerifiedPin(
        client,
        this.scope,
        { kind: row.kind, referenceKey: row.reference_key },
        {
          dao: receipt.dao,
          cid: receipt.cid,
          bytes: receipt.bytes,
          commitment: receipt.commitment,
        },
        pin,
      );
      await client.query(
        "UPDATE asset_uploads SET storage_object_id=$1,state='verified',verified_at=COALESCE(verified_at,now()),last_error_code=NULL WHERE id=$2 AND state NOT IN ('verified','published')",
        [objectId, row.id],
      );
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
    return receipt;
  }
  async reconcile(id: string): Promise<'completed' | 'retry' | 'manual'> {
    const found = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM asset_uploads WHERE id=$1',
      [z.uuid().parse(id)],
    );
    if (!found.rows[0]) return 'completed';
    const row = RowSchema.parse(found.rows[0]);
    if (row.provider_scope !== this.scope) return 'manual';
    if (['verified', 'published'].includes(row.state)) return 'completed';
    if (row.provider_id && row.cid) {
      await this.verify(row, { id: row.provider_id, cid: row.cid, size: row.expected_bytes });
      return 'completed';
    }
    const files = await this.provider.find(id);
    if (files.length > 1) return 'manual';
    const file = files[0];
    if (!file) {
      if (row.expires_at.getTime() <= Date.now()) {
        await this.pool.query(
          "UPDATE asset_uploads SET state='review',last_error_code='UPLOAD_REVIEW_REQUIRED' WHERE id=$1 AND state NOT IN ('verified','published')",
          [id],
        );
        return 'manual';
      }
      return 'retry';
    }
    await this.verify(row, file);
    return 'completed';
  }
}
