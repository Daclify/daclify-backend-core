import { PublicKey, Signature } from '@wharfkit/antelope';
import { ApiRoutes } from '../protocol/routes.js';
import { LoginMessageSchema, type UserMembership } from '../protocol/api.js';
import { type GovernanceState } from '../protocol/dao.js';
import {
  MCP_SCOPE_ACTIONS,
  McpConnectionSchema,
  McpReadInputSchema,
  McpReadResultSchema,
  McpPrepareInputSchema,
  PreparedInstructionSchema,
  SignedMcpInstructionSchema,
  type McpPreparation,
  type McpConnection,
  type McpReadInput,
  type McpReadResult,
  type McpPrepareInput,
  type PreparedInstruction,
  type SignedMcpInstruction,
  type SubmissionResult,
} from '../protocol/mcp.js';
import { readAppResponse } from './connected-apps.js';
import { makeInstruction, instructionDigest, type instruction as Instruction } from './index.js';

export interface CommunitySigner {
  signLoginMessage(message: string): Promise<string>;
  signInstruction(request: Instruction): Promise<string>;
}
export interface CommunityAccess {
  read(input: McpReadInput): Promise<McpReadResult>;
  prepare(input: McpPrepareInput): Promise<McpPreparation>;
  submitSigned(input: SignedMcpInstruction): Promise<SubmissionResult>;
}
export type CommunityRequest = (path: string, body?: unknown) => Promise<unknown>;
export interface CommunityModuleAdapter {
  readActivity(
    connection: McpConnection,
    input: McpReadInput,
    request: CommunityRequest,
  ): Promise<McpReadResult>;
  prepare(
    input: McpPrepareInput,
    context: {
      connection: McpConnection;
      member: UserMembership;
      governance: GovernanceState;
      request: CommunityRequest;
    },
  ): Promise<{ target: string; action: string; data: Uint8Array; codeHash: string }>;
}
export interface CommunityAgentOptions {
  fetch?: typeof fetch;
  modules?: CommunityModuleAdapter;
  credential?: { sessionId: string; signingPublicKey: string; appId?: string };
}
export class CommunityAgentClient implements CommunityAccess {
  readonly connection: McpConnection;
  private cookies = new Map<string, string>();
  private csrf = '';
  private loggedIn = false;
  private accountId: string | undefined;
  private prepared = new Map<string, PreparedInstruction>();
  private pending: PreparedInstruction | undefined;
  constructor(
    connection: unknown,
    private readonly signer: CommunitySigner,
    private readonly options: CommunityAgentOptions = {},
  ) {
    this.connection = McpConnectionSchema.parse(connection);
  }
  private request: CommunityRequest = async (path, body) => {
    if (!path.startsWith('/v1/') || path.startsWith('//')) throw new Error('MCP_API_PATH');
    const response = await (this.options.fetch ?? fetch)(new URL(path, this.connection.api), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: this.connection.origin,
        ...(this.cookies.size
          ? { cookie: [...this.cookies].map(([k, v]) => k + '=' + v).join('; ') }
          : {}),
        ...(body === undefined
          ? {}
          : { 'content-type': 'application/json', 'x-csrf-token': this.csrf }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('MCP_API_REJECTED');
    for (const raw of response.headers.getSetCookie()) {
      const cookie = raw.split(';')[0];
      if (!cookie || cookie.length > 4096) throw new Error('MCP_API_RESPONSE');
      const index = cookie.indexOf('=');
      if (index < 1 || this.cookies.size >= 16) throw new Error('MCP_API_RESPONSE');
      this.cookies.set(cookie.slice(0, index), cookie.slice(index + 1));
    }
    if (response.status === 204) return null;
    return JSON.parse(new TextDecoder().decode(await readAppResponse(response, 2 * 1024 * 1024)));
  };
  async login(): Promise<void> {
    await this.network();
    const auth = this.connection.authentication;
    const challenge = ApiRoutes.challenge.response.parse(
      await this.request(
        ApiRoutes.challenge.path,
        ApiRoutes.challenge.input.parse({
          signingKey: auth.signingPublicKey,
          encryptionKey: auth.encryptionPublicKey,
        }),
      ),
    );
    const message = LoginMessageSchema.safeParse(JSON.parse(challenge.message));
    if (
      !message.success ||
      message.data.origin !== this.connection.origin ||
      message.data.audience !== this.connection.api ||
      message.data.challenge !== challenge.id ||
      message.data.signingKey !== auth.signingPublicKey ||
      JSON.stringify(message.data.encryptionKey) !== JSON.stringify(auth.encryptionPublicKey) ||
      message.data.expires !== challenge.expires ||
      Date.parse(challenge.expires) <= Date.now()
    )
      throw new Error('MCP_LOGIN_CONTEXT');
    const session = ApiRoutes.login.response.parse(
      await this.request(
        ApiRoutes.login.path,
        ApiRoutes.login.input.parse({
          challengeId: challenge.id,
          signature: await this.signer.signLoginMessage(challenge.message),
          encryptionKey: auth.encryptionPublicKey,
        }),
      ),
    );
    if (
      session.account.signingKey !== auth.signingPublicKey ||
      JSON.stringify(session.account.encryptionKey) !== JSON.stringify(auth.encryptionPublicKey)
    )
      throw new Error('MCP_LOGIN_CONTEXT');
    this.csrf = session.csrfToken;
    this.accountId = session.account.id;
    this.loggedIn = true;
    await this.membership();
  }
  async logout(): Promise<void> {
    try {
      if (this.loggedIn) await this.request(ApiRoutes.logout.path, {});
    } finally {
      this.cookies.clear();
      this.csrf = '';
      this.loggedIn = false;
      this.accountId = undefined;
      this.prepared.clear();
    }
  }
  authenticatedAccountId(): string {
    if (!this.loggedIn || !this.accountId) throw new Error('MCP_LOGIN_REQUIRED');
    return this.accountId;
  }
  // Trusted SDK callers share authenticated transport; this method is never an MCP tool.
  async authenticatedRequest(path: string, body?: unknown): Promise<unknown> {
    if (!this.loggedIn) throw new Error('MCP_LOGIN_REQUIRED');
    return this.request(path, body);
  }
  private async network(): Promise<void> {
    const network = ApiRoutes.network.response.parse(await this.request(ApiRoutes.network.path));
    const dao = this.connection.dao;
    if (
      network.chainId !== dao.chainId ||
      network.runtime !== dao.contract ||
      network.interfaceVersion !== dao.interfaceVersion
    )
      throw new Error('MCP_DOMAIN');
    if (!network.capabilities.includes('guarded-agents')) throw new Error('MCP_CAPABILITY');
  }
  private async membership(): Promise<UserMembership> {
    if (!this.loggedIn) throw new Error('MCP_LOGIN_REQUIRED');
    const memberships = ApiRoutes.memberships.response.parse(
      await this.request(ApiRoutes.memberships.path),
    );
    const member = memberships.memberships.find(
      (value) =>
        JSON.stringify(value.dao) === JSON.stringify(this.connection.dao) &&
        value.memberId === this.connection.memberId,
    );
    if (!member?.active) throw new Error('MCP_MEMBER_INACTIVE');
    return member;
  }
  async read(input: McpReadInput): Promise<McpReadResult> {
    const parsed = McpReadInputSchema.parse(input);
    const member = await this.membership();
    if (parsed.tool === 'get_membership') return McpReadResultSchema.parse(member);
    // A connection cannot enumerate another community through an unfiltered discovery response.
    if (parsed.tool === 'list_daos') return McpReadResultSchema.parse({ daos: [member.dao] });
    if (!this.options.modules) throw new Error('MCP_MODULE_ADAPTER_REQUIRED');
    return McpReadResultSchema.parse(
      await this.options.modules.readActivity(this.connection, parsed, this.request),
    );
  }
  private async resolve(input: McpPrepareInput): Promise<Omit<PreparedInstruction, 'id'>> {
    const parsed = McpPrepareInputSchema.parse(input);
    if (!this.options.modules || !this.options.credential) throw new Error('MCP_DELEGATE_REQUIRED');
    await this.network();
    const member = await this.membership();
    const governance = ApiRoutes.governance.response.parse(
      await this.request(ApiRoutes.governance.path.replace(':id', this.connection.dao.daoId)),
    );
    // Resolve only producer-owned bounded intents; both local and hosted paths share native authority checks.
    const action = await this.options.modules.prepare(parsed, {
      connection: this.connection,
      member,
      governance,
      request: this.request,
    });
    return prepareCommunityInstruction(parsed, {
      connection: this.connection,
      member,
      governance,
      credential: this.options.credential,
      action,
      rootSigningKey: this.connection.authentication.signingPublicKey,
    });
  }

  async prepare(input: McpPrepareInput): Promise<PreparedInstruction> {
    if (this.pending) throw new Error('MCP_RECONCILE_REQUIRED');
    if (this.prepared.size >= 16) throw new Error('MCP_PREPARATION_LIMIT');
    const value = PreparedInstructionSchema.parse({
      id: crypto.randomUUID(),
      ...(await this.resolve(input)),
    });
    this.prepared.set(value.id, structuredClone(value));
    return value;
  }
  async validatePrepared(input: PreparedInstruction): Promise<Instruction> {
    const value = PreparedInstructionSchema.parse(input);
    const original = this.prepared.get(value.id);
    if (
      !original ||
      JSON.stringify(original) !== JSON.stringify(value) ||
      value.expires <= Math.floor(Date.now() / 1000)
    )
      throw new Error('MCP_PREPARED_CHANGED');
    const current = await this.resolve(value.intent);
    if (value.expires > current.expires) throw new Error('MCP_CONTEXT_CHANGED');
    // Keep the original expiry while rechecking nonce, module pin, roles and current policy.
    current.request.expires = value.expires;
    current.expires = value.expires;
    current.digest = instructionDigest(current.request).toString();
    if (JSON.stringify({ id: value.id, ...current }) !== JSON.stringify(value))
      throw new Error('MCP_CONTEXT_CHANGED');
    return current.request;
  }
  async submitSigned(input: SignedMcpInstruction): Promise<SubmissionResult> {
    const signed = SignedMcpInstructionSchema.parse(input);
    if (this.pending) throw new Error('MCP_RECONCILE_REQUIRED');
    const request = await this.validatePrepared(signed.prepared);
    if (
      !Signature.from(signed.signature).verifyDigest(
        instructionDigest(request),
        PublicKey.from(signed.prepared.signingPublicKey),
      )
    )
      throw new Error('MCP_SIGNATURE');
    this.pending = structuredClone(signed.prepared);
    try {
      const result = ApiRoutes.relay.response.parse(
        await this.request(
          ApiRoutes.relay.path,
          ApiRoutes.relay.input.parse({
            request,
            session_id: signed.prepared.sessionId,
            sig: signed.signature,
          }),
        ),
      );
      this.pending = undefined;
      this.prepared.clear();
      return { state: 'submitted', transactionId: result.transactionId };
    } catch {
      return {
        state: 'reconcile-required',
        preparedId: signed.prepared.id,
        digest: signed.prepared.digest,
      };
    }
  }
}

export function prepareCommunityInstruction(
  input: McpPrepareInput,
  context: {
    connection: Pick<McpConnection, 'dao' | 'memberId' | 'scopes'>;
    member: UserMembership;
    governance: GovernanceState;
    credential: NonNullable<CommunityAgentOptions['credential']>;
    action: Awaited<ReturnType<CommunityModuleAdapter['prepare']>>;
    rootSigningKey?: string;
  },
): Omit<PreparedInstruction, 'id'> {
  const parsed = McpPrepareInputSchema.parse(input);
  const { connection, member, governance, credential, action, rootSigningKey } = context;
  if (
    !member.active ||
    member.memberId !== connection.memberId ||
    JSON.stringify(member.dao) !== JSON.stringify(connection.dao)
  )
    throw new Error('MCP_MEMBER_INACTIVE');
  const scope =
    parsed.tool === 'prepare_proposal'
      ? 'proposal'
      : parsed.tool === 'prepare_vote'
        ? 'vote'
        : parsed.tool === 'prepare_review'
          ? 'review'
          : 'activity';
  if (!connection.scopes.includes(scope)) throw new Error('MCP_SCOPE_REQUIRED');
  if (
    scope === 'activity' &&
    (!credential?.appId ||
      parsed.tool !== 'prepare_activity' ||
      credential.appId !== parsed.input.appId)
  )
    throw new Error('MCP_APP_CREDENTIAL_REQUIRED');
  if (scope !== 'activity' && credential?.appId) throw new Error('MCP_ROUTINE_CREDENTIAL_REQUIRED');
  if (scope === 'review' && !member.reviewer) throw new Error('MCP_REVIEWER_REQUIRED');
  if (JSON.stringify(governance.dao) !== JSON.stringify(connection.dao))
    throw new Error('MCP_DOMAIN');
  if (!governance.policy) throw new Error('MCP_POLICY_REQUIRED');
  const now = Math.floor(Date.now() / 1000);
  if (governance.guardian && governance.guardian.paused_until > now)
    throw new Error('MCP_DAO_PAUSED');
  const actor = governance.actors.find((value) => value.id === member.memberId);
  if (actor?.revoked) throw new Error('MCP_ACTOR_REVOKED');
  if (rootSigningKey && credential.signingPublicKey === rootSigningKey)
    throw new Error('MCP_SIGNER_KEYS');
  const session = governance.sessions.find(
    (value) =>
      value.id === credential.sessionId &&
      value.member_id === member.memberId &&
      value.signing_key === credential.signingPublicKey,
  );
  if (
    !session ||
    session.expires <= now ||
    session.credential_epoch !== (actor?.credential_epoch ?? '1')
  )
    throw new Error('MCP_SESSION_REVOKED');
  const allowedActions: readonly string[] = MCP_SCOPE_ACTIONS[scope];
  if (!allowedActions.includes(action.action) || action.target === connection.dao.contract)
    throw new Error('MCP_INTENT_ACTION');
  if (
    !session.permissions.some(
      (value) =>
        value.target === action.target &&
        value.action === action.action &&
        value.code_hash === action.codeHash,
    )
  )
    throw new Error('MCP_SESSION_SCOPE');
  const expires = Math.min(now + 300, session.expires);
  const request = makeInstruction(
    connection.dao,
    member.memberId,
    member.nonce,
    expires,
    action.target,
    action.action,
    action.data,
  );
  return {
    intent: parsed,
    request,
    digest: instructionDigest(request).toString(),
    scope,
    sessionId: session.id,
    signingPublicKey: session.signing_key,
    codeHash: action.codeHash,
    policyRevision: governance.policy.revision,
    expires,
  };
}
