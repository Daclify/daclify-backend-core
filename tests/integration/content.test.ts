import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { generateKeyPairSync, randomUUID, createHash } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { AccountSchema, DaoSummarySchema, NetworkSchema } from '../../protocol/api.js';
import { DaoContentSchema } from '../../protocol/content.js';
import { HostedUploadSchema } from '../../protocol/storage.js';
import { RuntimeTableSchemas } from '../../sdk/index.js';
import { ContentService } from '../../services/api/src/content/service.js';
import type { ContentProvider } from '../../services/api/src/content/provider.js';
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
function setup(allowance = 1000n) {
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
    memberships: async () => [],
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
      return { id: randomUUID(), cid, size: bytes.length };
    }),
    retrieve: vi.fn(async (cid: string) => {
      const bytes = stored.get(cid);
      if (!bytes) throw new Error('Missing fixture file');
      return bytes.slice();
    }),
    find: async () => [],
    remove: vi.fn(async () => {}),
  };
  const service = new ContentService(pool, chain, provider, allowance);
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
  return { dao, content, provider, service, request };
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
  it('verifies reconstructed bytes and reuses an identical request receipt', async () => {
    const fixture = setup();
    const request = fixture.request();
    const first = await fixture.service.upload(account, request);
    const second = await fixture.service.upload(account, request);
    expect(second).toEqual(first);
    expect(first.commitment).toBe(request.commitment);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
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
  it('reserves quota once under concurrent requests', async () => {
    const fixture = setup(30n);
    const result = await Promise.allSettled([
      fixture.service.upload(account, fixture.request()),
      fixture.service.upload(account, fixture.request()),
    ]);
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(fixture.provider.upload).toHaveBeenCalledTimes(1);
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
