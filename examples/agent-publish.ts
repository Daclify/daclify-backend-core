// Protected local signers authenticate the root and publish public JSON with a separate delegate.
import { readFile, stat } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import {
  ApiRoutes,
  DaoRefSchema,
  ChainIdSchema,
  NativeAccountSchema,
  IdSchema,
} from '@daclify/core-protocol';
import { CommunityAgentClient } from '@daclify/core-protocol/community-agent';
import { encodeAction, makeInstruction, instructionDigest } from '@daclify/core-protocol/sdk';
import {
  AgentPublishInputSchema,
  AgentPublishResultSchema,
  AgentAuthenticationSchema,
  AgentScopedSignerSchema,
  type AgentPublishInput,
  type AgentPublishResult,
} from './agent-publish-config.js';

export async function publishAgent(input: AgentPublishInput): Promise<AgentPublishResult> {
  const config = AgentPublishInputSchema.parse(input);
  const root = PrivateKey.from(config.accountAuthentication.signingKey);
  const delegate = PrivateKey.from(config.scopedSigner.signingKey);
  if (root.toPublic().equals(delegate.toPublic())) throw new Error('AGENT_SIGNER_KEYS');
  const client = new CommunityAgentClient(
    {
      version: 1,
      api: config.api,
      origin: config.origin,
      dao: config.dao,
      memberId: config.scopedSigner.memberId,
      authentication: {
        signingPublicKey: root.toPublic().toString(),
        encryptionPublicKey: config.accountAuthentication.encryptionKey,
      },
      scopes: [],
    },
    {
      signLoginMessage: async (message) =>
        root.signMessage(new TextEncoder().encode(message)).toString(),
      signInstruction: async (request) =>
        delegate.signDigest(instructionDigest(request)).toString(),
    },
  );
  await client.login();
  const request = (path: string, body?: unknown) => client.authenticatedRequest(path, body);
  const network = ApiRoutes.network.response.parse(await request(ApiRoutes.network.path));
  if (
    network.chainId !== config.dao.chainId ||
    network.runtime !== config.dao.contract ||
    network.interfaceVersion !== config.dao.interfaceVersion
  )
    throw new Error('AGENT_DOMAIN');
  if (!network.capabilities.includes('guarded-agents')) throw new Error('AGENT_CAPABILITY');
  const dao = ApiRoutes.dao.response.parse(
    await request(ApiRoutes.dao.path.replace(':id', config.dao.daoId)),
  );
  if (JSON.stringify(dao.reference) !== JSON.stringify(config.dao)) throw new Error('AGENT_DOMAIN');
  if (dao.privacy !== 'public') throw new Error('EXAMPLE_REQUIRES_PUBLIC_DAO');
  try {
    const membership = ApiRoutes.memberships.response
      .parse(await request(ApiRoutes.memberships.path))
      .memberships.find(
        (member) =>
          member.dao.chainId === config.dao.chainId &&
          member.dao.contract === config.dao.contract &&
          member.dao.daoId === config.dao.daoId &&
          member.memberId === config.scopedSigner.memberId,
      );
    if (!membership?.active) throw new Error('MEMBER_UNKNOWN');
    const governance = ApiRoutes.governance.response.parse(
      await request(ApiRoutes.governance.path.replace(':id', config.dao.daoId)),
    );
    if (JSON.stringify(governance.dao) !== JSON.stringify(config.dao))
      throw new Error('AGENT_DOMAIN');
    const credential = governance.sessions.find(
      (value) =>
        value.id === config.scopedSigner.sessionId &&
        value.member_id === membership.memberId &&
        value.signing_key === delegate.toPublic().toString(),
    );
    if (
      !credential ||
      credential.expires <= Math.floor(Date.now() / 1000) ||
      !credential.permissions.some(
        (permission) =>
          permission.target === config.dao.contract &&
          permission.action === 'putjson' &&
          permission.code_hash === '00'.repeat(32),
      )
    )
      throw new Error('SESSION_NOT_REGISTERED');
    const instruction = makeInstruction(
      config.dao,
      membership.memberId,
      membership.nonce,
      Math.min(Math.floor(Date.now() / 1000) + 300, credential.expires),
      config.dao.contract,
      'putjson',
      encodeAction('putjson', {
        runtime: config.dao.contract,
        dao_id: config.dao.daoId,
        member_id: membership.memberId,
        document_id: config.documentId,
        version: config.documentVersion,
        value: JSON.stringify(config.publicJson),
        envelope_version: 0,
        key_epoch: '0',
      }),
    );
    const result = ApiRoutes.relay.response.parse(
      await request(
        ApiRoutes.relay.path,
        ApiRoutes.relay.input.parse({
          request: instruction,
          session_id: credential.id,
          sig: delegate.signDigest(instructionDigest(instruction)).toString(),
        }),
      ),
    );
    return AgentPublishResultSchema.parse({
      dao: config.dao,
      memberId: membership.memberId,
      accountId: client.authenticatedAccountId(),
      documentId: config.documentId,
      transactionId: result.transactionId,
    });
  } finally {
    try {
      await client.logout();
    } catch {
      /* A failed logout does not change the confirmed native receipt. */
    }
  }
}

async function protectedJson(path: string): Promise<unknown> {
  const info = await stat(path);
  if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > 16384)
    throw new Error('AGENT_PROTECTED_CONFIG');
  return JSON.parse(await readFile(path, 'utf8'));
}
async function main() {
  const env = z
    .object({
      DACLIFY_AGENT_API: z.string(),
      DACLIFY_AGENT_ORIGIN: z.string(),
      DACLIFY_AGENT_CHAIN_ID: ChainIdSchema,
      DACLIFY_AGENT_RUNTIME: NativeAccountSchema,
      DACLIFY_AGENT_DAO: IdSchema,
      DACLIFY_AGENT_DOCUMENT: IdSchema,
      DACLIFY_AGENT_DOCUMENT_VERSION: z.coerce.number().int().min(1).max(4294967295),
      DACLIFY_AGENT_ACCOUNT_FILE: z.string().min(1),
      DACLIFY_AGENT_SIGNER_FILE: z.string().min(1),
      DACLIFY_AGENT_PUBLIC_JSON_FILE: z.string().min(1),
    })
    .parse(process.env);
  if ((await stat(env.DACLIFY_AGENT_PUBLIC_JSON_FILE)).size > 4096)
    throw new Error('DOCUMENT_SIZE');
  const result = await publishAgent(
    AgentPublishInputSchema.parse({
      api: env.DACLIFY_AGENT_API,
      origin: env.DACLIFY_AGENT_ORIGIN,
      dao: DaoRefSchema.parse({
        chainId: env.DACLIFY_AGENT_CHAIN_ID,
        contract: env.DACLIFY_AGENT_RUNTIME,
        daoId: env.DACLIFY_AGENT_DAO,
        interfaceVersion: 1,
      }),
      documentId: env.DACLIFY_AGENT_DOCUMENT,
      documentVersion: env.DACLIFY_AGENT_DOCUMENT_VERSION,
      accountAuthentication: AgentAuthenticationSchema.parse(
        await protectedJson(env.DACLIFY_AGENT_ACCOUNT_FILE),
      ),
      scopedSigner: AgentScopedSignerSchema.parse(
        await protectedJson(env.DACLIFY_AGENT_SIGNER_FILE),
      ),
      visibility: 'public',
      publicJson: JSON.parse(await readFile(env.DACLIFY_AGENT_PUBLIC_JSON_FILE, 'utf8')),
    }),
  );
  process.stdout.write(JSON.stringify(result) + '\n');
}
if (import.meta.main)
  await main().catch(() => {
    process.stderr.write(
      'Agent request failed. Check protected configuration, account identity, scoped credential, expiry, nonce and service availability. No private diagnostic is printed.\n',
    );
    process.exitCode = 1;
  });
