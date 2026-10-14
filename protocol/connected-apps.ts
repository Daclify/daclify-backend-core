import { z } from 'zod';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { DaoRefSchema, IdSchema, ChainIdSchema, NativeAccountSchema } from './base.js';
import { SigningPublicKeySchema, ContentEnvelopeSchema } from './crypto.js';
import { PrivateFilePayloadSchema } from './storage.js';
import { RuntimeTableSchemas, RuntimeActionSchemas } from '../sdk/generated/schemas.js';
import { AppjoinTableSchemas as AppJoinTableSchemas } from '../sdk/generated/appjoin-schemas.js';

const httpsUrl = z
  .url()
  .max(512)
  .refine((value) => {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash;
  });
const httpsOrigin = httpsUrl.refine((value) => new URL(value).origin === value);
const portalUrl = z.url().max(512).refine(value => {
  const url = new URL(value);
  return !url.username && !url.password && !url.hash && (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)));
});
export const ConnectedAppConfigV1Schema = z
  .strictObject({
    dao: DaoRefSchema,
    appId: IdSchema,
    revision: IdSchema,
    name: z.string().trim().min(1).max(80),
    origins: z.array(httpsOrigin).min(1).max(8),
    redirectUris: z.array(httpsUrl).min(1).max(8),
    sourceApiBase: httpsUrl.optional(),
    activityAccount: NativeAccountSchema,
    enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.origins).size !== value.origins.length ||
      new Set(value.redirectUris).size !== value.redirectUris.length ||
      value.redirectUris.some((uri) => !value.origins.includes(new URL(uri).origin)) ||
      (!!value.sourceApiBase && !value.origins.includes(new URL(value.sourceApiBase).origin))
    )
      ctx.addIssue({ code: 'custom', message: 'Callbacks must use unique approved origins.' });
  });
export const ConnectedAppConfigV2Schema = ConnectedAppConfigV1Schema.safeExtend({
  schemaVersion: z.literal(2),
  cleanupUrl: httpsUrl.optional(),
}).refine(
  (value) => !value.cleanupUrl || value.origins.includes(new URL(value.cleanupUrl).origin),
  'Cleanup must use an approved origin.',
);
export const ConnectedAppConfigSchema = z.union([
  ConnectedAppConfigV1Schema,
  ConnectedAppConfigV2Schema,
]);
export type ConnectedAppConfig = z.infer<typeof ConnectedAppConfigSchema>;
export function appConfigurationHash(value: unknown): string {
  return bytesToHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify({
          domain:
            'schemaVersion' in ConnectedAppConfigSchema.parse(value)
              ? 'daclify.connected-app.v2'
              : 'daclify.connected-app.v1',
          config: ConnectedAppConfigSchema.parse(value),
        }),
      ),
    ),
  );
}
export const ConnectedAppSchema = z.strictObject({
  clientId: z.uuid(),
  config: ConnectedAppConfigSchema,
  configHash: ChainIdSchema,
  native: RuntimeTableSchemas.appregs.nullable(),
});
export const AppAuthorizationSchema = z
  .strictObject({
    client_id: z.uuid(),
    redirect_uri: httpsUrl,
    response_type: z.literal('code'),
    scope: z.literal('openid membership'),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal('S256'),
    state: z.string().min(16).max(256),
    nonce: z.string().min(16).max(256),
    signing_key: SigningPublicKeySchema.optional(),
    grant_seconds: z.coerce.number().int().min(60).max(604800).optional(),
  })
  .refine(
    (value) => !!value.signing_key === !!value.grant_seconds,
    'Signing grants require both a key and expiry.',
  );
export const AppClaimsSchema = z.strictObject({
  sub: z.uuid(),
  dao: DaoRefSchema,
  memberId: IdSchema,
  admin: z.boolean(),
  reviewer: z.boolean(),
  nonce: IdSchema.or(z.literal('0')),
  appId: IdSchema,
  appRevision: IdSchema,
  sessionId: IdSchema.nullable(),
  sessionExpires: z.number().int().nullable(),
});
export type AppClaims = z.infer<typeof AppClaimsSchema>;
export const AppConsentSchema = z.strictObject({
  id: z.uuid(),
  app: ConnectedAppSchema,
  member: AppClaimsSchema,
  signingKey: SigningPublicKeySchema.nullable(),
  grantExpires: z.number().int().nullable(),
  expires: z.iso.datetime(),
});
export const AppAdmissionMemberSchema = z.strictObject({
  memberId: IdSchema, admin: z.boolean(), executive: z.boolean(), canVote: z.boolean(),
});
export const AppAdmissionSchema = z.strictObject({
  app: ConnectedAppSchema, available: z.boolean(),
  policy: AppJoinTableSchemas.appjoins.nullable(),
  source: NativeAccountSchema.nullable(),
  gateway: z.strictObject({ account: NativeAccountSchema, permission: NativeAccountSchema }).nullable(),
  member: AppAdmissionMemberSchema.nullable(),
});
export const AppJoinPreviewSchema = AppAdmissionSchema.safeExtend({
  invitation: z.strictObject({role:z.enum(['member','admin']),expires:z.number().int()}).nullable(),
});
export const AppMemberAccessSchema = AppAdmissionMemberSchema.safeExtend({membersUrl:portalUrl});
export const AppInvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const AppJoinRequestSchema = z.union([
  z.strictObject({}),
  z.strictObject({ invitationId: IdSchema, tokenHash: ChainIdSchema, proofExpires: z.number().int().positive().max(4294967295).optional(), signature: z.string().min(1).max(256).optional() }),
]);
export const AppInvitationStageSchema = z.strictObject({
  invitationId: IdSchema, tokenHash: ChainIdSchema, invitationKey: SigningPublicKeySchema,
  name: z.string().trim().min(1).max(80).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  role: z.enum(['member', 'admin']), expires: z.number().int().positive().max(4294967295), revoke: z.boolean(),
});
export const AppInvitationRequestSchema = z.strictObject({
  requestId: z.uuid(), app: ConnectedAppSchema, inviter: IdSchema,
  invitation: AppInvitationStageSchema, confirmed: z.boolean(),
});
export const AppTokenSchema = z.strictObject({
  refresh_token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
  access_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  token_type: z.literal('Bearer'),
  expires_in: z.literal(300),
  id_token: z.string().max(8192),
  scope: z.literal('openid membership'),
});
export const AppCodeTokenRequestSchema = z.strictObject({
  grant_type: z.literal('authorization_code'),
  client_id: z.uuid(),
  code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  redirect_uri: httpsUrl,
  code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});
export const AppRefreshRequestSchema = z.strictObject({
  grant_type: z.literal('refresh_token'),
  client_id: z.uuid(),
  refresh_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const AppTokenRequestSchema = z.discriminatedUnion('grant_type', [
  AppCodeTokenRequestSchema,
  AppRefreshRequestSchema,
]);
export const AppActivityQuerySchema = z.strictObject({
  after: IdSchema.optional(),
  eventId: ChainIdSchema.optional(),
});
export const AppActivitySchema = z.strictObject({
  receiptId: IdSchema,
  appId: IdSchema,
  memberId: IdSchema,
  eventId: ChainIdSchema,
  sourceId: ChainIdSchema,
  sourceRevision: ChainIdSchema,
  kind: z.enum(['completed', 'review-requested']),
  status: z.enum(['recorded', 'pending-review', 'accepted', 'rejected']),
  createdAt: z.number().int(),
  evidenceCid: z.string().max(128),
  evidenceHash: ChainIdSchema,
  keyEpoch: z.string(),
});
export const AppActivityPageSchema = z.strictObject({
  receipts: z.array(AppActivitySchema).max(50),
  next: IdSchema.nullable(),
});
export const AppEvidenceContextSchema = z.strictObject({
  dao: DaoRefSchema,
  appId: IdSchema,
  keyEpoch: IdSchema,
  sourceId: ChainIdSchema,
  sourceRevision: ChainIdSchema,
  eventId: ChainIdSchema,
});
export const AppSourceRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sourceId: ChainIdSchema,
  sourceRevision: ChainIdSchema,
  title: z.string().max(256),
  details: z.string().max(16384),
  state: z.string().max(64),
});
export const AppSnapshotDraftSchema = z.strictObject({
  eventId: ChainIdSchema,
  source: AppSourceRecordSchema,
  files: z.array(PrivateFilePayloadSchema).max(8),
});
export const AppSnapshotEnvelopeSchema = z.strictObject({
  version: z.literal(1),
  context: AppEvidenceContextSchema,
  envelope: ContentEnvelopeSchema,
});
export function appEvidenceDomain(context: unknown) {
  return JSON.stringify({
    domain: 'daclify.app-evidence.v1',
    context: AppEvidenceContextSchema.parse(context),
  });
}
export function appKeyGrantDomain(
  dao: z.infer<typeof DaoRefSchema>,
  appId: string,
  epoch: string,
  member: string,
) {
  return JSON.stringify({
    domain: 'daclify.app-key-grant.v1',
    dao: DaoRefSchema.parse(dao),
    appId: IdSchema.parse(appId),
    epoch: IdSchema.parse(epoch),
    member: IdSchema.parse(member),
  });
}
export const ConnectedAppsRoutes = {
  appAdmission: { method: 'GET', path: '/v1/connected-apps/requests/:id/admission', response: AppAdmissionSchema, helpTopic: 'connected-apps' },
  joinApp: { method: 'POST', path: '/v1/connected-apps/requests/:id/join', input: AppJoinRequestSchema, response: AppAdmissionMemberSchema, helpTopic: 'connected-apps' },
  appJoinPreview: { method: 'POST', path: '/v1/connected-apps/requests/:id/join-preview', input: AppJoinRequestSchema, response: AppJoinPreviewSchema, helpTopic: 'connected-apps' },
  appJoinConfiguration: { method: 'GET', path: '/v1/connected-apps/:id/admission', response: AppAdmissionSchema, helpTopic: 'connected-apps' },
  appMemberAccess: { method: 'GET', path: '/v1/connected-apps/member-access', query:z.strictObject({invitationId:IdSchema.optional(),tokenHash:ChainIdSchema.optional()}).refine(value=>!!value.invitationId===!!value.tokenHash), response: AppMemberAccessSchema, helpTopic: 'connected-apps' },
  stageAppInvitation: { method: 'POST', path: '/v1/connected-apps/invitations', input: AppInvitationStageSchema, response: z.strictObject({ requestId: z.uuid(), approvalUrl: portalUrl }), helpTopic: 'connected-apps' },
  appInvitation: { method: 'GET', path: '/v1/connected-apps/invitations/:id', response: AppInvitationRequestSchema, helpTopic: 'connected-apps' },
  appInvitationStatus: { method: 'POST', path: '/v1/connected-apps/invitation-status', input: z.strictObject({ requestId: z.uuid() }), response: AppInvitationRequestSchema, helpTopic: 'connected-apps' },
  appSourceAccess: {
    method: 'POST',
    path: '/v1/connected-apps/:id/source-access',
    input: z.strictObject({}),
    response: z.strictObject({
      accessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      expiresIn: z.literal(300),
      dao: DaoRefSchema,
      appId: IdSchema,
      memberId: IdSchema,
      apiBase: httpsUrl,
    }),
    helpTopic: 'connected-apps',
  },
  connectedApps: {
    method: 'GET',
    path: '/v1/daos/:id/apps',
    response: z.array(ConnectedAppSchema),
    helpTopic: 'connected-apps',
  },
  stageConnectedApp: {
    method: 'POST',
    path: '/v1/connected-apps/configurations',
    input: ConnectedAppConfigSchema,
    response: ConnectedAppSchema,
    helpTopic: 'connected-apps',
  },
  appConsent: {
    method: 'GET',
    path: '/v1/connected-apps/requests/:id',
    response: AppConsentSchema,
    helpTopic: 'connected-apps',
  },
  approveApp: {
    method: 'POST',
    path: '/v1/connected-apps/requests/:id/approve',
    input: z.strictObject({ sessionId: IdSchema.optional() }),
    response: z.strictObject({ redirect: httpsUrl }),
    helpTopic: 'connected-apps',
  },
  rejectApp: {
    method: 'POST',
    path: '/v1/connected-apps/requests/:id/reject',
    input: z.strictObject({}),
    response: z.strictObject({ redirect: httpsUrl }),
    helpTopic: 'connected-apps',
  },
  appMembership: {
    method: 'GET',
    path: '/v1/connected-apps/userinfo',
    query: z.strictObject({ clientId: z.uuid().optional() }),
    clientHeader: 'x-daclify-client-id',
    response: AppClaimsSchema,
    helpTopic: 'connected-apps',
  },
  appRelay: {
    method: 'POST',
    path: '/v1/connected-apps/relay',
    input: z.strictObject({
      request: RuntimeActionSchemas.submit.shape.request,
      signature: z.string().max(256),
    }),
    response: z.strictObject({ transactionId: ChainIdSchema }),
    helpTopic: 'connected-apps',
  },
  appLogout: {
    method: 'POST',
    path: '/v1/connected-apps/logout',
    input: z.strictObject({}),
    response: z.strictObject({ revoked: z.literal(true) }),
    helpTopic: 'connected-apps',
  },
  appActivities: {
    method: 'GET',
    path: '/v1/connected-apps/activities',
    query: AppActivityQuerySchema,
    response: AppActivityPageSchema,
    helpTopic: 'connected-apps',
  },
} as const;
