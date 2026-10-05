import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import {
  ChallengeSchema,
  SessionSchema,
  DaoSummarySchema,
  UserMembershipSchema,
} from '../../protocol/api.js';
import { ModuleStateSchema } from '@daclify/modules';
import { encodeDecide } from '@daclify/modules/sdk';
import { makeInstruction, encodeAction, instructionDigest } from '../../sdk/index.js';
const url = process.env.DATABASE_URL;
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Local isolated test database required');
const network = z
  .object({ url: z.string(), chainId: z.string() })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const key = PrivateKey.generate('K1');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
const chain = new NativeChainGateway({
  rpcUrl: network.url,
  chainId: network.chainId,
  runtime: 'daclifycore',
  hub: 'daclifyhub',
  environment: 'local',
  relayActor: 'relay',
  relayKey: fixtureKey('relay'),
  bootstrap: { owner: 'alice', key: fixtureKey('alice') },
  modules: [
    { id: 'decide', account: 'decide' },
    { id: 'works', account: 'works' },
    { id: 'payroll', account: 'payroll' },
  ],
});
const app = await createServer(pool, chain, origin);
let cookie = '';
let csrf = '';
let dao: z.infer<typeof DaoSummarySchema>;
beforeAll(async () => {
  unlockFixtureWallet('daclify-v2-native');
  await migrate(pool);
  const c = ChallengeSchema.parse(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/challenge',
        headers: { origin },
        payload: { signingKey: key.toPublic().toString() },
      })
    ).json(),
  );
  const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { origin },
    payload: {
      challengeId: c.id,
      signature: key.signMessage(new TextEncoder().encode(c.message)).toString(),
      encryptionKey: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    },
  });
  csrf = SessionSchema.parse(response.json()).csrfToken;
  cookie = response.cookies.map((c) => `${c.name}=${c.value}`).join(';');
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
describe('API to real native runtime', () => {
  it('creates a shared DAO and walletless administrator atomically', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/daos',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload: {
        metadata: { schemaVersion: 1, title: 'API native DAO', description: '' },
        privacy: 'public',
        token: { chainId: network.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
      },
    });
    expect(response.statusCode, response.body).toBe(201);
    dao = DaoSummarySchema.parse(response.json());
    expect(dao.members).toBe(1);
    const membership = z
      .object({ memberships: z.array(UserMembershipSchema) })
      .parse((await app.inject({ url: '/v1/me/memberships', headers: { cookie } })).json())
      .memberships.find((m) => m.dao.daoId === dao.reference.daoId);
    expect(membership?.admin).toBe(true);
    expect(membership?.nativeAccount).toBe('');
  });
  it('relays a user instruction and rejects replay', async () => {
    const request = makeInstruction(
      dao.reference,
      '1',
      '0',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        metadata: JSON.stringify({
          schemaVersion: 1,
          title: 'Renamed by internal key',
          description: '',
        }),
      }),
    );
    const payload = { request, sig: key.signDigest(instructionDigest(request)).toString() };
    const response = await app.inject({
      method: 'POST',
      url: '/v1/relay',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(
      z.object({ transactionId: z.string() }).parse(response.json()).transactionId,
    ).toHaveLength(64);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/relay',
          headers: { origin, cookie, 'x-csrf-token': csrf },
          payload,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('enables a matching Decide release and records a real internal vote', async () => {
    const install = makeInstruction(
      dao.reference,
      '1',
      '1',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'modconfig',
      encodeAction('modconfig', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        account: 'decide',
        version: 1,
        actions: ['open', 'vote'],
        grants: ['govlock'],
      }),
    );
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/relay',
          headers: { origin, cookie, 'x-csrf-token': csrf },
          payload: { request: install, sig: key.signDigest(instructionDigest(install)).toString() },
        })
      ).statusCode,
    ).toBe(200);
    const opened = makeInstruction(
      dao.reference,
      '1',
      '2',
      Math.floor(Date.now() / 1000) + 300,
      'decide',
      'open',
      encodeDecide('open', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        ballot_id: dao.reference.daoId,
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    const openResponse = await app.inject({
      method: 'POST',
      url: '/v1/relay',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload: { request: opened, sig: key.signDigest(instructionDigest(opened)).toString() },
    });
    expect(openResponse.statusCode, openResponse.body).toBe(200);
    const voted = makeInstruction(
      dao.reference,
      '1',
      '3',
      Math.floor(Date.now() / 1000) + 300,
      'decide',
      'vote',
      encodeDecide('vote', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        ballot_id: dao.reference.daoId,
        choice: 1,
      }),
    );
    const voteResponse = await app.inject({
      method: 'POST',
      url: '/v1/relay',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload: { request: voted, sig: key.signDigest(instructionDigest(voted)).toString() },
    });
    expect(voteResponse.statusCode, voteResponse.body).toBe(200);
    const stateResponse = await app.inject(`/v1/daos/${dao.reference.daoId}/modules`);
    expect(stateResponse.statusCode).toBe(200);
    const state = ModuleStateSchema.parse(stateResponse.json());
    expect(state.ballots[0]?.cast).toBe('1');
    expect(state.modules.find((m) => m.deployment.id === 'decide')?.codeVerified).toBe(true);
  });
  it('publishes inline JSON and reads durable content without transaction history', async () => {
    const request = makeInstruction(
      dao.reference,
      '1',
      '4',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        document_id: '17',
        version: 1,
        value: '{"text":"durable JSON"}',
        envelope_version: 0,
        key_epoch: '0',
      }),
    );
    const submitted = await app.inject({
      method: 'POST',
      url: '/v1/relay',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload: { request, sig: key.signDigest(instructionDigest(request)).toString() },
    });
    expect(submitted.statusCode, submitted.body).toBe(200);
    const response = await app.inject(`/v1/daos/${dao.reference.daoId}/content`);
    expect(response.statusCode).toBe(200);
    const content = z
      .object({
        documents: z.array(
          z.object({ document_id: z.string(), metadata: z.string(), cid: z.string() }),
        ),
        members: z.array(z.object({ id: z.string() })),
      })
      .parse(response.json());
    expect(content.documents[0]).toMatchObject({
      document_id: '17',
      metadata: '{"text":"durable JSON"}',
      cid: '',
    });
    expect(content.members[0]?.id).toBe('1');
  });
  it('rejects a proof made by a different key before relay', async () => {
    const request = makeInstruction(
      dao.reference,
      '1',
      '1',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        runtime: 'daclifycore',
        dao_id: dao.reference.daoId,
        member_id: '1',
        metadata: '{}',
      }),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/v1/relay',
      headers: { origin, cookie, 'x-csrf-token': csrf },
      payload: {
        request,
        sig: PrivateKey.generate('K1').signDigest(instructionDigest(request)).toString(),
      },
    });
    expect(response.statusCode).toBe(403);
  });
});
