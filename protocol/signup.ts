import { z } from 'zod';
import { ApiOriginSchema } from './base.js';
import { SessionSchema, ChallengeRequestSchema } from './api.js';
import {
  RecoveryContextSchema,
  RecoveryCipherSchema,
  RecoveryKeyGrantSchema,
  recoveryVaultDomain,
} from './recovery.js';
import {
  SignInEmailSchema,
  SignInEmailCodeSchema,
  SignInProofSchema,
  TelegramStartSchema,
  TelegramAuthorizationSchema,
} from './sign-in.js';

export const SignupTicketSchema = z.strictObject({
  id: z.uuid(),
  provider: z.enum(['email', 'telegram']),
  expires: z.iso.datetime(),
});
export const SignupVerificationSchema = z.discriminatedUnion('status', [
  SessionSchema.extend({ status: z.literal('existing') }),
  SignupTicketSchema.extend({ status: z.literal('pending') }),
]);
export const SignupMessageSchema = ChallengeRequestSchema.extend({
  domain: z.literal('daclify.signup.v1'),
  id: z.uuid(),
  accountId: z.uuid(),
  origin: ApiOriginSchema,
  audience: ApiOriginSchema,
  expires: z.iso.datetime(),
  assistedConsent: z.literal(true),
});
export const SignupPreparedSchema = z.strictObject({
  id: z.uuid(),
  message: z.string().max(4096),
  expires: z.iso.datetime(),
  context: RecoveryContextSchema,
});
export const SignupAuthorizedSchema = z.strictObject({
  id: z.uuid(),
  recipient: RecoveryKeyGrantSchema.shape.ephemeralKey,
  expires: z.iso.datetime(),
});
export const SignupOptionsSchema = z.strictObject({
  telegram: z.strictObject({
    configured: z.boolean(),
    username: z.string().nullable(),
    oidc: z.boolean(),
    miniApp: z.boolean(),
  }),
  email: z.strictObject({ delivery: z.enum(['mail', 'unavailable']) }),
  assisted: z.strictObject({ available: z.boolean(), reason: z.string().max(512).nullable() }),
});
export function signupDeliveryDomain(id: string, context: unknown): string {
  return `daclify.signup.enroll.v1:${z.uuid().parse(id)}:${recoveryVaultDomain(context)}`;
}
export type SignupVerification = z.infer<typeof SignupVerificationSchema>;
export type SignupTicket = z.infer<typeof SignupTicketSchema>;
export const SignupRoutes = {
  signupOptions: {
    method: 'GET',
    path: '/v1/sign-up/options',
    response: SignupOptionsSchema,
    helpTopic: 'accounts',
  },
  signupEmailStart: {
    method: 'POST',
    path: '/v1/sign-up/email/start',
    input: SignInEmailSchema,
    response: z.strictObject({ delivery: z.literal('sent') }),
    helpTopic: 'accounts',
  },
  signupEmailVerify: {
    method: 'POST',
    path: '/v1/sign-up/email/verify',
    input: SignInEmailCodeSchema,
    response: SignupVerificationSchema,
    helpTopic: 'accounts',
  },
  signupTelegramVerify: {
    method: 'POST',
    path: '/v1/sign-up/telegram',
    input: SignInProofSchema,
    response: SignupVerificationSchema,
    helpTopic: 'accounts',
  },
  signupTelegramStart: {
    method: 'POST',
    path: '/v1/sign-in/telegram/oidc/signup/start',
    input: TelegramStartSchema,
    response: TelegramAuthorizationSchema,
    helpTopic: 'accounts',
  },
  signupPending: {
    method: 'GET',
    path: '/v1/sign-up/pending/:id',
    response: SignupTicketSchema,
    helpTopic: 'accounts',
  },
  signupPrepare: {
    method: 'POST',
    path: '/v1/sign-up/prepare',
    input: ChallengeRequestSchema.extend({ id: z.uuid(), assistedConsent: z.literal(true) }),
    response: SignupPreparedSchema,
    helpTopic: 'accounts',
  },
  signupAuthorize: {
    method: 'POST',
    path: '/v1/sign-up/authorize',
    input: z.strictObject({ id: z.uuid(), signature: z.string().min(1).max(160) }),
    response: SignupAuthorizedSchema,
    helpTopic: 'accounts',
  },
  signupFinish: {
    method: 'POST',
    path: '/v1/sign-up/finish',
    input: z.strictObject({
      id: z.uuid(),
      envelope: RecoveryCipherSchema,
      keyGrant: RecoveryKeyGrantSchema,
    }),
    response: SessionSchema,
    helpTopic: 'accounts',
  },
} as const;
