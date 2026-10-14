import { z } from 'zod';
import { PrivateKey, ABI, Serializer, Checksum256, Base58 } from '@wharfkit/antelope';
import { sha256 } from '@noble/hashes/sha2.js';
import { ApiOriginSchema } from '../protocol/base.js';
import {
  AppAuthorizationSchema,
  AppClaimsSchema,
  AppTokenSchema,
  AppActivityPageSchema,
  ConnectedAppsRoutes,
  AppInvitationTokenSchema, ConnectedAppConfigSchema,
} from '../protocol/connected-apps.js';
import type { ConnectedAppConfig } from '../protocol/connected-apps.js';
import { AccountSchema, type Account } from '../protocol/api.js';
import { appJoinAbi, AppJoinActionSchemas, type AppJoinProof } from './app-admission.js';
import { instructionDigest, makeInstruction } from './index.js';
function invitationKey(token:string) {
  const seed=sha256(new TextEncoder().encode('daclify.app-invitation-key.v1:'+AppInvitationTokenSchema.parse(token)));
  return PrivateKey.fromString('PVT_K1_'+Base58.encodeRipemd160Check(seed,'K1'));
}
export function invitationCredential(token:string) {
  AppInvitationTokenSchema.parse(token);
  return {tokenHash:Checksum256.hash(new TextEncoder().encode(token)).toString(),invitationKey:invitationKey(token).toPublic().toString()};
}
export function makeAppJoinProof(config:ConnectedAppConfig,account:Account,source:string,invitationId='0',tokenHash='0'.repeat(64),expires=Math.floor(Date.now()/1000)+120) {
  config=ConnectedAppConfigSchema.parse(config);account=AccountSchema.parse(account);
  if(!account.signingKey||!account.encryptionKey)throw new Error('ACCOUNT_SETUP_REQUIRED');
  return AppJoinActionSchemas.appadmit.shape.proof.parse({version:1,action:'appadmit',source,chain_id:config.dao.chainId,runtime:config.dao.contract,dao_id:config.dao.daoId,app_id:config.appId,app_revision:config.revision,invitation_id:invitationId,token_hash:tokenHash,signing_key:account.signingKey,encryption_key:JSON.stringify(account.encryptionKey),custody:account.custody==='managed'?1:0,expires});
}
export function signAppInvitation(token:string,proof:AppJoinProof) {
  proof=AppJoinActionSchemas.appadmit.shape.proof.parse(proof);
  if(proof.token_hash!==invitationCredential(token).tokenHash||proof.invitation_id==='0')throw new Error('APP_INVITE_DOMAIN');
  const bytes=Serializer.encode({abi:ABI.from(appJoinAbi),type:'app_join_proof',object:proof});
  return invitationKey(token).signDigest(Checksum256.hash(bytes)).toString();
}
const base64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
const unbase64 = (value: string) =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (character) =>
    character.charCodeAt(0),
  );
const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));
const PublicJwk = z.object({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  kid: z.string().max(64),
  alg: z.literal('ES256'),
  use: z.literal('sig'),
});
export class ConnectedAppClient {
  private readonly fetcher: typeof fetch;
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly redirectUri: string;
  private key: PrivateKey | null = null;
  private pending: {
    state: string;
    nonce: string;
    verifier: string;
    expires: number;
    recording: boolean;
  } | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private accessExpires = 0;
  private refreshing: Promise<void> | null = null;
  private identity: z.infer<typeof AppClaimsSchema> | null = null;
  private generation = 0;
  constructor(options: {
    issuer: string;
    clientId: string;
    redirectUri: string;
    fetch?: typeof fetch;
  }) {
    this.issuer = ApiOriginSchema.parse(options.issuer);
    this.clientId = z.uuid().parse(options.clientId);
    this.redirectUri = AppAuthorizationSchema.shape.redirect_uri.parse(options.redirectUri);
    this.fetcher = options.fetch ?? fetch;
  }
  beginLogin(options: { recording?: boolean; grantSeconds?: number } = {}): string {
    this.clear();
    const verifier = random(),
      state = random(),
      nonce = random(),
      recording = options.recording ?? false;
    if (recording) this.key = PrivateKey.generate('K1');
    const params = AppAuthorizationSchema.parse({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid membership',
      code_challenge: base64(sha256(new TextEncoder().encode(verifier))),
      code_challenge_method: 'S256',
      state,
      nonce,
      ...(this.key
        ? {
            signing_key: this.key.toPublic().toString(),
            grant_seconds: options.grantSeconds ?? 3600,
          }
        : {}),
    });
    this.pending = { state, nonce, verifier, expires: Date.now() + 300000, recording };
    return (
      this.issuer +
      '/v1/connected-apps/authorize?' +
      new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ).toString()
    );
  }
  signingPublicKey() {
    if (!this.key) throw new Error('APP_KEY_MISSING');
    return this.key.toPublic().toString();
  }
  clear() {
    this.generation++;
    this.pending = null;
    this.key = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.accessExpires = 0;
    this.refreshing = null;
    this.identity = null;
  }
  private async response(path: string, init: RequestInit = {}) {
    const response = await this.fetcher(this.issuer + path, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const error = z
        .object({ code: z.string().optional(), error: z.string().optional() })
        .safeParse(data);
      throw new Error(
        error.success
          ? (error.data.code ?? error.data.error ?? 'APP_REQUEST_FAILED')
          : 'APP_REQUEST_FAILED',
      );
    }
    return data;
  }
  async finishLogin(callbackUrl: string) {
    const pending = this.pending,
      generation = this.generation,
      callback = new URL(callbackUrl),
      registered = new URL(this.redirectUri);
    if (
      !pending ||
      pending.expires <= Date.now() ||
      callback.origin !== registered.origin ||
      callback.pathname !== registered.pathname ||
      callback.hash ||
      callback.searchParams.get('state') !== pending.state ||
      callback.searchParams.get('iss') !== this.issuer ||
      Array.from(registered.searchParams).some(
        ([key, value]) =>
          callback.searchParams.getAll(key).length !== 1 ||
          callback.searchParams.get(key) !== value,
      ) ||
      ['code', 'state', 'iss', 'error'].some((key) => callback.searchParams.getAll(key).length > 1)
    )
      throw new Error('APP_CALLBACK');
    if (callback.searchParams.has('error')) {
      this.clear();
      throw new Error('APP_CONSENT_DENIED');
    }
    const code = z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .parse(callback.searchParams.get('code'));
    const token = AppTokenSchema.parse(
      await this.response('/v1/connected-apps/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          code,
          redirect_uri: this.redirectUri,
          code_verifier: pending.verifier,
        }).toString(),
      }),
    );
    let identity: z.infer<typeof AppClaimsSchema>;
    try {
      const [head, payload, signature, ...extra] = token.id_token.split('.');
      if (!head || !payload || !signature || extra.length) throw new Error('JWT');
      const header = z
        .object({ alg: z.literal('ES256'), kid: z.string() })
        .parse(JSON.parse(new TextDecoder().decode(unbase64(head))));
      const keys = z
          .object({ keys: z.array(PublicJwk).min(1).max(4) })
          .parse(await this.response('/v1/connected-apps/jwks')).keys,
        key = keys.find((key) => key.kid === header.kid);
      if (!key) throw new Error('JWT_KEY');
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        key,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      );
      if (
        !(await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          publicKey,
          unbase64(signature),
          new TextEncoder().encode(head + '.' + payload),
        ))
      )
        throw new Error('JWT_SIGNATURE');
      const claims = z
        .object({
          iss: z.literal(this.issuer),
          aud: z.literal(this.clientId),
          sub: z.uuid(),
          nonce: z.literal(pending.nonce),
          iat: z.number().int(),
          exp: z.number().int(),
          daclify: AppClaimsSchema,
        })
        .parse(JSON.parse(new TextDecoder().decode(unbase64(payload))));
      const now = Math.floor(Date.now() / 1000);
      if (
        claims.exp <= now ||
        claims.exp > now + 330 ||
        claims.iat > now + 30 ||
        claims.iat < now - 330 ||
        claims.exp <= claims.iat ||
        claims.sub !== claims.daclify.sub ||
        pending.recording !== !!claims.daclify.sessionId
      )
        throw new Error('JWT_CLAIMS');
      identity = claims.daclify;
    } catch {
      if (generation === this.generation) this.clear();
      throw new Error('APP_ID_TOKEN');
    }
    if (generation !== this.generation) throw new Error('APP_CONTEXT_CHANGED');
    this.pending = null;
    this.accessToken = token.access_token;
    this.refreshToken = token.refresh_token ?? null;
    this.accessExpires = Date.now() + token.expires_in * 1000;
    this.identity = identity;
    return this.membership();
  }
  private authorization() {
    if (!this.accessToken) throw new Error('APP_LOGIN_REQUIRED');
    return { authorization: 'Bearer ' + this.accessToken };
  }
  async appAuthorization() {
    await this.membership();
    return this.authorization();
  }
  async membership() {
    if (this.accessToken && Date.now() >= this.accessExpires - 10000) await this.renewAccess();
    const generation = this.generation,
      old = this.identity;
    if (!old) throw new Error('APP_LOGIN_REQUIRED');
    const current = AppClaimsSchema.parse(
      await this.response(ConnectedAppsRoutes.appMembership.path, {
        headers: this.authorization(),
      }),
    );
    if (generation !== this.generation) throw new Error('APP_CONTEXT_CHANGED');
    if (
      current.sub !== old.sub ||
      JSON.stringify(current.dao) !== JSON.stringify(old.dao) ||
      current.appId !== old.appId ||
      current.appRevision !== old.appRevision ||
      current.memberId !== old.memberId ||
      current.sessionId !== old.sessionId ||
      current.sessionExpires !== old.sessionExpires
    ) {
      this.clear();
      throw new Error('APP_IDENTITY_CHANGED');
    }
    this.identity = current;
    return current;
  }
  private async renewAccess() {
    if (this.refreshing) return this.refreshing;
    const generation = this.generation,
      refresh = this.refreshToken;
    if (!refresh) throw new Error('APP_LOGIN_REQUIRED');
    const operation = (async () => {
      try {
        const token = AppTokenSchema.parse(
          await this.response('/v1/connected-apps/token', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: this.clientId,
              refresh_token: refresh,
            }).toString(),
          }),
        );
        if (generation !== this.generation) throw new Error('APP_CONTEXT_CHANGED');
        if (!token.refresh_token) throw new Error('APP_LOGIN_REQUIRED');
        this.accessToken = token.access_token;
        this.refreshToken = token.refresh_token;
        this.accessExpires = Date.now() + token.expires_in * 1000;
      } catch (error) {
        if (generation === this.generation) this.clear();
        throw error;
      } finally {
        if (generation === this.generation) this.refreshing = null;
      }
    })();
    this.refreshing = operation;
    return operation;
  }
  async activities(query: { eventId?: string; after?: string } = {}) {
    await this.membership();
    return AppActivityPageSchema.parse(
      await this.response(
        ConnectedAppsRoutes.appActivities.path + '?' + new URLSearchParams(query),
        { headers: this.authorization() },
      ),
    );
  }
  async submit(action: 'recordact' | 'askreview', target: string, data: Uint8Array) {
    const generation = this.generation,
      member = await this.membership(),
      key = this.key;
    if (
      !key ||
      !member.sessionId ||
      !member.sessionExpires ||
      member.sessionExpires <= Date.now() / 1000
    )
      throw new Error('APP_GRANT_REQUIRED');
    const request = makeInstruction(
        member.dao,
        member.memberId,
        member.nonce,
        Math.floor(Date.now() / 1000) + 120,
        target,
        action,
        data,
      ),
      signature = key.signDigest(instructionDigest(request)).toString();
    const result = ConnectedAppsRoutes.appRelay.response.parse(
      await this.response(ConnectedAppsRoutes.appRelay.path, {
        method: 'POST',
        headers: { ...this.authorization(), 'content-type': 'application/json' },
        body: JSON.stringify({ request, signature }),
      }),
    );
    if (generation !== this.generation) throw new Error('APP_CONTEXT_CHANGED');
    return result;
  }
  async logout() {
    try {
      if (this.accessToken)
        await this.response(ConnectedAppsRoutes.appLogout.path, {
          method: 'POST',
          headers: { ...this.authorization(), 'content-type': 'application/json' },
          body: '{}',
        });
    } finally {
      this.clear();
    }
  }
}
export { readAppResponse } from './read-response.js';
