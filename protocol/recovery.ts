import { z } from 'zod';
import { ApiOriginSchema } from './base.js';
import { EncryptionPublicKeySchema, SigningPublicKeySchema } from './crypto.js';

function encodedBytes(length: number) {
  return z
    .string()
    .max(4 * Math.ceil(length / 3))
    .refine((value) => {
      try {
        return atob(value).length === length && btoa(atob(value)) === value;
      } catch {
        return false;
      }
    }, 'Invalid canonical byte encoding');
}
const CiphertextSchema = z
  .string()
  .max(16384)
  .refine((value) => {
    try {
      return atob(value).length >= 16 && btoa(atob(value)) === value;
    } catch {
      return false;
    }
  }, 'Invalid ciphertext');
export const RecoveryCipherSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('AES-256-GCM'),
  iv: encodedBytes(12),
  ciphertext: CiphertextSchema,
});
export const RecoveryKeyCipherSchema = RecoveryCipherSchema.extend({
  ciphertext: encodedBytes(48),
});
export const RecoveryModeSchema = z.enum([
  'wallet-protected',
  'passkey-protected',
  'daclify-assisted',
]);
export const RecoveryCredentialKeySchema = z
  .string()
  .min(3)
  .max(2048)
  .regex(/^(email|telegram|google|passkey|native|evm):[^\u0000-\u001f\u007f]+$/);
export const RecoveryContextSchema = z
  .strictObject({
    version: z.literal(1),
    id: z.uuid(),
    accountId: z.uuid(),
    origin: ApiOriginSchema,
    credentialKey: RecoveryCredentialKeySchema,
    mode: RecoveryModeSchema,
    signingPublicKey: SigningPublicKeySchema,
    encryptionPublicKey: EncryptionPublicKeySchema,
    salt: encodedBytes(32),
  })
  .superRefine((value, ctx) => {
    if (
      (value.mode === 'wallet-protected' && !/^(native|evm):/.test(value.credentialKey)) ||
      (value.mode === 'passkey-protected' && !value.credentialKey.startsWith('passkey:'))
    )
      ctx.addIssue({ code: 'custom', message: 'Recovery method does not match credential' });
  });
export const RecoveryKeyWrapSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('client'), envelope: RecoveryKeyCipherSchema }),
  z.strictObject({
    kind: z.literal('service'),
    ciphertext: z
      .string()
      .max(8192)
      .regex(/^vault:v[1-9][0-9]*:[A-Za-z0-9+/]+={0,2}$/),
  }),
]);
export const RecoveryBackupSchema = z
  .strictObject({
    context: RecoveryContextSchema,
    envelope: RecoveryCipherSchema,
    keyWrap: RecoveryKeyWrapSchema,
  })
  .superRefine((value, ctx) => {
    if ((value.context.mode === 'daclify-assisted') !== (value.keyWrap.kind === 'service'))
      ctx.addIssue({ code: 'custom', message: 'Recovery wrap does not match custody policy' });
  });
export const RecoveryKeyGrantSchema = z.strictObject({
  version: z.literal(1),
  ephemeralKey: EncryptionPublicKeySchema,
  salt: encodedBytes(32),
  envelope: RecoveryKeyCipherSchema,
});
export const RecoveryEnrollSchema = z
  .strictObject({
    context: RecoveryContextSchema,
    envelope: RecoveryCipherSchema,
    clientKeyWrap: RecoveryKeyCipherSchema.optional(),
    assistedHandoff: z.strictObject({ id: z.uuid(), keyGrant: RecoveryKeyGrantSchema }).optional(),
    assistedConsent: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const assisted = value.context.mode === 'daclify-assisted';
    if (
      assisted
        ? !value.assistedConsent || !value.assistedHandoff || value.clientKeyWrap !== undefined
        : !value.clientKeyWrap || value.assistedHandoff !== undefined || value.assistedConsent
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Recovery enrollment requires the selected method and consent',
      });
  });
export const RecoveryGrantSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const RecoveryClaimSchema = z.strictObject({
  grant: RecoveryGrantSchema,
  recipient: EncryptionPublicKeySchema,
});
export const RecoveryClaimResponseSchema = z.strictObject({
  backup: RecoveryBackupSchema,
  keyGrant: RecoveryKeyGrantSchema.nullable(),
});
export const RecoveryMethodSchema = z.strictObject({
  credentialKey: RecoveryCredentialKeySchema,
  kind: z.enum(['email', 'telegram', 'google', 'passkey', 'native', 'evm']),
  subject: z.string().min(1).max(2048),
  chainId: z.string().nullable(),
  mode: RecoveryModeSchema.nullable(),
  availableModes: z.array(RecoveryModeSchema).max(3),
  reason: z.string().max(512).nullable(),
});
export const RecoveryMethodsSchema = z.strictObject({
  methods: z.array(RecoveryMethodSchema).max(64),
  assistedEver: z.boolean(),
  configured: z.boolean(),
  reason: z.string().max(512).nullable(),
});
export const RecoveryDisableSchema = z.strictObject({
  credentialKey: RecoveryCredentialKeySchema,
  keepKitFallback: z.boolean().default(false),
});
export const RecoveryAssistedOptionsSchema = z.strictObject({
  id: z.uuid(),
  recipient: EncryptionPublicKeySchema,
  expires: z.iso.datetime(),
});
export const RecoveryAssistedConsentSchema = z
  .strictObject({
    context: RecoveryContextSchema,
    assistedConsent: z.literal(true),
  })
  .refine((value) => value.context.mode === 'daclify-assisted', 'Assisted mode required');
export const RecoveryIdentitySchema = z.strictObject({
  signingPublicKey: SigningPublicKeySchema,
  encryptionPublicKey: EncryptionPublicKeySchema,
});
export const DeviceRecoveryRequestSchema = RecoveryIdentitySchema.extend({
  version: z.literal(1),
  id: z.uuid(),
  accountId: z.uuid(),
  origin: ApiOriginSchema,
  recipient: EncryptionPublicKeySchema,
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  expires: z.iso.datetime(),
});
export const DeviceRecoveryPayloadSchema = z.strictObject({
  version: z.literal(1),
  ephemeralKey: EncryptionPublicKeySchema,
  salt: encodedBytes(32),
  envelope: RecoveryCipherSchema,
});
export const DeviceRecoveryPollSchema = z.strictObject({
  id: z.uuid(),
  pollToken: RecoveryGrantSchema,
});
export type DeviceRecoveryRequest = z.infer<typeof DeviceRecoveryRequestSchema>;
export type DeviceRecoveryPayload = z.infer<typeof DeviceRecoveryPayloadSchema>;
export function deviceRecoveryDomain(input: unknown): string {
  return 'daclify.device-recovery.v1:' + JSON.stringify(DeviceRecoveryRequestSchema.parse(input));
}
export function recoverySigningMessage(input: unknown): string {
  const context = RecoveryContextSchema.parse(input);
  return (
    'Daclify private vault unlock\nKeep this signature private. It unlocks your signing and private-document keys.\n' +
    JSON.stringify(context)
  );
}
export function recoveryVaultDomain(input: unknown): string {
  return 'daclify.vault-recovery.v1:' + JSON.stringify(RecoveryContextSchema.parse(input));
}
export type RecoveryContext = z.infer<typeof RecoveryContextSchema>;
export type RecoveryBackup = z.infer<typeof RecoveryBackupSchema>;
export type RecoveryEnroll = z.infer<typeof RecoveryEnrollSchema>;
export type RecoveryMethods = z.infer<typeof RecoveryMethodsSchema>;
export type RecoveryMethod = z.infer<typeof RecoveryMethodSchema>;
export type RecoveryClaim = z.infer<typeof RecoveryClaimSchema>;
export type RecoveryKeyGrant = z.infer<typeof RecoveryKeyGrantSchema>;
export type RecoveryCipher = z.infer<typeof RecoveryCipherSchema>;

export const RecoveryRoutes = {
  deviceRecoveryBegin: {
    method: 'POST',
    path: '/v1/account/recovery/device',
    input: z.strictObject({ recipient: EncryptionPublicKeySchema }),
    response: z.strictObject({
      request: DeviceRecoveryRequestSchema,
      pollToken: RecoveryGrantSchema,
    }),
    helpTopic: 'recovery',
  },
  deviceRecoveryRequest: {
    method: 'GET',
    path: '/v1/account/recovery/device/:id',
    response: DeviceRecoveryRequestSchema,
    helpTopic: 'recovery',
  },
  deviceRecoveryApprove: {
    method: 'POST',
    path: '/v1/account/recovery/device/approve',
    input: z.strictObject({
      id: z.uuid(),
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      payload: DeviceRecoveryPayloadSchema,
    }),
    response: z.strictObject({ approved: z.literal(true) }),
    helpTopic: 'recovery',
  },
  deviceRecoveryPoll: {
    method: 'POST',
    path: '/v1/account/recovery/device/poll',
    input: DeviceRecoveryPollSchema,
    response: z.strictObject({
      request: DeviceRecoveryRequestSchema,
      payload: DeviceRecoveryPayloadSchema.nullable(),
    }),
    helpTopic: 'recovery',
  },
  deviceRecoveryCancel: {
    method: 'POST',
    path: '/v1/account/recovery/device/cancel',
    input: DeviceRecoveryPollSchema,
    response: z.strictObject({ cancelled: z.literal(true) }),
    helpTopic: 'recovery',
  },
  recoveryMethods: {
    method: 'GET',
    path: '/v1/account/recovery',
    response: RecoveryMethodsSchema,
    helpTopic: 'recovery',
  },
  recoveryEnroll: {
    method: 'POST',
    path: '/v1/account/recovery/enable',
    input: RecoveryEnrollSchema,
    response: RecoveryMethodsSchema,
    helpTopic: 'recovery',
  },
  recoveryDisable: {
    method: 'POST',
    path: '/v1/account/recovery/disable',
    input: RecoveryDisableSchema,
    response: RecoveryMethodsSchema,
    helpTopic: 'recovery',
  },
  recoveryAssistedOptions: {
    method: 'POST',
    path: '/v1/account/recovery/assisted/options',
    input: RecoveryAssistedConsentSchema,
    response: RecoveryAssistedOptionsSchema,
    helpTopic: 'recovery',
  },
  recoveryClaim: {
    method: 'POST',
    path: '/v1/account/recovery/claim',
    input: RecoveryClaimSchema,
    response: RecoveryClaimResponseSchema,
    helpTopic: 'recovery',
  },
} as const;
