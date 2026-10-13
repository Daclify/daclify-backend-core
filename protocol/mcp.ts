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
    options: z.array(z.string().min(1).max(80)).min(2).max(8),
  }),
  prepare_vote: z.strictObject({ pollId: IdSchema, optionId: z.string().regex(/^[0-7]$/) }),
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
