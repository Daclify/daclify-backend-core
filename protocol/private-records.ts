import { z } from 'zod';
import { ChainIdSchema, IdSchema, NativeAccountSchema } from './base.js';
import { ContentEnvelopeSchema, EpochGrantSchema } from './crypto.js';

export const PrivateRecordReferenceSchema = z.strictObject({
  documentId: IdSchema,
  version: z.int().min(1).max(4294967295),
  commitment: ChainIdSchema,
  keyEpoch: IdSchema,
});
const text = (maximum: number, maximumBytes = maximum * 4) =>
  z
    .string()
    .max(maximum)
    .refine(
      (value) => new TextEncoder().encode(value).length <= maximumBytes,
      'The UTF-8 text exceeds the byte limit.',
    );
export const PrivateIdentityBodySchema = z.strictObject({
  title: text(160).refine((value) => value.trim().length > 0),
  description: text(4000),
  summary: text(280).optional(),
  branding: z
    .strictObject({
      logo: PrivateRecordReferenceSchema.optional(),
      cover: PrivateRecordReferenceSchema.optional(),
    })
    .optional(),
});
export const PrivateBallotBodySchema = z
  .strictObject({
    title: text(160).refine((value) => value.trim().length > 0),
    description: text(2000).refine((value) => value.trim().length > 0),
    semantics: z.enum(['proposal', 'poll']),
    options: z
      .array(text(80).refine((value) => value.trim().length > 0))
      .min(2)
      .max(16),
    document: z
      .strictObject({
        documentId: IdSchema,
        version: z.int().min(1).max(4294967295),
        commitment: ChainIdSchema,
      })
      .optional(),
  })
  .refine(
    (value) =>
      new Set(value.options.map((option) => option.trim().normalize('NFC').toLowerCase())).size ===
        value.options.length &&
      (value.semantics === 'poll' ||
        (value.options.length === 2 &&
          value.options[0] === 'Reject' &&
          value.options[1] === 'Approve')),
    'Invalid ordered ballot choices.',
  );
export const PrivatePayrollBodySchema = z.strictObject({
  purpose: z.enum(['agreed', 'display']),
  label: text(80, 80).refine((value) => value.trim().length > 0),
});
export const PrivateAgentBodySchema = z.strictObject({
  operatorLabel: text(64),
  description: text(4000),
});
const context = {
  schemaVersion: z.literal(1),
  source: NativeAccountSchema,
  recordId: IdSchema,
};
export const PrivateRecordPayloadSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...context, kind: z.literal('dao-identity'), body: PrivateIdentityBodySchema }),
  z.strictObject({ ...context, kind: z.literal('ballot-content'), body: PrivateBallotBodySchema }),
  z.strictObject({ ...context, kind: z.literal('payroll-label'), body: PrivatePayrollBodySchema }),
  z.strictObject({
    ...context,
    kind: z.literal('agent-description'),
    body: PrivateAgentBodySchema,
  }),
]);
export type PrivateRecordReference = z.infer<typeof PrivateRecordReferenceSchema>;
export type PrivateRecordPayload = z.infer<typeof PrivateRecordPayloadSchema>;

const setupEnvelope = ContentEnvelopeSchema.extend({
  iv: ContentEnvelopeSchema.shape.iv.length(16),
  ciphertext: ContentEnvelopeSchema.shape.ciphertext.min(24).max(49152),
});
const setup = {
  schemaVersion: z.literal(1),
  daoId: IdSchema,
  documentId: IdSchema,
  contextCommitment: ChainIdSchema,
  envelope: setupEnvelope,
};
export const PrivateFounderSetupSchema = z.strictObject({
  ...setup,
  stage: z.literal('founder'),
  epochCommitment: ChainIdSchema,
  selfGrant: EpochGrantSchema.extend({
    salt: EpochGrantSchema.shape.salt.length(44),
    envelope: setupEnvelope.extend({ ciphertext: setupEnvelope.shape.ciphertext.max(4096) }),
  }),
  agentDescription: z.strictObject({ documentId: IdSchema, envelope: setupEnvelope }).optional(),
});
export const PrivateDaoSetupSchema = z.discriminatedUnion('stage', [
  z.strictObject({ ...setup, stage: z.literal('invitation') }),
  PrivateFounderSetupSchema,
]);
export type PrivateDaoSetup = z.infer<typeof PrivateDaoSetupSchema>;
export type PrivateFounderSetup = z.infer<typeof PrivateFounderSetupSchema>;
