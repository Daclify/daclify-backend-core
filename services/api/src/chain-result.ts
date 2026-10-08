import { z } from 'zod';
import { ChainIdSchema } from '../../../protocol/base.js';
import { ApiError } from './errors.js';

const ExecutedResultSchema = z.object({
  transaction_id: ChainIdSchema,
  processed: z.object({
    id: ChainIdSchema,
    block_num: z.int().min(1),
    receipt: z.object({ status: z.literal('executed') }),
    except: z.null().optional(),
  }),
});
export function executedChainResult(
  value: unknown,
  expectedId: string,
): { transactionId: string; blockNum: number } {
  const parsed = ExecutedResultSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.transaction_id !== expectedId ||
    parsed.data.processed.id !== expectedId
  )
    throw new ApiError('CHAIN_ACTION_REJECTED', 409);
  return { transactionId: parsed.data.transaction_id, blockNum: parsed.data.processed.block_num };
}
