import { z } from 'zod';
import { PrivateKey } from '@wharfkit/antelope';
import {
  ApiOriginSchema,
  DaoRefSchema,
  IdSchema,
  ChainIdSchema,
  EncryptionPublicKeySchema,
  ContentEnvelopeSchema,
} from '@daclify/core-protocol';
const SigningSecret = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => {
    try {
      return PrivateKey.from(value).type === 'K1';
    } catch {
      return false;
    }
  }, 'Protected K1 signer configuration required');
export const AgentAuthenticationSchema = z.strictObject({
  signingKey: SigningSecret,
  encryptionKey: EncryptionPublicKeySchema,
});
export const AgentScopedSignerSchema = z.strictObject({
  signingKey: SigningSecret,
  memberId: IdSchema,
  sessionId: IdSchema,
});
export const AgentPublishInputSchema = z
  .strictObject({
    api: ApiOriginSchema,
    origin: ApiOriginSchema,
    dao: DaoRefSchema,
    documentId: IdSchema,
    documentVersion: z.int().min(1).max(4294967295),
    accountAuthentication: AgentAuthenticationSchema,
    scopedSigner: AgentScopedSignerSchema,
    visibility: z.literal('public'),
    publicJson: z
      .json()
      .refine(
        (value) => Buffer.byteLength(JSON.stringify(value)) <= 4096,
        'Public JSON exceeds document limit',
      )
      .refine(
        (value) => !ContentEnvelopeSchema.safeParse(value).success,
        'This example requires public plaintext JSON',
      ),
  })
  .refine(
    (value) => value.accountAuthentication.signingKey !== value.scopedSigner.signingKey,
    'Root authentication and scoped publication require separate keys',
  );
export type AgentPublishInput = z.infer<typeof AgentPublishInputSchema>;
export const AgentPublishResultSchema = z.strictObject({
  dao: DaoRefSchema,
  memberId: IdSchema,
  accountId: z.uuid(),
  documentId: IdSchema,
  transactionId: ChainIdSchema,
});
export type AgentPublishResult = z.infer<typeof AgentPublishResultSchema>;
