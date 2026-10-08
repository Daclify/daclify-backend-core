import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { generateKeyPairSync, randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrivateKey } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import {
  AccountSchema,
  DaoSummarySchema,
  NetworkSchema,
  UserMembershipSchema,
} from '../../protocol/api.js';
import { DaoContentSchema } from '../../protocol/content.js';
import { HostedUploadSchema, HostedAssetUploadSchema } from '../../protocol/storage.js';
import { RuntimeTableSchemas } from '../../sdk/index.js';
import { ContentService } from '../../services/api/src/content/service.js';
import {
  recordVerifiedPin,
  storageUsed,
  contentDaoKey,
} from '../../services/api/src/content/ledger.js';
import { HostedAssets } from '../../services/api/src/content/assets.js';
import { EncryptedArchiveBackup } from '../../services/api/src/archive/backup.js';
import { StorageRetention } from '../../services/api/src/content/retention.js';
import { DEFAULT_STORAGE_PRICING, storagePricingHash } from '../../protocol/storage.js';
import { ArchiveHistory } from '../../services/api/src/archive/history.js';
import { ArchiveExports } from '../../services/api/src/archive/exports.js';
import {
  archiveExportConsent,
  planOrdinaryPollArchive,
  archiveSourceSchema,
} from '@daclify/modules/archive';
import { claimLegacyUpload } from '../../services/api/src/content/migrate.js';
import type { ContentProvider, PinnedFile } from '../../services/api/src/content/provider.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { migrate } from '../../services/api/src/store.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Isolated local test database required');
const pool = new Pool({ connectionString: url });
const network = NetworkSchema.parse({
  chainId: '22'.repeat(32),
  rpcUrl: 'http://127.0.0.1:18888',
  runtime: 'daclifycore',
  hub: null,
  environment: 'local',
  interfaceVersion: 1,
  coreVersion: '0.1.0-alpha.1',
  capabilities: [],
});
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const account = AccountSchema.parse({
  id: randomUUID(),
  signingKey: PrivateKey.generate('K1').toPublic().toString(),
  encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
  custody: 'user-controlled',
});
const member = RuntimeTableSchemas.members.parse({
  id: '1',
  native_account: '',
  signing_key: account.signingKey,
  encryption_key: JSON.stringify(account.encryptionKey),
  custody: 0,
  nonce: '0',
  credits: '0',
  active: true,
  admin: true,
  reviewer: false,
  stake: '0',
  claim: '0',
  join_epoch: '1',
});
const stored = new Map<string, Uint8Array>();
function setup(allowance = 1000n, providerScope = randomUUID()) {
  const inventory = new Map<string, PinnedFile>();
  const daoId = BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 16)}`).toString();
  const dao = DaoSummarySchema.parse({
    reference: { chainId: network.chainId, contract: network.runtime, daoId, interfaceVersion: 1 },
    title: 'Hosted content fixture',
    description: '',
    privacy: 'public',
    owner: 'alice',
    token: { chainId: network.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
    members: 1,
    available: '0',
    reserved: '0',
    claims: '0',
    keyEpoch: '1',
  });
  const content = DaoContentSchema.parse({
    dao: dao.reference,
    members: [member],
    documents: [],
    keyGrants: [],
    epochs: [],
  });
  const chain: ChainGateway = {
    governance: async () => {
      throw new Error('Not part of this fixture');
    },
    execute: async () => {
      throw new Error('Not part of this fixture');
    },
    finalize: async () => {
      throw new Error('Not part of this fixture');
    },
    treasury: async () => {
      throw new Error('Not part of this fixture');
    },
    settle: async () => {
      throw new Error('Not part of this fixture');
    },
    network: async () => network,
    dao: async () => dao,
    content: async () => content,
    listDaos: async () => [dao],
    memberships: async (user) =>
      user.signingKey === member.signing_key && content.members[0]?.active
        ? [
            UserMembershipSchema.parse({
              dao: dao.reference,
              memberId: member.id,
              nonce: member.nonce,
              active: true,
              admin: member.admin,
              reviewer: member.reviewer,
              credits: member.credits,
              claim: member.claim,
              stake: member.stake,
              nativeAccount: '',
              custody: 'user-controlled',
              signingKey: member.signing_key,
            }),
          ]
        : [],
    memberProfile: async () => ({ accountName: null, profile: null }),
    moduleState: async () => {
      throw new Error('Not part of this fixture');
    },
    createDao: async () => {
      throw new Error('Not part of this fixture');
    },
    relay: async () => {
      throw new Error('Not part of this fixture');
    },
  };
  const provider: ContentProvider = {
    upload: vi.fn(async (_id: string, bytes: Uint8Array) => {
      const cid = CID.createV1(
        0x55,
        create(0x12, createHash('sha256').update(bytes).digest()),
      ).toString();
      stored.set(cid, bytes.slice());
      const pin = { id: randomUUID(), cid, size: bytes.length };
      inventory.set(pin.id, pin);
      return pin;
    }),
    retrieve: vi.fn(async (cid: string) => {
      const bytes = stored.get(cid);
      if (!bytes) throw new Error('Missing fixture file');
      return bytes.slice();
    }),
    find: async () => [],
    findCid: async (cid) => [...inventory.values()].filter((pin) => pin.cid === cid),
    remove: vi.fn(async () => {}),
  };
  const service = new ContentService(
    pool,
    chain,
    provider,
    allowance,
    'local-fixture',
    providerScope,
  );
  function request(text = 'Synthetic hosted bytes') {
    const bytes = Buffer.from(text);
    return HostedUploadSchema.parse({
      schemaVersion: 1,
      requestId: randomUUID(),
      dao: dao.reference,
      documentId: '7',
      version: 1,
      metadata: '{}',
      commitment: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      envelopeVersion: 0,
      keyEpoch: '0',
      content: bytes.toString('base64'),
    });
  }
  return { dao, content, provider, service, request, chain, providerScope };
}
async function storageTerm(
  fixture: ReturnType<typeof setup>,
  freeBytes = '100',
  periodEnd = '2026-08-01T00:00:00Z',
) {
  const id = randomUUID(),
    approval = randomUUID(),
    price = { ...DEFAULT_STORAGE_PRICING, freeBytes },
    pricingHash = storagePricingHash(price),
    invoice = 'in_' + randomUUID().replaceAll('-', '');
  await pool.query(
    'INSERT INTO storage_prices(policy_key,pricing) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [pricingHash, price],
  );
  await pool.query(
    "INSERT INTO storage_subscriptions(id,dao_key,dao,provider_scope,created_by,initial_request,state) VALUES($1,$2,$3,$4,$5,$6,'active')",
    [
      id,
      contentDaoKey(fixture.dao.reference),
      fixture.dao.reference,
      fixture.providerScope,
      account.id,
      approval,
    ],
  );
  await pool.query(
    'INSERT INTO storage_approvals(request_id,subscription_id,approved_by,pricing,pricing_hash,price_key,units,monthly_usd_cents,recurring_consent) VALUES($1,$2,$3,$4,$5,$5,1,100,true)',
    [approval, id, account.id, price, pricingHash],
  );
  await pool.query(
    "INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,state,verified_at) VALUES($1,$2,$3,$4,$5,'verified',now())",
    [invoice, id, approval, '2026-07-01T00:00:00Z', periodEnd],
  );
  return { id, approval, invoice, price };
}
async function storageObjects(fixture: ReturnType<typeof setup>) {
  const objects = [];
  for (const [i, size] of [60, 60, 40].entries()) {
    const bytes = Buffer.from(String(i).repeat(size)),
      pin = await fixture.provider.upload(randomUUID(), bytes),
      db = await pool.connect();
    try {
      await db.query('BEGIN');
      const id = await recordVerifiedPin(
        db,
        fixture.providerScope,
        { kind: 'media', referenceKey: 'retention-fixture-' + i },
        {
          dao: fixture.dao.reference,
          cid: pin.cid,
          bytes: pin.size,
          commitment: createHash('sha256').update(bytes).digest('hex'),
        },
        pin,
      );
      await db.query('UPDATE hosted_references SET created_at=$2 WHERE object_id=$1', [
        id,
        new Date(Date.UTC(2026, i, 1)),
      ]);
      await db.query('COMMIT');
      objects.push({ id, pin, bytes });
    } finally {
      db.release();
    }
  }
  return objects;
}
beforeAll(async () => {
  await migrate(pool);
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
    [account.id, account.signingKey, account.custody, account.encryptionKey],
  );
});
afterAll(() => pool.end());
describe('hosted upload transactions with a simulated provider', () => {
  it('curates whole files with generation checks, preserves shared references and clears bounded removal staging', async () => {
    const fixture = setup(100n),
      term = await storageTerm(fixture),
      objects = await storageObjects(fixture),
      retention = new StorageRetention(
        pool,
        fixture.chain,
        fixture.provider,
        100n,
        fixture.providerScope,
        async () => {},
        true,
      );
    const first = objects[0];
    if (!first) throw new Error('No retention object');
    const initial = await retention.status(account, { dao: fixture.dao.reference });
    expect(initial.funding.state).toBe('overdue');
    expect(initial.objects.filter((o) => o.retained).map((o) => o.id)).not.toContain(first.id);
    await expect(
      retention.retain(account, { dao: fixture.dao.reference, generation: '1', keep: [first.id] }),
    ).rejects.toThrow('STORAGE_CURATION_CHANGED');
    const saved = await retention.retain(account, {
      dao: fixture.dao.reference,
      generation: '0',
      keep: [first.id],
    });
    expect(saved.generation).toBe('1');
    await retention.retain(account, { dao: fixture.dao.reference, generation: '1', keep: [] });
    const foreign = setup(100n, fixture.providerScope),
      db = await pool.connect();
    try {
      await db.query('BEGIN');
      await recordVerifiedPin(
        db,
        fixture.providerScope,
        { kind: 'media', referenceKey: 'shared-foreign' },
        {
          dao: foreign.dao.reference,
          cid: first.pin.cid,
          bytes: first.pin.size,
          commitment: createHash('sha256').update(first.bytes).digest('hex'),
        },
        first.pin,
      );
      await db.query('COMMIT');
    } finally {
      db.release();
    }
    expect(await retention.prepare(fixture.dao.reference)).toBeNull();
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    expect(
      (
        await pool.query(
          'SELECT released_at FROM hosted_references WHERE object_id=$1 AND dao_key=$2',
          [first.id, contentDaoKey(foreign.dao.reference)],
        )
      ).rows[0]?.released_at,
    ).toBeNull();
    await storageTerm(foreign);
    await storageObjects(foreign);
    await pool.query(
      'UPDATE hosted_references SET created_at=$3 WHERE object_id=$1 AND dao_key=$2',
      [first.id, contentDaoKey(foreign.dao.reference), new Date('2025-01-01T00:00:00Z')],
    );
    await pool.query('UPDATE hosted_references SET released_at=now() WHERE object_id=$1', [
      first.id,
    ]);
    // An already released orphan is recovered by the same bounded prepare path on a retry.
    await pool.query(
      'UPDATE hosted_references SET released_at=NULL WHERE object_id=$1 AND dao_key=$2',
      [first.id, contentDaoKey(fixture.dao.reference)],
    );
    const removal = await retention.prepare(fixture.dao.reference);
    expect(removal).toBe(first.id);
    if (!removal) throw new Error('No removal');
    expect(await retention.remove(removal)).toBe('removed');
    expect(await retention.remove(removal)).toBe('idle');
    const audit = (
      await pool.query('SELECT state,staged_bytes FROM hosted_removals WHERE object_id=$1', [
        first.id,
      ])
    ).rows[0];
    expect(audit).toMatchObject({ state: 'removed', staged_bytes: null });
    expect((await fixture.service.usage(account, fixture.dao.reference.daoId)).totalBytes).toBe(
      '100',
    );
    await expect(
      pool.query("UPDATE hosted_removals SET state='removing' WHERE object_id=$1", [first.id]),
    ).rejects.toThrow('STORAGE_REMOVAL_TERMINAL');
    expect(term.invoice).toMatch(/^in_/);
  });
  it('wires retention reconciliation through the content host and reports its actual enabled state', async () => {
    const fixture = setup(30n),
      reconcile = vi.fn(async () => {});
    const content = new ContentService(
      pool,
      fixture.chain,
      fixture.provider,
      30n,
      'local-fixture',
      fixture.providerScope,
      undefined,
      { enabled: true, reconcilePayment: reconcile },
    );
    expect((await content.usage(account, fixture.dao.reference.daoId)).cleanup).toBe('qualified');
    expect((await content.retention.status(account, { dao: fixture.dao.reference })).cleanup).toBe(
      'qualified',
    );
    await expect(content.retention.prepare(fixture.dao.reference)).rejects.toThrow(
      'STORAGE_GRACE_ACTIVE',
    );
    expect(reconcile).toHaveBeenCalledWith(fixture.dao.reference);
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    expect((await fixture.service.usage(account, fixture.dao.reference.daoId)).cleanup).toBe(
      'disabled',
    );
  });
  it('compensates a payment arriving during unpin, fences concurrent removal and retains failed recovery for review', async () => {
    const fixture = setup(100n),
      term = await storageTerm(fixture),
      objects = await storageObjects(fixture),
      retention = new StorageRetention(
        pool,
        fixture.chain,
        fixture.provider,
        100n,
        fixture.providerScope,
        async () => {},
        true,
      ),
      first = objects[0];
    if (!first) throw new Error('No retention object');
    const id = await retention.prepare(fixture.dao.reference);
    expect(id).toBe(first.id);
    if (!id) throw new Error('No removal');
    let entered: () => void = () => {},
      release: () => void = () => {};
    const started = new Promise<void>((resolve) => {
        entered = resolve;
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    fixture.provider.remove = vi.fn(async () => {
      entered();
      await gate;
      await pool.query(
        "INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,state,verified_at) VALUES($1,$2,$3,'2026-10-01','2026-11-01','verified',now())",
        ['in_' + randomUUID().replaceAll('-', ''), term.id, term.approval],
      );
    });
    const running = retention.remove(id);
    await started;
    expect(await retention.remove(id)).toBe('idle');
    release();
    expect(await running).toBe('compensated');
    const status = await retention.status(account, { dao: fixture.dao.reference });
    expect(status.funding.state).toBe('active');
    expect(status.objects.find((o) => o.id === id)?.releasedAt).toBeNull();
    expect(fixture.provider.upload).toHaveBeenCalledTimes(4);
  });
  it('pauses uncertain staging and payment reconciliation, then resumes after failed compensation without deleting the recovery copy', async () => {
    const fixture = setup(100n),
      term = await storageTerm(fixture),
      objects = await storageObjects(fixture),
      first = objects[0];
    if (!first) throw new Error('Missing object');
    const retention = new StorageRetention(
        pool,
        fixture.chain,
        fixture.provider,
        100n,
        fixture.providerScope,
        async () => {},
        true,
      ),
      originalRetrieve = fixture.provider.retrieve;
    fixture.provider.retrieve = async () => Buffer.from('corrupt');
    await expect(retention.prepare(fixture.dao.reference)).rejects.toThrow('STORAGE_OBJECT_REVIEW');
    expect(
      (await pool.query('SELECT released_at FROM hosted_references WHERE object_id=$1', [first.id]))
        .rows[0]?.released_at,
    ).toBeNull();
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    fixture.provider.retrieve = originalRetrieve;
    const blocked = new StorageRetention(
      pool,
      fixture.chain,
      fixture.provider,
      100n,
      fixture.providerScope,
      async () => {
        throw new Error('Payment provider unknown');
      },
      true,
    );
    await expect(blocked.prepare(fixture.dao.reference)).rejects.toThrow(
      'Payment provider unknown',
    );
    const id = await retention.prepare(fixture.dao.reference);
    if (!id) throw new Error('Missing removal');
    fixture.provider.remove = vi.fn(async () => {
      await pool.query(
        "INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,state,verified_at) VALUES($1,$2,$3,'2026-10-01','2026-11-01','verified',now()) ON CONFLICT DO NOTHING",
        ['in_resume' + first.id.replaceAll('-', ''), term.id, term.approval],
      );
    });
    const upload = fixture.provider.upload;
    fixture.provider.upload = async () => {
      throw new Error('Re-pin provider unavailable');
    };
    await expect(retention.remove(id)).rejects.toThrow('STORAGE_REMOVAL_REVIEW');
    const held = (
      await pool.query('SELECT state,staged_bytes FROM hosted_removals WHERE object_id=$1', [id])
    ).rows[0];
    expect(held?.state).toBe('review');
    expect(held?.staged_bytes).toEqual(first.bytes);
    expect(
      (await pool.query('SELECT released_at FROM hosted_references WHERE object_id=$1', [id]))
        .rows[0]?.released_at,
    ).not.toBeNull();
    fixture.provider.upload = upload;
    await pool.query('UPDATE hosted_removals SET lease_until=now() WHERE object_id=$1', [id]);
    expect(await retention.remove(id)).toBe('compensated');
    expect(
      (await pool.query('SELECT state,staged_bytes FROM hosted_removals WHERE object_id=$1', [id]))
        .rows[0],
    ).toMatchObject({ state: 'canceled', staged_bytes: null });
  });
  function archiveFixture(allowance = 10_000n) {
    const fixture = setup(allowance),
      schema = archiveSourceSchema('ordinary-poll-votes');
    const selection = {
      dao: fixture.dao.reference,
      ballotIds: ['7'],
      retentionSeconds: 90 * 86400,
    };
    const plan = planOrdinaryPollArchive({
      dao: fixture.dao.reference,
      source: { account: 'decide', codeHash: schema.codeHash, abiHash: schema.rawAbiHash },
      snapshot: {
        blockNumber: 1,
        blockId: '00000001' + 'ab'.repeat(28),
        timestamp: '2026-10-08T10:00:00.000Z',
      },
      sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
      retentionSeconds: 90 * 86400,
      ballots: [
        {
          id: '7',
          dao_id: fixture.dao.reference.daoId,
          creator: '1',
          kind: 0,
          choices: 2,
          closes: 1700000000,
          quorum: 0,
          approval: 5001,
          denominator: '1',
          max_member: '1',
          cast: '1',
          tallies: ['1', '0'],
          status: 1,
          winner: 0,
          metadata: '{}',
        },
      ],
      votes: [{ id: '1', ballot: '7', member: '1', weight: '1', choice: 0 }],
      terminals: [
        {
          ballot_id: '7',
          dao_id: fixture.dao.reference.daoId,
          completed_at: 1700000000,
          legacy: false,
        },
      ],
      elections: [],
      executions: [],
      grantplans: [],
    });
    fixture.chain.archivePreview = async () => plan;
    const service = new ArchiveExports(
      pool,
      fixture.chain,
      fixture.service.assets,
      fixture.provider,
      allowance,
      fixture.service.providerScope,
    );
    const request = { requestId: randomUUID(), selection, ...archiveExportConsent(plan) };
    return { ...fixture, exports: service, request, plan, uploadRequest: fixture.request };
  }
  it('reserves the whole archive before pinning, resumes every phase and releases only unused verified capacity', async () => {
    const fixture = archiveFixture(),
      created = await fixture.exports.create(account, fixture.request);
    expect(created).toMatchObject({
      state: 'planned',
      heldBytes: fixture.request.maximumStoredBytes,
      verifiedChunks: 0,
      pruningAuthorized: false,
    });
    expect(fixture.provider.upload).not.toHaveBeenCalled();
    expect(await fixture.exports.create(account, fixture.request)).toEqual(created);
    const restarted = new ArchiveExports(
      pool,
      fixture.chain,
      fixture.service.assets,
      fixture.provider,
      10_000n,
      fixture.service.providerScope,
    );
    expect(await restarted.reconcile(created.id)).toBe('retry');
    expect(await restarted.status(account, created.id)).toMatchObject({
      state: 'exporting',
      verifiedChunks: 1,
      manifest: null,
    });
    expect(await restarted.reconcile(created.id)).toBe('completed');
    const finished = await restarted.status(account, created.id);
    expect(finished).toMatchObject({
      state: 'verified',
      heldBytes: '0',
      verifiedChunks: 1,
      totalChunks: 1,
      pruningAuthorized: false,
    });
    expect(finished.manifest?.cid).toBeTruthy();
    expect(await restarted.reconcile(created.id)).toBe('completed');
    expect(fixture.provider.upload).toHaveBeenCalledTimes(2);
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    const usage = await fixture.service.usage(account, fixture.dao.reference.daoId);
    expect(BigInt(usage.totalBytes)).toBeLessThanOrEqual(BigInt(created.maximumStoredBytes));
    expect(usage.reservedBytes).toBe('0');
    expect(
      (await restarted.list(account, { dao: fixture.dao.reference })).exports.map((e) => e.id),
    ).toEqual([created.id]);
    await expect(
      restarted.list(account, { dao: fixture.dao.reference, cursor: randomUUID() }),
    ).rejects.toThrow('ARCHIVE_CURSOR_INVALID');
    const bundle = await restarted.bundle(account, created.id);
    expect(bundle.manifest.families[0]?.records).toBe('1');
    expect(bundle.chunks).toHaveLength(1);
    const directory = await mkdtemp(join(tmpdir(), 'daclify-archive-'));
    try {
      const file = join(directory, 'bundle.json');
      await writeFile(file, JSON.stringify(bundle));
      const result: unknown = JSON.parse(
        execFileSync(
          process.execPath,
          ['--import', 'tsx', 'tools/archive/verify.ts', file, bundle.manifestFile.commitment],
          { encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' } },
        ),
      );
      expect(result).toMatchObject({
        id: created.id,
        dao: fixture.dao.reference,
        records: '1',
        chunks: 1,
        pruningAuthorized: false,
      });
      const backupKey = randomBytes(32),
        backupStore = new EncryptedArchiveBackup({
          directory,
          key: backupKey,
          keyId: 'owned-fixture-key',
          storeId: 'independent-owned-fixture',
        }),
        withBackup = new ArchiveExports(
          pool,
          fixture.chain,
          fixture.service.assets,
          fixture.provider,
          10_000n,
          fixture.service.providerScope,
          backupStore,
        );
      await expect(withBackup.backup(account, created.id, '00'.repeat(32))).rejects.toThrow(
        'ARCHIVE_MANIFEST_CHANGED',
      );
      const backed = await withBackup.backup(account, created.id, bundle.manifestFile.commitment);
      expect(backed.backup).toMatchObject({
        storeId: 'independent-owned-fixture',
        manifestCommitment: bundle.manifestFile.commitment,
      });
      expect(
        (await withBackup.backup(account, created.id, bundle.manifestFile.commitment)).backup,
      ).toEqual(backed.backup);
      await expect(
        pool.query('DELETE FROM archive_backups WHERE export_id=$1', [created.id]),
      ).rejects.toThrow('ARCHIVE_BACKUP_IMMUTABLE');
      await expect(
        pool.query('UPDATE archive_exports SET backup_verified_at=now() WHERE id=$1', [created.id]),
      ).rejects.toThrow('ARCHIVE_BACKUP_IMMUTABLE');
      const restored: unknown = JSON.parse(
        execFileSync(
          process.execPath,
          [
            '--import',
            'tsx',
            'tools/archive/verify.ts',
            '--encrypted',
            join(directory, created.id + '.daclify-archive.enc'),
            bundle.manifestFile.commitment,
          ],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              DATABASE_URL: '',
              ARCHIVE_BACKUP_KEY: backupKey.toString('hex'),
            },
          },
        ),
      );
      expect(restored).toMatchObject({
        id: created.id,
        records: '1',
        chunks: 1,
        pruningAuthorized: false,
      });
      await expect(
        restarted.backup(account, created.id, bundle.manifestFile.commitment),
      ).rejects.toThrow('ARCHIVE_BACKUP_NOT_CONFIGURED');
      let anchor: ReturnType<typeof RuntimeTableSchemas.archives.parse> | null = null;
      fixture.chain.archiveAnchor = async () => anchor;
      fixture.chain.attestArchive = async (input) => {
        anchor = RuntimeTableSchemas.archives.parse({
          id: '1',
          dao_id: input.dao_id,
          manifest: input.manifest,
          manifest_cid: input.manifest_cid,
          manifest_bytes: input.manifest_bytes,
          manifest_commitment: input.manifest_commitment,
          descriptor_commitment: bundle.manifest.descriptorCommitment,
          backup_commitment: input.backup_commitment,
          verifier: 'relay',
          retention_seconds: input.retention_seconds,
          attested_at: 1700000000,
          approved_by: anchor?.approved_by ?? '0',
          approved_at: anchor?.approved_at ?? 0,
          revoked: anchor?.revoked ?? false,
          attestation_transaction: 'cd'.repeat(32),
          approval_transaction: '00'.repeat(32),
        });
        return anchor;
      };
      const authorization = {
        manifestCommitment: bundle.manifestFile.commitment,
        descriptorCommitment: bundle.manifest.descriptorCommitment,
        backupCommitment: backed.backup?.commitment,
        retentionSeconds: fixture.request.selection.retentionSeconds,
      };
      await expect(
        withBackup.attest(account, created.id, {
          ...authorization,
          descriptorCommitment: 'ff'.repeat(32),
        }),
      ).rejects.toThrow('ARCHIVE_COMMITMENT');
      const attested = await withBackup.attest(account, created.id, authorization);
      expect(attested.anchor).toMatchObject({
        id: '1',
        approved_by: '0',
        backup_commitment: backed.backup?.commitment,
      });
      expect((await withBackup.attest(account, created.id, authorization)).anchor).toEqual(
        attested.anchor,
      );
      await expect(
        pool.query("UPDATE archive_exports SET anchor_id='2' WHERE id=$1", [created.id]),
      ).rejects.toThrow('ARCHIVE_ANCHOR_IMMUTABLE');
      const originalRetrieve = fixture.provider.retrieve;
      fixture.provider.retrieve = async () => {
        throw new Error('Primary provider lost');
      };
      expect(await withBackup.bundle(account, created.id)).toEqual(bundle);
      await expect(withBackup.attest(account, created.id, authorization)).rejects.toThrow(
        'ARCHIVE_BUNDLE_UNAVAILABLE',
      );
      fixture.provider.retrieve = originalRetrieve;
      await expect(
        withBackup.prune(account, created.id, bundle.manifestFile.commitment),
      ).rejects.toThrow('ARCHIVE_PRUNING_DISABLED');
      if (!anchor) throw new Error('Missing anchor fixture');
      anchor = RuntimeTableSchemas.archives.parse({
        ...RuntimeTableSchemas.archives.parse(anchor),
        approved_by: '1',
        approved_at: 1700000001,
      });
      let pruned = 0;
      fixture.chain.archiveProgress = async () => {
        if (!anchor) throw new Error('Missing anchor fixture');
        return {
          anchor,
          enabled: true,
          positions: [
            {
              id: '32',
              dao_id: fixture.dao.reference.daoId,
              archive_id: '1',
              chunk_ordinal: 0,
              pruned,
            },
          ],
        };
      };
      fixture.chain.pruneArchive = async (_dao, _commitment, batch) => {
        expect(batch).toMatchObject({
          archive_id: '1',
          start: 0,
          proofs: [{ primary_key: '1', siblings: [] }],
        });
        pruned += batch.proofs.length;
      };
      expect(
        (await withBackup.prune(account, created.id, bundle.manifestFile.commitment)).state,
      ).toBe('pruning');
      expect(
        (await withBackup.prune(account, created.id, bundle.manifestFile.commitment)).state,
      ).toBe('completed');
      expect(pruned).toBe(1);
      fixture.chain.archiveHistory = async (input) => ({
        dao: input.dao,
        anchors: [RuntimeTableSchemas.archives.parse(anchor)],
        next: null,
      });
      // Construct a reader with no Pool capability: a lost SQL history index cannot be consulted.
      const history = new ArchiveHistory(fixture.chain, fixture.provider);
      const discovered = await history.list(account, { dao: fixture.dao.reference });
      expect(discovered.anchors[0]?.manifest_commitment).toBe(bundle.manifestFile.commitment);
      const recovered = await history.recover(account, {
        dao: fixture.dao.reference,
        manifestCommitment: bundle.manifestFile.commitment,
      });
      expect(recovered.manifest).toEqual(bundle.manifest);
      const page = await history.page(account, {
        dao: fixture.dao.reference,
        manifestCommitment: bundle.manifestFile.commitment,
      });
      expect(page).toMatchObject({
        parentId: '7',
        records: [{ id: '1', ballot: '7', member: '1', weight: '1', choice: 0 }],
        coverage: 'verified-archive',
        liveRowsIncluded: false,
        next: null,
      });
      fixture.chain.archiveLiveVotes = async () => [
        { id: '1', ballot: '7', member: '1', weight: '1', choice: 0 },
        { id: '2', ballot: '7', member: '2', weight: '1', choice: 1 },
      ];
      const merged = await history.page(account, {
        dao: fixture.dao.reference,
        manifestCommitment: bundle.manifestFile.commitment,
      });
      expect(merged.liveRowsIncluded).toBe(true);
      expect(merged.records.map((r) => r.id)).toEqual(['1', '2']);
      fixture.chain.archiveLiveVotes = async () => [
        { id: '1', ballot: '7', member: '1', weight: '2', choice: 0 },
      ];
      await expect(
        history.page(account, {
          dao: fixture.dao.reference,
          manifestCommitment: bundle.manifestFile.commitment,
        }),
      ).rejects.toThrow('ARCHIVE_HISTORY_CONFLICT');
      await expect(
        history.list(account, { dao: { ...fixture.dao.reference, daoId: '999' } }),
      ).rejects.toThrow('MEMBER_REQUIRED');
      fixture.provider.retrieve = async () => {
        throw new Error('Missing primary and SQL index');
      };
      await expect(
        history.recover(account, {
          dao: fixture.dao.reference,
          manifestCommitment: bundle.manifestFile.commitment,
        }),
      ).rejects.toThrow('ARCHIVE_BUNDLE_UNAVAILABLE');
      fixture.provider.retrieve = originalRetrieve;

      anchor = RuntimeTableSchemas.archives.parse({
        ...RuntimeTableSchemas.archives.parse(anchor),
        revoked: true,
      });
      await expect(
        withBackup.prune(account, created.id, bundle.manifestFile.commitment),
      ).rejects.toThrow('ARCHIVE_APPROVAL_REQUIRED');

      expect(() =>
        execFileSync(
          process.execPath,
          ['--import', 'tsx', 'tools/archive/verify.ts', file, '00'.repeat(32)],
          { stdio: 'pipe', env: { ...process.env, DATABASE_URL: '' } },
        ),
      ).toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    fixture.provider.retrieve = async () => Buffer.from('corrupt');
    // Without a configured backup, provider corruption remains explicit.
    await expect(restarted.bundle(account, created.id)).rejects.toThrow(
      'ARCHIVE_BUNDLE_UNAVAILABLE',
    );
  });
  it('fences concurrent whole-bundle reservations and never borrows another DAO archive hold', async () => {
    const fixture = archiveFixture(2000n);
    const requests = [fixture.request, { ...fixture.request, requestId: randomUUID() }];
    const outcomes = await Promise.allSettled(
      requests.map((request) => fixture.exports.create(account, request)),
    );
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const created = outcomes.find((result) => result.status === 'fulfilled');
    if (!created || created.status !== 'fulfilled') throw new Error('No archive reservation');
    await expect(
      fixture.service.upload(account, fixture.uploadRequest('x'.repeat(2000))),
    ).rejects.toThrow('STORAGE_QUOTA');
    const foreign = setup(10_000n),
      raw = foreign.request();
    await expect(
      foreign.service.assets.upload(
        account,
        HostedAssetUploadSchema.parse({
          dao: raw.dao,
          requestId: randomUUID(),
          kind: 'archive',
          referenceKey: randomUUID(),
          bytes: raw.bytes,
          commitment: raw.commitment,
          content: raw.content,
        }),
        created.value.id,
      ),
    ).rejects.toThrow('ARCHIVE_HOLD_INVALID');
    expect(fixture.provider.upload).not.toHaveBeenCalled();
    expect(foreign.provider.upload).not.toHaveBeenCalled();
  });
  it('recovers a lost archive pin response without repinning or consuming its budget twice', async () => {
    const fixture = archiveFixture(),
      created = await fixture.exports.create(account, fixture.request);
    const actualUpload = fixture.provider.upload,
      found = new Map<string, Awaited<ReturnType<ContentProvider['upload']>>>();
    let lost = true;
    fixture.provider.upload = vi.fn(async (id, bytes) => {
      const file = await actualUpload(id, bytes);
      found.set(id, file);
      if (lost) {
        lost = false;
        throw new Error('Lost provider acknowledgement');
      }
      return file;
    });
    fixture.provider.find = async (id) =>
      found.has(id)
        ? [found.get(id)].filter(
            (file): file is Awaited<ReturnType<ContentProvider['upload']>> => file !== undefined,
          )
        : [];
    await expect(fixture.exports.reconcile(created.id)).rejects.toThrow('UPLOAD_PENDING');
    const held = await fixture.exports.status(account, created.id);
    expect(held.verifiedChunks).toBe(0);
    expect(await fixture.exports.reconcile(created.id)).toBe('retry');
    const resumed = await fixture.exports.status(account, created.id);
    expect(resumed.heldBytes).toBe(held.heldBytes);
    expect(await fixture.exports.reconcile(created.id)).toBe('completed');
    expect(fixture.provider.upload).toHaveBeenCalledTimes(2);
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
  it('retains the entire unresolved archive budget after corrupt retrieval', async () => {
    const fixture = archiveFixture(),
      created = await fixture.exports.create(account, fixture.request);
    fixture.provider.retrieve = async () => Buffer.from('corrupt');
    await expect(fixture.exports.reconcile(created.id)).rejects.toThrow('UPLOAD_PENDING');
    const usage = await fixture.service.usage(account, fixture.dao.reference.daoId);
    expect(usage.totalBytes).toBe(fixture.request.maximumStoredBytes);
    expect(usage.verifiedBytes).toBe('0');
    expect(await fixture.exports.status(account, created.id)).toMatchObject({
      state: 'planned',
      verifiedChunks: 0,
      manifest: null,
    });
    await expect(
      pool.query('UPDATE archive_storage_holds SET remaining_bytes=maximum_bytes+1 WHERE id=$1', [
        created.id,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query('DELETE FROM archive_storage_holds WHERE id=$1', [created.id]),
    ).rejects.toMatchObject({ code: '23514' });
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
  it('rejects changed export consent, insufficient capacity and unauthorized recovery before provider writes', async () => {
    const fixture = archiveFixture(1n);
    await expect(
      fixture.exports.create(account, { ...fixture.request, selectionCommitment: '00'.repeat(32) }),
    ).rejects.toThrow('ARCHIVE_PLAN_CHANGED');
    await expect(fixture.exports.create(account, fixture.request)).rejects.toThrow('STORAGE_QUOTA');
    const funded = archiveFixture(),
      created = await funded.exports.create(account, funded.request);
    await expect(
      funded.exports.create(account, {
        ...funded.request,
        maximumStoredBytes: String(BigInt(funded.request.maximumStoredBytes) + 1n),
      }),
    ).rejects.toThrow('ARCHIVE_REQUEST_CONFLICT');
    funded.chain.memberships = async () => [];
    await expect(funded.exports.status(account, created.id)).rejects.toThrow(
      'ARCHIVE_ADMIN_REQUIRED',
    );
    expect(await funded.exports.reconcile(created.id)).toBe('manual');
    expect(funded.provider.upload).not.toHaveBeenCalled();
    const client = await pool.connect();
    try {
      expect(await storageUsed(client, contentDaoKey(funded.dao.reference))).toBe(
        BigInt(funded.request.maximumStoredBytes),
      );
    } finally {
      client.release();
    }
  });
  it('reserves and verifies an archive asset, sharing document CID capacity and recovering an uncertain provider response', async () => {
    const fixture = setup(30n),
      doc = await fixture.service.upload(account, fixture.request());
    const assets = new HostedAssets(
      pool,
      fixture.chain,
      fixture.provider,
      30n,
      fixture.service.providerScope,
    );
    const request = HostedAssetUploadSchema.parse({
      requestId: randomUUID(),
      kind: 'archive',
      referenceKey: randomUUID(),
      content: Buffer.from('Synthetic hosted bytes').toString('base64'),
      bytes: doc.bytes,
      commitment: doc.commitment,
      dao: doc.dao,
    });
    const receipt = await assets.upload(account, request);
    expect(receipt.cid).toBe(doc.cid);
    expect(await assets.upload(account, request)).toEqual(receipt);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
    expect(await fixture.service.usage(account, fixture.dao.reference.daoId)).toMatchObject({
      totalBytes: String(doc.bytes),
      references: 2,
    });
    await expect(
      assets.upload(account, { ...request, referenceKey: randomUUID() }),
    ).rejects.toThrow('UPLOAD_REQUEST_CONFLICT');
    const second = setup(23n),
      secondAssets = new HostedAssets(
        pool,
        second.chain,
        second.provider,
        23n,
        second.service.providerScope,
      );
    const intent = second.request('different bytes');
    const unknown = HostedAssetUploadSchema.parse({
      dao: intent.dao,
      requestId: intent.requestId,
      kind: 'archive',
      referenceKey: randomUUID(),
      bytes: intent.bytes,
      commitment: intent.commitment,
      content: intent.content,
    });
    let eventual: Awaited<ReturnType<ContentProvider['upload']>> | undefined;
    const actualUpload = second.provider.upload;
    second.provider.upload = vi.fn(async (id, bytes) => {
      eventual = await actualUpload(id, bytes);
      throw new Error('Unknown provider outcome');
    });
    await expect(secondAssets.upload(account, unknown)).rejects.toThrow('UPLOAD_PENDING');
    await expect(secondAssets.upload(account, unknown)).rejects.toThrow('UPLOAD_PENDING');
    expect(second.provider.upload).toHaveBeenCalledTimes(1);
    await expect(
      secondAssets.upload(account, { ...unknown, requestId: randomUUID() }),
    ).rejects.toThrow('STORAGE_QUOTA');
    const held = await pool.query<{ id: string }>(
      'SELECT id FROM asset_uploads WHERE account_id=$1 AND request_id=$2',
      [account.id, unknown.requestId],
    );
    const id = held.rows[0]?.id;
    if (!id) throw new Error('Missing asset hold');
    await pool.query("UPDATE asset_uploads SET expires_at=now()-interval '1 hour' WHERE id=$1", [
      id,
    ]);
    expect(await secondAssets.reconcile(id)).toBe('manual');
    expect(await second.service.usage(account, second.dao.reference.daoId)).toMatchObject({
      totalBytes: String(intent.bytes),
    });
    expect(second.provider.remove).not.toHaveBeenCalled();
    second.provider.find = async (uploadId) => (uploadId === id && eventual ? [eventual] : []);
    expect(await secondAssets.reconcile(id)).toBe('completed');
    expect((await secondAssets.upload(account, unknown)).cid).toBe(eventual?.cid);
    expect(second.provider.upload).toHaveBeenCalledTimes(1);
    expect(await second.service.usage(account, second.dao.reference.daoId)).toMatchObject({
      totalBytes: String(intent.bytes),
      references: 1,
    });
  });
  it('verifies public branding uploads for private DAOs before pinning and charges a shared image only once', async () => {
    const fixture = setup(8n);
    fixture.dao.privacy = 'encrypted-user-controlled';
    const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const input = {
      requestId: randomUUID(),
      dao: fixture.dao.reference,
      slot: 'logo',
      bytes: bytes.length,
      commitment: createHash('sha256').update(bytes).digest('hex'),
      mediaType: 'image/png',
      content: Buffer.from(bytes).toString('base64'),
      publicConsent: true,
    };
    const uploaded = await fixture.service.uploadBranding(account, input);
    expect(uploaded.image).toMatchObject({
      bytes: 8,
      commitment: input.commitment,
      mediaType: 'image/png',
    });
    expect(await fixture.service.uploadBranding(account, input)).toEqual(uploaded);
    const cover = await fixture.service.uploadBranding(account, {
      ...input,
      requestId: randomUUID(),
      slot: 'cover',
    });
    expect(cover.image.cid).toBe(uploaded.image.cid);
    expect(await fixture.service.usage(account, input.dao.daoId)).toMatchObject({
      totalBytes: '8',
      references: 2,
    });
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
    for (const change of [
      { publicConsent: false },
      { bytes: 9 },
      { mediaType: 'image/jpeg' },
      { commitment: '00'.repeat(32) },
    ])
      await expect(
        fixture.service.uploadBranding(account, { ...input, ...change, requestId: randomUUID() }),
      ).rejects.toThrow();
    const memberships = fixture.chain.memberships;
    fixture.chain.memberships = async (user) =>
      (await memberships(user)).map((row) => ({ ...row, admin: false }));
    await expect(
      fixture.service.uploadBranding(account, { ...input, requestId: randomUUID() }),
    ).rejects.toThrow('ADMIN_REQUIRED');
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
  });
  it('rebuilds hosted references in a genuinely empty database from surviving chain rows and provider inventory without inventing billing', async () => {
    const fixture = setup(30n),
      uploaded = await fixture.service.upload(account, fixture.request());
    fixture.content.documents.push(
      RuntimeTableSchemas.documents.parse({
        id: '1',
        document_id: uploaded.documentId,
        version: uploaded.version,
        author: '1',
        cid: uploaded.cid,
        metadata: uploaded.metadata,
        commitment: uploaded.commitment,
        bytes: uploaded.bytes,
        envelope_version: uploaded.envelopeVersion,
        key_epoch: uploaded.keyEpoch,
      }),
    );
    const database = 'daclify_restore_' + randomUUID().replaceAll('-', '') + '_test';
    if (!/^daclify_restore_[a-f0-9]{32}_test$/.test(database))
      throw new Error('Owned restore database required');
    await pool.query(`CREATE DATABASE "${database}"`);
    const restoredUrl = new URL(url ?? '');
    restoredUrl.pathname = '/' + database;
    const empty = new Pool({ connectionString: restoredUrl.toString() });
    try {
      await migrate(empty);
      const restored = new ContentService(
        empty,
        fixture.chain,
        fixture.provider,
        30n,
        'local-fixture',
        fixture.providerScope,
      );
      expect((await empty.query('SELECT count(*)::text AS count FROM uploads')).rows[0]).toEqual({
        count: '0',
      });
      expect(
        await restored.retrieve(uploaded.dao.daoId, uploaded.documentId, uploaded.version),
      ).toEqual(Buffer.from('Synthetic hosted bytes'));
      const result = await restored.recoverStorage(account, {
        dao: uploaded.dao,
        kind: 'document-version',
      });
      expect(result).toMatchObject({
        next: null,
        billingRestored: false,
        objects: [{ cid: uploaded.cid, state: 'recovered' }],
      });
      expect(await restored.usage(account, uploaded.dao.daoId)).toMatchObject({
        totalBytes: String(uploaded.bytes),
        objects: 1,
        references: 1,
      });
      expect(
        (await restored.recoverStorage(account, { dao: uploaded.dao, kind: 'document-version' }))
          .objects[0]?.state,
      ).toBe('tracked');
      fixture.dao.branding = {
        logo: {
          cid: uploaded.cid,
          bytes: uploaded.bytes,
          commitment: uploaded.commitment,
          mediaType: 'image/png',
        },
      };
      expect(
        (await restored.recoverStorage(account, { dao: uploaded.dao, kind: 'branding' })).objects[0]
          ?.state,
      ).toBe('recovered');
      expect(await restored.usage(account, uploaded.dao.daoId)).toMatchObject({
        totalBytes: String(uploaded.bytes),
        objects: 1,
        references: 2,
      });
      expect(
        (await empty.query('SELECT count(*)::text AS count FROM storage_invoices')).rows[0],
      ).toEqual({ count: '0' });
      const adminMemberships = fixture.chain.memberships;
      fixture.chain.memberships = async (user) =>
        (await adminMemberships(user)).map((m) => ({ ...m, admin: false }));
      await expect(
        restored.recoverStorage(account, { dao: uploaded.dao, kind: 'document-version' }),
      ).rejects.toThrow('ADMIN_REQUIRED');
      fixture.chain.memberships = adminMemberships;
      const original = fixture.content.documents[0];
      if (!original) throw new Error('Missing restored document');
      fixture.content.documents.push({
        ...original,
        id: '2',
        document_id: '8',
        cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      expect(
        (await restored.recoverStorage(account, { dao: uploaded.dao, kind: 'document-version' }))
          .objects[1]?.state,
      ).toBe('external');
      await empty.query('UPDATE hosted_references SET released_at=now()');
      expect(
        (await restored.recoverStorage(account, { dao: uploaded.dao, kind: 'document-version' }))
          .objects[0]?.state,
      ).toBe('released');
      expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
      expect(fixture.provider.remove).not.toHaveBeenCalled();
    } finally {
      await empty.end();
      await pool.query(`DROP DATABASE "${database}"`);
    }
  });
  it('fences concurrent asset growth and rejects invalid authority/content before provider calls', async () => {
    const fixture = setup(23n),
      assets = new HostedAssets(
        pool,
        fixture.chain,
        fixture.provider,
        23n,
        fixture.service.providerScope,
      );
    const make = (text = 'fifteen bytes!') => {
      const row = fixture.request(text);
      return HostedAssetUploadSchema.parse({
        dao: row.dao,
        requestId: row.requestId,
        kind: 'archive',
        referenceKey: randomUUID(),
        bytes: row.bytes,
        commitment: row.commitment,
        content: row.content,
      });
    };
    const input = make();
    await expect(assets.upload(account, { ...input, commitment: '00'.repeat(32) })).rejects.toThrow(
      'DOCUMENT_INTEGRITY',
    );
    await expect(
      assets.upload(account, { ...input, dao: { ...input.dao, contract: 'daoother' } }),
    ).rejects.toThrow('DAO_REFERENCE');
    const memberships = fixture.chain.memberships;
    fixture.chain.memberships = async () => [];
    await expect(assets.upload(account, input)).rejects.toThrow('ADMIN_REQUIRED');
    fixture.chain.memberships = memberships;
    expect(fixture.provider.upload).not.toHaveBeenCalled();
    const results = await Promise.allSettled([
      assets.upload(account, input),
      assets.upload(account, make('other content!')),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
  });
  it('recovers a reused asset from its recorded provider pin after a gateway outage', async () => {
    const fixture = setup(30n),
      document = await fixture.service.upload(account, fixture.request());
    const input = HostedAssetUploadSchema.parse({
      dao: document.dao,
      requestId: randomUUID(),
      kind: 'archive',
      referenceKey: randomUUID(),
      bytes: document.bytes,
      commitment: document.commitment,
      content: fixture.request().content,
    });
    const retrieve = fixture.provider.retrieve;
    fixture.provider.retrieve = vi.fn(async () => {
      throw new Error('Gateway unavailable');
    });
    await expect(fixture.service.assets.upload(account, input)).rejects.toThrow('UPLOAD_PENDING');
    const held = await pool.query<{ id: string }>(
      'SELECT id FROM asset_uploads WHERE account_id=$1 AND request_id=$2',
      [account.id, input.requestId],
    );
    const id = held.rows[0]?.id;
    if (!id) throw new Error('Missing reused asset reservation');
    await pool.query("UPDATE asset_uploads SET expires_at=now()-interval '1 hour' WHERE id=$1", [
      id,
    ]);
    fixture.provider.retrieve = retrieve;
    fixture.provider.find = vi.fn(async () => []);
    expect(await fixture.service.assets.reconcile(id)).toBe('completed');
    expect(fixture.provider.find).not.toHaveBeenCalled();
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    expect(await fixture.service.usage(account, document.dao.daoId)).toMatchObject({
      totalBytes: String(document.bytes),
      references: 2,
    });
  });
  it('retains asset holds when retrieved bytes are corrupt and never removes another provider pin', async () => {
    const fixture = setup(23n),
      assets = fixture.service.assets,
      raw = fixture.request('archive fixture');
    const input = HostedAssetUploadSchema.parse({
      dao: raw.dao,
      requestId: raw.requestId,
      kind: 'archive',
      referenceKey: randomUUID(),
      bytes: raw.bytes,
      commitment: raw.commitment,
      content: raw.content,
    });
    fixture.provider.retrieve = async () => new Uint8Array(input.bytes);
    await expect(assets.upload(account, input)).rejects.toThrow('UPLOAD_PENDING');
    expect(await fixture.service.usage(account, fixture.dao.reference.daoId)).toMatchObject({
      totalBytes: String(input.bytes),
      verifiedBytes: '0',
    });
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    const jobs = await pool.query<{ count: string }>(
      "SELECT count(*)::text FROM jobs j JOIN asset_uploads a ON j.job_key='asset-upload:'||a.id::text WHERE a.request_id=$1 AND j.module_id='core-assets'",
      [input.requestId],
    );
    expect(jobs.rows[0]?.count).toBe('1');
  });
  it('records verified pins consistently across branding/media/archive roles without double charging or changing ownership', async () => {
    const fixture = setup(),
      document = await fixture.service.upload(account, fixture.request());
    const pin = (
      await pool.query<{ id: string; provider_id: string }>(
        'SELECT id,provider_id FROM uploads WHERE cid=$1 AND provider_scope=$2',
        [document.cid, fixture.service.providerScope],
      )
    ).rows[0];
    if (!pin) throw new Error('Owned pin missing');
    const content = {
        dao: document.dao,
        cid: document.cid,
        bytes: document.bytes,
        commitment: document.commitment,
      },
      file = { id: pin.provider_id, cid: document.cid, size: document.bytes };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const kind of ['branding', 'media', 'archive'] as const) {
        await recordVerifiedPin(
          client,
          fixture.service.providerScope,
          { kind, referenceKey: kind },
          content,
          file,
        );
        await recordVerifiedPin(
          client,
          fixture.service.providerScope,
          { kind, referenceKey: kind },
          content,
          file,
        );
      }
      await client.query('COMMIT');
      expect(await fixture.service.usage(account, fixture.dao.reference.daoId)).toMatchObject({
        totalBytes: String(document.bytes),
        objects: 1,
        references: 4,
      });
      await client.query('BEGIN');
      await expect(
        recordVerifiedPin(
          client,
          fixture.service.providerScope,
          { kind: 'archive', referenceKey: 'wrong-size' },
          { ...content, bytes: document.bytes + 1 },
          file,
        ),
      ).rejects.toThrow();
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await expect(
        recordVerifiedPin(
          client,
          fixture.service.providerScope,
          { kind: 'archive', referenceKey: 'retag-existing-upload', uploadId: pin.id },
          content,
          file,
        ),
      ).rejects.toThrow('STORAGE_OBJECT_REVIEW');
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query("UPDATE hosted_objects SET state='removing' WHERE provider_scope=$1", [
        fixture.service.providerScope,
      ]);
      await expect(
        recordVerifiedPin(
          client,
          fixture.service.providerScope,
          { kind: 'archive', referenceKey: 'fenced' },
          content,
          file,
        ),
      ).rejects.toThrow('STORAGE_OBJECT_REVIEW');
      await client.query('ROLLBACK');
      expect(await fixture.service.usage(account, fixture.dao.reference.daoId)).toMatchObject({
        totalBytes: String(document.bytes),
        references: 4,
      });
      expect(fixture.provider.remove).not.toHaveBeenCalled();
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('verifies reconstructed bytes and reuses an identical request receipt', async () => {
    const fixture = setup();
    const request = fixture.request();
    const first = await fixture.service.upload(account, request);
    const second = await fixture.service.upload(account, request);
    expect(second).toEqual(first);
    expect(first.commitment).toBe(request.commitment);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
  });
  it('charges one verified CID once per DAO and reuses its owned pin', async () => {
    const fixture = setup(30n);
    const first = await fixture.service.upload(account, fixture.request());
    const second = await fixture.service.upload(account, { ...fixture.request(), documentId: '8' });
    expect(second.cid).toBe(first.cid);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
    const objects = await pool.query<{ bytes: string; references: string }>(
      `SELECT o.verified_bytes::text AS bytes,count(r.id)::text AS references
       FROM hosted_objects o JOIN hosted_references r ON r.object_id=o.id
       WHERE r.dao_key=$1 GROUP BY o.id`,
      [
        JSON.stringify([
          fixture.dao.reference.chainId,
          fixture.dao.reference.contract,
          fixture.dao.reference.daoId,
        ]),
      ],
    );
    expect(objects.rows).toEqual([{ bytes: String(first.bytes), references: '2' }]);
    await expect(
      fixture.service.upload(
        account,
        fixture.request('A distinct file that exceeds the remaining capacity'),
      ),
    ).rejects.toThrow('STORAGE_QUOTA');
  });
  it('holds each DAO accountable for the same CID while sharing provider ownership', async () => {
    const scope = randomUUID();
    const first = setup(30n, scope),
      second = setup(30n, scope);
    const uploaded = await first.service.upload(account, first.request());
    await second.service.upload(account, second.request());
    expect(second.provider.upload).not.toHaveBeenCalled();
    const usage = await pool.query<{ dao_key: string; used: string }>(
      `SELECT r.dao_key,sum(o.verified_bytes)::text AS used FROM
       (SELECT DISTINCT dao_key,object_id FROM hosted_references) r
       JOIN hosted_objects o ON o.id=r.object_id WHERE o.cid=$1 AND o.provider_scope=$2 GROUP BY r.dao_key`,
      [uploaded.cid, scope],
    );
    expect(usage.rows).toHaveLength(2);
    expect(usage.rows.map((row) => row.used)).toEqual([
      String(uploaded.bytes),
      String(uploaded.bytes),
    ]);
    expect(second.provider.remove).not.toHaveBeenCalled();
  });
  it('binds pins to their provider account instead of reusing another environment', async () => {
    const first = setup(30n, randomUUID()),
      second = setup(30n, randomUUID());
    await first.service.upload(account, first.request());
    await second.service.upload(account, second.request());
    expect(first.provider.upload).toHaveBeenCalledOnce();
    expect(second.provider.upload).toHaveBeenCalledOnce();
  });
  it('binds a request ID to one exact content intent', async () => {
    const fixture = setup();
    const first = fixture.request();
    await fixture.service.upload(account, first);
    await expect(
      fixture.service.upload(account, {
        ...fixture.request('Different bytes'),
        requestId: first.requestId,
      }),
    ).rejects.toThrow('UPLOAD_REQUEST_CONFLICT');
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
  });
  it('does not lend uncertain upload reservations to concurrent requests', async () => {
    const fixture = setup(30n);
    const upload = vi.mocked(fixture.provider.upload).getMockImplementation();
    if (!upload) throw new Error('Provider fixture missing');
    const gate = { started: () => {}, finish: () => {} };
    const started = new Promise<void>((resolve) => {
      gate.started = resolve;
    });
    const finish = new Promise<void>((resolve) => {
      gate.finish = resolve;
    });
    vi.mocked(fixture.provider.upload).mockImplementation(async (id, bytes) => {
      gate.started();
      await finish;
      return upload(id, bytes);
    });
    const first = fixture.service.upload(account, fixture.request());
    await started;
    try {
      await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
        'STORAGE_QUOTA',
      );
    } finally {
      gate.finish();
    }
    await first;
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
  });
  it('counts document, branding and archive references together without multiplying logical bytes', async () => {
    const fixture = setup(100n);
    const document = await fixture.service.upload(account, fixture.request());
    const key = JSON.stringify([document.dao.chainId, document.dao.contract, document.dao.daoId]);
    await pool.query(
      `INSERT INTO hosted_references(object_id,dao_key,kind,reference_key)
      SELECT object_id,dao_key,role,role FROM hosted_references CROSS JOIN unnest(ARRAY['branding','archive','media']) role WHERE dao_key=$1`,
      [key],
    );
    expect(await fixture.service.usage(account, document.dao.daoId)).toMatchObject({
      verifiedBytes: String(document.bytes),
      totalBytes: String(document.bytes),
      reservedBytes: '0',
      objects: 1,
      references: 4,
      capacityBytes: '100',
      cleanup: 'disabled',
    });
    vi.mocked(fixture.provider.upload).mockRejectedValue(new Error('Uncertain provider upload'));
    const other = fixture.request('An unresolved upload');
    await expect(fixture.service.upload(account, other)).rejects.toThrow('UPLOAD_PENDING');
    expect(await fixture.service.usage(account, document.dao.daoId)).toMatchObject({
      verifiedBytes: String(document.bytes),
      reservedBytes: String(other.bytes),
      totalBytes: String(document.bytes + other.bytes),
    });
    fixture.content.members[0] = { ...member, active: false };
    await expect(fixture.service.usage(account, document.dao.daoId)).rejects.toThrow(
      'MEMBER_REQUIRED',
    );
  });
  it('retains all duplicate provider IDs but charges their common CID only once', async () => {
    const fixture = setup();
    const upload = vi.mocked(fixture.provider.upload).getMockImplementation();
    if (!upload) throw new Error('Provider fixture missing');
    let waiting = 0;
    const gate = { release: () => {} };
    const ready = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    vi.mocked(fixture.provider.upload).mockImplementation(async (id, bytes) => {
      if (++waiting === 2) gate.release();
      await ready;
      return upload(id, bytes);
    });
    const results = await Promise.all([
      fixture.service.upload(account, fixture.request()),
      fixture.service.upload(account, { ...fixture.request(), documentId: '8' }),
    ]);
    expect(results[0]?.cid).toBe(results[1]?.cid);
    const measured = await fixture.service.usage(account, fixture.dao.reference.daoId);
    expect(measured).toMatchObject({
      objects: 1,
      references: 2,
      verifiedBytes: '22',
      totalBytes: '22',
    });
    const pins = await pool.query<{ count: string }>(
      'SELECT count(*)::text FROM hosted_pins WHERE provider_scope=$1',
      [fixture.service.providerScope],
    );
    expect(pins.rows[0]?.count).toBe('2');
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
  it('blocks new verified references while an object is being removed', async () => {
    const fixture = setup();
    await fixture.service.upload(account, fixture.request());
    await pool.query(
      "UPDATE hosted_objects SET state='removing',generation=generation+1 WHERE provider_scope=$1",
      [fixture.service.providerScope],
    );
    const request = { ...fixture.request(), documentId: '8' };
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    expect((await fixture.service.status(account, request.requestId)).state).toBe('uploaded');
    expect((await fixture.service.usage(account, fixture.dao.reference.daoId)).references).toBe(1);
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
  it('keeps migrated ownership unclaimed until the operator verifies its provider listing and bytes', async () => {
    const fixture = setup(30n);
    const request = fixture.request();
    const pin = await fixture.provider.upload(randomUUID(), Buffer.from(request.content, 'base64'));
    const uploadId = randomUUID();
    const { content: _content, ...intent } = request;
    await pool.query(
      `INSERT INTO uploads(id,account_id,dao_key,expected_size,privacy,state,provider_id,cid,commitment,expires_at,request_id,intent,request_hash,member_id)
      VALUES($1,$2,$3,$4,'public','verified',$5,$6,$7,now(),$8,$9,$10,1)`,
      [
        uploadId,
        account.id,
        JSON.stringify([request.dao.chainId, request.dao.contract, request.dao.daoId]),
        request.bytes,
        pin.id,
        pin.cid,
        request.commitment,
        request.requestId,
        intent,
        createHash('sha256').update(JSON.stringify(intent)).digest('hex'),
      ],
    );
    expect(await fixture.service.reconcile(uploadId)).toBe('manual');
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'STORAGE_QUOTA',
    );
    await expect(
      claimLegacyUpload(pool, fixture.provider, fixture.service.providerScope, uploadId),
    ).rejects.toThrow('STORAGE_OWNERSHIP_REVIEW');
    fixture.provider.find = async () => [pin];
    vi.mocked(fixture.provider.retrieve).mockResolvedValueOnce(new Uint8Array(request.bytes));
    await expect(
      claimLegacyUpload(pool, fixture.provider, fixture.service.providerScope, uploadId),
    ).rejects.toThrow('DOCUMENT_INTEGRITY');
    await claimLegacyUpload(pool, fixture.provider, fixture.service.providerScope, uploadId);
    await fixture.service.upload(account, { ...fixture.request(), documentId: '8' });
    expect(fixture.provider.upload).toHaveBeenCalledOnce();
    await expect(claimLegacyUpload(pool, fixture.provider, randomUUID(), uploadId)).rejects.toThrow(
      'STORAGE_OWNERSHIP_REVIEW',
    );
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
  it('holds corrupt reused objects without granting another verified reference', async () => {
    const fixture = setup(30n);
    await fixture.service.upload(account, fixture.request());
    vi.mocked(fixture.provider.retrieve).mockResolvedValue(new Uint8Array(22));
    const request = { ...fixture.request(), documentId: '8' };
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    expect((await fixture.service.status(account, request.requestId)).state).toBe('uploaded');
    const result = await pool.query<{ count: string }>(
      'SELECT count(*)::text FROM hosted_references WHERE dao_key=$1',
      [JSON.stringify([request.dao.chainId, request.dao.contract, request.dao.daoId])],
    );
    expect(result.rows[0]?.count).toBe('1');
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
  it('holds a reservation when provider completion is uncertain', async () => {
    const fixture = setup(30n);
    vi.mocked(fixture.provider.upload).mockRejectedValue(
      new Error('Vendor details must stay private'),
    );
    const request = fixture.request();
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'STORAGE_QUOTA',
    );
    const rows = await pool.query<{ state: string }>(
      'SELECT state FROM uploads WHERE account_id=$1 AND request_id=$2',
      [account.id, request.requestId],
    );
    expect(rows.rows[0]?.state).toBe('reserved');
  });
  it('keeps an expired uncertain reservation and does not unpin it', async () => {
    const fixture = setup(30n);
    vi.mocked(fixture.provider.upload).mockRejectedValue(new Error('index unavailable'));
    const request = fixture.request();
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    const reserved = await pool.query<{ id: string; expected_size: string }>(
      'SELECT id,expected_size::text FROM uploads WHERE account_id=$1 AND request_id=$2',
      [account.id, request.requestId],
    );
    const id = reserved.rows[0]?.id;
    const expectedSize = reserved.rows[0]?.expected_size;
    if (!id || !expectedSize) throw new Error('UPLOAD_MISSING');
    await pool.query("UPDATE uploads SET expires_at=now()-interval '1 second' WHERE id=$1", [id]);
    expect(await fixture.service.reconcile(id)).toBe('manual');
    expect(
      (
        await pool.query<{ state: string; last_error_code: string; expected_size: string }>(
          'SELECT state,last_error_code,expected_size::text FROM uploads WHERE id=$1',
          [id],
        )
      ).rows[0],
    ).toEqual({
      state: 'reserved',
      last_error_code: 'UPLOAD_REVIEW_REQUIRED',
      expected_size: expectedSize,
    });
    expect(fixture.provider.remove).not.toHaveBeenCalled();
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'STORAGE_QUOTA',
    );
  });
  it('requires the active on-chain member and the full deployment reference', async () => {
    const fixture = setup();
    fixture.content.members[0] = { ...member, active: false };
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'MEMBER_REQUIRED',
    );
    const other = setup();
    await expect(
      other.service.upload(account, {
        ...other.request(),
        dao: { ...other.dao.reference, contract: 'daclifytwo' },
      }),
    ).rejects.toThrow('DAO_REFERENCE');
    expect(other.provider.upload).not.toHaveBeenCalled();
  });
  it('checks the declared byte digest before contacting the provider', async () => {
    const fixture = setup();
    await expect(
      fixture.service.upload(account, { ...fixture.request(), commitment: '00'.repeat(32) }),
    ).rejects.toThrow('DOCUMENT_INTEGRITY');
    expect(fixture.provider.upload).not.toHaveBeenCalled();
  });
  it('does not verify a corrupt gateway response', async () => {
    const fixture = setup();
    vi.mocked(fixture.provider.retrieve).mockResolvedValue(new Uint8Array(22));
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'UPLOAD_PENDING',
    );
    const result = await pool.query<{ state: string }>(
      'SELECT state FROM uploads WHERE account_id=$1 AND dao_key=$2',
      [account.id, JSON.stringify([network.chainId, network.runtime, fixture.dao.reference.daoId])],
    );
    expect(result.rows[0]?.state).not.toBe('verified');
  });
  it('requires a committed encryption epoch and a valid private envelope structure', async () => {
    const fixture = setup();
    fixture.dao.privacy = 'encrypted-user-controlled';
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'PRIVACY_ENVELOPE',
    );
    const envelope = JSON.stringify({
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: Buffer.alloc(12, 1).toString('base64'),
      ciphertext: Buffer.alloc(32, 2).toString('base64'),
    });
    const privateRequest = {
      ...fixture.request(envelope),
      envelopeVersion: 1 as const,
      keyEpoch: '1',
    };
    await expect(fixture.service.upload(account, privateRequest)).rejects.toThrow(
      'EPOCH_UNAVAILABLE',
    );
    fixture.content.epochs.push({ epoch: '1', commitment: '33'.repeat(32), creator: '1' });
    expect((await fixture.service.upload(account, privateRequest)).envelopeVersion).toBe(1);
  });
  it('reconciles a lost provider response without another upload', async () => {
    const fixture = setup();
    const request = fixture.request();
    let file: { id: string; cid: string; size: number } | undefined;
    vi.mocked(fixture.provider.upload).mockImplementation(async (_id, bytes) => {
      const cid = CID.createV1(
        0x55,
        create(0x12, createHash('sha256').update(bytes).digest()),
      ).toString();
      stored.set(cid, bytes.slice());
      file = { id: randomUUID(), cid, size: bytes.length };
      throw new Error('Response lost after the provider stored it');
    });
    fixture.provider.find = async () => (file ? [file] : []);
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    const status = await fixture.service.refreshStatus(account, request.requestId);
    expect(status.state).toBe('verified');
    expect(status.document?.commitment).toBe(request.commitment);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
  });
  it('returns the same verified receipt when a worker and a user reconcile concurrently', async () => {
    const fixture = setup();
    const request = fixture.request();
    let file: { id: string; cid: string; size: number } | undefined;
    vi.mocked(fixture.provider.upload).mockImplementation(async (_id, bytes) => {
      const cid = CID.createV1(
        0x55,
        create(0x12, createHash('sha256').update(bytes).digest()),
      ).toString();
      file = { id: randomUUID(), cid, size: bytes.length };
      throw new Error('Response lost');
    });
    fixture.provider.find = async () => (file ? [file] : []);
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    const gate = { release: () => {} };
    const wait = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    let readers = 0;
    vi.mocked(fixture.provider.retrieve).mockImplementation(async () => {
      if (++readers === 2) gate.release();
      await wait;
      return Buffer.from(request.content, 'base64');
    });
    const results = await Promise.all([
      fixture.service.refreshStatus(account, request.requestId),
      fixture.service.refreshStatus(account, request.requestId),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]?.state).toBe('verified');
    const audits = await pool.query<{ count: string }>(
      "SELECT count(*)::text FROM audit_events WHERE kind='content.verified' AND public_reference->>'uploadId'=(SELECT id::text FROM uploads WHERE account_id=$1 AND request_id=$2)",
      [account.id, request.requestId],
    );
    expect(audits.rows[0]?.count).toBe('1');
  });
  it('does not treat a matching chain record as verification of corrupt stored bytes', async () => {
    const fixture = setup();
    const request = fixture.request();
    vi.mocked(fixture.provider.retrieve).mockResolvedValue(new Uint8Array(request.bytes));
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    const value = (
      await pool.query<{ cid: string; provider_id: string }>(
        'SELECT cid,provider_id FROM uploads WHERE account_id=$1 AND request_id=$2',
        [account.id, request.requestId],
      )
    ).rows[0];
    if (!value) throw new Error('Upload fixture missing');
    fixture.provider.find = async () => [
      { id: value.provider_id, cid: value.cid, size: request.bytes },
    ];
    fixture.content.documents.push({
      id: '1',
      document_id: request.documentId,
      version: request.version,
      author: '1',
      cid: value.cid,
      metadata: request.metadata,
      commitment: request.commitment,
      bytes: request.bytes,
      envelope_version: request.envelopeVersion,
      key_epoch: request.keyEpoch,
    });
    await expect(fixture.service.refreshStatus(account, request.requestId)).rejects.toThrow(
      'DOCUMENT_INTEGRITY',
    );
    expect((await fixture.service.status(account, request.requestId)).state).toBe('uploaded');
  });
  it('reports publication from exact chain records and keeps receipt access after offboarding', async () => {
    const fixture = setup();
    const request = fixture.request();
    const document = await fixture.service.upload(account, request);
    fixture.content.documents.push({
      id: '1',
      document_id: document.documentId,
      version: document.version,
      author: '1',
      cid: document.cid,
      metadata: document.metadata,
      commitment: document.commitment,
      bytes: document.bytes,
      envelope_version: document.envelopeVersion,
      key_epoch: document.keyEpoch,
    });
    fixture.content.members[0] = { ...member, active: false };
    const status = await fixture.service.refreshStatus(account, request.requestId);
    expect(status.state).toBe('published');
    expect((await fixture.service.upload(account, request)).cid).toBe(document.cid);
    expect(
      await fixture.service.retrieve(
        fixture.dao.reference.daoId,
        document.documentId,
        document.version,
      ),
    ).toEqual(Buffer.from(request.content, 'base64'));
  });
  it('requires the receipt owner and does not release uncertain expired pins', async () => {
    const fixture = setup(30n);
    const request = fixture.request();
    vi.mocked(fixture.provider.upload).mockRejectedValue(new Error('Uncertain provider result'));
    await expect(fixture.service.upload(account, request)).rejects.toThrow('UPLOAD_PENDING');
    await expect(
      fixture.service.status({ ...account, id: randomUUID() }, request.requestId),
    ).rejects.toThrow('UPLOAD_UNKNOWN');
    await pool.query(
      "UPDATE uploads SET expires_at=now()-interval '1 second' WHERE account_id=$1 AND request_id=$2",
      [account.id, request.requestId],
    );
    await fixture.service.refreshStatus(account, request.requestId);
    await expect(fixture.service.upload(account, fixture.request())).rejects.toThrow(
      'STORAGE_QUOTA',
    );
    expect(fixture.provider.remove).not.toHaveBeenCalled();
  });
});
