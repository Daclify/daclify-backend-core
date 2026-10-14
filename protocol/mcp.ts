import { z } from 'zod';
import { ApiOriginSchema, ChainIdSchema, DaoRefSchema, IdSchema } from './base.js';
import { EncryptionPublicKeySchema, SigningPublicKeySchema } from './crypto.js';
import { RuntimeActionSchemas } from '../sdk/generated/schemas.js';

export const McpScopeSchema = z.enum(['proposal', 'activity', 'vote', 'review']);
export const McpConnectionSchema = z.strictObject({
  version: z.literal(1),
  api: ApiOriginSchema,
  origin: ApiOriginSchema,
  dao: DaoRefSchema,
  memberId: IdSchema,
  authentication: z.strictObject({
    signingPublicKey: SigningPublicKeySchema,
    encryptionPublicKey: EncryptionPublicKeySchema,
  }),
  scopes: z
    .array(McpScopeSchema)
    .max(4)
    .refine((values) => new Set(values).size === values.length),
});
export const McpToolInputSchemas = {
  list_daos: z.strictObject({}),
  get_membership: z.strictObject({}),
  list_activity: z.strictObject({ after: IdSchema.optional() }),
  prepare_proposal: z.strictObject({
    ballotId: IdSchema,
    title: z.string().min(1).max(160),
    description: z.string().max(2000),
    options: z.array(z.string().min(1).max(80)).min(2).max(16),
  }),
  prepare_vote: z.strictObject({ pollId: IdSchema, optionId: z.string().regex(/^(?:[0-9]|1[0-5])$/) }),
  prepare_review: z.strictObject({
    milestoneId: IdSchema,
    approve: z.boolean(),
    documentId: IdSchema,
    documentVersion: z.int().min(1).max(4294967295),
  }),
  prepare_activity: z.strictObject({
    appId: IdSchema,
    sourceId: ChainIdSchema,
    sourceRevision: ChainIdSchema,
    eventId: ChainIdSchema,
  }),
};
export const McpReadInputSchema = z.discriminatedUnion('tool', [
  z.strictObject({ tool: z.literal('list_daos'), input: McpToolInputSchemas.list_daos }),
  z.strictObject({ tool: z.literal('get_membership'), input: McpToolInputSchemas.get_membership }),
  z.strictObject({ tool: z.literal('list_activity'), input: McpToolInputSchemas.list_activity }),
]);
export const McpPrepareInputSchema = z.discriminatedUnion('tool', [
  z.strictObject({
    tool: z.literal('prepare_proposal'),
    input: McpToolInputSchemas.prepare_proposal,
  }),
  z.strictObject({ tool: z.literal('prepare_vote'), input: McpToolInputSchemas.prepare_vote }),
  z.strictObject({ tool: z.literal('prepare_review'), input: McpToolInputSchemas.prepare_review }),
  z.strictObject({
    tool: z.literal('prepare_activity'),
    input: McpToolInputSchemas.prepare_activity,
  }),
]);
export const PreparedInstructionSchema = z.strictObject({
  id: z.uuid(),
  intent: McpPrepareInputSchema,
  request: RuntimeActionSchemas.submitsess.shape.request,
  digest: ChainIdSchema,
  scope: McpScopeSchema,
  sessionId: IdSchema,
  signingPublicKey: SigningPublicKeySchema,
  codeHash: ChainIdSchema,
  policyRevision: IdSchema,
  expires: z.int().min(1).max(4294967295),
});
export const SignedMcpInstructionSchema = z.strictObject({
  prepared: PreparedInstructionSchema,
  signature: z.string().min(1).max(160),
});
export const SubmissionResultSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('submitted'), transactionId: ChainIdSchema }),
  z.strictObject({
    state: z.literal('reconcile-required'),
    preparedId: z.uuid(),
    digest: ChainIdSchema,
  }),
]);
export const McpReadResultSchema = z
  .json()
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).length <= 2 * 1024 * 1024,
    'MCP result exceeds the response limit',
  );
export type McpConnection = z.infer<typeof McpConnectionSchema>;
export type McpReadInput = z.infer<typeof McpReadInputSchema>;
export type McpReadResult = z.infer<typeof McpReadResultSchema>;
export type McpPrepareInput = z.infer<typeof McpPrepareInputSchema>;
export type PreparedInstruction = z.infer<typeof PreparedInstructionSchema>;
export type SignedMcpInstruction = z.infer<typeof SignedMcpInstructionSchema>;
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;

export const McpOAuthScopeSchema = z.enum(['daclify:read', 'daclify:prepare', 'daclify:submit']);
export const McpOAuthClaimsSchema = z
  .strictObject({
    version: z.literal(1),
    iss: z.url().max(512),
    aud: z.url().max(512),
    sub: z.uuid(),
    clientId: z.string().min(1).max(128),
    familyId: z.uuid(),
    dao: DaoRefSchema,
    memberId: IdSchema,
    scopes: z
      .array(McpOAuthScopeSchema)
      .min(1)
      .max(3)
      .refine((values) => new Set(values).size === values.length),
    nativeScopes: z
      .array(McpScopeSchema)
      .max(4)
      .refine((values) => new Set(values).size === values.length),
    iat: z.int().positive(),
    exp: z.int().positive(),
    sessionId: IdSchema.nullable(),
    delegatePublicKey: SigningPublicKeySchema.nullable(),
    credentialEpoch: IdSchema,
  })
  .refine(
    (value) =>
      (value.sessionId === null) === (value.delegatePublicKey === null) &&
      (!value.scopes.includes('daclify:submit') || value.sessionId !== null),
    'Signed submission needs its authorized native companion',
  );

const Pkce = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const McpPairingInputSchema = z
  .strictObject({
    dao: DaoRefSchema,
    memberId: IdSchema,
    scopes: z.array(McpScopeSchema).min(1).max(4),
    delegatePublicKey: SigningPublicKeySchema,
    codeChallenge: Pkce,
    app: z
      .strictObject({ appId: IdSchema, revision: IdSchema, configHash: ChainIdSchema })
      .optional(),
  })
  .refine(
    (value) =>
      new Set(value.scopes).size === value.scopes.length &&
      (value.scopes.includes('activity') ? value.scopes.length === 1 && !!value.app : !value.app),
    'Activity grants are distinct from routine grants',
  );
export const McpPairingSchema = McpPairingInputSchema.safeExtend({
  id: z.uuid(),
  expires: z.iso.datetime(),
});
export const McpPairingApprovalSchema = z.strictObject({
  id: z.uuid(),
  dao: DaoRefSchema,
  memberId: IdSchema,
  scopes: z.array(McpScopeSchema).min(1).max(4),
  sessionId: IdSchema,
  mode: z.enum(['autonomous', 'confirm']),
});
export const McpGrantSchema = z.strictObject({
  id: z.uuid(),
  dao: DaoRefSchema,
  memberId: IdSchema,
  scopes: z.array(McpScopeSchema).min(1).max(4),
  delegatePublicKey: SigningPublicKeySchema,
  sessionId: IdSchema,
  sessionExpires: z.int().positive().max(4294967295),
  mode: z.enum(['autonomous', 'confirm']),
  app: McpPairingInputSchema.shape.app,
});
const Token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const McpPairingRoutes = {
  mcpPair: {
    method: 'POST',
    path: '/v1/mcp/pairings',
    input: McpPairingInputSchema,
    response: McpPairingSchema.safeExtend({ consentUrl: z.url().max(2048) }),
    helpTopic: 'agents',
  },
  mcpConsent: {
    method: 'GET',
    path: '/v1/mcp/pairings/:id/consent',
    response: z.strictObject({
      pairing: McpPairingSchema,
      permissions: z
        .array(
          z.strictObject({
            target: RuntimeActionSchemas.addsession.shape.permissions.element.shape.target,
            action: RuntimeActionSchemas.addsession.shape.permissions.element.shape.action,
            code_hash: ChainIdSchema,
          }),
        )
        .min(1)
        .max(4),
      grantExpires: z.int().positive().max(4294967295),
    }),
    helpTopic: 'agents',
  },
  mcpApprove: {
    method: 'POST',
    path: '/v1/mcp/pairings/approve',
    input: McpPairingApprovalSchema,
    response: z.strictObject({ approved: z.literal(true) }),
    helpTopic: 'agents',
  },
  mcpRedeem: {
    method: 'POST',
    path: '/v1/mcp/pairings/:id/redeem',
    input: z.strictObject({ codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) }),
    response: z.strictObject({ grant: McpGrantSchema, token: Token }),
    helpTopic: 'agents',
  },
  mcpLocalStatus: {
    method: 'GET',
    path: '/v1/mcp/local/status',
    response: McpGrantSchema,
    helpTopic: 'agents',
  },
  mcpLocalRead: {
    method: 'POST',
    path: '/v1/mcp/local/read',
    input: McpReadInputSchema,
    response: McpReadResultSchema,
    helpTopic: 'agents',
  },
  mcpLocalPrepare: {
    method: 'POST',
    path: '/v1/mcp/local/prepare',
    input: McpPrepareInputSchema,
    response: PreparedInstructionSchema,
    helpTopic: 'agents',
  },
  mcpLocalSubmit: {
    method: 'POST',
    path: '/v1/mcp/local/submit',
    input: SignedMcpInstructionSchema,
    response: SubmissionResultSchema,
    helpTopic: 'agents',
  },
  mcpLocalRevoke: {
    method: 'POST',
    path: '/v1/mcp/local/revoke',
    input: z.strictObject({}),
    response: z.strictObject({ revoked: z.literal(true) }),
    helpTopic: 'agents',
  },
  mcpLocalValidate: {
    method: 'POST',
    path: '/v1/mcp/local/validate',
    input: PreparedInstructionSchema,
    response: RuntimeActionSchemas.submitsess.shape.request,
    helpTopic: 'agents',
  },
} satisfies Record<
  string,
  {
    method: 'GET' | 'POST';
    path: string;
    input?: z.ZodType;
    response: z.ZodType;
    helpTopic: string;
  }
>;

export const McpOAuthClientSchema = z.strictObject({
  clientId: z.string().min(1).max(128),
  redirectUris: z.array(z.url().max(2048)).min(1).max(8),
});
export const McpOAuthAuthorizeSchema = z.strictObject({
  response_type: z.literal('code'),
  client_id: z.string().min(1).max(128),
  redirect_uri: z.url().max(2048),
  resource: z.url().max(512),
  scope: z.string().min(1).max(128),
  state: z.string().min(1).max(512),
  code_challenge: Pkce,
  code_challenge_method: z.literal('S256'),
});
export const McpOAuthApprovalSchema = z.strictObject({
  id: z.uuid(),
  dao: DaoRefSchema,
  memberId: IdSchema,
  nativeScopes: z.array(McpScopeSchema).max(4),
  localGrantId: z.uuid().nullable(),
});
export const McpOAuthTokenInputSchema = z.discriminatedUnion('grant_type', [
  z.strictObject({
    grant_type: z.literal('authorization_code'),
    code: Token,
    code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
    client_id: z.string().min(1).max(128),
    redirect_uri: z.url().max(2048),
    resource: z.url().max(512),
  }),
  z.strictObject({
    grant_type: z.literal('refresh_token'),
    refresh_token: Token,
    client_id: z.string().min(1).max(128),
    resource: z.url().max(512),
  }),
]);
export const McpPreviewSchema = PreparedInstructionSchema.omit({
  id: true,
  sessionId: true,
  signingPublicKey: true,
}).safeExtend({ state: z.literal('signer-required') });
export const McpPreparationSchema = z.union([PreparedInstructionSchema, McpPreviewSchema]);
export type McpPreparation = z.infer<typeof McpPreparationSchema>;
export type McpOAuthClaims = z.infer<typeof McpOAuthClaimsSchema>;
export const McpOAuthRoutes = {
  mcpOAuthSignInApproval: {
    method: 'GET',
    path: '/v1/mcp/oauth/sign-in-approval',
    response: z.strictObject({ expires: z.iso.datetime().nullable() }),
    helpTopic: 'agents',
  },
  mcpOAuthConsent: {
    method: 'GET',
    path: '/v1/mcp/oauth/requests/:id',
    response: z.strictObject({
      id: z.uuid(),
      clientId: z.string().min(1).max(128),
      redirectUri: z.url().max(2048),
      scopes: z.array(McpOAuthScopeSchema).min(1).max(3),
      expires: z.iso.datetime(),
    }),
    helpTopic: 'agents',
  },
  mcpOAuthApprove: {
    method: 'POST',
    path: '/v1/mcp/oauth/approve',
    input: McpOAuthApprovalSchema,
    response: z.strictObject({ redirectUrl: z.url().max(4096) }),
    helpTopic: 'agents',
  },
} as const;
export const McpInventoryRoutes = {
  mcpGrants: {
    method: 'GET',
    path: '/v1/mcp/grants',
    response: z.array(McpGrantSchema).max(32),
    helpTopic: 'agents',
  },
  mcpRevokeGrant: {
    method: 'POST',
    path: '/v1/mcp/grants/revoke',
    input: z.strictObject({ id: z.uuid() }),
    response: z.strictObject({ revoked: z.literal(true) }),
    helpTopic: 'agents',
  },
} as const;

const McpReleaseVersion = z
  .string()
  .max(64)
  .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);
export const McpArtifactNameSchema = z.enum(['core.tgz', 'modules.tgz', 'mcp.tgz']);
export const McpReleaseIdentitySchema = z
  .strictObject({
    version: z.literal(1),
    coreVersion: McpReleaseVersion,
    modulesVersion: McpReleaseVersion,
    mcpVersion: McpReleaseVersion,
    files: z
      .array(
        z.strictObject({
          name: McpArtifactNameSchema,
          sha256: ChainIdSchema,
          bytes: z
            .int()
            .min(1)
            .max(16 * 1024 * 1024),
        }),
      )
      .length(3),
  })
  .refine((value) => new Set(value.files.map((file) => file.name)).size === 3);
export const McpReleaseManifestSchema = McpReleaseIdentitySchema.safeExtend({
  releaseId: ChainIdSchema,
});
export const McpLocalConfigurationSchema = z.strictObject({
  version: z.literal(1),
  api: ApiOriginSchema,
  frontend: ApiOriginSchema,
  dao: DaoRefSchema,
  memberId: IdSchema,
  scopes: McpConnectionSchema.shape.scopes,
  app: McpPairingInputSchema.shape.app,
});
export const McpConnectionInventorySchema = z.strictObject({
  local: z.array(z.strictObject({ grant: McpGrantSchema, revoked: z.boolean() })).max(32),
  remote: z
    .array(
      z.strictObject({
        id: z.uuid(),
        clientId: z.string().min(1).max(128),
        dao: DaoRefSchema,
        memberId: IdSchema,
        scopes: z.array(McpOAuthScopeSchema).max(3),
        expires: z.iso.datetime(),
        revoked: z.boolean(),
      }),
    )
    .max(32),
});
export const McpSetupRoutes = {
  mcpRelease: {
    method: 'GET',
    path: '/v1/mcp/release',
    response: McpReleaseManifestSchema,
    helpTopic: 'agents',
  },
  mcpConnections: {
    method: 'GET',
    path: '/v1/mcp/connections',
    response: McpConnectionInventorySchema,
    helpTopic: 'agents',
  },
  mcpRevokeFamily: {
    method: 'POST',
    path: '/v1/mcp/oauth/revoke-family',
    input: z.strictObject({ id: z.uuid() }),
    response: z.strictObject({ revoked: z.literal(true) }),
    helpTopic: 'agents',
  },
} as const;
export const McpDiagnosticCodeSchema = z.enum([
  'MCP_VOTE_UNAVAILABLE',
  'MCP_PUBLIC_DAO_REQUIRED',
  'MCP_DOMAIN',
  'MCP_POLICY_CHANGED',
  'MCP_INDEPENDENT_REVIEW_REQUIRED',
  'MCP_APP_REVISION_CHANGED',
  'MCP_ACTIVITY_RECONCILE_REQUIRED',
  'MCP_COMPANION_PRIVATE',
  'MCP_CREDENTIALS',
  'MCP_API_REJECTED',
  'MCP_TRUSTED_CONFIRMATION_REQUIRED',
  'MCP_ROOT_CEREMONY_REQUIRED',
  'MCP_APPROVAL_PENDING',
  'MCP_MEMBER_INACTIVE',
  'MCP_GRANT_REVOKED',
  'MCP_TOKEN_REQUIRED',
  'MCP_SCOPE_REQUIRED',
  'MCP_REVIEWER_REQUIRED',
  'MCP_MODULE_PIN',
  'MCP_GRANT_REQUIRED',
  'MCP_APP_CREDENTIAL_REQUIRED',
  'MCP_RECONCILE_REQUIRED',
  'MCP_PREPARED_CHANGED',
  'MCP_SIGNATURE',
  'MCP_UNAVAILABLE',
  'MCP_DOWNLOAD_UNAVAILABLE',
  'MCP_FRESH_CONSENT_REQUIRED',
  'RATE_LIMIT',
]);
