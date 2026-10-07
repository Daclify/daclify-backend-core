import { z } from 'zod';
import {
  AssetRefSchema,
  DaoRefSchema,
  Uint64Schema,
  IdSchema,
  NativeAccountSchema,
  ChainIdSchema,
} from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
export const ReportTotalSchema = z
  .string()
  .max(40)
  .regex(/^(0|[1-9][0-9]*)$/);
export function formatReportAmount(value: string, precision: number): string {
  const total = BigInt(ReportTotalSchema.parse(value)),
    p = AssetRefSchema.shape.precision.parse(precision),
    scale = 10n ** BigInt(p);
  return p === 0
    ? total.toString()
    : `${total / scale}.${(total % scale).toString().padStart(p, '0')}`;
}
const DocumentReferenceSchema = z.strictObject({
  id: IdSchema,
  version: z.int().min(1),
  cid: z.string(),
  commitment: ChainIdSchema,
  encrypted: z.boolean(),
});
export const SpendingReportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  dao: DaoRefSchema,
  asset: AssetRefSchema,
  read: z.strictObject({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    atomic: z.literal(false),
  }),
  complete: z.boolean(),
  issues: z.array(
    z.enum([
      'treasury-unavailable',
      'content-unavailable',
      'modules-unavailable',
      'module-records-unavailable',
      'document-reference-unavailable',
      'reconciliation-changed',
    ]),
  ),
  receiptCoverage: z.enum(['since-receipt-upgrade', 'unavailable']),
  summary: z
    .strictObject({
      available: Uint64Schema,
      reserved: Uint64Schema,
      claims: Uint64Schema,
      settledObligations: ReportTotalSchema,
      externalCashflow: ReportTotalSchema,
      legacyUnknownSettlements: ReportTotalSchema,
    })
    .nullable(),
  obligations: z.array(
    z.strictObject({
      id: IdSchema,
      source: NativeAccountSchema,
      sourceId: IdSchema,
      beneficiary: IdSchema,
      amount: Uint64Schema,
      due: z.int().min(0),
      state: z.enum(['reserved', 'approved', 'settled', 'cancelled']),
      settlement: z.enum(['pending', 'internal-claim', 'native-payment', 'legacy-unknown']),
      receiptId: IdSchema.nullable(),
      category: z.enum(['works', 'payroll', 'other']),
      projectId: IdSchema.nullable(),
      agreementTerms: ChainIdSchema.nullable(),
      documents: z.array(DocumentReferenceSchema),
      statements: z.array(RuntimeTableSchemas.evidence),
    }),
  ),
  claimBalances: z.array(z.strictObject({ member: IdSchema, amount: Uint64Schema })),
  receipts: z.array(RuntimeTableSchemas.receipts),
});
export type SpendingReport = z.infer<typeof SpendingReportSchema>;
