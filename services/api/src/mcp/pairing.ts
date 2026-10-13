import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import {
  McpPairingInputSchema,
  McpPairingSchema,
  McpPairingApprovalSchema,
  McpGrantSchema,
} from '../../../../protocol/mcp.js';
import { readAccount, withTransaction } from '../auth/account-session.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import type { ConnectedApps } from '../connected-apps/service.js';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
const hash = (value: string) => createHash('sha256').update(value).digest();
const invalid = () => new ApiError('MCP_PAIRING_INVALID', 403);
type PairingRow = {
  request: unknown;
  account_id: string | null;
  approved_grant: string | null;
  expires_at: Date;
};
type GrantRow = {
  id: string;
  account_id: string;
  context: unknown;
  credential_epoch: string;
  expires_at: Date;
};
export class McpPairings {
  constructor(
    readonly pool: Pool,
    readonly chain: ChainGateway | undefined,
    readonly api: string,
    readonly frontend: string,
    readonly apps?: ConnectedApps,
  ) {}
  async begin(input: unknown) {
    const request = McpPairingInputSchema.parse(input),
      id = randomUUID(),
      expires = new Date(Date.now() + 300000).toISOString();
    await withTransaction(this.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'mcp-pairings-admission',
      ]);
      const count = (
        await db.query<{ total: string }>(
          'SELECT count(*)::text AS total FROM mcp_pairings WHERE expires_at>now()',
        )
      ).rows[0];
      if (!count || Number(count.total) >= 10000) throw new ApiError('RATE_LIMIT', 429);
      await db.query('INSERT INTO mcp_pairings(id,request,expires_at) VALUES($1,$2,$3)', [
        id,
        request,
        expires,
      ]);
    });
    return {
      ...McpPairingSchema.parse({ ...request, id, expires }),
      consentUrl: this.frontend + '/mcp/consent?request=' + id,
    };
  }
  private async pairing(id: string): Promise<PairingRow> {
    const row = (
      await this.pool.query<PairingRow>(
        'SELECT request,account_id,approved_grant,expires_at FROM mcp_pairings WHERE id=$1 AND consumed_at IS NULL AND expires_at>now()',
        [z.uuid().parse(id)],
      )
    ).rows[0];
    if (!row) throw invalid();
    return row;
  }
  async consent(account: Account, id: string) {
    if (!this.chain || !(await readAccount(this.pool, account.id))) throw invalid();
    const row = await this.pairing(id),
      pairing = McpPairingSchema.parse({
        ...McpPairingInputSchema.parse(row.request),
        id,
        expires: row.expires_at.toISOString(),
      });
    if (row.account_id && row.account_id !== account.id) throw invalid();
    const member = (await this.chain.memberships(account)).find(
      (value) =>
        value.active &&
        value.memberId === pairing.memberId &&
        isDeepStrictEqual(value.dao, pairing.dao),
    );
    if (!member) throw new ApiError('MCP_MEMBER_INACTIVE', 403);
    const state = await this.chain.moduleState(pairing.dao.daoId),
      governance = await this.chain.governance(pairing.dao.daoId);
    if (
      !isDeepStrictEqual(state.dao, pairing.dao) ||
      !isDeepStrictEqual(governance.dao, pairing.dao) ||
      !governance.policy ||
      (governance.guardian && governance.guardian.paused_until > Date.now() / 1000)
    )
      throw invalid();
    const actor = governance.actors.find((value) => value.id === member.memberId);
    if (actor?.revoked) throw invalid();
    if (pairing.scopes.includes('review') && !member.reviewer)
      throw new ApiError('MCP_REVIEWER_REQUIRED', 403);
    const permissions = pairing.scopes.map((scope) => {
      const moduleId = scope === 'review' ? 'works' : scope === 'activity' ? 'activity' : 'decide';
      const module = state.modules.find((value) => value.deployment.id === moduleId);
      const action =
        scope === 'review'
          ? 'review'
          : scope === 'activity'
            ? 'recordact'
            : scope === 'vote'
              ? 'vote'
              : 'open';
      if (
        !module?.installed ||
        !module.enabled ||
        !module.compatible ||
        !module.codeVerified ||
        module.deployment.codeHash !== ModuleCodeHashes[moduleId] ||
        !module.actions.includes(action)
      )
        throw new ApiError('MCP_MODULE_PIN', 403);
      return { target: module.deployment.account, action, code_hash: module.deployment.codeHash };
    });
    if (pairing.app) {
      if (!this.apps) throw invalid();
      const current = (await this.apps.list(account, pairing.dao.daoId)).find(
        (value) => value.config.appId === pairing.app?.appId,
      );
      if (
        !current?.native?.enabled ||
        current.native.revision !== pairing.app.revision ||
        current.native.config_hash !== pairing.app.configHash ||
        current.configHash !== pairing.app.configHash
      )
        throw invalid();
      const permission = permissions[0];
      if (!permission || permission.target !== current.native.target) throw invalid();
      permissions.push({ ...permission, action: 'askreview' });
    }
    const expiredSessions = governance.sessions
      .filter(
        (session) => session.member_id === member.memberId && session.expires <= Date.now() / 1000,
      )
      .map((session) => session.id);
    if (expiredSessions.length && this.chain.pruneExpiredSessions)
      await this.chain.pruneExpiredSessions(pairing.dao, expiredSessions);
    // Binding is only claimed by an authenticated matching member; approval still needs fresh control proof.
    const claimed = await this.pool.query(
      'UPDATE mcp_pairings SET account_id=$2 WHERE id=$1 AND (account_id IS NULL OR account_id=$2) AND consumed_at IS NULL AND expires_at>now()',
      [id, account.id],
    );
    if (!claimed.rowCount) throw invalid();
    return { pairing, permissions, grantExpires: Math.floor(Date.now() / 1000) + 3600 };
  }
  async approve(account: Account, input: unknown) {
    if (!this.chain) throw invalid();
    const approval = McpPairingApprovalSchema.parse(input);
    const consent = await this.consent(account, approval.id),
      request = consent.pairing;
    if (
      !isDeepStrictEqual(request.dao, approval.dao) ||
      request.memberId !== approval.memberId ||
      !isDeepStrictEqual(request.scopes, approval.scopes)
    )
      throw invalid();
    const governance = await this.chain.governance(request.dao.daoId),
      credential = governance.sessions.find(
        (value) =>
          value.id === approval.sessionId &&
          value.member_id === request.memberId &&
          value.signing_key === request.delegatePublicKey,
      );
    const epoch =
      governance.actors.find((value) => value.id === request.memberId)?.credential_epoch ?? '1';
    if (request.app) {
      const bound = await this.chain.connectedApps?.session(request.dao.daoId, approval.sessionId);
      if (
        !bound ||
        bound.scope.app_id !== request.app.appId ||
        bound.scope.revision !== request.app.revision ||
        bound.credential.signing_key !== request.delegatePublicKey
      )
        throw new ApiError('MCP_APP_CREDENTIAL_REQUIRED', 403);
    }
    if (
      !credential ||
      credential.expires <= Date.now() / 1000 ||
      credential.expires > Date.now() / 1000 + 604800 ||
      credential.credential_epoch !== epoch ||
      !isDeepStrictEqual(credential.permissions, consent.permissions)
    )
      throw new ApiError('MCP_GRANT_REQUIRED', 403);
    const token = randomBytes(32).toString('base64url'),
      id = randomUUID();
    const grant = McpGrantSchema.parse({
      id,
      dao: request.dao,
      memberId: request.memberId,
      scopes: request.scopes,
      delegatePublicKey: request.delegatePublicKey,
      sessionId: credential.id,
      sessionExpires: credential.expires,
      mode: approval.mode,
      ...(request.app ? { app: request.app } : {}),
    });
    // The token is derived again at redeem; only its hash is retained by the service.
    await withTransaction(this.pool, async (db) => {
      await db.query(
        "SELECT id FROM accounts WHERE id=$1 AND erasure_state='none' AND merged_into IS NULL FOR SHARE",
        [account.id],
      );
      const row = (
        await db.query<PairingRow>(
          'SELECT request,account_id,approved_grant,expires_at FROM mcp_pairings WHERE id=$1 AND account_id=$2 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
          [approval.id, account.id],
        )
      ).rows[0];
      if (!row || row.approved_grant) throw invalid();
      await db.query(
        'INSERT INTO mcp_local_grants(id,account_id,token_hash,context,credential_epoch,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
        [id, account.id, hash(token), grant, epoch, new Date(credential.expires * 1000)],
      );
      await db.query('UPDATE mcp_pairings SET approved_grant=$2 WHERE id=$1', [approval.id, id]);
    });
    // Approval never returns the local token to the browser; redeem replaces this unavailable random hash.
    return { approved: true as const };
  }
  async redeem(id: string, verifier: string) {
    const codeVerifier = z
      .string()
      .regex(/^[A-Za-z0-9._~-]{43,128}$/)
      .safeParse(verifier);
    if (!codeVerifier.success) throw invalid();
    return withTransaction(this.pool, async (db) => {
      const row = (
        await db.query<PairingRow>(
          'SELECT request,account_id,approved_grant,expires_at FROM mcp_pairings WHERE id=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
          [z.uuid().parse(id)],
        )
      ).rows[0];
      if (!row?.approved_grant || !row.account_id) throw invalid();
      const pairing = McpPairingInputSchema.parse(row.request);
      const expected = Buffer.from(pairing.codeChallenge, 'base64url'),
        actual = createHash('sha256').update(verifier).digest();
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid();
      const owner = await readAccount(db, row.account_id);
      if (!owner) throw invalid();
      const grant = (
        await db.query<GrantRow>(
          'SELECT id,account_id,context,credential_epoch,expires_at FROM mcp_local_grants WHERE id=$1 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE',
          [row.approved_grant],
        )
      ).rows[0];
      if (!grant || grant.account_id !== owner.id) throw invalid();
      const token = randomBytes(32).toString('base64url');
      await db.query('UPDATE mcp_local_grants SET token_hash=$2 WHERE id=$1', [
        grant.id,
        hash(token),
      ]);
      await db.query('UPDATE mcp_pairings SET consumed_at=now() WHERE id=$1', [id]);
      return { grant: McpGrantSchema.parse(grant.context), token };
    });
  }
  async authorize(token: string) {
    if (!this.chain || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new ApiError('MCP_TOKEN_REQUIRED', 401);
    const row = (
      await this.pool.query<GrantRow>(
        'SELECT id,account_id,context,credential_epoch,expires_at FROM mcp_local_grants WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',
        [hash(token)],
      )
    ).rows[0];
    if (!row) throw new ApiError('MCP_TOKEN_REQUIRED', 401);
    return this.authorizeGrant(row.id, row.account_id);
  }
  async authorizeGrant(id: string, accountId: string) {
    if (!this.chain) throw new ApiError('MCP_TOKEN_REQUIRED', 401);
    const row = (
      await this.pool.query<GrantRow>(
        'SELECT id,account_id,context,credential_epoch,expires_at FROM mcp_local_grants WHERE id=$1 AND account_id=$2 AND revoked_at IS NULL AND expires_at>now()',
        [id, accountId],
      )
    ).rows[0];
    const account = row ? await readAccount(this.pool, row.account_id) : null;
    if (!row || !account) throw new ApiError('MCP_TOKEN_REQUIRED', 401);
    const grant = McpGrantSchema.parse(row.context),
      members = await this.chain.memberships(account),
      member = members.find(
        (value) =>
          value.active &&
          value.memberId === grant.memberId &&
          isDeepStrictEqual(value.dao, grant.dao),
      );
    const governance = await this.chain.governance(grant.dao.daoId),
      actor = governance.actors.find((value) => value.id === grant.memberId),
      credential = governance.sessions.find(
        (value) =>
          value.id === grant.sessionId &&
          value.member_id === grant.memberId &&
          value.signing_key === grant.delegatePublicKey,
      );
    const appScope = grant.app
      ? await this.chain.connectedApps?.session(grant.dao.daoId, grant.sessionId)
      : undefined;
    if (
      !member ||
      !isDeepStrictEqual(governance.dao, grant.dao) ||
      actor?.revoked ||
      (governance.guardian && governance.guardian.paused_until > Date.now() / 1000) ||
      !credential ||
      (grant.app &&
        (!appScope ||
          appScope.scope.app_id !== grant.app.appId ||
          appScope.scope.revision !== grant.app.revision ||
          appScope.credential.signing_key !== grant.delegatePublicKey)) ||
      credential.expires <= Date.now() / 1000 ||
      credential.credential_epoch !== row.credential_epoch ||
      (actor?.credential_epoch ?? '1') !== row.credential_epoch
    ) {
      await this.pool.query('UPDATE mcp_local_grants SET revoked_at=now() WHERE id=$1', [row.id]);
      throw new ApiError('MCP_GRANT_REVOKED', 401);
    }
    return { account, grant, member, governance, credential };
  }
  async revoke(token: string) {
    const { grant } = await this.authorize(token);
    await this.pool.query('UPDATE mcp_local_grants SET revoked_at=now() WHERE id=$1', [grant.id]);
    return { revoked: true as const };
  }
  async cleanup(limit = 25) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('MCP_CLEANUP_LIMIT');
    let count = 0;
    for (const table of ['mcp_preparations', 'mcp_pairings', 'mcp_local_grants']) {
      const unreferenced =
        table === 'mcp_local_grants'
          ? ' AND NOT EXISTS(SELECT 1 FROM mcp_preparations p WHERE p.grant_id=mcp_local_grants.id) AND NOT EXISTS(SELECT 1 FROM mcp_pairings p WHERE p.approved_grant=mcp_local_grants.id) AND NOT EXISTS(SELECT 1 FROM mcp_oauth_families f WHERE f.local_grant_id=mcp_local_grants.id)'
          : '';
      count +=
        (
          await this.pool.query(
            `DELETE FROM ${table} WHERE ctid IN(SELECT ctid FROM ${table} WHERE expires_at<=now()${unreferenced} ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)`,
            [limit],
          )
        ).rowCount ?? 0;
    }
    return count;
  }
}
