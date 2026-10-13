import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { PrivateKey } from '@wharfkit/antelope';
import { createHash, randomBytes, generateKeyPairSync } from 'node:crypto';
import { z } from 'zod';
import { migrate } from '../../services/api/src/store.js';
import { McpPairings } from '../../services/api/src/mcp/pairing.js';
import {
  nativeContracts,
  nativeModules,
  type NativeContracts,
} from '../helpers/native-contracts.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { createServer } from '../../services/api/src/server.js';
import {
  ApiRoutes,
  AccountControlChallengeSchema,
  McpPairingRoutes,
} from '../../protocol/index.js';
import { instructionDigest, encodeAction } from '../../sdk/index.js';
import { encodeDecide, DecideTableSchemas } from '@daclify/modules/sdk';
const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test') || new URL(url).hostname !== '127.0.0.1')
  throw Error('Owned test database required');
const pool = new Pool({ connectionString: url });
let native: NativeContracts,
  gateway: NativeChainGateway,
  server: Awaited<ReturnType<typeof createServer>>,
  service: McpPairings;
const frontend = 'https://app.example',
  issuer = 'https://api.example';
beforeAll(async () => {
  await migrate(pool);
  native = await nativeContracts();
  gateway = new NativeChainGateway(
    {
      rpcUrl: native.url,
      chainId: native.chainId,
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      relayActor: 'relay',
      relayKey: native.key('relay'),
      modules: nativeModules,
    },
    pool,
  );
  service = new McpPairings(pool, gateway, issuer, frontend);
  server = await createServer(pool, gateway, frontend, { apiOrigin: issuer, mcpPairings: service });
}, 90000);
afterAll(async () => {
  vi.restoreAllMocks();
  await server?.close();
  await native?.stop();
  await pool.end();
});
async function approved() {
  const dao = await native.dummyDao(),
    root = dao.keys[0];
  if (!root) throw Error('fixture root');
  const encryptionKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
    format: 'jwk',
  });
  const challengeResponse = await server.inject({
    method: 'POST',
    url: ApiRoutes.challenge.path,
    headers: { origin: frontend },
    payload: { signingKey: root.toPublic().toString(), encryptionKey },
  });
  const challenge = ApiRoutes.challenge.response.parse(challengeResponse.json());
  const login = await server.inject({
    method: 'POST',
    url: ApiRoutes.login.path,
    headers: { origin: frontend },
    payload: {
      challengeId: challenge.id,
      signature: root.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey,
    },
  });
  expect(login.statusCode, login.body).toBe(200);
  const account = ApiRoutes.login.response.parse(login.json());
  const headers = {
    origin: frontend,
    cookie: login.cookies.map((value) => value.name + '=' + value.value).join('; '),
    'x-csrf-token': account.csrfToken,
  };
  const delegate = PrivateKey.generate('K1'),
    verifier = randomBytes(32).toString('base64url');
  const begin = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpPair.path,
    payload: {
      dao: dao.reference,
      memberId: '1',
      scopes: ['vote'],
      delegatePublicKey: delegate.toPublic().toString(),
      codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
    },
  });
  expect(begin.statusCode, begin.body).toBe(200);
  const pairing = McpPairingRoutes.mcpPair.response.parse(begin.json());
  const consentResponse = await server.inject({
    method: 'GET',
    url: McpPairingRoutes.mcpConsent.path.replace(':id', pairing.id),
    headers,
  });
  expect(consentResponse.statusCode, consentResponse.body).toBe(200);
  const consent = McpPairingRoutes.mcpConsent.response.parse(consentResponse.json());
  await dao.act(
    'daclifycore',
    'addsession',
    encodeAction('addsession', {
      ...dao.actor(),
      session_id: '1',
      signing_key: delegate.toPublic().toString(),
      expires: consent.grantExpires,
      permissions: consent.permissions,
    }),
  );
  const body = McpPairingRoutes.mcpApprove.input.parse({
    id: pairing.id,
    dao: dao.reference,
    memberId: '1',
    scopes: ['vote'],
    sessionId: '1',
    mode: 'autonomous',
  });
  const denied = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpApprove.path,
    headers,
    payload: body,
  });
  expect(denied.statusCode).toBe(403);
  const controlResponse = await server.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers,
    payload: {
      path: McpPairingRoutes.mcpApprove.path,
      bodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    },
  });
  expect(controlResponse.statusCode, controlResponse.body).toBe(200);
  const control = AccountControlChallengeSchema.parse(controlResponse.json());
  const approval = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpApprove.path,
    headers: {
      ...headers,
      'x-account-intent-id': control.id,
      'x-account-signature': root.signMessage(new TextEncoder().encode(control.message)).toString(),
    },
    payload: body,
  });
  expect(approval.statusCode, approval.body).toBe(200);
  const wrong = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpRedeem.path.replace(':id', pairing.id),
    payload: { codeVerifier: 'w'.repeat(43) },
  });
  expect(wrong.statusCode).toBe(403);
  const redeemed = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpRedeem.path.replace(':id', pairing.id),
    payload: { codeVerifier: verifier },
  });
  expect(redeemed.statusCode, redeemed.body).toBe(200);
  const value = McpPairingRoutes.mcpRedeem.response.parse(redeemed.json());
  return {
    dao,
    root,
    delegate,
    pairing,
    verifier,
    value,
    headers: { authorization: 'Bearer ' + value.token },
  };
}
it('stores only a bounded PKCE/public-key pairing and consumes it once with the exact verifier', async () => {
  const service = new McpPairings(pool, undefined, 'https://api.example', 'https://app.example');
  const verifier = randomBytes(32).toString('base64url');
  const input = {
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    memberId: '1',
    scopes: ['vote'],
    delegatePublicKey: PrivateKey.generate('K1').toPublic().toString(),
    codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
  };
  const result = await service.begin(input);
  expect(z.string().uuid().parse(result.id)).toBe(result.id);
  expect(JSON.stringify(result)).not.toContain(verifier);
  expect(Date.parse(result.expires) - Date.now()).toBeLessThanOrEqual(300000);
  await expect(service.redeem(result.id, 'wrong'.repeat(11))).rejects.toThrow(
    'MCP_PAIRING_INVALID',
  );
  const row = (
    await pool.query('SELECT octet_length(request::text) AS bytes FROM mcp_pairings WHERE id=$1', [
      result.id,
    ])
  ).rows[0];
  expect(row.bytes).toBeLessThan(4096);
  await pool.query(
    "UPDATE mcp_pairings SET created_at=now()-interval '2 seconds', expires_at=now()-interval '1 second' WHERE id=$1",
    [result.id],
  );
  await expect(service.redeem(result.id, verifier)).rejects.toThrow('MCP_PAIRING_INVALID');
  expect(await service.cleanup(25)).toBeGreaterThan(0);
});
it('requires a genuine fresh body-bound browser proof and consumes a matched pairing once', async () => {
  const f = await approved();
  const replay = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpRedeem.path.replace(':id', f.pairing.id),
    payload: { codeVerifier: f.verifier },
  });
  expect(replay.statusCode).toBe(403);
  const status = await server.inject({
    method: 'GET',
    url: McpPairingRoutes.mcpLocalStatus.path,
    headers: f.headers,
  });
  expect(status.statusCode, status.body).toBe(200);
  expect(JSON.stringify(status.json())).not.toContain(f.root.toString());
  expect(JSON.stringify(status.json())).not.toContain(f.delegate.toString());
  await f.dao.act(
    'daclifycore',
    'delsession',
    encodeAction('delsession', { ...f.dao.actor(), session_id: '1' }),
  );
  const revoked = await server.inject({
    method: 'GET',
    url: McpPairingRoutes.mcpLocalStatus.path,
    headers: f.headers,
  });
  expect(revoked.statusCode).toBe(401);
});
it('persists the exact real native packet before delivery and reconciles a lost response once', async () => {
  const f = await approved();
  await f.dao.act(
    'decide',
    'open',
    encodeDecide('open', {
      ...f.dao.actor(),
      ballot_id: '900001',
      kind: 0,
      choices: 2,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: '{}',
    }),
  );
  const response = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpLocalPrepare.path,
    headers: f.headers,
    payload: { tool: 'prepare_vote', input: { pollId: '900001', optionId: '1' } },
  });
  expect(response.statusCode, response.body).toBe(200);
  const prepared = McpPairingRoutes.mcpLocalPrepare.response.parse(response.json());
  const malformed = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpLocalSubmit.path,
    headers: f.headers,
    payload: { prepared, signature: 'invalid' },
  });
  expect(malformed.statusCode, malformed.body).toBe(403);
  const changed = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpLocalValidate.path,
    headers: f.headers,
    payload: { ...prepared, request: { ...prepared.request, action: 'withdraw' } },
  });
  expect(changed.statusCode).toBe(409);
  const original = gateway.submitPreparedScoped.bind(gateway);
  vi.spyOn(gateway, 'submitPreparedScoped').mockImplementationOnce(async (packet) => {
    const stored = (
      await pool.query('SELECT packet,state FROM mcp_preparations WHERE id=$1', [prepared.id])
    ).rows[0];
    expect(stored.packet.transactionId).toBe(packet.transactionId);
    expect(stored.state).toBe('submitting');
    await original(packet);
    throw Error('Synthetic lost transport response after actual execution');
  });
  const signed = {
    prepared,
    signature: f.delegate.signDigest(instructionDigest(prepared.request)).toString(),
  };
  const sent = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpLocalSubmit.path,
    headers: f.headers,
    payload: signed,
  });
  expect(sent.statusCode, sent.body).toBe(200);
  expect(sent.json().state).toBe('reconcile-required');
  const blocked = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpLocalPrepare.path,
    headers: f.headers,
    payload: { tool: 'prepare_vote', input: { pollId: '900001', optionId: '1' } },
  });
  expect(blocked.statusCode).toBe(409);
  const recovered = await server.inject({
    method: 'POST',
    url: McpPairingRoutes.mcpLocalSubmit.path,
    headers: f.headers,
    payload: signed,
  });
  expect(recovered.statusCode, recovered.body).toBe(200);
  expect(recovered.json().state).toBe('submitted');
  const votes = await native.api.v1.chain.get_table_rows({
    code: 'decide',
    scope: 'daclifycore',
    table: 'votes',
    limit: 10,
  });
  expect(
    z
      .array(DecideTableSchemas.votes)
      .parse(votes.rows)
      .filter((value) => value.member === '1' && value.ballot === '900001'),
  ).toHaveLength(1);
  vi.restoreAllMocks();
});
