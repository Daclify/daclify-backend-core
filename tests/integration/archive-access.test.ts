import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EncryptedArchiveBackup } from '../../services/api/src/archive/backup.js';
import { generateKeyPairSync, randomUUID, randomBytes, createHash } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { create } from 'multiformats/hashes/digest';
import { PrivateKey } from '@wharfkit/antelope';
import {
  ArchiveRoutes,
  OrdinaryPollArchivePlanSchema,
  archiveSourceSchema,
  archiveExportConsent,
} from '@daclify/modules/archive';
import {
  AccountSchema,
  ChallengeSchema,
  SessionSchema,
  NetworkSchema,
  UserMembershipSchema,
} from '../../protocol/api.js';
import { VERSION } from '../../protocol/base.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import type { ChainGateway } from '../../services/api/src/chain.js';
import { ContentService } from '../../services/api/src/content/service.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith('_test')
)
  throw new Error('Owned local *_test database required');
const pool = new Pool({ connectionString: url }),
  key = PrivateKey.generate('K1');
const encryption = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
  format: 'jwk',
});
const account = AccountSchema.parse({
  id: randomUUID(),
  custody: 'user-controlled',
  signingKey: key.toPublic().toString(),
  encryptionKey: encryption,
});
beforeAll(async () => {
  await migrate(pool);
  await pool.query(
    'INSERT INTO accounts(id,signing_key,custody,encryption_key) VALUES($1,$2,$3,$4)',
    [account.id, account.signingKey, account.custody, account.encryptionKey],
  );
});
afterAll(() => pool.end());
const unavailable = async (): Promise<never> => {
  throw new Error('Not part of archive fixture');
};
it('requires session/CSRF/current administrator and binds the readonly result to the exact deployment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'daclify-api-backup-'));
  const dao = {
    chainId: 'ef'.repeat(32),
    contract: 'daclifycore',
    daoId: randomBytes(4).readUInt32BE().toString(),
    interfaceVersion: 1 as const,
  };
  let admin = true,
    active = true;
  const source = archiveSourceSchema('ordinary-poll-votes');
  const plan = OrdinaryPollArchivePlanSchema.parse({
    dao,
    source: { account: 'decide', codeHash: source.codeHash, abiHash: source.rawAbiHash },
    snapshot: {
      blockNumber: 1,
      blockId: '00000001' + 'ab'.repeat(28),
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    pruningAuthorized: false,
    grossRamBytes: '0',
    families: [],
    blocked: [{ parentId: '7', reason: 'terminal-marker-required' }],
  });
  const read = vi.fn(async () => plan);
  const chain: ChainGateway = {
    archivePreview: read,
    network: async () =>
      NetworkSchema.parse({
        chainId: dao.chainId,
        rpcUrl: 'http://127.0.0.1:20588',
        runtime: dao.contract,
        hub: null,
        environment: 'local',
        interfaceVersion: 1,
        coreVersion: VERSION,
        capabilities: [],
      }),
    memberships: async () => [
      UserMembershipSchema.parse({
        dao,
        memberId: '1',
        active,
        admin,
        reviewer: false,
        nonce: '0',
        credits: '0',
        claim: '0',
        stake: '0',
        nativeAccount: '',
        custody: 'user-controlled',
      }),
    ],
    governance: unavailable,
    execute: unavailable,
    treasury: unavailable,
    settle: unavailable,
    finalize: unavailable,
    content: unavailable,
    dao: unavailable,
    moduleState: unavailable,
    listDaos: unavailable,
    memberProfile: unavailable,
    createDao: unavailable,
    relay: unavailable,
  };
  const origin = 'http://localhost:5208',
    files = new Map<string, Uint8Array>(),
    content = new ContentService(
      pool,
      chain,
      {
        upload: async (_id, bytes) => {
          const cid = CID.createV1(
            0x55,
            create(0x12, createHash('sha256').update(bytes).digest()),
          ).toString();
          files.set(cid, bytes.slice());
          return { id: randomUUID(), cid, size: bytes.length };
        },
        retrieve: async (cid) => {
          const bytes = files.get(cid);
          if (!bytes) throw new Error('Missing fixture file');
          return bytes.slice();
        },
        find: async () => [],
        remove: async () => {
          throw new Error('Archive must not remove pins');
        },
      },
      10_000n,
      'local-fixture',
      randomUUID(),
      new EncryptedArchiveBackup({
        directory,
        key: randomBytes(32),
        keyId: 'api-fixture-key',
        storeId: 'api-fixture-backup',
      }),
    ),
    app = await createServer(pool, chain, origin, { content }),
    payload = { dao, ballotIds: ['7'], retentionSeconds: 90 * 86400 },
    path = ArchiveRoutes.preview.path;
  try {
    expect(
      (await app.inject({ method: 'POST', url: path, payload, headers: { origin } })).statusCode,
    ).toBe(401);
    const challenge = ChallengeSchema.parse(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/auth/challenge',
          headers: { origin },
          payload: { signingKey: account.signingKey },
        })
      ).json(),
    );
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin },
      payload: {
        challengeId: challenge.id,
        signature: key.signMessage(new TextEncoder().encode(challenge.message)).toString(),
        encryptionKey: account.encryptionKey,
      },
    });
    const session = SessionSchema.parse(login.json());
    const headers = {
      origin,
      cookie: login.cookies.map((c) => c.name + '=' + c.value).join(';'),
      'x-csrf-token': session.csrfToken,
    };
    const request = { method: 'POST' as const, url: path, payload, headers };
    expect(
      (await app.inject({ ...request, headers: { ...headers, 'x-csrf-token': '' } })).statusCode,
    ).toBe(403);
    const accepted = await app.inject(request);
    expect(accepted.statusCode).toBe(200);
    expect(ArchiveRoutes.preview.response.parse(accepted.json())).toEqual(plan);
    expect(read).toHaveBeenCalledTimes(1);
    admin = false;
    expect((await app.inject(request)).statusCode).toBe(403);
    admin = true;
    active = false;
    expect((await app.inject(request)).statusCode).toBe(403);
    active = true;
    expect(
      (
        await app.inject({
          ...request,
          payload: { ...payload, dao: { ...dao, contract: 'daoother' } },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ ...request, payload: { ...payload, retentionSeconds: 1 } })).statusCode,
    ).toBe(400);
    expect(read).toHaveBeenCalledTimes(1);
    read.mockImplementationOnce(async () => ({ ...plan, dao: { ...dao, daoId: '2' } }));
    expect((await app.inject(request)).statusCode).toBe(503);
    const eligible = {
        ...plan,
        blocked: [],
        families: [
          { kind: 'ordinary-poll-votes' as const, parentId: '7', grossRamBytes: '0', chunks: [] },
        ],
      },
      exportPayload = {
        requestId: randomUUID(),
        selection: payload,
        ...archiveExportConsent(eligible),
      },
      exportRequest = {
        method: 'POST' as const,
        url: ArchiveRoutes.export.path,
        payload: exportPayload,
        headers,
      };
    expect((await app.inject({ ...exportRequest, headers: { origin } })).statusCode).toBe(401);
    expect(
      (await app.inject({ ...exportRequest, headers: { ...headers, 'x-csrf-token': '' } }))
        .statusCode,
    ).toBe(403);
    admin = false;
    expect((await app.inject(exportRequest)).statusCode).toBe(403);
    admin = true;
    read.mockImplementationOnce(async () => eligible);
    const exported = await app.inject(exportRequest);
    expect(exported.statusCode).toBe(200);
    const status = ArchiveRoutes.export.response.parse(exported.json());
    expect(status.pruningAuthorized).toBe(false);
    const statusPath = ArchiveRoutes.status.path.replace(':id', status.id);
    expect((await app.inject({ url: statusPath })).statusCode).toBe(401);
    expect((await app.inject({ url: statusPath, headers })).statusCode).toBe(200);
    const refresh = {
      method: 'POST' as const,
      url: ArchiveRoutes.reconcile.path.replace(':id', status.id),
      payload: {},
      headers,
    };
    expect(
      (await app.inject({ ...refresh, headers: { ...headers, 'x-csrf-token': '' } })).statusCode,
    ).toBe(403);
    const ready = await app.inject(refresh);
    expect(ready.statusCode).toBe(200);
    expect(ArchiveRoutes.reconcile.response.parse(ready.json())).toMatchObject({
      state: 'verified',
      heldBytes: '0',
      pruningAuthorized: false,
    });
    const download = await app.inject({
      url: ArchiveRoutes.bundle.path.replace(':id', status.id),
      headers,
    });
    expect(download.statusCode).toBe(200);
    expect(ArchiveRoutes.bundle.response.parse(download.json()).manifest.families[0]?.records).toBe(
      '0',
    );
    const manifest = ArchiveRoutes.reconcile.response.parse(ready.json()).manifest;
    if (!manifest) throw new Error('Archive fixture requires manifest');
    const backupRequest = {
      method: 'POST' as const,
      url: ArchiveRoutes.backup.path.replace(':id', status.id),
      headers,
      payload: { expectedManifestCommitment: manifest.commitment },
    };
    expect((await app.inject({ ...backupRequest, headers: { origin } })).statusCode).toBe(401);
    expect(
      (await app.inject({ ...backupRequest, headers: { ...headers, 'x-csrf-token': '' } }))
        .statusCode,
    ).toBe(403);
    admin = false;
    expect((await app.inject(backupRequest)).statusCode).toBe(403);
    admin = true;
    expect(
      (
        await app.inject({
          ...backupRequest,
          payload: { expectedManifestCommitment: '00'.repeat(32) },
        })
      ).statusCode,
    ).toBe(409);
    const backupResponse = await app.inject(backupRequest);
    expect(backupResponse.statusCode).toBe(200);
    expect(ArchiveRoutes.backup.response.parse(backupResponse.json())).toMatchObject({
      pruningAuthorized: false,
      backupSupported: true,
      backup: { manifestCommitment: manifest.commitment },
    });
    const attestRequest = {
      method: 'POST' as const,
      url: ArchiveRoutes.attest.path.replace(':id', status.id),
      headers,
      payload: {
        manifestCommitment: manifest.commitment,
        descriptorCommitment: 'ab'.repeat(32),
        backupCommitment: 'cd'.repeat(32),
        retentionSeconds: 90 * 86400,
      },
    };
    expect((await app.inject({ ...attestRequest, headers: { origin } })).statusCode).toBe(401);
    expect(
      (await app.inject({ ...attestRequest, headers: { ...headers, 'x-csrf-token': '' } }))
        .statusCode,
    ).toBe(403);
    admin = false;
    expect((await app.inject(attestRequest)).statusCode).toBe(403);
    admin = true;
    expect((await app.inject(attestRequest)).statusCode).toBe(503);
    delete chain.archivePreview;
    expect((await app.inject(request)).statusCode).toBe(503);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
