import type { APIClient } from '@wharfkit/antelope';
import { z } from 'zod';
import { ChainIdSchema } from '../../../protocol/base.js';
import { ExitSubmissionSchema, type ExitSubmission } from '../../../protocol/account-exit.js';
import { ApiError } from './errors.js';

// Public RPC nodes may lag behind the node that accepted an account creation.
export async function waitForIrreversibleBlock(
  readBlock: () => Promise<number>,
  submittedBlock: number,
  attempts = 60,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if ((await readBlock()) >= submittedBlock) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('CHAIN_CONFIRMATION_TIMEOUT');
}

// Callers validate the exact signed action and its authority before checking native receipts.
export async function reconcileChainSubmission(
  api: APIClient,
  chainId: string,
  input: ExitSubmission,
): Promise<{ state: 'confirmed' | 'pending' | 'unavailable'; cursor: number }> {
  const packet = ExitSubmissionSchema.parse(input);
  try {
    const result = await api.v1.chain.get_transaction_status(packet.transactionId);
    if (result.state === 'IRREVERSIBLE') return { state: 'confirmed', cursor: packet.cursor };
  } catch {
    /* Nodes may not enable finality tracking; reconcile the exact ID in irreversible blocks. */
  }
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== chainId) throw new ApiError('CHAIN_ID_MISMATCH', 503);
  const end = Math.min(
    Number(info.last_irreversible_block_num),
    packet.firstBlock + 128,
    packet.cursor + 24,
  );
  for (let cursor = packet.cursor; cursor <= end; cursor++) {
    const value = await api.call({
      path: '/v1/chain/get_block',
      params: { block_num_or_id: cursor },
    });
    const block = z
      .object({
        block_num: z.int(),
        timestamp: z.string(),
        transactions: z.array(
          z.object({
            status: z.string(),
            trx: z.union([z.string(), z.object({ id: ChainIdSchema })]),
          }),
        ),
      })
      .parse(value);
    if (block.block_num !== cursor) throw new ApiError('EXIT_RECEIPT', 503);
    if (
      block.transactions.some(
        (item) =>
          (typeof item.trx === 'string' ? item.trx : item.trx.id) === packet.transactionId &&
          item.status === 'executed',
      )
    )
      return { state: 'confirmed', cursor };
    if (
      Date.parse(block.timestamp + (block.timestamp.endsWith('Z') ? '' : 'Z')) >
      Date.parse(packet.expiresAt)
    )
      return { state: 'unavailable', cursor };
  }
  return {
    state: packet.cursor >= packet.firstBlock + 128 ? 'unavailable' : 'pending',
    cursor: end >= packet.cursor ? end + 1 : packet.cursor,
  };
}
