import type { Pool } from 'pg';
import type { Account } from '../../../../protocol/api.js';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import {
  HostedUploadSchema,
  HostedIntentSchema,
  HostedDocumentSchema,
  UploadStatusSchema,
  StorageStatusSchema,
  MAX_HOSTED_CONTENT_BYTES,
  FileMetadataSchema,
  type HostedUpload,
  type HostedDocument,
} from '../../../../protocol/storage.js';
import { ContentEnvelopeSchema } from '../../../../protocol/crypto.js';
import { Uint64Schema } from '../../../../protocol/base.js';
import type { ChainGateway } from '../chain.js';
import type { ContentProvider, PinnedFile } from './provider.js';
import { ApiError } from '../errors.js';
const RowSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  request_id: z.uuid(),
  state: z.enum(['reserved', 'uploaded', 'verified', 'published', 'failed']),
  intent: HostedIntentSchema,
  request_hash: z.string().regex(/^[0-9a-f]{64}$/),
  member_id: Uint64Schema,
  provider_id: z.uuid().nullable(),
  cid: z.string().nullable(),
  expires_at: z.date(),
});
type UploadRow = z.infer<typeof RowSchema>;
function hash(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function daoKey(input: HostedUpload['dao']): string {
  return JSON.stringify([input.chainId, input.contract, input.daoId]);
}
export class ContentService {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly provider: ContentProvider,
    private readonly allowance: bigint,
    readonly providerName: z.infer<typeof StorageStatusSchema>['provider'] = 'pinata',
  ) {
    if (allowance < 0n || allowance > (1n << 63n) - 1n) throw new Error('CONTENT_ALLOWANCE');
  }
  configuration(): z.infer<typeof StorageStatusSchema> {
    return { provider: this.providerName, configured: true, uploadLimit: MAX_HOSTED_CONTENT_BYTES };
  }
  #receipt(row: UploadRow): HostedDocument {
    if (!row.cid) throw new ApiError('UPLOAD_PENDING', 409);
    return HostedDocumentSchema.parse({ ...row.intent, cid: row.cid });
  }
  #reuse(row: UploadRow, requestHash: string): HostedDocument {
    if (row.request_hash !== requestHash) throw new ApiError('UPLOAD_REQUEST_CONFLICT', 409);
    if (row.state === 'verified' || row.state === 'published') return this.#receipt(row);
    throw new ApiError(row.state === 'failed' ? 'UPLOAD_FAILED' : 'UPLOAD_PENDING', 409);
  }
  async #existing(accountId: string, requestId: string): Promise<UploadRow | undefined> {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM uploads WHERE account_id=$1 AND request_id=$2',
      [accountId, requestId],
    );
    return result.rows[0] ? RowSchema.parse(result.rows[0]) : undefined;
  }
  async #reserve(
    account: Account,
    input: HostedUpload,
    memberId: string,
    requestHash: string,
  ): Promise<{ row: UploadRow; created: boolean }> {
    const client = await this.pool.connect();
    const key = daoKey(input.dao);
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `upload-request:${account.id}:${input.requestId}`,
      ]);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${key}`]);
      const existing = await client.query<Record<string, unknown>>(
        'SELECT * FROM uploads WHERE account_id=$1 AND request_id=$2 FOR UPDATE',
        [account.id, input.requestId],
      );
      if (existing.rows[0]) {
        const row = RowSchema.parse(existing.rows[0]);
        await client.query('COMMIT');
        return { row, created: false };
      }
      const entitlement = await client.query<{ storage_limit: string }>(
        "SELECT storage_limit::text FROM entitlements WHERE dao_key=$1 AND (tier='free' OR expires_at IS NULL OR expires_at>now())",
        [key],
      );
      const budget = entitlement.rows[0]
        ? BigInt(Uint64Schema.parse(entitlement.rows[0].storage_limit))
        : this.allowance;
      // Expired reservations remain charged until reconciliation establishes their pin state.
      const usage = await client.query<{ used: string }>(
        'SELECT COALESCE(sum(expected_size),0)::text AS used FROM uploads WHERE dao_key=$1 AND (state<>$2 OR provider_id IS NOT NULL)',
        [key, 'failed'],
      );
      const used = BigInt(Uint64Schema.parse(usage.rows[0]?.used));
      if (used + BigInt(input.bytes) > budget) throw new ApiError('STORAGE_QUOTA', 403);
      const id = randomUUID();
      const intent = HostedIntentSchema.strip().parse(input);
      const inserted = await client.query<Record<string, unknown>>(
        "INSERT INTO uploads(id,account_id,dao_key,expected_size,privacy,expires_at,request_id,intent,request_hash,member_id,commitment) VALUES($1,$2,$3,$4,$5,now()+interval '1 hour',$6,$7,$8,$9,$10) RETURNING *",
        [
          id,
          account.id,
          key,
          input.bytes,
          input.envelopeVersion === 1 ? 'encrypted' : 'public',
          input.requestId,
          intent,
          requestHash,
          memberId,
          input.commitment,
        ],
      );
      const row = RowSchema.parse(inserted.rows[0]);
      await client.query(
        "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES($1,$2,$3,$4,now()+interval '60 seconds') ON CONFLICT(job_key) DO NOTHING",
        ['core-content', 'reconcile', `content-upload:${id}`, { uploadId: id }],
      );
      await client.query('COMMIT');
      return { row, created: true };
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
  }
  async #authority(account: Account, input: HostedUpload): Promise<string> {
    const network = await this.chain.network();
    if (
      network.chainId !== input.dao.chainId ||
      network.runtime !== input.dao.contract ||
      network.interfaceVersion !== input.dao.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    const [dao, content] = await Promise.all([
      this.chain.dao(input.dao.daoId),
      this.chain.content(input.dao.daoId),
    ]);
    if (
      dao.reference.chainId !== input.dao.chainId ||
      dao.reference.contract !== input.dao.contract ||
      dao.reference.daoId !== input.dao.daoId ||
      content.dao.chainId !== input.dao.chainId ||
      content.dao.contract !== input.dao.contract ||
      content.dao.daoId !== input.dao.daoId
    )
      throw new ApiError('DAO_REFERENCE');
    const member = content.members.find((row) => row.signing_key === account.signingKey);
    if (!member?.active || member.custody !== (account.custody === 'managed' ? 1 : 0))
      throw new ApiError('MEMBER_REQUIRED', 403);
    const versions = content.documents.filter(
      (document) => document.document_id === input.documentId,
    );
    const last = versions.reduce<(typeof versions)[number] | undefined>(
      (previous, current) => (!previous || current.version > previous.version ? current : previous),
      undefined,
    );
    if (input.version !== (last?.version ?? 0) + 1) throw new ApiError('DOCUMENT_VERSION', 409);
    if (last && last.author !== member.id && !member.admin)
      throw new ApiError('DOCUMENT_PERMISSION', 403);
    if (dao.privacy === 'public') {
      if (input.envelopeVersion !== 0 || input.keyEpoch !== '0')
        throw new ApiError('PUBLIC_ENVELOPE');
      if (input.metadata !== '{}') {
        try {
          FileMetadataSchema.parse(JSON.parse(input.metadata));
        } catch {
          throw new ApiError('CONTENT_METADATA');
        }
      }
    } else {
      if (input.envelopeVersion !== 1 || input.keyEpoch !== dao.keyEpoch || input.metadata !== '{}')
        throw new ApiError('PRIVACY_ENVELOPE');
      if (!content.epochs.some((epoch) => epoch.epoch === input.keyEpoch))
        throw new ApiError('EPOCH_UNAVAILABLE', 409);
      try {
        const envelope = ContentEnvelopeSchema.parse(
          JSON.parse(Buffer.from(input.content, 'base64').toString('utf8')),
        );
        if (
          Buffer.from(envelope.iv, 'base64').length !== 12 ||
          Buffer.from(envelope.ciphertext, 'base64').length < 16
        )
          throw new Error();
      } catch {
        throw new ApiError('PRIVACY_ENVELOPE');
      }
    }
    return member.id;
  }
  async #verify(row: UploadRow, file: PinnedFile): Promise<HostedDocument> {
    const providerId = z.uuid().parse(file.id);
    const document = HostedDocumentSchema.parse({ ...row.intent, cid: file.cid });
    if (file.size !== document.bytes) throw new ApiError('CONTENT_SIZE', 502);
    await this.pool.query(
      "UPDATE uploads SET provider_id=$1,cid=$2,state='uploaded' WHERE id=$3 AND state IN ('reserved','uploaded')",
      [providerId, file.cid, row.id],
    );
    const retrieved = await this.provider.retrieve(file.cid, document.bytes);
    if (retrieved.length !== document.bytes || hash(retrieved) !== document.commitment)
      throw new ApiError('DOCUMENT_INTEGRITY', 502);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        "UPDATE uploads SET state='verified',last_error_code=NULL WHERE id=$1 AND state='uploaded' RETURNING id",
        [row.id],
      );
      if (result.rowCount === 1)
        await client.query(
          'INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,$2,$3)',
          [
            row.account_id,
            'content.verified',
            {
              uploadId: row.id,
              dao: document.dao,
              documentId: document.documentId,
              version: document.version,
              cid: document.cid,
              commitment: document.commitment,
            },
          ],
        );
      else {
        const current = await client.query<Record<string, unknown>>(
          'SELECT * FROM uploads WHERE id=$1 FOR UPDATE',
          [row.id],
        );
        const completed = RowSchema.parse(current.rows[0]);
        if (
          !['verified', 'published'].includes(completed.state) ||
          completed.cid !== document.cid ||
          completed.request_hash !== row.request_hash
        )
          throw new ApiError('UPLOAD_PENDING', 409);
      }
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
    return document;
  }
  async upload(account: Account, input: HostedUpload): Promise<HostedDocument> {
    input = HostedUploadSchema.parse(input);
    const bytes = Buffer.from(input.content, 'base64');
    if (bytes.length !== input.bytes) throw new ApiError('CONTENT_SIZE');
    if (hash(bytes) !== input.commitment) throw new ApiError('DOCUMENT_INTEGRITY');
    const intent = HostedIntentSchema.strip().parse(input);
    const requestHash = hash(JSON.stringify(intent));
    const existing = await this.#existing(account.id, input.requestId);
    if (existing) return this.#reuse(existing, requestHash);
    const memberId = await this.#authority(account, input);
    const reserved = await this.#reserve(account, input, memberId, requestHash);
    if (!reserved.created) return this.#reuse(reserved.row, requestHash);
    try {
      return await this.#verify(reserved.row, await this.provider.upload(reserved.row.id, bytes));
    } catch {
      await this.pool
        .query('UPDATE uploads SET last_error_code=$1 WHERE id=$2', [
          'UPLOAD_PENDING',
          reserved.row.id,
        ])
        .catch(() => undefined);
      throw new ApiError('UPLOAD_PENDING', 503);
    }
  }
  async status(account: Account, requestId: string): Promise<z.infer<typeof UploadStatusSchema>> {
    const row = await this.#existing(account.id, z.uuid().parse(requestId));
    if (!row) throw new ApiError('UPLOAD_UNKNOWN', 404);
    return UploadStatusSchema.parse({
      requestId: row.request_id,
      state: row.state,
      ...(row.state === 'verified' || row.state === 'published'
        ? { document: this.#receipt(row) }
        : {}),
    });
  }
  async reconcile(uploadId: string): Promise<'completed' | 'retry' | 'manual'> {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM uploads WHERE id=$1',
      [z.uuid().parse(uploadId)],
    );
    const value = result.rows[0];
    if (!value) return 'completed';
    const row = RowSchema.parse(value);
    if (row.state === 'published' || row.state === 'failed') return 'completed';
    const network = await this.chain.network();
    if (network.chainId !== row.intent.dao.chainId || network.runtime !== row.intent.dao.contract)
      throw new ApiError('DAO_REFERENCE');
    const content = await this.chain.content(row.intent.dao.daoId);
    if (
      content.dao.chainId !== row.intent.dao.chainId ||
      content.dao.contract !== row.intent.dao.contract ||
      content.dao.daoId !== row.intent.dao.daoId
    )
      throw new ApiError('DAO_REFERENCE');
    const published = content.documents.find(
      (document) =>
        document.document_id === row.intent.documentId && document.version === row.intent.version,
    );
    if (
      row.state === 'verified' &&
      published &&
      row.cid === published.cid &&
      row.intent.commitment === published.commitment &&
      row.intent.bytes === published.bytes &&
      row.intent.envelopeVersion === published.envelope_version &&
      row.intent.keyEpoch === published.key_epoch &&
      row.intent.metadata === published.metadata
    ) {
      await this.pool.query(
        "UPDATE uploads SET state='published',last_error_code=NULL WHERE id=$1 AND state<>'failed'",
        [row.id],
      );
      return 'completed';
    }
    if (row.state === 'reserved' || row.state === 'uploaded') {
      const files = await this.provider.find(row.id);
      if (files.length === 1 && files[0]) {
        await this.#verify(row, files[0]);
        return 'retry';
      }
      if (files.length > 1) {
        await this.pool.query('UPDATE uploads SET last_error_code=$1 WHERE id=$2', [
          'UPLOAD_REVIEW_REQUIRED',
          row.id,
        ]);
        return 'manual';
      }
    }
    if (row.expires_at.getTime() <= Date.now()) {
      // A missing provider index entry is not proof of absence. Keep its budget held.
      // Automated unpinning also requires verified shared-reference/retention semantics.
      await this.pool.query('UPDATE uploads SET last_error_code=$1 WHERE id=$2', [
        'UPLOAD_REVIEW_REQUIRED',
        row.id,
      ]);
      return 'manual';
    }
    return 'retry';
  }
  async refreshStatus(
    account: Account,
    requestId: string,
  ): Promise<z.infer<typeof UploadStatusSchema>> {
    const row = await this.#existing(account.id, z.uuid().parse(requestId));
    if (!row) throw new ApiError('UPLOAD_UNKNOWN', 404);
    await this.reconcile(row.id);
    return this.status(account, requestId);
  }
  async retrieve(daoId: string, documentId: string, version: number): Promise<Uint8Array> {
    const content = await this.chain.content(daoId);
    const document = content.documents.find(
      (row) => row.document_id === documentId && row.version === version,
    );
    if (!document?.cid) throw new ApiError('DOCUMENT_UNKNOWN', 404);
    const bytes = await this.provider.retrieve(document.cid, document.bytes);
    if (bytes.length !== document.bytes || hash(bytes) !== document.commitment)
      throw new ApiError('DOCUMENT_INTEGRITY', 502);
    return bytes;
  }
}
