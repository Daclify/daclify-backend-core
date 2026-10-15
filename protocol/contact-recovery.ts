import { z } from 'zod';
import { ChainIdSchema, DaoRefSchema, IdSchema, Uint64Schema } from './base.js';
import { SessionSchema } from './api.js';
import { RuntimeActionSchemas, RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import { EncryptionPublicKeySchema, SigningPublicKeySchema, EpochGrantSchema } from './crypto.js';
import { DeviceRecoveryPayloadSchema, RecoveryCipherSchema } from './recovery.js';

export const CONTACT_RECOVERY_WAIT_SECONDS = 172800;
export const CONTACT_RECOVERY_REQUEST_SECONDS = 604800;
export const CONTACT_PACKET_MAX_BYTES = 16000;
export const CONTACT_PACKET_MAX_EPOCHS = 64;
export const ContactRecoveryTargetSchema = z.strictObject({
  dao: DaoRefSchema,
  memberId: IdSchema,
});
export const ContactIdentitySchema = z.strictObject({
  signingKey: SigningPublicKeySchema.refine((key) => key.startsWith('PUB_K1_')),
  // Zero unused base64url bits prevent aliases of the same encryption coordinate.
  encryptionKey: EncryptionPublicKeySchema.refine((key) =>
    [key.x, key.y].every((coordinate) => /[AEIMQUYcgkosw048]$/.test(coordinate)),
  ),
});
export const RecoveryContactsSchema = z
  .array(ContactIdentitySchema)
  .length(3)
  .superRefine((contacts, ctx) => {
    if (
      new Set(contacts.map((c) => c.signingKey)).size !== 3 ||
      new Set(contacts.map((c) => JSON.stringify(c.encryptionKey))).size !== 3
    )
      ctx.addIssue({ code: 'custom', message: 'Choose three distinct contact identities' });
  });
const bytes = (length: number) =>
  z
    .string()
    .max(4 * Math.ceil(length / 3))
    .refine((value) => {
      try {
        return atob(value).length === length && btoa(atob(value)) === value;
      } catch {
        return false;
      }
    }, 'Invalid canonical byte encoding');
export const ContactEpochSecretSchema = z.strictObject({
  epoch: IdSchema,
  commitment: ChainIdSchema,
  key: bytes(32),
});
export const ContactEpochSecretsSchema = z
  .array(ContactEpochSecretSchema)
  .min(1)
  .max(CONTACT_PACKET_MAX_EPOCHS)
  .superRefine((epochs, ctx) => {
    if (new Set(epochs.map((e) => e.epoch)).size !== epochs.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate epoch' });
  });
export const ContactPacketContextSchema = z.strictObject({
  target: ContactRecoveryTargetSchema,
  revision: IdSchema,
  packetId: IdSchema,
  contacts: RecoveryContactsSchema,
  epochs: z
    .array(z.strictObject({ epoch: IdSchema, commitment: ChainIdSchema }))
    .min(1)
    .max(CONTACT_PACKET_MAX_EPOCHS),
});
export const ContactDocumentPacketSchema = z
  .strictObject({
    version: z.literal(1),
    context: ContactPacketContextSchema,
    envelope: RecoveryCipherSchema,
    shares: z.array(DeviceRecoveryPayloadSchema).length(3),
  })
  .superRefine((packet, ctx) => {
    if (new TextEncoder().encode(JSON.stringify(packet)).length > CONTACT_PACKET_MAX_BYTES)
      ctx.addIssue({ code: 'custom', message: 'Recovery packet is too large' });
    if (new Set(packet.context.epochs.map((e) => e.epoch)).size !== packet.context.epochs.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate epoch' });
  });
export const ContactDocumentShareSchema = z.strictObject({
  packetCommitment: ChainIdSchema,
  index: z.int().min(0).max(2),
  share: bytes(33),
});
export const ContactShareDeliveryContextSchema = z.strictObject({
  target: ContactRecoveryTargetSchema,
  requestId: IdSchema,
  packetCommitment: ChainIdSchema,
  recipient: EncryptionPublicKeySchema,
});
export const ContactShareDeliverySchema = z.strictObject({
  version: z.literal(1),
  context: ContactShareDeliveryContextSchema,
  payload: DeviceRecoveryPayloadSchema,
});
export type ContactRecoveryTarget = z.infer<typeof ContactRecoveryTargetSchema>;
export type ContactIdentity = z.infer<typeof ContactIdentitySchema>;
export type ContactEpochSecret = z.infer<typeof ContactEpochSecretSchema>;
export type ContactDocumentPacket = z.infer<typeof ContactDocumentPacketSchema>;
export type ContactDocumentShare = z.infer<typeof ContactDocumentShareSchema>;
export type ContactShareDeliveryContext = z.infer<typeof ContactShareDeliveryContextSchema>;
export type ContactShareDelivery = z.infer<typeof ContactShareDeliverySchema>;

export const ContactRecoveryStateSchema = z.strictObject({
  target: ContactRecoveryTargetSchema,
  supported: z.boolean(),
  documentsAllowed: z.boolean(),
  nextPacketId: IdSchema,
  member: RuntimeTableSchemas.members.nullable(),
  identity: RuntimeTableSchemas.recroots.nullable().default(null),
  policy: RuntimeTableSchemas.reccontacts.nullable(),
  pending: RuntimeTableSchemas.recrequests.nullable(),
  result: RuntimeTableSchemas.recresults.nullable(),
  packets: z.array(RuntimeTableSchemas.recdocpkts).max(20),
  next: Uint64Schema.nullable(),
});
export const ContactRecoverySubmitSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('acceptcont'), data: RuntimeActionSchemas.acceptcont }),
  z.strictObject({ action: z.literal('startrecover'), data: RuntimeActionSchemas.startrecover }),
  z.strictObject({ action: z.literal('approverec'), data: RuntimeActionSchemas.approverec }),
  z.strictObject({ action: z.literal('finishrec'), data: RuntimeActionSchemas.finishrec }),
  z.strictObject({ action: z.literal('ackrecpack'), data: RuntimeActionSchemas.ackrecpack }),
]);
export const ContactRecoveryOfferSchema = z.strictObject({
  version: z.literal(1),
  request: RuntimeActionSchemas.startrecover.shape.request,
  newSignature: RuntimeActionSchemas.startrecover.shape.new_sig,
});
export type ContactRecoveryOffer = z.infer<typeof ContactRecoveryOfferSchema>;
export const ContactRecoveryRoutes = {
  contactRecoveryGrant: {
    method: 'POST',
    path: '/v1/recovery/contacts/grant',
    helpTopic: 'contact-recovery',
    input: z.strictObject({
      target: ContactRecoveryTargetSchema,
      epoch: IdSchema,
      requestId: IdSchema.optional(),
    }),
    response: z.strictObject({ grant: EpochGrantSchema.nullable() }),
  },
  contactRecoveryState: {
    method: 'POST',
    path: '/v1/recovery/contacts/state',
    helpTopic: 'contact-recovery',
    input: z.strictObject({ target: ContactRecoveryTargetSchema, after: Uint64Schema.optional() }),
    response: ContactRecoveryStateSchema,
  },
  contactRecoverySubmit: {
    method: 'POST',
    path: '/v1/recovery/contacts/submit',
    helpTopic: 'contact-recovery',
    input: ContactRecoverySubmitSchema,
    response: z.strictObject({ transactionId: ChainIdSchema }),
  },
  contactRecoveryClaim: {
    method: 'POST',
    path: '/v1/recovery/contacts/claim',
    helpTopic: 'contact-recovery',
    input: z.strictObject({
      target: ContactRecoveryTargetSchema,
      requestId: IdSchema,
      challengeId: z.uuid(),
      signature: z.string().max(256),
      encryptionKey: EncryptionPublicKeySchema,
    }),
    response: SessionSchema,
  },
} as const;
export type ContactRecoveryState = z.infer<typeof ContactRecoveryStateSchema>;
export type ContactRecoverySubmit = z.infer<typeof ContactRecoverySubmitSchema>;
export type ContactRecoveryGrantQuery = z.infer<
  typeof ContactRecoveryRoutes.contactRecoveryGrant.input
>;
