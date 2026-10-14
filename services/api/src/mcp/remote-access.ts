import {
  McpReadInputSchema,
  McpReadResultSchema,
  McpPrepareInputSchema,
  McpPreviewSchema,
  type McpReadInput,
  type McpPrepareInput,
  type SignedMcpInstruction,
} from '../../../../protocol/mcp.js';
import { ApiRoutes } from '../../../../protocol/routes.js';
import { ConnectedAppsRoutes } from '../../../../protocol/connected-apps.js';
import { instructionDigest, makeInstruction } from '../../../../sdk/index.js';
import type { CommunityAccess } from '../../../../sdk/community-agent.js';
import { ModuleApiRoutes, ModulePageQuerySchema } from '@daclify/modules';
import { communityModuleAdapter } from '../../../../packages/community-mcp/src/modules.js';
import type { McpOAuth } from './oauth.js';
import { LocalCommunityAccess } from './access.js';
import { ApiError } from '../errors.js';
export class RemoteCommunityAccess implements CommunityAccess {
  constructor(
    private readonly service: McpOAuth,
    private readonly token: string,
  ) {}
  private async current(scope: 'daclify:read' | 'daclify:prepare' | 'daclify:submit') {
    const current = await this.service.authorizeToken(this.token);
    if (!current.claims.scopes.includes(scope)) throw new ApiError('MCP_SCOPE_REQUIRED', 403);
    return current;
  }
  private localAccess() {
    return new LocalCommunityAccess(this.service.pairings, async () => {
      const current = await this.current('daclify:submit');
      if (!current.local) throw new ApiError('MCP_LOCAL_SIGNER_REQUIRED', 403);
      return current.local;
    });
  }
  async read(input: McpReadInput) {
    const parsed = McpReadInputSchema.parse(input),
      current = await this.current('daclify:read');
    if (parsed.tool === 'list_daos') return { daos: [current.claims.dao] };
    if (parsed.tool === 'get_membership') return McpReadResultSchema.parse(current.member);
    const chain = this.service.pairings.chain;
    if (!chain) throw new ApiError('MCP_UNAVAILABLE', 503);
    return communityModuleAdapter(current.local?.grant.app).readActivity(
      { dao: current.claims.dao },
      parsed,
      async () => chain.moduleState(current.claims.dao.daoId),
    );
  }
  async prepare(input: McpPrepareInput) {
    const parsed = McpPrepareInputSchema.parse(input),
      current = await this.current('daclify:prepare');
    const scope =
      parsed.tool === 'prepare_proposal'
        ? 'proposal'
        : parsed.tool === 'prepare_vote'
          ? 'vote'
          : parsed.tool === 'prepare_review'
            ? 'review'
            : 'activity';
    if (!current.claims.nativeScopes.includes(scope)) throw new ApiError('MCP_SCOPE_REQUIRED', 403);
    if (current.local) {
      const access = new LocalCommunityAccess(this.service.pairings, async () => {
        const fresh = await this.current('daclify:prepare');
        if (!fresh.local || !fresh.claims.nativeScopes.includes(scope))
          throw new ApiError('MCP_SCOPE_REQUIRED', 403);
        return {
          ...fresh.local,
          grant: { ...fresh.local.grant, scopes: fresh.claims.nativeScopes },
        };
      });
      return access.prepare(parsed);
    }
    if (scope === 'activity') throw new ApiError('MCP_APP_CREDENTIAL_REQUIRED', 403);
    const chain = this.service.pairings.chain;
    if (!chain) throw new ApiError('MCP_UNAVAILABLE', 503);
    const dao = current.claims.dao,
      request = async (path: string): Promise<unknown> => {
        if (path === ApiRoutes.dao.path.replace(':id', dao.daoId)) return chain.dao(dao.daoId);
        if (path.split('?')[0] === ModuleApiRoutes.state.path.replace(':id', dao.daoId)) {
          const url = new URL(path, this.service.pairings.api),
            query = url.search
              ? ModulePageQuerySchema.parse(Object.fromEntries(url.searchParams))
              : undefined;
          if (query?.memberId && query.memberId !== current.member.memberId)
            throw new ApiError('MCP_SCOPE_REQUIRED', 403);
          return chain.moduleState(dao.daoId, query);
        }
        if (path === ConnectedAppsRoutes.connectedApps.path.replace(':id', dao.daoId))
          throw new ApiError('MCP_APP_CREDENTIAL_REQUIRED', 403);
        throw new ApiError('MCP_SCOPE_REQUIRED', 403);
      };
    const action = await communityModuleAdapter().prepare(parsed, {
      connection: { dao },
      member: current.member,
      governance: current.governance,
      request,
    });
    if (
      !current.governance.policy ||
      action.target === dao.contract ||
      !(scope === 'proposal' ? ['open','openpoll'] : scope === 'vote' ? ['vote','votecommit'] : ['review']).includes(action.action)
    )
      throw new ApiError('MCP_SCOPE_REQUIRED', 403);
    const expires = Math.floor(Date.now() / 1000) + 300,
      instruction = makeInstruction(
        dao,
        current.member.memberId,
        current.member.nonce,
        expires,
        action.target,
        action.action,
        action.data,
      );
    return McpPreviewSchema.parse({
      state: 'signer-required',
      intent: parsed,
      request: instruction,
      digest: instructionDigest(instruction).toString(),
      scope,
      codeHash: action.codeHash,
      policyRevision: current.governance.policy.revision,
      expires,
    });
  }
  async submitSigned(input: SignedMcpInstruction) {
    const current = await this.current('daclify:submit');
    if (!current.claims.nativeScopes.includes(input.prepared.scope))
      throw new ApiError('MCP_SCOPE_REQUIRED', 403);
    return this.localAccess().submitSigned(input);
  }
}
