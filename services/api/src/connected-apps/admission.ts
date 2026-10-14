import { z } from 'zod';
import { AppAdmissionSchema, AppInvitationStageSchema, AppInvitationRequestSchema, AppJoinRequestSchema } from '../../../../protocol/connected-apps.js';
import type { Account } from '../../../../protocol/api.js';
import { ApiError } from '../errors.js';
import { rollbackTransaction } from '../transaction.js';
import type { ConnectedApps } from './service.js';

export class AppAdmissions {
  constructor(readonly apps: ConnectedApps) {}
  async status(account: Account, id: string) {
    return this.configuration(account, (await this.apps.admissionContext(id)).clientId);
  }
  async configuration(account: Account, clientId: string) {
    const app = await this.apps.client(clientId), chain = this.apps.chain.admission;
    const policy = chain ? await chain.policy(app.config.dao.daoId, app.config.appId) : null;
    const gateway = chain?.gateway() ?? null;
    return AppAdmissionSchema.parse({ app, policy, gateway, source:chain?.source() ?? null,
      available: !!policy?.enabled && policy.app_revision === app.config.revision && policy.gateway === gateway?.account && policy.gateway_permission === gateway?.permission,
      member: chain ? await chain.member(account, app.config.dao.daoId) : null });
  }
  async preview(account: Account, id: string, value: unknown) {
    const input=AppJoinRequestSchema.parse(value),status=await this.status(account,id);
    if (!('invitationId' in input)) return {...status,invitation:null};
    const invitation=await this.apps.chain.admission?.invitation(status.app.config.dao.daoId,input.invitationId);
    const tokenHash=input.tokenHash;
    if(!invitation||invitation.token_hash!==tokenHash||invitation.app_id!==status.app.config.appId||invitation.app_revision!==status.app.config.revision||invitation.policy_revision!==status.policy?.revision)throw new ApiError('APP_INVITE_DOMAIN',403);
    if(invitation.member_id!=='0'&&invitation.member_id!==status.member?.memberId)throw new ApiError('APP_INVITE_USED',409);
    if(invitation.revoked||invitation.expires<=Date.now()/1000)throw new ApiError(invitation.revoked?'APP_INVITE_REVOKED':'APP_INVITE_EXPIRED',410);
    return {...status,invitation:{role:invitation.admin?'admin':'member',expires:invitation.expires}};
  }
  async join(account: Account, id: string, value: unknown) {
    const input = AppJoinRequestSchema.parse(value), status = await this.status(account, id), chain = this.apps.chain.admission;
    if (!chain) throw new ApiError('APP_JOIN_UNAVAILABLE', 503);
    if (!status.available) throw new ApiError('APP_JOIN_DISABLED', 403);
    const invitationId = 'invitationId' in input ? input.invitationId : '0';
    const tokenHash = 'tokenHash' in input ? input.tokenHash : '0'.repeat(64);
    const invitation = invitationId !== '0' ? await chain.invitation(status.app.config.dao.daoId, invitationId) : null;
    if (invitationId !== '0' && (!invitation || invitation.token_hash !== tokenHash || invitation.app_id !== status.app.config.appId || invitation.app_revision !== status.app.config.revision || invitation.policy_revision !== status.policy?.revision)) throw new ApiError('APP_INVITE_DOMAIN', 403);
    if (invitation && invitation.member_id !== '0' && invitation.member_id !== status.member?.memberId) throw new ApiError('APP_INVITE_USED', 409);
    if (invitation && invitation.member_id === '0' && (invitation.revoked || invitation.expires <= Date.now()/1000)) throw new ApiError(invitation.revoked ? 'APP_INVITE_REVOKED' : 'APP_INVITE_EXPIRED', 410);
    if (!invitation && !status.member && !status.policy?.public_join) throw new ApiError('APP_JOIN_DISABLED', 403);
    let failure: unknown;
    const proof = 'invitationId' in input && input.signature && input.proofExpires ? {expires:input.proofExpires,signature:input.signature} : undefined;
    if(invitation && !proof)throw new ApiError('APP_INVITE_PROOF',403);
    try { await chain.admit(account, status.app.config, invitationId, tokenHash, proof); } catch (cause) { failure = cause; }
    const member = await chain.member(account, status.app.config.dao.daoId);
    const confirmed = invitationId !== '0' ? await chain.invitation(status.app.config.dao.daoId, invitationId) : null;
    if (!member || (invitationId !== '0' && confirmed?.member_id !== member.memberId) || (invitation?.admin && (!member.admin || !member.executive || !member.canVote))) {
      if (failure) throw failure;
      throw new ApiError('APP_JOIN_PENDING', 409);
    }
    if (failure && !invitation && status.member) throw failure;
    return member;
  }
  async stage(token: string, origin: string | undefined, value: unknown) {
    const access = await this.apps.access(token, origin);
    if (!access.claims.admin) throw new ApiError('ADMIN_REQUIRED', 403);
    const invitation = AppInvitationStageSchema.parse(value), chain = this.apps.chain.admission;
    if (!chain) throw new ApiError('APP_JOIN_UNAVAILABLE', 503);
    if (!invitation.revoke && (invitation.expires <= Date.now()/1000 || invitation.expires > Date.now()/1000 + 604800)) throw new ApiError('APP_INVITE_EXPIRED', 410);
    const db = await this.apps.pool.connect();
    let discard = false;
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['app-invitations:' + access.app.clientId]);
      const existing = (await db.query('SELECT id,account_id,revision,request FROM connected_app_invitations WHERE client_id=$1 AND invitation_id=$2 AND revoke=$3', [access.app.clientId, invitation.invitationId, invitation.revoke])).rows[0];
      let id: string;
      if (existing) {
        const saved = z.object({id:z.uuid(), account_id:z.uuid(), revision:z.string(), request:AppInvitationStageSchema}).parse(existing);
        if (saved.account_id !== access.account.id || saved.revision !== access.app.config.revision || JSON.stringify(saved.request) !== JSON.stringify(invitation)) throw new ApiError('APP_INVITE_CONFLICT', 409);
        id = saved.id;
      } else {
        const count = z.object({n:z.coerce.number()}).parse((await db.query('SELECT count(*) AS n FROM connected_app_invitations WHERE client_id=$1', [access.app.clientId])).rows[0]);
        if (count.n >= 256) throw new ApiError('APP_INVITE_CAPACITY', 409);
        id = z.object({id:z.uuid()}).parse((await db.query('INSERT INTO connected_app_invitations(client_id,account_id,revision,invitation_id,request,revoke,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [access.app.clientId, access.account.id, access.app.config.revision, invitation.invitationId, JSON.stringify(invitation), invitation.revoke, new Date(invitation.expires*1000)])).rows[0]).id;
      }
      await db.query('COMMIT');
      return {requestId:id, approvalUrl:this.apps.config.frontendOrigin + '/apps/invitation?request=' + id};
    } catch(cause) { discard = await rollbackTransaction(db); throw cause; } finally { db.release(discard); }
  }
  async details(account: Account, id: string, clientId?: string) {
    const row = z.object({client_id:z.uuid(), account_id:z.uuid(), revision:z.string(), request:AppInvitationStageSchema}).safeParse((await this.apps.pool.query('SELECT * FROM connected_app_invitations WHERE id=$1', [z.uuid().parse(id)])).rows[0]);
    if (!row.success || (clientId && row.data.client_id !== clientId)) throw new ApiError('APP_INVITE_UNKNOWN', 404);
    const app = await this.apps.client(row.data.client_id), member = await this.apps.chain.membership(account, app.config.dao.daoId);
    if (!member?.active || !member.admin || (!clientId && account.id !== row.data.account_id)) throw new ApiError('ADMIN_REQUIRED', 403);
    if (row.data.revision !== app.config.revision) throw new ApiError('APP_REVISED', 409);
    const issuer = await this.apps.account(row.data.account_id), inviter = await this.apps.chain.membership(issuer, app.config.dao.daoId);
    if (!inviter?.active || !inviter.admin) throw new ApiError('APP_INVITE_ISSUER', 403);
    const saved = row.data.request, native = await this.apps.chain.admission?.invitation(app.config.dao.daoId, saved.invitationId);
    const matches = native?.app_id === app.config.appId && native.app_revision === app.config.revision && (saved.revoke || native.inviter === inviter.memberId) && native.token_hash === saved.tokenHash && native.invitation_key === saved.invitationKey && native.admin === (saved.role === 'admin') && native.expires === saved.expires;
    return AppInvitationRequestSchema.parse({requestId:id, app, inviter:inviter.memberId, invitation:saved, confirmed:!!matches && (saved.revoke ? native?.revoked : !native?.revoked)});
  }
}
