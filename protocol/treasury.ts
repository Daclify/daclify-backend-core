import { z } from 'zod';
import { DaoRefSchema, NativeAccountSchema, IdSchema, ChainIdSchema } from './base.js';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
export const TreasurySchema = z.strictObject({
  dao: DaoRefSchema,
  obligations: z.array(RuntimeTableSchemas.obligations).max(5000),
});
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
