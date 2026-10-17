import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PublicKey, Signature } from '@wharfkit/antelope';
import { ApiRoutes } from '../../../../protocol/routes.js';
import {
  McpDiagnosticCodeSchema,
  McpReadInputSchema,
  McpReadResultSchema,
  McpPrepareInputSchema,
  PreparedInstructionSchema,
  SignedMcpInstructionSchema,
  type McpReadInput,
  type McpPrepareInput,
  type PreparedInstruction,
  type SignedMcpInstruction,
  type SubmissionResult,
} from '../../../../protocol/mcp.js';
import { ExitSubmissionSchema } from '../../../../protocol/account-exit.js';
import {
  prepareCommunityInstruction,
  type CommunityAccess,
} from '../../../../sdk/community-agent.js';
import { instructionDigest } from '../../../../sdk/index.js';
import { communityModuleAdapter } from '../../../../packages/community-mcp/src/modules.js';
import { ModuleApiRoutes, ModulePageQuerySchema } from '@daclify/modules';
import { ConnectedAppsRoutes } from '../../../../protocol/connected-apps.js';
import type { McpPairings } from './pairing.js';
import { withTransaction } from '../auth/account-session.js';
import { ApiError } from '../errors.js';
type PreparationRow = { prepared: unknown; packet: unknown; state: string };
export class LocalCommunityAccess implements CommunityAccess {
  constructor(
    private readonly service: McpPairings,
    private readonly token: string | (() => ReturnType<McpPairings['authorize']>),
  ) {}
  private authorize() {
    return typeof this.token === 'string' ? this.service.authorize(this.token) : this.token();
  }
  private async resolve(input: McpPrepareInput) {
    const current = await this.authorize(),
      { grant, member, governance, account } = current,
      chain = this.service.chain;
    if (!chain) throw new ApiError('MCP_UNAVAILABLE', 503);
    const request = async (path: string): Promise<unknown> => {
      if (path === ApiRoutes.dao.path.replace(':id', grant.dao.daoId))
        return chain.dao(grant.dao.daoId);
      if (path.split('?')[0] === ModuleApiRoutes.state.path.replace(':id', grant.dao.daoId)) {
        const url = new URL(path, this.service.api);
        const query = url.search
          ? ModulePageQuerySchema.parse(Object.fromEntries(url.searchParams))
          : undefined;
        if (query?.memberId && query.memberId !== member.memberId)
          throw new ApiError('MCP_SCOPE_REQUIRED', 403);
        return chain.moduleState(grant.dao.daoId, query);
      }
      if (
        path === ConnectedAppsRoutes.connectedApps.path.replace(':id', grant.dao.daoId) &&
        this.service.apps
      )
        return this.service.apps.list(account, grant.dao.daoId);
      throw new ApiError('MCP_SCOPE_REQUIRED', 403);
    };
    const action = await communityModuleAdapter(grant.app).prepare(input, {
      connection: { dao: grant.dao },
      member,
      governance,
      request,
    });
    try {
      return {
        current,
        prepared: prepareCommunityInstruction(input, {
          connection: grant,
          member,
          governance,
          credential: {
            sessionId: grant.sessionId,
            signingPublicKey: grant.delegatePublicKey,
            ...(grant.app ? { appId: grant.app.appId } : {}),
          },
          action,
          ...(account.signingKey ? { rootSigningKey: account.signingKey } : {}),
        }),
      };
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'MCP_SESSION_SCOPE')
        throw new ApiError('MCP_APPROVAL_PENDING', 403);
      if (cause instanceof Error && cause.message === 'MCP_SCOPE_REQUIRED')
        throw new ApiError('MCP_SCOPE_REQUIRED', 403);
      throw cause;
    }
  }

  async read(input: McpReadInput) {
    const parsed = McpReadInputSchema.parse(input),
      current = await this.authorize();
    if (parsed.tool === 'list_daos') return { daos: [current.grant.dao] };
    if (parsed.tool === 'get_membership') return McpReadResultSchema.parse(current.member);
    if (!this.service.chain) throw new ApiError('MCP_UNAVAILABLE', 503);
    return communityModuleAdapter(current.grant.app).readActivity(current.grant, parsed, async () =>
      this.service.chain?.moduleState(current.grant.dao.daoId),
    );
  }
  async prepare(input: McpPrepareInput): Promise<PreparedInstruction> {
    const parsed = McpPrepareInputSchema.parse(input),
      authorized = await this.authorize();
    if (
      (
        await this.service.pool.query(
          "SELECT 1 FROM mcp_preparations WHERE grant_id=$1 AND state='submitting' AND expires_at>now() LIMIT 1",
          [authorized.grant.id],
        )
      ).rowCount
    )
      throw new ApiError('MCP_RECONCILE_REQUIRED', 409);
    const { current, prepared } = await this.resolve(parsed).catch((cause) => {
      const code = McpDiagnosticCodeSchema.safeParse(cause instanceof Error ? cause.message : '');
      if (code.success) throw new ApiError(code.data, 403);
      throw cause;
    });
    const value = PreparedInstructionSchema.parse({ id: randomUUID(), ...prepared });
    await withTransaction(this.service.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'mcp-grant:' + current.grant.id,
      ]);
      const counts = (
        await db.query<{ total: string; pending: string }>(
          "SELECT count(*) FILTER(WHERE state='prepared' AND (prepared->>'expires')::bigint>extract(epoch FROM now()))::text AS total,count(*) FILTER(WHERE state='submitting')::text AS pending FROM mcp_preparations WHERE grant_id=$1 AND expires_at>now()",
          [current.grant.id],
        )
      ).rows[0];
      if (!counts || Number(counts.total) >= 16 || Number(counts.pending) > 0)
        throw new ApiError('MCP_RECONCILE_REQUIRED', 409);
      await db.query(
        'INSERT INTO mcp_preparations(id,account_id,grant_id,prepared,expires_at) VALUES($1,$2,$3,$4,$5)',
        [
          value.id,
          current.account.id,
          current.grant.id,
          value,
          new Date((value.expires + 86400) * 1000),
        ],
      );
    });
    return value;
  }
  async validatePrepared(input: PreparedInstruction) {
    const value = PreparedInstructionSchema.parse(input),
      { current, prepared } = await this.resolve(value.intent);
    const row = (
      await this.service.pool.query<PreparationRow>(
        'SELECT prepared,packet,state FROM mcp_preparations WHERE id=$1 AND grant_id=$2 AND account_id=$3 AND expires_at>now()',
        [value.id, current.grant.id, current.account.id],
      )
    ).rows[0];
    if (
      !row ||
      !isDeepStrictEqual(PreparedInstructionSchema.parse(row.prepared), value) ||
      value.expires <= Date.now() / 1000 ||
      value.expires > prepared.expires
    )
      throw new ApiError('MCP_PREPARED_CHANGED', 409);
    prepared.request.expires = value.expires;
    prepared.expires = value.expires;
    prepared.digest = instructionDigest(prepared.request).toString();
    if (!isDeepStrictEqual({ id: value.id, ...prepared }, value))
      throw new ApiError('MCP_CONTEXT_CHANGED', 409);
    return value.request;
  }
  async submitSigned(input: SignedMcpInstruction): Promise<SubmissionResult> {
    const signed = SignedMcpInstructionSchema.parse(input),
      current = await this.authorize(),
      chain = this.service.chain;
    if (
      !chain?.prepareScopedSubmission ||
      !chain.submitPreparedScoped ||
      !chain.reconcileScopedSubmission
    )
      throw new ApiError('MCP_DELIVERY_UNAVAILABLE', 503);
    const existing = (
      await this.service.pool.query<PreparationRow>(
        'SELECT prepared,packet,state FROM mcp_preparations WHERE id=$1 AND grant_id=$2 AND account_id=$3',
        [signed.prepared.id, current.grant.id, current.account.id],
      )
    ).rows[0];
    if (
      !existing ||
      !isDeepStrictEqual(PreparedInstructionSchema.parse(existing.prepared), signed.prepared)
    )
      throw new ApiError('MCP_PREPARED_CHANGED', 409);
    if (existing.packet) {
      const packet = ExitSubmissionSchema.parse(existing.packet);
      if (existing.state === 'confirmed')
        return { state: 'submitted', transactionId: packet.transactionId };
      const receipt = await chain.reconcileScopedSubmission(packet);
      await this.service.pool.query('UPDATE mcp_preparations SET packet=$2,state=$3 WHERE id=$1', [
        signed.prepared.id,
        { ...packet, cursor: receipt.cursor },
        receipt.state === 'confirmed' ? 'confirmed' : 'submitting',
      ]);
      return receipt.state === 'confirmed'
        ? { state: 'submitted', transactionId: packet.transactionId }
        : {
            state: 'reconcile-required',
            preparedId: signed.prepared.id,
            digest: signed.prepared.digest,
          };
    }
    const request = await this.validatePrepared(signed.prepared);
    let valid = false;
    try {
      valid = Signature.from(signed.signature).verifyDigest(
        instructionDigest(request),
        PublicKey.from(signed.prepared.signingPublicKey),
      );
    } catch {
      /* Malformed signatures are permission failures, never a service outage. */
    }
    if (!valid) throw new ApiError('MCP_SIGNATURE', 403);
    const packet = await chain.prepareScopedSubmission(
      current.account,
      request,
      signed.signature,
      signed.prepared.sessionId,
    );
    await withTransaction(this.service.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'mcp-grant:' + current.grant.id,
      ]);
      const stored = (
        await db.query<PreparationRow>(
          'SELECT prepared,packet,state FROM mcp_preparations WHERE id=$1 AND grant_id=$2 FOR UPDATE',
          [signed.prepared.id, current.grant.id],
        )
      ).rows[0];
      if (!stored || stored.packet || stored.state !== 'prepared')
        throw new ApiError('MCP_RECONCILE_REQUIRED', 409);
      const other = await db.query(
        "SELECT id FROM mcp_preparations WHERE grant_id=$1 AND state='submitting'",
        [current.grant.id],
      );
      if (other.rowCount) throw new ApiError('MCP_RECONCILE_REQUIRED', 409);
      await db.query("UPDATE mcp_preparations SET packet=$2,state='submitting' WHERE id=$1", [
        signed.prepared.id,
        packet,
      ]);
    });
    // Recheck after durable packet persistence and immediately before delivery; never allocate another packet on error.
    await this.validatePrepared(signed.prepared);
    try {
      await chain.submitPreparedScoped(packet);
      await this.service.pool.query("UPDATE mcp_preparations SET state='confirmed' WHERE id=$1", [
        signed.prepared.id,
      ]);
      return { state: 'submitted', transactionId: packet.transactionId };
    } catch {
      return {
        state: 'reconcile-required',
        preparedId: signed.prepared.id,
        digest: signed.prepared.digest,
      };
    }
  }
}
