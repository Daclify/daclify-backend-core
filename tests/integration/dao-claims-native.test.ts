import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { PrivateKey } from '@wharfkit/antelope';
import { Pool } from 'pg';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import { controlledInject } from '../helpers/account-control.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { CreationService } from '../../services/api/src/creation.js';
import { DaoClaimLinks } from '../../services/api/src/dao-claims.js';
import { createServer } from '../../services/api/src/server.js';
import { migrate } from '../../services/api/src/store.js';
import {
  ApiRoutes,
  DaoClaimRoutes,
  defaultDaoSetup,
  privateCreationCommitment,
} from '../../protocol/index.js';
import { encodeAction } from '../../sdk/index.js';
import { PrivateFounderSetupSchema } from '../../protocol/private-records.js';

const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || !new URL(url).pathname.endsWith('_test'))
  throw Error('Owned database required');
const pool = new Pool({ connectionString: url });
const origin = 'http://localhost:5178';
let native: NativeContracts;
let chain: NativeChainGateway;
let server: Awaited<ReturnType<typeof createServer>>;
let executive: Awaited<ReturnType<typeof login>>;
let first: Awaited<ReturnType<typeof login>>;
let second: Awaited<ReturnType<typeof login>>;
async function login(root = PrivateKey.generate('K1')) {
  const encryptionKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const start = await server.inject({
    method: 'POST',
    url: ApiRoutes.challenge.path,
    headers: { origin },
    payload: { signingKey: root.toPublic().toString(), encryptionKey },
  });
  const challenge = ApiRoutes.challenge.response.parse(start.json());
  const finish = await server.inject({
    method: 'POST',
    url: ApiRoutes.login.path,
    headers: { origin },
    payload: {
      challengeId: challenge.id,
      signature: root.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
    },
  });
  expect(finish.statusCode, finish.body).toBe(200);
  const session = ApiRoutes.login.response.parse(finish.json());
  return {
    root,
    account: session.account,
    headers: {
      origin,
      cookie: finish.cookies.map((c) => c.name + '=' + c.value).join('; '),
      'x-csrf-token': session.csrfToken,
    },
  };
}
const issue = async () => {
  const response = await controlledInject(server, executive.root, {
    method: 'POST',
    url: DaoClaimRoutes.daoClaimIssue.path,
    headers: executive.headers,
    payload: {
      request: {
        metadata: { schemaVersion: 1, title: 'Native claimed community' },
        privacy: 'public',
        token: { chainId: native.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
        setup: defaultDaoSetup('custom'),
      },
    },
  });
  expect(response.statusCode, response.body).toBe(200);
  return DaoClaimRoutes.daoClaimIssue.response.parse(response.json());
};
beforeAll(async () => {
  await migrate(pool);
  native = await nativeContracts();
  await native.push(
    contextLinkRepairActions(native.context, await native.api.v1.chain.get_account('daclifycore')),
    [native.key('daclifycore')],
  );
  const governing = await native.executiveTree();
  await native.call('daclifycore', 'setgov', { dao_id: governing.daoId }, 'daclifycore', 'owner', [
    native.key('recovery'),
  ]);
  await governing.act(
    'daclifycore',
    'govcreate',
    encodeAction('govcreate', {
      ...governing.actor(),
      shared_usd: 0,
      independent_usd: 5000,
      premium_bps: 2000,
      settler: 'relay',
    }),
  );
  await governing.act(
    'daclifycore',
    'govhosted',
    encodeAction('govhosted', { ...governing.actor(), free_members: 10, settler: 'relay' }),
  );
  chain = new NativeChainGateway(
    {
      rpcUrl: native.url,
      chainId: native.chainId,
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      relayActor: 'relay',
      relayKey: native.key('relay'),
      modules: nativeModules,
      bootstrap: { owner: 'daclifycore', key: native.key('relay') },
    },
    pool,
  );
  const creation = new CreationService(pool, chain);
  server = await createServer(pool, chain, origin, {
    apiOrigin: 'http://localhost:3008',
    creation,
    daoClaims: new DaoClaimLinks(pool, chain, creation),
  });
  const key = governing.keys[0];
  if (!key) throw Error('Owned executive absent');
  executive = await login(key);
  first = await login();
  second = await login();
}, 90000);
afterAll(async () => {
  await server?.close();
  await native?.stop();
  await pool.end();
});
it('uses a real current native executive and rejects missing approval and CSRF', async () => {
  // A freshly installed office is visible in pending state before its block becomes the chain head.
  await expect
    .poll(
      async () => {
        const eligibility = await server.inject({
          method: 'GET',
          url: DaoClaimRoutes.daoClaimEligibility.path,
          headers: executive.headers,
        });
        expect(eligibility.statusCode, eligibility.body).toBe(200);
        return DaoClaimRoutes.daoClaimEligibility.response.parse(eligibility.json()).eligible;
      },
      { timeout: 5000 },
    )
    .toBe(true);
  const missing = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimIssue.path,
    headers: executive.headers,
    payload: {},
  });
  expect(missing.statusCode).toBe(403);
  const link = await issue();
  const noCsrf = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimConfirm.path,
    headers: { origin, cookie: first.headers.cookie },
    payload: { token: link.token, method: 'free' },
  });
  expect(noCsrf.json().code).toBe('CSRF_REQUIRED');
  const nonExecutive = await controlledInject(server, first.root, {
    method: 'POST',
    url: DaoClaimRoutes.daoClaimIssue.path,
    headers: first.headers,
    payload: { request: link.claim.request },
  });
  expect(nonExecutive.json().code).toBe('DAO_CLAIM_EXECUTIVE_REQUIRED');
});
it('anonymous preview allocates nothing; two confirmations create one sole native admin and executive', async () => {
  const link = await issue();
  const before = await chain.listDaos();
  const authority = (await native.api.v1.chain.get_account('daclifycore')).permissions;
  const platform = await chain.platform();
  if (!platform.platformDao) throw Error('Owned governing DAO absent');
  const offices = await chain.governance(platform.platformDao.daoId);
  for (let n = 0; n < 2; n++) {
    const preview = await server.inject({
      method: 'POST',
      url: DaoClaimRoutes.daoClaimPreview.path,
      headers: { origin },
      payload: { token: link.token },
    });
    expect(preview.statusCode, preview.body).toBe(200);
  }
  expect(
    (await pool.query('SELECT 1 FROM creation_orders WHERE id=$1', [link.claim.id])).rowCount,
  ).toBe(0);
  expect(await chain.listDaos()).toHaveLength(before.length);
  const results = await Promise.all(
    [first, second].map((current) =>
      server.inject({
        method: 'POST',
        url: DaoClaimRoutes.daoClaimConfirm.path,
        headers: current.headers,
        payload: { token: link.token, method: 'free' },
      }),
    ),
  );
  expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  const winnerIndex = results.findIndex((r) => r.statusCode === 200),
    winner = winnerIndex === 0 ? first : second;
  const result = DaoClaimRoutes.daoClaimConfirm.response.parse(results[winnerIndex]?.json());
  expect(result).toMatchObject({ state: 'created', founderExecutive: true });
  if (!result.dao) throw Error('Owned creation absent');
  expect(await chain.listDaos()).toHaveLength(before.length + 1);
  expect((await chain.dao(result.dao.daoId)).members).toBe(1);
  expect((await chain.governance(result.dao.daoId)).executiveMembers).toMatchObject([
    { id: '1', admin: true, active: true, signing_key: winner.account.signingKey },
  ]);
  expect((await native.api.v1.chain.get_account('daclifycore')).permissions).toEqual(authority);
  expect((await chain.governance(platform.platformDao.daoId)).executives).toEqual(
    offices.executives,
  );
  const resumed = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimConfirm.path,
    headers: winner.headers,
    payload: { token: link.token, method: 'free' },
  });
  expect(resumed.statusCode, resumed.body).toBe(200);
  expect(resumed.json().dao).toEqual(result.dao);
});
it('reconciles an actual native commit when its API response is lost', async () => {
  const link = await issue();
  const before = await chain.listDaos();
  const realCreate = chain.createDao.bind(chain);
  const loss = vi.spyOn(chain, 'createDao').mockImplementationOnce(async (...args) => {
    await realCreate(...args);
    throw Error('Owned response-loss simulation');
  });
  const lost = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimConfirm.path,
    headers: first.headers,
    payload: { token: link.token, method: 'free' },
  });
  loss.mockRestore();
  expect(lost.statusCode).toBe(500);
  const resumed = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimConfirm.path,
    headers: first.headers,
    payload: { token: link.token, method: 'free' },
  });
  expect(resumed.statusCode, resumed.body).toBe(200);
  expect(resumed.json().founderExecutive).toBe(true);
  expect(await chain.listDaos()).toHaveLength(before.length + 1);
});
it('creates only an opaque private DAO for the claimant and leaves content initialization to their original keys', async () => {
  const setup = defaultDaoSetup('custom'),
    envelope = {
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: btoa('i'.repeat(12)),
      ciphertext: btoa('c'.repeat(32)),
    };
  const draft = {
    schemaVersion: 1,
    stage: 'invitation',
    daoId: '987654321',
    documentId: '41',
    contextCommitment: 'aa'.repeat(32),
    envelope,
  };
  const request = {
    metadata: {
      schemaVersion: 4,
      title: 'Private DAO',
      description: '',
      purpose: 'custom',
      setup,
      privateIdentity: null,
    },
    privacy: 'encrypted-user-controlled',
    token: { chainId: native.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
    setup,
    privateSetup: draft,
  };
  draft.contextCommitment = privateCreationCommitment(
    { chainId: native.chainId, contract: 'daclifycore', daoId: draft.daoId, interfaceVersion: 1 },
    request,
  );
  const issued = await controlledInject(server, executive.root, {
    method: 'POST',
    url: DaoClaimRoutes.daoClaimIssue.path,
    headers: executive.headers,
    payload: { request },
  });
  expect(issued.statusCode, issued.body).toBe(200);
  const invitation = DaoClaimRoutes.daoClaimIssue.response.parse(issued.json());
  const incomplete = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimConfirm.path,
    headers: first.headers,
    payload: { token: invitation.token, method: 'free' },
  });
  expect(incomplete.json().code).toBe('PRIVATE_FOUNDER_REQUIRED');
  const privateSetup = PrivateFounderSetupSchema.parse({
    ...draft,
    stage: 'founder',
    epochCommitment: 'ac'.repeat(32),
    selfGrant: {
      version: 1,
      ephemeralKey: first.account.encryptionKey,
      salt: btoa('s'.repeat(32)),
      envelope,
    },
  });
  const confirmed = await server.inject({
    method: 'POST',
    url: DaoClaimRoutes.daoClaimConfirm.path,
    headers: first.headers,
    payload: { token: invitation.token, method: 'free', privateSetup },
  });
  expect(confirmed.statusCode, confirmed.body).toBe(200);
  const result = DaoClaimRoutes.daoClaimConfirm.response.parse(confirmed.json());
  expect(result.dao?.daoId).toBe(draft.daoId);
  expect((await chain.privateIdentity(draft.daoId)).metadata).toMatchObject({
    schemaVersion: 4,
    title: 'Private DAO',
    privateIdentity: null,
    setup,
  });
  const members = (await chain.governance(draft.daoId)).executiveMembers;
  expect(members).toMatchObject([
    { id: '1', active: true, admin: true, signing_key: first.account.signingKey },
  ]);
  expect(members.some((row) => row.signing_key === executive.account.signingKey)).toBe(false);
  expect((await chain.content(draft.daoId)).keyGrants).toEqual([]);
  expect((await chain.content(draft.daoId)).epochs).toEqual([]);
});
it('bounds anonymous preview requests without revealing raw invitation secrets', async () => {
  let status = 0;
  for (let n = 0; n < 61; n++)
    status = (
      await server.inject({
        method: 'POST',
        url: DaoClaimRoutes.daoClaimPreview.path,
        headers: { origin },
        payload: { token: 'x'.repeat(43) },
      })
    ).statusCode;
  expect(status).toBe(429);
});
