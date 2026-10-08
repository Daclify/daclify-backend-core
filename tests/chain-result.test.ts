import { expect, it } from 'vitest';
import { executedChainResult } from '../services/api/src/chain-result.js';

const id = 'ab'.repeat(32);
const successful = {
  transaction_id: id,
  processed: { id, block_num: 12, receipt: { status: 'executed' }, except: null },
};
it('accepts only an executed receipt for the transaction actually submitted', () => {
  expect(executedChainResult(successful, id)).toEqual({ transactionId: id, blockNum: 12 });
  expect(() => executedChainResult(successful, 'cd'.repeat(32))).toThrow('CHAIN_ACTION_REJECTED');
});
it('rejects HTTP-success exception envelopes without exposing internal errors', () => {
  for (const processed of [
    { ...successful.processed, receipt: null, except: { message: 'private provider diagnostic' } },
    { ...successful.processed, except: { message: 'private provider diagnostic' } },
    { ...successful.processed, receipt: { status: 'soft_fail' } },
    { ...successful.processed, receipt: { status: 'hard_fail' } },
    { ...successful.processed, receipt: { status: 'delayed' } },
    { ...successful.processed, id: 'cd'.repeat(32) },
    { ...successful.processed, block_num: -1 },
  ])
    expect(() => executedChainResult({ transaction_id: id, processed }, id)).toThrow(
      'CHAIN_ACTION_REJECTED',
    );
  expect(() => executedChainResult({}, id)).toThrow('CHAIN_ACTION_REJECTED');
});
