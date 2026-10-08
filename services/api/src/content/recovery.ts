import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { Account } from '../../../../protocol/api.js';
import {
  HostedObjectDescriptorSchema,
  StorageRecoveryRequestSchema,
  StorageRecoveryPageSchema,
  type HostedObjectDescriptor,
  type HostedReference,
} from '../../../../protocol/storage.js';
import type { ChainGateway } from '../chain.js';
import type { ContentProvider } from './provider.js';
import { ApiError } from '../errors.js';
import { ArchiveHistory } from '../archive/history.js';
import {
  contentDaoKey,
  recordVerifiedPin,
  CONTENT_IMPORT_PROFILE,
  recordArchiveGroup,
} from './ledger.js';
const ObjectState = z.object({
  bytes: z.coerce.number().int().positive(),
  commitment: z.string(),
  released_at: z.date().nullable(),
  same_reference: z.boolean(),
  state: z.enum(['pinned', 'removing', 'removed', 'review']),
});
export async function recoverStorageReferences(
  pool: Pool,
  chain: ChainGateway,
  provider: ContentProvider,
  scope: string,
  account: Account,
  value: unknown,
) {
  const input = StorageRecoveryRequestSchema.parse(value),
    network = await chain.network(),
    daoKey = contentDaoKey(input.dao);
  if (
    input.dao.chainId !== network.chainId ||
    input.dao.contract !== network.runtime ||
    input.dao.interfaceVersion !== network.interfaceVersion
  )
    throw new ApiError('DAO_REFERENCE');
  if (
    !(await chain.memberships(account)).some(
      (m) => m.active && m.admin && contentDaoKey(m.dao) === daoKey,
    )
  )
    throw new ApiError('ADMIN_REQUIRED', 403);
  if (!provider.findCid) throw new ApiError('STORAGE_RECOVERY_UNSUPPORTED', 503);
  const candidates: { descriptor: HostedObjectDescriptor; reference: HostedReference }[] = [];
  let next: string | null = null,
    bundleKey: string | undefined;
  if (input.kind === 'document-version') {
    const content = await chain.content(input.dao.daoId, {
      documents: input.after,
      members: 'done',
      keyGrants: 'done',
      epochs: 'done',
    });
    if (
      contentDaoKey(content.dao) !== daoKey ||
      content.documents.length > 250 ||
      (content.next.documents !== null && BigInt(content.next.documents) <= BigInt(input.after))
    )
      throw new ApiError('STORAGE_RECOVERY_COVERAGE', 503);
    const documents = content.documents.slice(0, 25);
    let previous = BigInt(input.after) - 1n;
    for (const row of content.documents) {
      if (BigInt(row.id) <= previous) throw new ApiError('STORAGE_RECOVERY_COVERAGE', 503);
      previous = BigInt(row.id);
    }
    next =
      content.documents.length > 25
        ? (BigInt(documents.at(-1)?.id ?? input.after) + 1n).toString()
        : content.next.documents;
    for (const row of documents)
      if (row.cid)
        candidates.push({
          descriptor: HostedObjectDescriptorSchema.parse({
            dao: input.dao,
            cid: row.cid,
            bytes: row.bytes,
            commitment: row.commitment,
          }),
          reference: {
            kind: input.kind,
            referenceKey: `chain:${row.document_id}:${row.version}:${row.id}`,
          },
        });
  } else if (input.kind === 'branding') {
    const dao = await chain.dao(input.dao.daoId);
    if (contentDaoKey(dao.reference) !== daoKey || input.after !== '0')
      throw new ApiError('DAO_REFERENCE');
    for (const slot of ['logo', 'cover'] as const) {
      const image = dao.branding?.[slot];
      if (image)
        candidates.push({
          descriptor: HostedObjectDescriptorSchema.parse({
            dao: input.dao,
            cid: image.cid,
            bytes: image.bytes,
            commitment: image.commitment,
          }),
          reference: { kind: 'branding', referenceKey: `chain:${slot}:${image.commitment}` },
        });
    }
  } else {
    if (!chain.archiveHistory) throw new ApiError('ARCHIVE_HISTORY_UNAVAILABLE', 503);
    const history = new ArchiveHistory(chain, provider),
      page = await history.list(account, {
        dao: input.dao,
        ...(input.after === '0' ? {} : { cursor: input.after }),
      }),
      anchor = page.anchors[0];
    next = page.anchors.length > 1 && anchor ? (BigInt(anchor.id) + 1n).toString() : page.next;
    if (anchor) {
      bundleKey = `chain:${anchor.id}`;
      const bundle = await history.recover(account, {
        dao: input.dao,
        manifestCommitment: anchor.manifest_commitment,
      });
      candidates.push({
        descriptor: {
          dao: input.dao,
          cid: bundle.manifestFile.cid,
          bytes: bundle.manifestFile.bytes,
          commitment: bundle.manifestFile.commitment,
        },
        reference: { kind: 'archive', referenceKey: `chain:${anchor.id}:manifest` },
      });
      for (const chunk of bundle.manifest.families.flatMap((f) => f.chunks))
        candidates.push({
          descriptor: {
            dao: input.dao,
            cid: chunk.cid,
            bytes: chunk.bytes,
            commitment: chunk.commitment,
          },
          reference: {
            kind: 'archive',
            referenceKey: `chain:${anchor.id}:chunk:${chunk.domain.chunk_ordinal}`,
          },
        });
      // ponytail: first-party exports contain at most 25 document versions; add a file cursor before supporting wider hosted recovery.
      if (bundle.manifest.files.length > 25) throw new ApiError('STORAGE_RECOVERY_COVERAGE', 503);
      for (const file of bundle.manifest.files)
        candidates.push({
          descriptor: HostedObjectDescriptorSchema.parse({
            dao: input.dao,
            cid: file.cid,
            bytes: Number(file.bytes),
            commitment: file.commitment,
          }),
          reference: {
            kind: 'document-version',
            referenceKey: `archive:${anchor.id}:${file.document_id}:${file.version}`,
          },
        });
    }
  }
  const objects: z.infer<typeof StorageRecoveryPageSchema>['objects'] = [];
  for (const candidate of candidates) {
    const { descriptor, reference } = candidate;
    let state: z.infer<typeof StorageRecoveryPageSchema>['objects'][number]['state'] =
      'unavailable';
    const client = await pool.connect();
    try {
      const saved = await client.query<Record<string, unknown>>(
        `SELECT o.verified_bytes AS bytes,o.commitment,o.state,r.released_at,(r.kind=$5 AND r.reference_key=$6) AS same_reference FROM hosted_objects o JOIN hosted_references r ON r.object_id=o.id WHERE o.provider_scope=$1 AND o.import_profile=$2 AND o.cid=$3 AND r.dao_key=$4 ORDER BY r.released_at NULLS FIRST,(r.kind=$5 AND r.reference_key=$6) DESC LIMIT 1`,
        [
          scope,
          CONTENT_IMPORT_PROFILE,
          descriptor.cid,
          daoKey,
          reference.kind,
          reference.referenceKey,
        ],
      );
      let importReference = !saved.rows[0];
      if (saved.rows[0]) {
        const original = ObjectState.parse(saved.rows[0]);
        if (original.bytes !== descriptor.bytes || original.commitment !== descriptor.commitment)
          throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
        state =
          original.released_at || original.state === 'removed'
            ? 'released'
            : original.state === 'pinned'
              ? 'tracked'
              : 'unavailable';
        importReference = state === 'tracked' && !original.same_reference;
      }
      if (importReference) {
        const pins = await provider.findCid(descriptor.cid);
        if (pins.length === 0) state = 'external';
        else {
          const bytes = await provider.retrieve(descriptor.cid, descriptor.bytes);
          if (
            bytes.length !== descriptor.bytes ||
            createHash('sha256').update(bytes).digest('hex') !== descriptor.commitment
          )
            throw new ApiError('DOCUMENT_INTEGRITY', 502);
          if (
            !(await chain.memberships(account)).some(
              (m) => m.active && m.admin && contentDaoKey(m.dao) === daoKey,
            )
          )
            throw new ApiError('ADMIN_REQUIRED', 403);
          await client.query('BEGIN');
          for (const pin of pins)
            await recordVerifiedPin(client, scope, reference, descriptor, pin);
          await client.query('COMMIT');
          state = 'recovered';
        }
      }
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    objects.push({ referenceKey: reference.referenceKey, cid: descriptor.cid, state });
  }
  if (
    bundleKey &&
    candidates.length &&
    objects
      .filter((o) =>
        candidates.some(
          (c) => c.reference.kind === 'archive' && c.reference.referenceKey === o.referenceKey,
        ),
      )
      .every((o) => o.state === 'tracked' || o.state === 'recovered')
  ) {
    if (
      !(await chain.memberships(account)).some(
        (m) => m.active && m.admin && contentDaoKey(m.dao) === daoKey,
      )
    )
      throw new ApiError('ADMIN_REQUIRED', 403);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const members = await client.query<{ id: string }>(
        `SELECT id FROM hosted_objects WHERE provider_scope=$1 AND cid=ANY($2::text[]) AND state='pinned'`,
        [
          scope,
          candidates.filter((c) => c.reference.kind === 'archive').map((c) => c.descriptor.cid),
        ],
      );
      if (
        members.rows.length !==
        new Set(
          candidates.filter((c) => c.reference.kind === 'archive').map((c) => c.descriptor.cid),
        ).size
      )
        throw new ApiError('STORAGE_OBJECT_REVIEW', 409);
      await recordArchiveGroup(
        client,
        scope,
        input.dao,
        bundleKey,
        members.rows.map((r) => r.id),
      );
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
  }
  return StorageRecoveryPageSchema.parse({
    dao: input.dao,
    kind: input.kind,
    next,
    objects,
    billingRestored: false,
  });
}
