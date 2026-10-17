import { it, expect } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  LoginMessageSchema,
  ApiRoutes,
  VERSION,
  NetworkSchema,
  GovernanceStateSchema,
  McpPrepareInputSchema,
  UserMembershipSchema,
} from '../protocol/index.js';
import { CommunityAgentClient, type CommunityModuleAdapter } from '../sdk/community-agent.js';
import { instructionDigest } from '../sdk/index.js';
import { encodeDecide } from '@daclify/modules/sdk';
it('checks both public keys, origin and audience before requesting an actual root login signature', async () => {
  const root = PrivateKey.generate('K1'),
    encryptionPublicKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    }),
    dao = { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
    connection = {
      version: 1,
      api: 'https://api.example',
      origin: 'https://app.example',
      dao,
      memberId: '1',
      authentication: { signingPublicKey: root.toPublic().toString(), encryptionPublicKey },
      scopes: ['proposal'],
    };
  let signed = 0,
    badAudience = true;
  const challengeId = randomUUID(),
    expires = new Date(Date.now() + 300000).toISOString();
  const client = new CommunityAgentClient(
    connection,
    {
      signLoginMessage: async (message) => {
        signed++;
        return root.signMessage(new TextEncoder().encode(message)).toString();
      },
      signInstruction: async () => {
        throw Error('Login must not sign native instructions');
      },
    },
    {
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path === ApiRoutes.network.path)
          return Response.json(
            NetworkSchema.parse({
              chainId: dao.chainId,
              rpcUrl: 'https://rpc.example',
              runtime: dao.contract,
              hub: null,
              environment: 'testnet',
              interfaceVersion: 1,
              coreVersion: VERSION,
              capabilities: ['guarded-agents'],
            }),
          );
        if (path === ApiRoutes.challenge.path) {
          expect(JSON.parse(String(init?.body))).toEqual({
            signingKey: root.toPublic().toString(),
            encryptionKey: encryptionPublicKey,
          });
          return Response.json({
            id: challengeId,
            expires,
            message: JSON.stringify(
              LoginMessageSchema.parse({
                domain: 'daclify.login.v3',
                challenge: challengeId,
                signingKey: root.toPublic().toString(),
                encryptionKey: encryptionPublicKey,
                origin: connection.origin,
                audience: badAudience ? 'https://foreign.example' : connection.api,
                expires,
              }),
            ),
          });
        }
        throw Error('Unexpected login transport');
      },
    },
  );
  await expect(client.login()).rejects.toThrow('MCP_LOGIN_CONTEXT');
  expect(signed).toBe(0);
  badAudience = false;
  await expect(client.login()).rejects.toThrow('Unexpected login transport');
  expect(signed).toBe(1);
});

async function fixture() {
  const root = PrivateKey.generate('K1'),
    delegate = PrivateKey.generate('K1');
  const encryptionPublicKey = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  }).publicKey.export({ format: 'jwk' });
  const dao = {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
    interfaceVersion: 1,
  };
  const member = UserMembershipSchema.parse({
    dao,
    memberId: '1',
    nonce: '4',
    active: true,
    admin: false,
    reviewer: true,
    credits: '0',
    claim: '0',
    stake: '0',
    nativeAccount: '',
    custody: 'user-controlled',
  });
  const governance = GovernanceStateSchema.parse({
    dao,
    policy: {
      dao_id: '1',
      revision: '1',
      config: {
        participant_mode: 1,
        decide: 'daclifydecid',
        guardian: 'guardian',
        kind: 0,
        duration: 3600,
        quorum: 5000,
        approval: 5001,
        governed_works: true,
        max_commitment: '0',
        daily_commitment: '0',
      },
    },
    actors: [],
    sessions: [
      {
        id: '1',
        member_id: '1',
        signing_key: delegate.toPublic().toString(),
        expires: Math.floor(Date.now() / 1000) + 3600,
        credential_epoch: '1',
        permissions: [{ target: 'daclifydecid', action: 'open', code_hash: '00'.repeat(32) }],
      },
    ],
    guardian: null,
    budget: null,
  });
  const connection = {
    version: 1,
    api: 'https://api.example',
    origin: 'https://app.example',
    dao,
    memberId: '1',
    authentication: { signingPublicKey: root.toPublic().toString(), encryptionPublicKey },
    scopes: ['proposal', 'review', 'activity'],
  };
  let failRelay = false,
    relays = 0;
  const challengeId = randomUUID(),
    expires = new Date(Date.now() + 300000).toISOString();
  const modules: CommunityModuleAdapter = {
    readActivity: async () => ({ receipts: [], next: null }),
    prepare: async () => ({
      target: 'daclifydecid',
      action: 'open',
      codeHash: '00'.repeat(32),
      data: encodeDecide('open', {
        runtime: dao.contract,
        dao_id: '1',
        member_id: '1',
        ballot_id: '1',
        kind: 0,
        choices: 2,
        duration: 3600,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    }),
  };
  const client = new CommunityAgentClient(
    connection,
    {
      signLoginMessage: async (message) =>
        root.signMessage(new TextEncoder().encode(message)).toString(),
      signInstruction: async (request) =>
        delegate.signDigest(instructionDigest(request)).toString(),
    },
    {
      modules,
      credential: { sessionId: '1', signingPublicKey: delegate.toPublic().toString() },
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path === ApiRoutes.network.path)
          return Response.json({
            chainId: dao.chainId,
            rpcUrl: 'https://rpc.example',
            runtime: dao.contract,
            hub: null,
            environment: 'testnet',
            interfaceVersion: 1,
            coreVersion: VERSION,
            capabilities: ['guarded-agents'],
          });
        if (path === ApiRoutes.challenge.path)
          return Response.json({
            id: challengeId,
            expires,
            message: JSON.stringify({
              domain: 'daclify.login.v3',
              origin: connection.origin,
              audience: connection.api,
              challenge: challengeId,
              expires,
              signingKey: root.toPublic().toString(),
              encryptionKey: encryptionPublicKey,
            }),
          });
        if (path === ApiRoutes.login.path) {
          const body = ApiRoutes.login.input.parse(JSON.parse(String(init?.body)));
          expect(body.encryptionKey).toEqual(encryptionPublicKey);
          return Response.json(
            {
              account: {
                id: randomUUID(),
                custody: 'user-controlled',
                signingKey: root.toPublic().toString(),
                encryptionKey: encryptionPublicKey,
              },
              csrfToken: 'c'.repeat(32),
            },
            { headers: { 'set-cookie': 'session=protected; HttpOnly; Secure' } },
          );
        }
        expect(new Headers(init?.headers).get('cookie')).toBe('session=protected');
        if (path === ApiRoutes.memberships.path) return Response.json({ memberships: [member] });
        if (path === ApiRoutes.governance.path.replace(':id', '1'))
          return Response.json(governance);
        if (path === ApiRoutes.relay.path) {
          relays++;
          expect(new Headers(init?.headers).get('x-csrf-token')).toBe('c'.repeat(32));
          if (failRelay) throw Error('uncertain transport');
          return Response.json({ transactionId: 'ef'.repeat(32) });
        }
        if (path === ApiRoutes.logout.path) return new Response(null, { status: 204 });
        throw Error('Unexpected transport');
      },
    },
  );
  await client.login();
  return {
    client,
    member,
    governance,
    delegate,
    setFailRelay: () => {
      failRelay = true;
    },
    relays: () => relays,
    intent: McpPrepareInputSchema.parse({
      tool: 'prepare_proposal',
      input: { ballotId: '1', title: 'Proposal', description: 'Public', options: ['Yes', 'No'] },
    }),
  };
}
it('rechecks guardian, membership, session revocation, epoch and nonce before signing', async () => {
  const f = await fixture(),
    prepared = await f.client.prepare(f.intent);
  f.governance.guardian = {
    dao_id: '1',
    paused_until: Math.floor(Date.now() / 1000) + 100,
    reason: '00'.repeat(32),
  };
  await expect(f.client.validatePrepared(prepared)).rejects.toThrow('MCP_DAO_PAUSED');
  f.governance.guardian = null;
  f.member.active = false;
  await expect(f.client.validatePrepared(prepared)).rejects.toThrow('MCP_MEMBER_INACTIVE');
  f.member.active = true;
  const session = f.governance.sessions[0];
  if (!session) throw Error('missing fixture session');
  session.expires = 1;
  await expect(f.client.validatePrepared(prepared)).rejects.toThrow('MCP_SESSION_REVOKED');
  session.expires = Math.floor(Date.now() / 1000) + 3600;
  session.credential_epoch = '2';
  await expect(f.client.validatePrepared(prepared)).rejects.toThrow('MCP_SESSION_REVOKED');
  session.credential_epoch = '1';
  f.member.nonce = '5';
  await expect(f.client.validatePrepared(prepared)).rejects.toThrow('MCP_CONTEXT_CHANGED');
  expect(f.relays()).toBe(0);
});
it('rejects changed preview bytes and wrong signing keys, and submits the exact protected packet', async () => {
  const f = await fixture(),
    prepared = await f.client.prepare(f.intent);
  await expect(
    f.client.validatePrepared({ ...prepared, request: { ...prepared.request, target: 'foreign' } }),
  ).rejects.toThrow('MCP_PREPARED_CHANGED');
  await expect(
    f.client.submitSigned({
      prepared,
      signature: PrivateKey.generate('K1')
        .signDigest(instructionDigest(prepared.request))
        .toString(),
    }),
  ).rejects.toThrow('MCP_SIGNATURE');
  expect(
    await f.client.submitSigned({
      prepared,
      signature: f.delegate.signDigest(instructionDigest(prepared.request)).toString(),
    }),
  ).toEqual({ state: 'submitted', transactionId: 'ef'.repeat(32) });
  expect(f.relays()).toBe(1);
});
it('freezes unknown deliveries and does not allocate a replacement nonce or event', async () => {
  const f = await fixture(),
    prepared = await f.client.prepare(f.intent);
  f.setFailRelay();
  expect(
    await f.client.submitSigned({
      prepared,
      signature: f.delegate.signDigest(instructionDigest(prepared.request)).toString(),
    }),
  ).toEqual({ state: 'reconcile-required', preparedId: prepared.id, digest: prepared.digest });
  await expect(f.client.prepare(f.intent)).rejects.toThrow('MCP_RECONCILE_REQUIRED');
  expect(f.relays()).toBe(1);
});
it('keeps app-scoped activity and reviewer authority separate from general routine sessions', async () => {
  const f = await fixture();
  await expect(
    f.client.prepare({
      tool: 'prepare_activity',
      input: {
        appId: '1',
        sourceId: 'ab'.repeat(32),
        sourceRevision: 'cd'.repeat(32),
        eventId: 'ef'.repeat(32),
      },
    }),
  ).rejects.toThrow('MCP_APP_CREDENTIAL_REQUIRED');
  f.member.reviewer = false;
  await expect(
    f.client.prepare({
      tool: 'prepare_review',
      input: { milestoneId: '1', approve: true, documentId: '1', documentVersion: 1 },
    }),
  ).rejects.toThrow('MCP_REVIEWER_REQUIRED');
});

it.each(['openpoll', 'votecommit'])(
  'permits the verified %s path only in its routine scope and exact session grant',
  async (action) => {
    const f = await fixture(),
      session = f.governance.sessions[0];
    if (!session) throw Error('MISSING_FIXTURE_SESSION');
    const { prepareCommunityInstruction } = await import('../sdk/community-agent.js');
    const intent =
      action === 'openpoll'
        ? f.intent
        : McpPrepareInputSchema.parse({
            tool: 'prepare_vote',
            input: { pollId: '1', optionId: '0' },
          });
    const scope: 'proposal' | 'vote' = action === 'openpoll' ? 'proposal' : 'vote';
    const context = {
      connection: { dao: f.member.dao, memberId: '1', scopes: [scope] },
      member: f.member,
      governance: f.governance,
      credential: { sessionId: session.id, signingPublicKey: f.delegate.toPublic().toString() },
      action: {
        target: 'daclifydecid',
        action,
        codeHash: '00'.repeat(32),
        data: new Uint8Array([1]),
      },
    };
    session.permissions.push({
      target: 'daclifydecid',
      action,
      code_hash: context.action.codeHash,
    });
    expect(prepareCommunityInstruction(intent, context).request.action).toBe(action);
    expect(() =>
      prepareCommunityInstruction(intent, {
        ...context,
        action: { ...context.action, action: action === 'openpoll' ? 'votecommit' : 'openpoll' },
      }),
    ).toThrow('MCP_INTENT_ACTION');
    expect(() =>
      prepareCommunityInstruction(intent, {
        ...context,
        action: { ...context.action, codeHash: 'ab'.repeat(32) },
      }),
    ).toThrow('MCP_SESSION_SCOPE');
    session.permissions = [];
    expect(() => prepareCommunityInstruction(intent, context)).toThrow('MCP_SESSION_SCOPE');
  },
);
