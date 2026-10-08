import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import {
  ArchiveRoutes,
  OrdinaryPollArchivePlanSchema,
  archiveSourceSchema,
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
  const dao = {
    chainId: 'ef'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
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
    app = await createServer(pool, chain, origin),
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
    delete chain.archivePreview;
    expect((await app.inject(request)).statusCode).toBe(503);
  } finally {
    await app.close();
  }
});
