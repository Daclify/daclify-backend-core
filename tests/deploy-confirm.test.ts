import { expect, it, vi } from 'vitest';
import { waitForIrreversibleBlock } from '../services/api/src/chain-confirmation.js';
import { ApiError, contractError } from '../services/api/src/errors.js';

it('preserves a typed confirmation failure instead of reporting an accepted transaction as rejected', () => {
  const cause = new ApiError('CHAIN_UNAVAILABLE', 503);
  expect(contractError(cause)).toBe(cause);
});

it('waits for the submitted block to be irreversible before the next deployment step', async () => {
  vi.useFakeTimers();
  try {
    let reads = 0;
    const pending = waitForIrreversibleBlock(async () => (++reads < 3 ? 99 : 100), 100);
    await vi.runAllTimersAsync();
    await pending;
    expect(reads).toBe(3);
  } finally {
    vi.useRealTimers();
  }
});

it('stops a stalled deployment instead of sending dependent transactions', async () => {
  vi.useFakeTimers();
  try {
    const pending = expect(waitForIrreversibleBlock(async () => 99, 100)).rejects.toThrow(
      'CHAIN_CONFIRMATION_TIMEOUT',
    );
    await vi.runAllTimersAsync();
    await pending;
  } finally {
    vi.useRealTimers();
  }
});
