import { z } from 'zod';
import { DaoRefSchema, NativeAccountSchema, IdSchema, ChainIdSchema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
export const TreasurySchema = z.strictObject({
  dao: DaoRefSchema,
  obligations: z.array(RuntimeTableSchemas.obligations).max(5000),
  evidence: z.array(RuntimeTableSchemas.evidence).max(5000),
  receipts: z.array(RuntimeTableSchemas.receipts).max(5000).default([]),
  receiptsAvailable: z.boolean().default(false),
});
export function evidenceForDao<Row extends { dao_id: string }>(
  rows: readonly Row[],
  daoId: string,
): Row[] {
  return rows.filter((row) => row.dao_id === daoId);
}
export function evidenceTableMissing(body: unknown): boolean {
  const parsed = z
    .object({
      error: z
        .object({
          details: z.array(z.object({ message: z.string() })).optional(),
        })
        .optional(),
    })
    .safeParse(body);
  return (
    parsed.success &&
    parsed.data.error?.details?.some(
      (detail) => detail.message === 'Table evidence is not specified in the ABI',
    ) === true
  );
}
export const SettlementRequestSchema = z.strictObject({
  dao: DaoRefSchema,
  source: NativeAccountSchema,
  sourceId: IdSchema,
});
export const SettlementResultSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('settled'), transactionId: ChainIdSchema }),
  z.strictObject({ state: z.literal('already-settled') }),
]);
export type Treasury = z.infer<typeof TreasurySchema>;
export type SettlementRequest = z.infer<typeof SettlementRequestSchema>;
export type SettlementResult = z.infer<typeof SettlementResultSchema>;
