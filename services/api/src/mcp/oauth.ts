import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { ApiOriginSchema } from '../../../../protocol/base.js';
import type { Account } from '../../../../protocol/api.js';
import {
  McpOAuthClaimsSchema,
  McpOAuthClientSchema,
  McpOAuthAuthorizeSchema,
  McpOAuthApprovalSchema,
  McpOAuthTokenInputSchema,
  McpOAuthScopeSchema,
} from '../../../../protocol/mcp.js';
import { readAccount, withTransaction } from '../auth/account-session.js';
import { ApiError } from '../errors.js';
import type { McpPairings } from './pairing.js';
import { CHATGPT_CLIENT_METADATA } from './clients.js';
const hash = (value: string) => createHash('sha256').update(value).digest();
const invalid = () => new ApiError('MCP_TOKEN_REQUIRED', 401);
const opaque = () => randomBytes(32).toString('base64url');
const { iat: _iat, exp: _exp, ...contextShape } = McpOAuthClaimsSchema.shape;
const StoredContext = z.strictObject({
  ...contextShape,
  redirectUri: z.url().max(2048),
  challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
type FamilyRow = {
  id: string;
  account_id: string;
  context: unknown;
  local_grant_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
};
type RequestRow = { request: unknown; account_id: string | null; expires_at: Date };
type TokenRow = { context: unknown; family_id: string; consumed_at: Date | null; expires_at: Date };
export function validateMcpOAuthClaims(
  input: unknown,
  api: string,
  now = Math.floor(Date.now() / 1000),
) {
  const origin = ApiOriginSchema.parse(api),
    claims = McpOAuthClaimsSchema.parse(input);
  if (
    claims.iss !== origin + '/mcp/oauth' ||
    claims.aud !== origin + '/mcp' ||
    claims.exp <= now ||
    claims.exp > now + 300 ||
    claims.iat > now + 30 ||
    claims.iat < now - 330 ||
    claims.exp <= claims.iat
  )
    throw invalid();
  return claims;
}
export class McpOAuth {
  readonly clients;
  readonly issuer: string;
  readonly resource: string;
  constructor(
    readonly pairings: McpPairings,
    clients: unknown,
  ) {
    this.clients = z.array(McpOAuthClientSchema).max(32).parse(clients);
    if (new Set(this.clients.map((value) => value.clientId)).size !== this.clients.length)
      throw Error('MCP_CLIENT_DUPLICATE');
    for (const client of this.clients)
      for (const uri of client.redirectUris) {
        const url = new URL(uri);
        const fixedLoopback =
          url.protocol === 'http:' &&
          (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
          Number(url.port) >= 1024 &&
          Number(url.port) <= 65535 &&
          url.pathname === '/callback' &&
          !url.search;
        if (
          (url.protocol !== 'https:' && !fixedLoopback) ||
          url.username ||
          url.password ||
          url.hash
        )
          throw Error('MCP_REDIRECT_INVALID');
      }
    const api = ApiOriginSchema.parse(pairings.api);
    this.issuer = api + '/mcp/oauth';
    this.resource = api + '/mcp';
  }
  resourceMetadata() {
    return {
      resource: this.resource,
      authorization_servers: [this.issuer],
      scopes_supported: ['daclify:read', 'daclify:prepare', 'daclify:submit'],
      bearer_methods_supported: ['header'],
    };
  }
  metadata() {
    return {
      issuer: this.issuer,
      authorization_endpoint: this.issuer + '/authorize',
      token_endpoint: this.issuer + '/token',
      revocation_endpoint: this.issuer + '/revoke',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['daclify:read', 'daclify:prepare', 'daclify:submit'],
      authorization_response_iss_parameter_supported: true,
      ...(this.clients.some((client) => client.clientId === CHATGPT_CLIENT_METADATA)
        ? { client_id_metadata_document_supported: true }
        : {}),
    };
  }
  private scopes(value: string) {
    const result = z.array(McpOAuthScopeSchema).min(1).max(3).parse(value.split(' '));
    if (new Set(result).size !== result.length) throw invalid();
    return result;
  }
  async begin(input: unknown) {
    const request = McpOAuthAuthorizeSchema.parse(input);
    if (
      request.resource !== this.resource ||
      !this.clients.some(
        (client) =>
          client.clientId === request.client_id &&
          client.redirectUris.includes(request.redirect_uri),
      )
    )
      throw invalid();
    this.scopes(request.scope);
    const id = randomUUID(),
      expires = new Date(Date.now() + 300000);
    await withTransaction(this.pairings.pool, async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'mcp-oauth-admission',
      ]);
      const count = (
        await db.query<{ total: string }>(
          'SELECT count(*)::text AS total FROM mcp_oauth_requests WHERE expires_at>now()',
        )
      ).rows[0];
      if (!count || Number(count.total) >= 10000) throw new ApiError('RATE_LIMIT', 429);
      await db.query('INSERT INTO mcp_oauth_requests(id,request,expires_at) VALUES($1,$2,$3)', [
        id,
        request,
        expires,
      ]);
    });
    return { id, consentUrl: this.pairings.frontend + '/mcp/oauth/consent?request=' + id };
  }
  private async request(id: string) {
    const row = (
      await this.pairings.pool.query<RequestRow>(
        'SELECT request,account_id,expires_at FROM mcp_oauth_requests WHERE id=$1 AND consumed_at IS NULL AND expires_at>now()',
        [z.uuid().parse(id)],
      )
    ).rows[0];
    if (!row) throw invalid();
    return row;
  }
  async consent(account: Account, id: string) {
    if (!(await readAccount(this.pairings.pool, account.id))) throw invalid();
    const row = await this.request(id),
      request = McpOAuthAuthorizeSchema.parse(row.request);
    if (row.account_id && row.account_id !== account.id) throw invalid();
    const claimed = await this.pairings.pool.query(
      'UPDATE mcp_oauth_requests SET account_id=$2 WHERE id=$1 AND (account_id IS NULL OR account_id=$2) AND consumed_at IS NULL AND expires_at>now()',
      [id, account.id],
    );
    if (!claimed.rowCount) throw invalid();
    return {
      id,
      clientId: request.client_id,
      redirectUri: request.redirect_uri,
      scopes: this.scopes(request.scope),
      expires: row.expires_at.toISOString(),
    };
  }
  async approve(account: Account, input: unknown) {
    const approval = McpOAuthApprovalSchema.parse(input);
    await this.consent(account, approval.id);
    if (!this.pairings.chain) throw invalid();
    const row = await this.request(approval.id),
      request = McpOAuthAuthorizeSchema.parse(row.request),
      scopes = this.scopes(request.scope).filter(
        (scope) => scope !== 'daclify:submit' || approval.localGrantId !== null,
      ),
      familyId = randomUUID();
    if (
      new Set(approval.nativeScopes).size !== approval.nativeScopes.length ||
      (!scopes.includes('daclify:prepare') && approval.nativeScopes.length)
    )
      throw invalid();
    const local = approval.localGrantId
      ? await this.pairings.authorizeGrant(approval.localGrantId, account.id)
      : undefined;
    if (!scopes.length || (scopes.includes('daclify:submit') && !local))
      throw new ApiError('MCP_LOCAL_SIGNER_REQUIRED', 403);
    if (
      local &&
      (!isDeepStrictEqual(local.grant.dao, approval.dao) ||
        local.grant.memberId !== approval.memberId ||
        approval.nativeScopes.some((scope) => !local.grant.scopes.includes(scope)))
    )
      throw invalid();
    const governance = await this.pairings.chain.governance(approval.dao.daoId),
      member = (await this.pairings.chain.memberships(account)).find(
        (value) =>
          value.active &&
          value.memberId === approval.memberId &&
          isDeepStrictEqual(value.dao, approval.dao),
      );
    const actor = governance.actors.find((value) => value.id === approval.memberId);
    if (
      !member ||
      !isDeepStrictEqual(governance.dao, approval.dao) ||
      !governance.policy ||
      actor?.revoked ||
      (governance.guardian && governance.guardian.paused_until > Date.now() / 1000) ||
      (approval.nativeScopes.includes('review') && !member.reviewer)
    )
      throw invalid();
    // Activity always needs its distinct app-bound native companion.
    if (approval.nativeScopes.includes('activity') && !local?.grant.app)
      throw new ApiError('MCP_APP_CREDENTIAL_REQUIRED', 403);
    const context = StoredContext.parse({
      version: 1,
      iss: this.issuer,
      aud: this.resource,
      sub: account.id,
      clientId: request.client_id,
      familyId,
      dao: approval.dao,
      memberId: approval.memberId,
      scopes,
      nativeScopes: approval.nativeScopes,
      sessionId: local?.grant.sessionId ?? null,
      delegatePublicKey: local?.grant.delegatePublicKey ?? null,
      credentialEpoch: actor?.credential_epoch ?? '1',
      redirectUri: request.redirect_uri,
      challenge: request.code_challenge,
    });
    const code = opaque(),
      expiry = new Date(
        Math.min(Date.now() + 604800000, (local?.credential.expires ?? Infinity) * 1000),
      );
    await withTransaction(this.pairings.pool, async (db) => {
      const current = (
        await db.query<RequestRow>(
          'SELECT request,account_id,expires_at FROM mcp_oauth_requests WHERE id=$1 AND account_id=$2 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
          [approval.id, account.id],
        )
      ).rows[0];
      if (!current || !isDeepStrictEqual(current.request, request)) throw invalid();
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'mcp-oauth-owner:' + account.id,
      ]);
      const count = (
        await db.query<{ total: string }>(
          'SELECT count(*)::text AS total FROM mcp_oauth_families WHERE account_id=$1 AND revoked_at IS NULL AND expires_at>now()',
          [account.id],
        )
      ).rows[0];
      if (!count || Number(count.total) >= 32) throw new ApiError('RATE_LIMIT', 429);
      await db.query(
        'INSERT INTO mcp_oauth_families(id,account_id,context,local_grant_id,expires_at) VALUES($1,$2,$3,$4,$5)',
        [familyId, account.id, context, approval.localGrantId, expiry],
      );
      await db.query(
        "INSERT INTO mcp_oauth_tokens(token_hash,account_id,family_id,kind,context,expires_at) VALUES($1,$2,$3,'code',$4,$5)",
        [hash(code), account.id, familyId, context, new Date(Date.now() + 60000)],
      );
      await db.query('UPDATE mcp_oauth_requests SET consumed_at=now() WHERE id=$1', [approval.id]);
    });
    const redirect = new URL(request.redirect_uri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', request.state);
    redirect.searchParams.set('iss', this.issuer);
    return { redirectUrl: redirect.toString() };
  }
  private async family(id: string) {
    const row = (
      await this.pairings.pool.query<FamilyRow>(
        'SELECT id,account_id,context,local_grant_id,expires_at,revoked_at FROM mcp_oauth_families WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!row || row.revoked_at || row.expires_at.getTime() <= Date.now()) throw invalid();
    return row;
  }
  private async current(family: FamilyRow) {
    const context = StoredContext.parse(family.context),
      account = await readAccount(this.pairings.pool, family.account_id),
      chain = this.pairings.chain;
    if (
      !account ||
      !chain ||
      context.sub !== account.id ||
      context.familyId !== family.id ||
      context.iss !== this.issuer ||
      context.aud !== this.resource
    )
      throw invalid();
    const governance = await chain.governance(context.dao.daoId),
      member = (await chain.memberships(account)).find(
        (value) =>
          value.active &&
          value.memberId === context.memberId &&
          isDeepStrictEqual(value.dao, context.dao),
      ),
      actor = governance.actors.find((value) => value.id === context.memberId);
    if (
      !member ||
      !isDeepStrictEqual(governance.dao, context.dao) ||
      !governance.policy ||
      actor?.revoked ||
      (actor?.credential_epoch ?? '1') !== context.credentialEpoch ||
      (governance.guardian && governance.guardian.paused_until > Date.now() / 1000) ||
      (context.nativeScopes.includes('review') && !member.reviewer)
    ) {
      await this.revokeFamily(family.id);
      throw invalid();
    }
    const local = family.local_grant_id
      ? await this.pairings.authorizeGrant(family.local_grant_id, account.id).catch(async () => {
          await this.revokeFamily(family.id);
          throw invalid();
        })
      : undefined;
    if (
      local &&
      (local.grant.sessionId !== context.sessionId ||
        local.grant.delegatePublicKey !== context.delegatePublicKey ||
        !isDeepStrictEqual(local.grant.dao, context.dao) ||
        local.grant.memberId !== context.memberId ||
        context.nativeScopes.some((scope) => !local.grant.scopes.includes(scope)))
    ) {
      await this.revokeFamily(family.id);
      throw invalid();
    }
    return { context, account, member, governance, local };
  }
  async authorizeToken(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid();
    const row = (
      await this.pairings.pool.query<TokenRow>(
        "SELECT context,family_id,consumed_at,expires_at FROM mcp_oauth_tokens WHERE token_hash=$1 AND kind='access' AND consumed_at IS NULL AND expires_at>now()",
        [hash(token)],
      )
    ).rows[0];
    if (!row) throw invalid();
    const claims = validateMcpOAuthClaims(row.context, this.pairings.api),
      current = await this.current(await this.family(row.family_id));
    if (
      claims.familyId !== row.family_id ||
      !isDeepStrictEqual(
        StoredContext.parse({
          ...(({ iat: _iat, exp: _exp, ...identity }) => identity)(claims),
          redirectUri: current.context.redirectUri,
          challenge: current.context.challenge,
        }),
        current.context,
      )
    )
      throw invalid();
    return { ...current, claims };
  }
  private async issue(db: PoolClient, family: FamilyRow) {
    const context = StoredContext.parse(family.context),
      now = Math.floor(Date.now() / 1000);
    const { redirectUri: _redirectUri, challenge: _challenge, ...identity } = context;
    const claims = McpOAuthClaimsSchema.parse({
      ...identity,
      iat: now,
      exp: Math.min(now + 300, Math.floor(family.expires_at.getTime() / 1000)),
    });
    const count = (
      await db.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM mcp_oauth_tokens WHERE family_id=$1',
        [family.id],
      )
    ).rows[0];
    if (!count || Number(count.total) >= 512) throw new ApiError('MCP_FRESH_CONSENT_REQUIRED', 409);
    const access = opaque(),
      refresh = opaque();
    for (const [kind, value, expires, stored] of [
      ['access', access, new Date(claims.exp * 1000), claims],
      ['refresh', refresh, family.expires_at, context],
    ] as const)
      await db.query(
        'INSERT INTO mcp_oauth_tokens(token_hash,account_id,family_id,kind,context,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
        [hash(value), family.account_id, family.id, kind, stored, expires],
      );
    return {
      access_token: access,
      token_type: 'Bearer' as const,
      expires_in: claims.exp - now,
      refresh_token: refresh,
      scope: claims.scopes.join(' '),
    };
  }
  async token(input: unknown) {
    const request = McpOAuthTokenInputSchema.parse(input);
    if (request.resource !== this.resource) throw invalid();
    const kind = request.grant_type === 'authorization_code' ? 'code' : 'refresh',
      value = request.grant_type === 'authorization_code' ? request.code : request.refresh_token;
    const lookup = (
      await this.pairings.pool.query<TokenRow>(
        'SELECT context,family_id,consumed_at,expires_at FROM mcp_oauth_tokens WHERE token_hash=$1 AND kind=$2',
        [hash(value), kind],
      )
    ).rows[0];
    if (!lookup) throw invalid();
    const family = await this.family(lookup.family_id),
      current = await this.current(family);
    if (current.context.clientId !== request.client_id) throw invalid();
    if (request.grant_type === 'authorization_code') {
      const expected = Buffer.from(current.context.challenge, 'base64url'),
        actual = hash(request.code_verifier);
      if (
        request.redirect_uri !== current.context.redirectUri ||
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        throw invalid();
    }
    const result = await withTransaction(this.pairings.pool, async (db) => {
      const active = (
        await db.query<FamilyRow>(
          'SELECT id,account_id,context,local_grant_id,expires_at,revoked_at FROM mcp_oauth_families WHERE id=$1 FOR UPDATE',
          [family.id],
        )
      ).rows[0];
      if (!active || active.revoked_at || active.expires_at.getTime() <= Date.now())
        throw invalid();
      const row = (
        await db.query<TokenRow>(
          'SELECT context,family_id,consumed_at,expires_at FROM mcp_oauth_tokens WHERE token_hash=$1 AND kind=$2 FOR UPDATE',
          [hash(value), kind],
        )
      ).rows[0];
      if (!row || row.expires_at.getTime() <= Date.now()) throw invalid();
      if (row.consumed_at) {
        await db.query('UPDATE mcp_oauth_families SET revoked_at=now() WHERE id=$1', [family.id]);
        return null;
      }
      await db.query('UPDATE mcp_oauth_tokens SET consumed_at=now() WHERE token_hash=$1', [
        hash(value),
      ]);
      return this.issue(db, active);
    });
    if (!result) throw invalid();
    return result;
  }
  async revokeFamily(id: string) {
    await this.pairings.pool.query(
      'UPDATE mcp_oauth_families SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL',
      [id],
    );
  }
  async revokeToken(token: string, clientId: string) {
    const row = (
      await this.pairings.pool.query<TokenRow>(
        'SELECT context,family_id,consumed_at,expires_at FROM mcp_oauth_tokens WHERE token_hash=$1',
        [hash(token)],
      )
    ).rows[0];
    if (row) {
      const family = (
        await this.pairings.pool.query<FamilyRow>(
          'SELECT id,account_id,context,local_grant_id,expires_at,revoked_at FROM mcp_oauth_families WHERE id=$1',
          [row.family_id],
        )
      ).rows[0];
      if (family && StoredContext.parse(family.context).clientId === clientId)
        await this.revokeFamily(family.id);
    }
    return {};
  }
  async cleanup(limit = 25) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('MCP_CLEANUP_LIMIT');
    let count = 0;
    for (const table of ['mcp_oauth_tokens', 'mcp_oauth_requests', 'mcp_oauth_families']) {
      const unreferenced =
        table === 'mcp_oauth_families'
          ? ' AND NOT EXISTS(SELECT 1 FROM mcp_oauth_tokens t WHERE t.family_id=mcp_oauth_families.id)'
          : '';
      count +=
        (
          await this.pairings.pool.query(
            `DELETE FROM ${table} WHERE ctid IN(SELECT ctid FROM ${table} WHERE expires_at<=now()${unreferenced} ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)`,
            [limit],
          )
        ).rowCount ?? 0;
    }
    return count;
  }
}
