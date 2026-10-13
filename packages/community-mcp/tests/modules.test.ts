import { it, expect } from 'vitest';
import { Serializer, ABI, PrivateKey } from '@wharfkit/antelope';
import { generateKeyPairSync } from 'node:crypto';
import {
  McpConnectionSchema,
  GovernanceStateSchema,
  UserMembershipSchema,
  ApiRoutes,
  McpPrepareInputSchema,
} from '@daclify/core-protocol';
import { ModuleApiRoutes, Catalog } from '@daclify/modules';
import { ModuleCodeHashes, decideAbi } from '@daclify/modules/sdk';
import { communityModuleAdapter } from '../src/modules.js';
function fixture() {
  const dao = {
    chainId: 'ab'.repeat(32),
    contract: 'daclifycore',
    daoId: '1',
    interfaceVersion: 1,
  };
  const connection = McpConnectionSchema.parse({
    version: 1,
    api: 'https://api.example',
    origin: 'https://app.example',
    dao,
    memberId: '1',
    authentication: {
      signingPublicKey: PrivateKey.generate('K1').toPublic().toString(),
      encryptionPublicKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export(
        { format: 'jwk' },
      ),
    },
    scopes: ['proposal', 'vote', 'review'],
  });
  const member = UserMembershipSchema.parse({
    dao,
    memberId: '1',
    nonce: '1',
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
        decide: 'decide',
        guardian: 'guardian',
        kind: 0,
        duration: 300,
        quorum: 5000,
        approval: 5001,
        governed_works: true,
        max_commitment: '1000',
        daily_commitment: '10000',
      },
    },
    actors: [],
    sessions: [],
    guardian: null,
    budget: null,
  });
  const state = ModuleApiRoutes.state.response.parse({
    dao,
    modules: [
      {
        deployment: {
          id: 'decide',
          account: 'decide',
          version: '0.10.0-alpha.3',
          codeHash: ModuleCodeHashes.decide,
        },
        manifest: Catalog.find((value) => value.id === 'decide'),
        enabled: true,
        installed: true,
        compatible: true,
        codeVerified: true,
        actions: ['open', 'vote'],
        grants: [],
      },
    ],
    ballots: [],
    votes: [],
    projects: [],
    milestones: [],
    schedules: [],
    entries: [],
    controls: [],
  });
  let privacy = 'public';
  return {
    state,
    governance,
    member,
    connection,
    setPrivate: () => {
      privacy = 'encrypted-user-controlled';
    },
    request: async (path: string) => {
      if (path === ModuleApiRoutes.state.path.replace(':id', '1')) return state;
      if (path === ApiRoutes.dao.path.replace(':id', '1'))
        return {
          reference: dao,
          title: 'DAO',
          description: '',
          privacy,
          owner: 'alice',
          token: { chainId: dao.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
          members: 1,
          available: '0',
          reserved: '0',
          claims: '0',
          keyEpoch: '0',
        };
      throw Error('Unexpected transport');
    },
  };
}
it('encodes a real zero-payment poll using current producer policy and pinned module ABI', async () => {
  const context = fixture();
  const intent = McpPrepareInputSchema.parse({
    tool: 'prepare_proposal',
    input: {
      ballotId: '18446744073709551615',
      title: 'Community choice',
      description: 'Public proposal',
      options: ['Yes', 'No'],
    },
  });
  const result = await communityModuleAdapter().prepare(intent, context);
  const decoded = Serializer.decode({ abi: ABI.from(decideAbi), type: 'open', data: result.data });
  expect(JSON.parse(JSON.stringify(decoded))).toMatchObject({
    runtime: 'daclifycore',
    dao_id: 1,
    member_id: 1,
    ballot_id: '18446744073709551615',
    kind: 0,
    duration: 300,
    quorum: 5000,
    approval: 5001,
  });
  expect(result.codeHash).toBe(ModuleCodeHashes.decide);
  expect(result.action).toBe('open');
  const module = context.state.modules[0];
  if (!module) throw Error('missing fixture');
  module.deployment.codeHash = 'cd'.repeat(32);
  await expect(communityModuleAdapter().prepare(intent, context)).rejects.toThrow('MCP_MODULE_PIN');
});
it('rejects private output, wrong DAO state and independent reviews without current project evidence', async () => {
  const context = fixture();
  const intent = McpPrepareInputSchema.parse({
    tool: 'prepare_review',
    input: { milestoneId: '1', approve: true, documentId: '1', documentVersion: 1 },
  });
  context.setPrivate();
  await expect(communityModuleAdapter().prepare(intent, context)).rejects.toThrow(
    'MCP_PUBLIC_DAO_REQUIRED',
  );
  const second = fixture();
  second.state.dao.daoId = '2';
  await expect(communityModuleAdapter().prepare(intent, second)).rejects.toThrow('MCP_DOMAIN');
});
