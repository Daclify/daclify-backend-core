// Provider-neutral example: publish supplied PUBLIC JSON using an existing scoped credential.
// This is not an LLM runner or a production key-management provider.
import { readFile } from 'node:fs/promises';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { ApiRoutes, DaoRefSchema, VaultAccountSchema, IdSchema } from '@daclify/core-protocol';
import {
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeTableSchemas,
} from '@daclify/core-protocol/sdk';
const environment = z.object({
  DACLIFY_AGENT_API: z.url(),
  DACLIFY_AGENT_ORIGIN: z.url(),
  DACLIFY_AGENT_DAO: IdSchema,
  DACLIFY_AGENT_MEMBER: IdSchema,
  DACLIFY_AGENT_SESSION: IdSchema,
  DACLIFY_AGENT_SIGNING_KEY: z.string().min(1),
  DACLIFY_AGENT_DOCUMENT: IdSchema,
  DACLIFY_AGENT_DOCUMENT_VERSION: z.coerce.number().int().min(1).max(4294967295),
  DACLIFY_AGENT_PUBLIC_JSON_FILE: z.string().min(1),
});
async function main() {
  const config = environment.parse(process.env);
  const base = new URL(config.DACLIFY_AGENT_API);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/' ||
    (base.protocol !== 'https:' &&
      !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)))
  )
    throw new Error('API_ORIGIN');
  const signing = PrivateKey.from(config.DACLIFY_AGENT_SIGNING_KEY);
  const origin = new URL(config.DACLIFY_AGENT_ORIGIN);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/' ||
    (origin.protocol !== 'https:' &&
      !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)))
  )
    throw new Error('AGENT_ORIGIN');
  let cookie = '',
    csrf = '';
  async function request(path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(new URL(path, base), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: origin.origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json', 'x-csrf-token': csrf }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('AGENT_API_REJECTED');
    const cookies = response.headers.getSetCookie();
    if (cookies.length) cookie = cookies.map((value) => value.split(';')[0]).join('; ');
    return response.json();
  }
  const network = ApiRoutes.network.response.parse(await request(ApiRoutes.network.path));
  const domain = DaoRefSchema.parse({
    chainId: network.chainId,
    contract: network.runtime,
    daoId: config.DACLIFY_AGENT_DAO,
    interfaceVersion: network.interfaceVersion,
  });
  if (!network.capabilities.includes('guarded-agents')) throw new Error('AGENT_CAPABILITY');
  const dao = ApiRoutes.dao.response.parse(
    await request(ApiRoutes.dao.path.replace(':id', domain.daoId)),
  );
  if (dao.privacy !== 'public') throw new Error('EXAMPLE_REQUIRES_PUBLIC_DAO');
  const governance = ApiRoutes.governance.response.parse(
    await request(ApiRoutes.governance.path.replace(':id', domain.daoId)),
  );
  const credential = governance.sessions.find(
    (value) =>
      value.id === config.DACLIFY_AGENT_SESSION &&
      value.member_id === config.DACLIFY_AGENT_MEMBER &&
      value.signing_key === signing.toPublic().toString(),
  );
  if (!credential) throw new Error('SESSION_NOT_REGISTERED');
  const content = ApiRoutes.content.response.parse(
    await request(ApiRoutes.content.path.replace(':id', domain.daoId)),
  );
  const member = content.members.find((value) => value.id === config.DACLIFY_AGENT_MEMBER);
  if (!member) throw new Error('MEMBER_UNKNOWN');
  const challenge = ApiRoutes.challenge.response.parse(
    await request(ApiRoutes.challenge.path, { signingKey: signing.toPublic().toString() }),
  );
  const session = ApiRoutes.login.response.parse(
    await request(ApiRoutes.login.path, {
      challengeId: challenge.id,
      signature: signing.signMessage(new TextEncoder().encode(challenge.message)).toString(),
      encryptionKey: VaultAccountSchema.shape.encryptionKey.parse(
        JSON.parse(member.encryption_key),
      ),
    }),
  );
  csrf = session.csrfToken;
  const value = await readFile(config.DACLIFY_AGENT_PUBLIC_JSON_FILE, 'utf8');
  if (Buffer.byteLength(value) > 4096) throw new Error('DOCUMENT_SIZE');
  const parsed: unknown = JSON.parse(value);
  const canonical = JSON.stringify(parsed);
  const memberRecord = RuntimeTableSchemas.members.parse(member);
  const instruction = makeInstruction(
    domain,
    memberRecord.id,
    memberRecord.nonce,
    Math.floor(Date.now() / 1000) + 300,
    domain.contract,
    'putjson',
    encodeAction('putjson', {
      runtime: domain.contract,
      dao_id: domain.daoId,
      member_id: memberRecord.id,
      document_id: config.DACLIFY_AGENT_DOCUMENT,
      version: config.DACLIFY_AGENT_DOCUMENT_VERSION,
      value: canonical,
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  const result = ApiRoutes.relay.response.parse(
    await request(ApiRoutes.relay.path, {
      request: instruction,
      session_id: credential.id,
      sig: signing.signDigest(instructionDigest(instruction)).toString(),
    }),
  );
  process.stdout.write(
    JSON.stringify({
      dao: domain,
      documentId: config.DACLIFY_AGENT_DOCUMENT,
      transactionId: result.transactionId,
    }) + '\n',
  );
}
await main().catch(() => {
  process.stderr.write(
    'Agent request failed. Check local configuration, credential scope, expiry, nonce and service availability. No private diagnostic is printed.\n',
  );
  process.exitCode = 1;
});
