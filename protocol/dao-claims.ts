import { z } from 'zod';
import { PrivateFounderSetupSchema } from './private-records.js';
import { CreateDaoSchema } from './api.js';
import { DaoRefSchema } from './base.js';
import { CreationMethodSchema, CreationOrderViewSchema } from './platform.js';

export const DaoClaimTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const DaoClaimSetupSchema = CreateDaoSchema.refine(
  (request) =>
    request.setup !== undefined &&
    request.setup.participantMode !== 'agents-guarded' &&
    request.foundingAgent === undefined,
  'Claim links require a human or mixed governance setup',
);
export const DaoClaimIssueSchema = z.strictObject({ request: DaoClaimSetupSchema });
export const DaoClaimViewSchema = z.strictObject({
  id: z.uuid(),
  request: DaoClaimSetupSchema.nullable(),
  chainId: z.string().regex(/^[0-9a-f]{64}$/),
  runtime: z.string(),
  method: CreationMethodSchema.nullable(),
  expiresAt: z.iso.datetime(),
  state: z.enum(['ready', 'claiming', 'created', 'revoked', 'expired']),
});
export const DaoClaimEligibilitySchema = z.strictObject({
  eligible: z.boolean(),
  governingDao: DaoRefSchema.nullable(),
});
export const DaoClaimRoutes = {
  daoClaimSignInApproval: {
    method: 'GET',
    path: '/v1/dao-claims/sign-in-approval',
    response: z.strictObject({ expires: z.iso.datetime().nullable() }),
    helpTopic: 'dao-claim-links',
  },
  daoClaimEligibility: {
    method: 'GET',
    path: '/v1/dao-claims/eligibility',
    response: DaoClaimEligibilitySchema,
    helpTopic: 'dao-claim-links',
  },
  daoClaimList: {
    method: 'GET',
    path: '/v1/dao-claims',
    response: z.array(DaoClaimViewSchema).max(50),
    helpTopic: 'dao-claim-links',
  },
  daoClaimIssue: {
    method: 'POST',
    path: '/v1/dao-claims/issue',
    input: DaoClaimIssueSchema,
    response: z.strictObject({ claim: DaoClaimViewSchema, token: DaoClaimTokenSchema }),
    helpTopic: 'dao-claim-links',
  },
  daoClaimRevoke: {
    method: 'POST',
    path: '/v1/dao-claims/revoke',
    input: z.strictObject({ id: z.uuid() }),
    response: DaoClaimViewSchema,
    helpTopic: 'dao-claim-links',
  },
  daoClaimPreview: {
    method: 'POST',
    path: '/v1/dao-claims/preview',
    input: z.strictObject({ token: DaoClaimTokenSchema }),
    response: DaoClaimViewSchema,
    helpTopic: 'dao-claim-links',
  },
  daoClaimConfirm: {
    method: 'POST',
    path: '/v1/dao-claims/claim',
    input: z.strictObject({
      token: DaoClaimTokenSchema,
      method: CreationMethodSchema,
      privateSetup: PrivateFounderSetupSchema.optional(),
    }),
    response: CreationOrderViewSchema,
    helpTopic: 'dao-claim-links',
  },
} as const;
export type DaoClaimView = z.infer<typeof DaoClaimViewSchema>;
