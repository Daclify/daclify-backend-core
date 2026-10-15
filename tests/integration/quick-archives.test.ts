import { beforeAll, afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import {
  QuickBallotArchiveInputSchema,
  quickArchivePruneBatch,
  recoverQuickBallotHistory,
} from '@daclify/modules/archive';
import { ABI, Serializer } from '@wharfkit/antelope';
import { RuntimeTableSchemas } from '../../sdk/index.js';
import { migrate } from '../../services/api/src/store.js';
import {
  QuickBallotArchives,
  type QuickArchiveGateway,
} from '../../services/api/src/quick-ballots/archives.js';
import { EncryptedArchiveBackup } from '../../services/api/src/archive/backup.js';
import { contentDaoKey, storageUsed } from '../../services/api/src/content/ledger.js';
import type { ContentProvider, PinnedFile } from '../../services/api/src/content/provider.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url });
beforeAll(() => migrate(pool));
afterAll(() => pool.end());

it('reserves origin storage, reconciles a lost pin response, and requires both verified copies before bounded untallied cleanup', async () => {
  const raw: unknown = JSON.parse(
    await readFile(
      new URL('../fixtures/quick-ballots/archive-snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  const snapshot = QuickBallotArchiveInputSchema.omit({ kind: true, rows: true })
    .extend({
      responses: QuickBallotArchiveInputSchema.shape.rows,
      grants: QuickBallotArchiveInputSchema.shape.rows,
    })
    .parse(raw);
  // This public native fixture has a fixed domain; remove only its previous in-memory-provider test records.
  const cleanup = async () => {
    await pool.query(
      "DELETE FROM quick_ballot_archive_files WHERE export_id IN(SELECT id FROM quick_ballot_archive_exports WHERE dao_key=$1 AND provider_scope LIKE 'quick-fixture-%')",
      [contentDaoKey(snapshot.dao)],
    );
    await pool.query(
      "DELETE FROM quick_ballot_archive_exports WHERE dao_key=$1 AND provider_scope LIKE 'quick-fixture-%'",
      [contentDaoKey(snapshot.dao)],
    );
    await pool.query('DELETE FROM quick_ballot_archive_catalog WHERE dao_key=$1', [
      contentDaoKey(snapshot.dao),
    ]);
    await pool.query("DELETE FROM jobs WHERE module_id='core-quick-archives' AND job_key=$1", [
      `quick-archive-catalog:${contentDaoKey(snapshot.dao)}:${snapshot.source.account}`,
    ]);
    await pool.query(
      "DELETE FROM hosted_archive_members WHERE dao_key=$1 AND provider_scope LIKE 'quick-fixture-%'",
      [contentDaoKey(snapshot.dao)],
    );
    await pool.query(
      "DELETE FROM hosted_references WHERE dao_key=$1 AND object_id IN(SELECT id FROM hosted_objects WHERE provider_scope LIKE 'quick-fixture-%')",
      [contentDaoKey(snapshot.dao)],
    );
  };
  await cleanup();
  const directory = await mkdtemp(join(tmpdir(), 'daclify-quick-archive-'));
  const scope = 'quick-fixture-' + randomUUID(),
    pins = new Map<string, PinnedFile[]>(),
    bytesByCid = new Map<string, Uint8Array>();
  let uploads = 0,
    loseReply = true,
    providerDown = false,
    backupDown = false,
    prunes = 0;
  const provider: ContentProvider = {
    upload: async (id, bytes) => {
      uploads++;
      const hash = createHash('sha256').update(bytes).digest();
      const pin = {
        id: randomUUID(),
        cid: CID.createV1(0x55, create(0x12, hash)).toString(),
        size: bytes.length,
      };
      pins.set(id, [pin]);
      bytesByCid.set(pin.cid, bytes);
      if (loseReply) {
        loseReply = false;
        throw Error('LOST_PIN_RESPONSE');
      }
      return pin;
    },
    find: async (id) => pins.get(id) ?? [],
    retrieve: async (cid, size) => {
      if (providerDown) throw Error('PROVIDER_DOWN');
      const bytes = bytesByCid.get(cid);
      if (!bytes || bytes.length !== size) throw Error('MISSING_BYTES');
      return bytes;
    },
    remove: async () => {
      throw Error('NEVER_DELETE');
    },
  };
  const backup = new EncryptedArchiveBackup({
    directory,
    storeId: 'independent-test',
    keyId: 'fixture',
    key: randomBytes(32),
  });
  const anchors: zAnchor[] = [];
  type zAnchor = ReturnType<typeof RuntimeTableSchemas.archives.parse>;
  const chain: QuickArchiveGateway = {
    configuration: async () => ({
      chainId: snapshot.dao.chainId,
      runtime: snapshot.dao.contract,
      source: snapshot.source.account,
    }),
    detail: async () => ({ ballot: snapshot.ballot }),
    archiveSnapshot: async () => snapshot,
    archiveHistory: async () => ({ dao: snapshot.dao, anchors, next: null }),
    archiveAnchor: async (_dao, commitment) =>
      anchors.find((row) => row.manifest_commitment === commitment) ?? null,
    attestArchive: async (input) => {
      const old = anchors.find((row) => row.manifest_commitment === input.manifest_commitment);
      const anchor = RuntimeTableSchemas.archives.parse({
        ...input,
        id: old?.id ?? String(anchors.length + 1),
        descriptor_commitment: old?.descriptor_commitment ?? '00'.repeat(32),
        verifier: 'gateway',
        attestation_transaction: '44'.repeat(32),
        approval_transaction: '00'.repeat(32),
        attested_at: Math.floor(Date.now() / 1000),
        approved_by: '0',
        approved_at: 0,
        revoked: false,
      });
      // The producer's packed descriptor digest is authoritative, including on the simulated chain.
      const descriptor = Serializer.encode({
        abi: ABI.from((await import('../../sdk/generated/runtime.js')).runtimeAbi),
        type: 'archive_manifest_descriptor',
        object: input.manifest,
      });
      anchor.descriptor_commitment = createHash('sha256').update(descriptor.array).digest('hex');
      if (!old) anchors.push(anchor);
      return anchor;
    },
    pruneArchiveRows: async (bundle, anchor, position) => {
      const batch = quickArchivePruneBatch(bundle, anchor, position);
      if (batch) prunes++;
      return !!batch;
    },
  };
  try {
    const copies = {
      put: async (value: Parameters<typeof backup.put>[0]) => {
        if (backupDown) throw Error('BACKUP_DOWN');
        return backup.put(value);
      },
      read: backup.read.bind(backup),
    };
    const blocked = new QuickBallotArchives(pool, chain, provider, scope, 1n, copies);
    await expect(blocked.stage(snapshot.ballot.id)).rejects.toThrow('STORAGE_QUOTA');
    expect(uploads).toBe(0);
    const service = new QuickBallotArchives(pool, chain, provider, scope, 100_000_000n, copies);
    const ids = await service.stage(snapshot.ballot.id);
    expect(ids).toHaveLength(2);
    const db = await pool.connect();
    try {
      expect(await storageUsed(db, contentDaoKey(snapshot.dao))).toBeGreaterThan(0n);
    } finally {
      db.release();
    }
    await expect(service.exportStep(ids[0] ?? '')).rejects.toThrow('LOST_PIN_RESPONSE');
    const uploaded = uploads;
    await service.exportStep(ids[0] ?? '');
    expect(uploads).toBe(uploaded);
    for (const id of ids)
      for (let n = 0; n < 4; n++) if ((await service.exportStep(id)) === 'complete') break;
    expect(prunes).toBe(0);
    providerDown = true;
    await expect(service.pruneStep(snapshot.ballot.id)).rejects.toThrow();
    expect(prunes).toBe(0);
    providerDown = false;
    backupDown = true;
    await expect(service.pruneStep(snapshot.ballot.id)).rejects.toThrow('BACKUP_DOWN');
    expect(prunes).toBe(0);
    backupDown = false;
    for (let n = 0; n < 6; n++)
      if ((await service.pruneStep(snapshot.ballot.id)) === 'complete') break;
    expect(prunes).toBe(2);
    const history = await service.history(snapshot.ballot.id);
    expect(history.archives).toHaveLength(2);
    const restored = recoverQuickBallotHistory({
      chainId: snapshot.dao.chainId,
      runtime: snapshot.dao.contract,
      source: snapshot.source.account,
      ballot: { ...snapshot.ballot, pruned: true },
      responses: [],
      grants: null,
      archives: history.archives,
    });
    expect(restored.snapshot.responses).toHaveLength(2);
    expect(restored.grants?.grants).toHaveLength(snapshot.ballot.definition.readers.length);
    await pool.query('DELETE FROM quick_ballot_archive_catalog WHERE dao_key=$1', [
      contentDaoKey(snapshot.dao),
    ]);
    await pool.query("DELETE FROM jobs WHERE module_id='core-quick-archives' AND job_key=$1", [
      `quick-archive-catalog:${contentDaoKey(snapshot.dao)}:${snapshot.source.account}`,
    ]);
    providerDown = true;
    const recovered = await service.history(snapshot.ballot.id);
    expect(recovered.complete).toBe(true);
    expect(recovered.archives.map((row) => row.bundle)).toEqual(
      history.archives.map((row) => row.bundle),
    );
  } finally {
    await cleanup();
    await rm(directory, { recursive: true, force: true });
  }
});
