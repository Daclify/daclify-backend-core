import { createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { importJWK, SignJWT } from 'jose';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { AccountSchema } from '../../../../protocol/api.js';
import {
  ConnectedAppConfigSchema,
  ConnectedAppSchema,
  AppAuthorizationSchema,
  AppClaimsSchema,
  AppConsentSchema,
  AppTokenRequestSchema,
  AppTokenSchema,
  AppRefreshRequestSchema,
  appConfigurationHash,
} from '../../../../protocol/connected-apps.js';
import { ApiError } from '../errors.js';
import { rollbackTransaction } from '../transaction.js';
import { CleanupNoticeSchema, type CleanupNotice } from '../../../../protocol/account-exit.js';
import type { ConnectedAppsChain } from './chain.js';
import type { ConnectedAppsConfiguration } from './config.js';
const hash = (value: string) => createHash('sha256').update(value).digest();
const opaque = () => randomBytes(32).toString('base64url');
const AppRow = z.object({
  id: z.uuid(),
  chain_id: z.string(),
  runtime: z.string(),
  dao_id: z.string(),
  app_id: z.string(),
});
const AuthorizationRow = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  revision: z.string(),
  request: AppAuthorizationSchema,
  grant_expires: z.coerce.number().int().nullable(),
  expires_at: z.date(),
  consumed_at: z.date().nullable(),
});
const AccessRow = z.object({
  client_id: z.uuid(),
  account_id: z.uuid(),
  revision: z.string(),
  session_id: z.string().nullable(),
  session_expires: z.coerce.number().int().nullable(),
});
export class ConnectedApps {
  private constructor(
    readonly pool: Pool,
    readonly chain: ConnectedAppsChain,
    readonly config: ConnectedAppsConfiguration,
    private readonly key: Awaited<ReturnType<typeof importJWK>>,
  ) {}
  static async create(pool: Pool, chain: ConnectedAppsChain, config: ConnectedAppsConfiguration) {
    return new ConnectedApps(
      pool,
      chain,
      config,
      await importJWK({ ...config.signingKey, alg: 'ES256' }, 'ES256'),
    );
  }
  jwks() {
    const { kty, crv, x, y, kid } = this.config.signingKey;
    return { keys: [{ kty, crv, x, y, kid, alg: 'ES256', use: 'sig' }] };
  }
  async signCleanupNotice(input: CleanupNotice): Promise<string> {
    const notice = CleanupNoticeSchema.parse(input);
    if (notice.binding.issuer !== this.config.issuer) throw new ApiError('APP_DOMAIN', 403);
    return new SignJWT(notice)
      .setProtectedHeader({
        alg: 'ES256',
        kid: this.config.signingKey.kid,
        typ: 'daclify-cleanup+jwt',
      })
      .setIssuer(this.config.issuer)
      .setAudience('daclify.cleanup:' + notice.binding.clientId)
      .setSubject(notice.subject)
      .setJti(notice.eventId)
      .setIssuedAt(Math.floor(Date.parse(notice.issuedAt) / 1000))
      .setExpirationTime(Math.floor(Date.parse(notice.expiresAt) / 1000))
      .sign(this.key);
  }
  async allowedOrigin(origin: string) {
    const ids = await this.pool.query(
      "SELECT DISTINCT client_id AS id FROM connected_app_configs WHERE config->'origins' ? $1 LIMIT 64",
      [origin],
    );
    for (const row of ids.rows) {
      try {
        const client = await this.client(z.object({ id: z.uuid() }).parse(row).id);
        if (client.config.origins.includes(origin)) return true;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }
    return false;
  }
  discovery() {
    return {
      issuer: this.config.issuer,
      authorization_endpoint: this.config.issuer + '/v1/connected-apps/authorize',
      token_endpoint: this.config.issuer + '/v1/connected-apps/token',
      userinfo_endpoint: this.config.issuer + '/v1/connected-apps/userinfo',
      jwks_uri: this.config.issuer + '/v1/connected-apps/jwks',
      response_types_supported: ['code'],
      subject_types_supported: ['pairwise'],
      id_token_signing_alg_values_supported: ['ES256'],
      scopes_supported: ['openid', 'membership'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    };
  }
  async account(id: string, db: Pool | PoolClient = this.pool): Promise<Account> {
    const row = z
      .object({
        id: z.uuid(),
        signing_key: z.string().nullable(),
        custody: z.string(),
        encryption_key: z.unknown(),
      })
      .parse(
        (
          await db.query('SELECT id,signing_key,custody,encryption_key FROM accounts WHERE id=$1', [
            id,
          ])
        ).rows[0],
      );
    return AccountSchema.parse({
      id: row.id,
      signingKey: row.signing_key,
      custody: row.custody,
      encryptionKey: row.encryption_key,
    });
  }
  private async member(account: Account, daoId: string) {
    const member = await this.chain.membership(account, daoId);
    if (!member?.active) throw new ApiError('MEMBERSHIP_REQUIRED', 403);
    return member;
  }
  async stage(account: Account, value: unknown) {
    const config = ConnectedAppConfigSchema.parse(value),
      network = await this.chain.network();
    if (config.dao.chainId !== network.chainId || config.dao.contract !== network.runtime)
      throw new ApiError('APP_DOMAIN', 403);
    if (!(await this.member(account, config.dao.daoId)).admin)
      throw new ApiError('ADMIN_REQUIRED', 403);
    const native =
      (await this.chain.registry(config.dao.daoId)).find((app) => app.id === config.appId) ?? null;
    const commitment = appConfigurationHash(config);
    if (
      config.revision !== (BigInt(native?.revision ?? '0') + 1n).toString() &&
      !(native?.revision === config.revision && native.config_hash === commitment)
    )
      throw new ApiError('APP_REVISED', 409);
    const db = await this.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'connected-apps:' + config.dao.chainId + ':' + config.dao.contract + ':' + config.dao.daoId,
      ]);
      const existing = (
        await db.query(
          'SELECT * FROM connected_apps WHERE chain_id=$1 AND runtime=$2 AND dao_id=$3 AND app_id=$4',
          [config.dao.chainId, config.dao.contract, config.dao.daoId, config.appId],
        )
      ).rows[0];
      let clientId: string;
      if (existing) clientId = AppRow.parse(existing).id;
      else {
        const count = z
          .object({ count: z.coerce.number() })
          .parse(
            (
              await db.query(
                'SELECT count(*) FROM connected_apps WHERE chain_id=$1 AND runtime=$2 AND dao_id=$3',
                [config.dao.chainId, config.dao.contract, config.dao.daoId],
              )
            ).rows[0],
          );
        if (count.count >= 64) throw new ApiError('APP_CAPACITY', 409);
        clientId = z
          .object({ id: z.uuid() })
          .parse(
            (
              await db.query(
                'INSERT INTO connected_apps(chain_id,runtime,dao_id,app_id) VALUES($1,$2,$3,$4) RETURNING id',
                [config.dao.chainId, config.dao.contract, config.dao.daoId, config.appId],
              )
            ).rows[0],
          ).id;
      }
      const candidates = z
        .object({ count: z.coerce.number() })
        .parse(
          (
            await db.query(
              'SELECT count(*) FROM connected_app_configs WHERE client_id=$1 AND revision=$2 AND config_hash<>$3',
              [clientId, config.revision, commitment],
            )
          ).rows[0],
        );
      if (candidates.count >= 8) throw new ApiError('APP_CONFIG_CAPACITY', 409);
      await db.query(
        'INSERT INTO connected_app_configs(client_id,revision,config,config_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [clientId, config.revision, JSON.stringify(config), commitment],
      );
      await db.query('COMMIT');
      return ConnectedAppSchema.parse({ clientId, config, configHash: commitment, native });
    } catch (error) {
      discard = await rollbackTransaction(db);
      throw error;
    } finally {
      db.release(discard);
    }
  }
  async client(id: string, enabled = true) {
    const result = (await this.pool.query('SELECT * FROM connected_apps WHERE id=$1', [id]))
      .rows[0];
    if (!result) throw new ApiError('APP_UNKNOWN', 404);
    const app = AppRow.parse(result),
      network = await this.chain.network();
    if (app.chain_id !== network.chainId || app.runtime !== network.runtime)
      throw new ApiError('APP_DOMAIN', 403);
    const native = (await this.chain.registry(app.dao_id)).find((row) => row.id === app.app_id);
    if (!native || (enabled && !native.enabled)) throw new ApiError('APP_DISABLED', 403);
    const row = z
      .object({ config: ConnectedAppConfigSchema, config_hash: z.string() })
      .safeParse(
        (
          await this.pool.query(
            'SELECT config,config_hash FROM connected_app_configs WHERE client_id=$1 AND revision=$2 AND config_hash=$3',
            [id, native.revision, native.config_hash],
          )
        ).rows[0],
      );
    if (!row.success) throw new ApiError('APP_REVISED', 409);
    const config = row.data.config;
    if (
      appConfigurationHash(config) !== native.config_hash ||
      config.appId !== native.id ||
      config.revision !== native.revision ||
      config.activityAccount !== native.target ||
      config.enabled !== native.enabled ||
      config.dao.daoId !== app.dao_id ||
      config.dao.contract !== app.runtime ||
      config.dao.chainId !== app.chain_id
    )
      throw new ApiError('APP_REVISED', 409);
    return ConnectedAppSchema.parse({
      clientId: id,
      config,
      configHash: row.data.config_hash,
      native,
    });
  }
  async list(account: Account, daoId: string) {
    await this.member(account, daoId);
    const network = await this.chain.network();
    const rows = await this.pool.query(
      'SELECT id FROM connected_apps WHERE chain_id=$1 AND runtime=$2 AND dao_id=$3 ORDER BY app_id LIMIT 64',
      [network.chainId, network.runtime, daoId],
    );
    const apps = [];
    for (const value of rows.rows) {
      const id = z.object({ id: z.uuid() }).parse(value).id;
      try {
        apps.push(await this.client(id, false));
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        const pending = z
          .object({ config: ConnectedAppConfigSchema, config_hash: z.string() })
          .parse(
            (
              await this.pool.query(
                'SELECT config,config_hash FROM connected_app_configs WHERE client_id=$1 ORDER BY revision DESC,created_at DESC LIMIT 1',
                [id],
              )
            ).rows[0],
          );
        apps.push(
          ConnectedAppSchema.parse({
            clientId: id,
            config: pending.config,
            configHash: pending.config_hash,
            native: null,
          }),
        );
      }
    }
    return apps;
  }
  private async subject(
    clientId: string,
    accountId: string,
    memberId: string,
    configurationHash: string,
    db: Pool | PoolClient = this.pool,
  ) {
    const row = z
      .object({ subject: z.uuid() })
      .safeParse(
        (
          await db.query(
            'INSERT INTO connected_app_subjects(client_id,account_id,member_id,configuration_hash) VALUES($1,$2,$3,$4) ON CONFLICT(client_id,account_id) DO UPDATE SET member_id=excluded.member_id,configuration_hash=excluded.configuration_hash WHERE connected_app_subjects.member_id IS NULL OR connected_app_subjects.member_id=excluded.member_id RETURNING subject',
            [clientId, accountId, memberId, configurationHash],
          )
        ).rows[0],
      );
    if (!row.success) throw new ApiError('APP_SUBJECT_MEMBER_CHANGED', 409);
    return row.data.subject;
  }

  async claims(
    account: Account,
    clientId: string,
    revision: string,
    sessionId: string | null,
    sessionExpires: number | null,
    db: Pool | PoolClient = this.pool,
  ) {
    const app = await this.client(clientId);
    if (app.config.revision !== revision) throw new ApiError('APP_REVISED', 403);
    const member = await this.member(account, app.config.dao.daoId);
    if (sessionId) {
      const session = await this.chain.session(app.config.dao.daoId, sessionId);
      if (
        !session ||
        session.credential.member_id !== member.memberId ||
        session.scope.app_id !== app.config.appId ||
        session.scope.revision !== revision ||
        session.credential.expires <= Date.now() / 1000 ||
        session.credential.expires !== sessionExpires
      )
        throw new ApiError('APP_GRANT_REVOKED', 403);
    }
    return AppClaimsSchema.parse({
      sub: await this.subject(clientId, account.id, member.memberId, app.configHash, db),
      dao: app.config.dao,
      memberId: member.memberId,
      admin: member.admin,
      reviewer: member.reviewer,
      nonce: member.nonce,
      appId: app.config.appId,
      appRevision: revision,
      sessionId,
      sessionExpires,
    });
  }
  async authorize(value: unknown) {
    const request = AppAuthorizationSchema.parse(value),
      app = await this.client(request.client_id);
    if (!app.config.redirectUris.includes(request.redirect_uri))
      throw new ApiError('APP_CALLBACK', 400);
    const expiry = new Date(Date.now() + 300000),
      grantExpires = request.grant_seconds
        ? Math.floor(Date.now() / 1000) + request.grant_seconds
        : null;
    const id = z
      .object({ id: z.uuid() })
      .parse(
        (
          await this.pool.query(
            'INSERT INTO connected_app_requests(client_id,revision,request,grant_expires,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id',
            [app.clientId, app.config.revision, JSON.stringify(request), grantExpires, expiry],
          )
        ).rows[0],
      ).id;
    return this.config.frontendOrigin + '/apps/consent?request=' + id;
  }
  private async request(id: string, db: Pool | PoolClient = this.pool, lock = false) {
    const row = AuthorizationRow.safeParse(
      (
        await db.query(
          'SELECT * FROM connected_app_requests WHERE id=$1' + (lock ? ' FOR UPDATE' : ''),
          [id],
        )
      ).rows[0],
    );
    if (!row.success || row.data.consumed_at || row.data.expires_at.getTime() <= Date.now())
      throw new ApiError('APP_REQUEST_EXPIRED', 410);
    return row.data;
  }
  async consent(account: Account, id: string) {
    const row = await this.request(id),
      app = await this.client(row.client_id);
    if (row.revision !== app.config.revision) throw new ApiError('APP_REVISED', 409);
    return AppConsentSchema.parse({
      id,
      app,
      member: await this.claims(account, row.client_id, row.revision, null, null),
      signingKey: row.request.signing_key ?? null,
      grantExpires: row.grant_expires,
      expires: row.expires_at.toISOString(),
    });
  }
  async approve(account: Account, id: string, sessionId?: string) {
    const db = await this.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      const row = await this.request(id, db, true),
        app = await this.client(row.client_id);
      if (app.config.revision !== row.revision) throw new ApiError('APP_REVISED', 409);
      const member = await this.member(account, app.config.dao.daoId);
      if (!!row.request.signing_key !== !!sessionId) throw new ApiError('APP_GRANT_REQUIRED', 409);
      if (sessionId) {
        const session = await this.chain.session(app.config.dao.daoId, sessionId);
        if (
          !session ||
          session.credential.member_id !== member.memberId ||
          session.credential.signing_key !== row.request.signing_key ||
          session.credential.expires !== row.grant_expires ||
          session.scope.app_id !== app.config.appId ||
          session.scope.revision !== row.revision ||
          session.credential.expires <= Date.now() / 1000
        )
          throw new ApiError('APP_GRANT_REQUIRED', 409);
      }
      const code = opaque();
      await db.query(
        "INSERT INTO connected_app_codes(code_hash,client_id,account_id,request,revision,session_id,session_expires,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')",
        [
          hash(code),
          row.client_id,
          account.id,
          JSON.stringify(row.request),
          row.revision,
          sessionId ?? null,
          row.grant_expires,
        ],
      );
      await db.query('UPDATE connected_app_requests SET consumed_at=now() WHERE id=$1', [id]);
      await db.query('COMMIT');
      const redirect = new URL(row.request.redirect_uri);
      redirect.searchParams.set('code', code);
      redirect.searchParams.set('state', row.request.state);
      redirect.searchParams.set('iss', this.config.issuer);
      return { redirect: redirect.toString() };
    } catch (error) {
      discard = await rollbackTransaction(db);
      throw error;
    } finally {
      db.release(discard);
    }
  }
  async reject(account: Account, id: string) {
    const row = await this.request(id);
    await this.member(account, (await this.client(row.client_id)).config.dao.daoId);
    const result = await this.pool.query(
      'UPDATE connected_app_requests SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL AND expires_at>now()',
      [id],
    );
    if (result.rowCount !== 1) throw new ApiError('APP_REQUEST_EXPIRED', 410);
    const redirect = new URL(row.request.redirect_uri);
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('state', row.request.state);
    redirect.searchParams.set('iss', this.config.issuer);
    return { redirect: redirect.toString() };
  }
  async token(value: unknown) {
    const input = AppTokenRequestSchema.parse(value);
    if (input.grant_type === 'refresh_token') return this.refresh(input);
    const db = await this.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      const row = AccessRow.extend({
        request: AppAuthorizationSchema,
        expires_at: z.date(),
        consumed_at: z.date().nullable(),
      }).safeParse(
        (
          await db.query('SELECT * FROM connected_app_codes WHERE code_hash=$1 FOR UPDATE', [
            hash(input.code),
          ])
        ).rows[0],
      );
      if (
        !row.success ||
        row.data.consumed_at ||
        row.data.expires_at.getTime() <= Date.now() ||
        row.data.client_id !== input.client_id ||
        row.data.request.redirect_uri !== input.redirect_uri ||
        hash(input.code_verifier).toString('base64url') !== row.data.request.code_challenge
      )
        throw new ApiError('APP_INVALID_GRANT', 400);
      const family = z
        .object({ id: z.uuid() })
        .parse(
          (
            await db.query(
              'INSERT INTO connected_app_refresh_families(client_id,account_id,revision,session_id,session_expires,nonce,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
              [
                row.data.client_id,
                row.data.account_id,
                row.data.revision,
                row.data.session_id,
                row.data.session_expires,
                row.data.request.nonce,
                new Date(
                  row.data.session_expires
                    ? row.data.session_expires * 1000
                    : Date.now() + 86400000,
                ),
              ],
            )
          ).rows[0],
        );
      const issued = await this.issue(db, row.data, row.data.request.nonce, family.id);
      await db.query('UPDATE connected_app_codes SET consumed_at=now() WHERE code_hash=$1', [
        hash(input.code),
      ]);
      await db.query('COMMIT');
      return issued;
    } catch (error) {
      discard = await rollbackTransaction(db);
      throw error;
    } finally {
      db.release(discard);
    }
  }
  private async issue(
    db: PoolClient,
    row: z.infer<typeof AccessRow>,
    nonce: string,
    familyId: string,
  ) {
    const account = await this.account(row.account_id, db),
      claims = await this.claims(
        account,
        row.client_id,
        row.revision,
        row.session_id,
        row.session_expires,
        db,
      ),
      token = opaque(),
      refresh = opaque();
    const idToken = await new SignJWT({ nonce, daclify: claims })
      .setProtectedHeader({ alg: 'ES256', kid: this.config.signingKey.kid, typ: 'JWT' })
      .setIssuer(this.config.issuer)
      .setAudience(row.client_id)
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.key);
    await db.query(
      "INSERT INTO connected_app_tokens(token_hash,client_id,account_id,revision,session_id,session_expires,refresh_family_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '5 minutes')",
      [
        hash(token),
        row.client_id,
        row.account_id,
        row.revision,
        row.session_id,
        row.session_expires,
        familyId,
      ],
    );
    await db.query('INSERT INTO connected_app_refresh_tokens(token_hash,family_id) VALUES($1,$2)', [
      hash(refresh),
      familyId,
    ]);
    return AppTokenSchema.parse({
      access_token: token,
      refresh_token: refresh,
      token_type: 'Bearer',
      expires_in: 300,
      id_token: idToken,
      scope: 'openid membership',
    });
  }
  private async refresh(input: z.infer<typeof AppRefreshRequestSchema>) {
    const db = await this.pool.connect();
    let discard = false,
      committed = false;
    try {
      await db.query('BEGIN');
      const row = AccessRow.extend({
        id: z.uuid(),
        nonce: z.string(),
        expires_at: z.date(),
        revoked_at: z.date().nullable(),
        consumed_at: z.date().nullable(),
      }).safeParse(
        (
          await db.query(
            'SELECT f.*,t.consumed_at FROM connected_app_refresh_tokens t JOIN connected_app_refresh_families f ON f.id=t.family_id WHERE t.token_hash=$1 FOR UPDATE OF f,t',
            [hash(input.refresh_token)],
          )
        ).rows[0],
      );
      if (
        !row.success ||
        row.data.client_id !== input.client_id ||
        row.data.revoked_at ||
        row.data.expires_at.getTime() <= Date.now()
      )
        throw new ApiError('APP_INVALID_GRANT');
      if (row.data.consumed_at) {
        await db.query('UPDATE connected_app_refresh_families SET revoked_at=now() WHERE id=$1', [
          row.data.id,
        ]);
        await db.query('COMMIT');
        committed = true;
        throw new ApiError('APP_INVALID_GRANT');
      }
      const issued = await this.issue(db, row.data, row.data.nonce, row.data.id);
      await db.query(
        'UPDATE connected_app_refresh_tokens SET consumed_at=now() WHERE token_hash=$1',
        [hash(input.refresh_token)],
      );
      await db.query('COMMIT');
      committed = true;
      return issued;
    } catch (error) {
      if (!committed) discard = await rollbackTransaction(db);
      throw error;
    } finally {
      db.release(discard);
    }
  }
  async access(token: string, origin?: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError('APP_TOKEN_REQUIRED', 401);
    const row = AccessRow.safeParse(
      (
        await this.pool.query(
          'SELECT t.* FROM connected_app_tokens t LEFT JOIN connected_app_refresh_families f ON f.id=t.refresh_family_id WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>now() AND (f.id IS NULL OR(f.revoked_at IS NULL AND f.expires_at>now()))',
          [hash(token)],
        )
      ).rows[0],
    );
    if (!row.success) throw new ApiError('APP_TOKEN_REQUIRED', 401);
    const app = await this.client(row.data.client_id);
    if (origin && !app.config.origins.includes(origin)) throw new ApiError('APP_ORIGIN', 403);
    const account = await this.account(row.data.account_id),
      claims = await this.claims(
        account,
        row.data.client_id,
        row.data.revision,
        row.data.session_id,
        row.data.session_expires,
      );
    return { account, app, claims };
  }
  async revoke(token: string) {
    await this.access(token);
    await this.pool.query(
      'UPDATE connected_app_refresh_families SET revoked_at=now() WHERE id=(SELECT refresh_family_id FROM connected_app_tokens WHERE token_hash=$1)',
      [hash(token)],
    );
    await this.pool.query('UPDATE connected_app_tokens SET revoked_at=now() WHERE token_hash=$1', [
      hash(token),
    ]);
    return { revoked: true };
  }
  async sourceAccess(account: Account, id: string) {
    const app = await this.client(id);
    if (!app.config.sourceApiBase) throw new ApiError('APP_SOURCE_UNAVAILABLE', 404);
    const claims = await this.claims(account, id, app.config.revision, null, null);
    const token = opaque();
    await this.pool.query(
      "INSERT INTO connected_app_tokens(token_hash,client_id,account_id,revision,session_id,session_expires,expires_at) VALUES($1,$2,$3,$4,NULL,NULL,now()+interval '5 minutes')",
      [hash(token), id, account.id, app.config.revision],
    );
    return {
      accessToken: token,
      expiresIn: 300,
      dao: claims.dao,
      appId: claims.appId,
      memberId: claims.memberId,
      apiBase: app.config.sourceApiBase,
    };
  }
  async cleanup(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('APP_CLEANUP_LIMIT');
    let removed = 0;
    for (const table of [
      'connected_app_requests',
      'connected_app_codes',
      'connected_app_tokens',
      'connected_app_refresh_families',
    ])
      removed +=
        (
          await this.pool.query(
            `DELETE FROM ${table} WHERE ctid IN(SELECT ctid FROM ${table} WHERE expires_at<=now() ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)`,
            [limit],
          )
        ).rowCount ?? 0;
    return removed;
  }
}
