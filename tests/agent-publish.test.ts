import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey, Signature } from '@wharfkit/antelope';
import { generateKeyPairSync } from 'node:crypto';
import { ApiRoutes, ChallengeRequestSchema, EncryptionPublicKeySchema } from '../protocol/index.js';
import { RuntimeActionSchemas, instructionDigest } from '../sdk/index.js';
import { publishAgent } from '../examples/agent-publish.js';
import { AgentPublishInputSchema } from '../examples/agent-publish-config.js';
const root = PrivateKey.generate('K1'),
  delegate = PrivateKey.generate('K1');
const encryptionKey = EncryptionPublicKeySchema.parse(
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
);
const input = AgentPublishInputSchema.parse({
  api: 'https://api.example',
  origin: 'https://harness.example',
  dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  documentId: '1',
  documentVersion: 1,
  visibility: 'public' as const,
  publicJson: { decision: 'Synthetic public decision' },
  accountAuthentication: { signingKey: root.toString(), encryptionKey },
  scopedSigner: { signingKey: delegate.toString(), memberId: '1', sessionId: '1' },
});
const domain = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1 as const,
};
afterEach(() => vi.unstubAllGlobals());
function apiFixture(audience = input.api) {
  const calls: { path: string; body: unknown }[] = [];
  const expires = new Date(Date.now() + 60000).toISOString();
  const message = JSON.stringify({
    domain: 'daclify.login.v3',
    signingKey: root.toPublic().toString(),
    encryptionKey,
    origin: input.origin,
    audience,
    challenge: '550e8400-e29b-41d4-a716-446655440001',
    expires,
  });
  vi.stubGlobal('fetch', async (url: string | URL | Request, options?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body: unknown = typeof options?.body === 'string' ? JSON.parse(options.body) : null;
    calls.push({ path, body });
    let value: unknown;
    if (path === ApiRoutes.network.path)
      value = {
        chainId: domain.chainId,
        runtime: domain.contract,
        hub: null,
        rpcUrl: 'https://rpc.example',
        environment: 'local',
        interfaceVersion: 1,
        coreVersion: '0.14.0-alpha.8',
        capabilities: ['guarded-agents'],
      };
    else if (path === ApiRoutes.challenge.path)
      value = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        message,
        expires,
      };
    else if (path === ApiRoutes.login.path) {
      const parsed = ApiRoutes.login.input.parse(body);
      expect(
        Signature.from(parsed.signature).verifyMessage(
          new TextEncoder().encode(message),
          root.toPublic(),
        ),
      ).toBe(true);
      value = {
        account: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          custody: 'user-controlled',
          signingKey: root.toPublic().toString(),
          encryptionKey,
        },
        csrfToken: 'a'.repeat(43),
      };
    } else if (path === '/v1/daos/1')
      value = {
        reference: domain,
        title: 'Fixture',
        description: '',
        privacy: 'public',
        owner: 'alice',
        token: { chainId: domain.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
        members: 1,
        available: '0',
        reserved: '0',
        claims: '0',
        keyEpoch: '1',
      };
    else if (path === ApiRoutes.memberships.path)
      value = {
        memberships: [
          {
            dao: domain,
            memberId: '1',
            nonce: '1',
            active: true,
            admin: true,
            reviewer: false,
            credits: '0',
            claim: '0',
            stake: '0',
            nativeAccount: '',
            custody: 'user-controlled',
            signingKey: root.toPublic().toString(),
          },
        ],
      };
    else if (path === '/v1/daos/1/governance')
      value = {
        dao: domain,
        policy: null,
        actors: [],
        sessions: [
          {
            id: '1',
            member_id: '1',
            signing_key: delegate.toPublic().toString(),
            expires: Math.floor(Date.now() / 1000) + 600,
            credential_epoch: '0',
            permissions: [
              { target: domain.contract, action: 'putjson', code_hash: '00'.repeat(32) },
            ],
          },
        ],
        guardian: null,
        budget: null,
      };
    else if (path === ApiRoutes.relay.path) {
      const parsed = RuntimeActionSchemas.submitsess.parse(body);
      expect(parsed.request.member_id).toBe('1');
      expect(
        Signature.from(parsed.sig).verifyDigest(
          instructionDigest(parsed.request),
          delegate.toPublic(),
        ),
      ).toBe(true);
      value = { transactionId: 'cc'.repeat(32) };
    } else throw new Error('FIXTURE_UNEXPECTED_PATH');
    return Response.json(value, {
      headers:
        path === ApiRoutes.login.path ? { 'set-cookie': 'daclify_session=fixture; HttpOnly' } : {},
    });
  });
  return calls;
}
it('constructs the complete producer challenge and publishes using a different scoped signing key', async () => {
  const calls = apiFixture();
  expect((await publishAgent(input)).transactionId).toBe('cc'.repeat(32));
  const exampleChallenge = calls.find((call) => call.path === ApiRoutes.challenge.path)?.body;
  expect(ChallengeRequestSchema.safeParse(exampleChallenge).success).toBe(true);
  expect(exampleChallenge).toEqual({ signingKey: root.toPublic().toString(), encryptionKey });
  expect(calls.filter((call) => call.path === ApiRoutes.login.path)).toHaveLength(1);
  expect(JSON.stringify(calls)).not.toContain(root.toString());
  expect(JSON.stringify(calls)).not.toContain(delegate.toString());
});
it('refuses a login challenge from another audience before signing it', async () => {
  const calls = apiFixture('https://other.example');
  await expect(publishAgent(input)).rejects.toThrow('AGENT_LOGIN_CONTEXT');
  expect(calls.some((call) => call.path === ApiRoutes.login.path)).toBe(false);
});
it('rejects absent encryption identity, private classification, protected envelopes and oversized public JSON', () => {
  for (const changed of [
    { accountAuthentication: { signingKey: root.toString() } },
    { visibility: 'private' },
    {
      publicJson: {
        version: 1,
        algorithm: 'AES-256-GCM',
        iv: 'AAAAAAAAAAAAAAAA',
        ciphertext: 'AAAA',
      },
    },
    { publicJson: { text: 'a'.repeat(4097) } },
  ])
    expect(AgentPublishInputSchema.safeParse({ ...input, ...changed }).success).toBe(false);
});
