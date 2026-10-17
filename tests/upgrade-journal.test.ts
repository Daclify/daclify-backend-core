import { expect, it } from 'vitest';
import {
  upgradePosition,
  assertNoAssetTransfer,
  contractRamGrowth,
} from '../tools/deploy/upgrade-journal.js';
it('reserves contract code RAM separately from existing DAO grants and never releases budget on shrink', () => {
  expect(contractRamGrowth(200, 100, 30, 10)).toBe(1020);
  expect(contractRamGrowth(100, 200, 10, 30)).toBe(0);
  expect(() => contractRamGrowth(Number.MAX_SAFE_INTEGER, 0, 0, 0)).toThrow('RAM_GROWTH_BOUND');
});
it('resumes only a confirmed forward prefix or rollback suffix and rejects gaps', () => {
  expect(upgradePosition([true, true, true, false], [false, false, false, false])).toEqual({
    completed: 3,
    remaining: 3,
  });
  expect(upgradePosition([true, true, true, false], [false, true, true, false])).toEqual({
    completed: 3,
    remaining: 1,
  });
  expect(() => upgradePosition([true, false, true], [false, false, false])).toThrow(
    'JOURNAL_FORWARD_GAP',
  );
  expect(() => upgradePosition([true, true, true], [false, true, false])).toThrow(
    'JOURNAL_REVERSE_GAP',
  );
  expect(() => upgradePosition([true, false], [false, true])).toThrow('JOURNAL_REVERSE_GAP');
});
it('rejects nested asset transfers and missing simulation traces before broadcasting', () => {
  const operation = { act: { name: 'setcode' }, inline_traces: [{ act: { name: 'ramadjust' } }] };
  expect(() => assertNoAssetTransfer({ processed: { action_traces: [operation] } })).not.toThrow();
  expect(() =>
    assertNoAssetTransfer({
      processed: {
        action_traces: [{ ...operation, inline_traces: [{ act: { name: 'transfer' } }] }],
      },
    }),
  ).toThrow('ASSET_MOVEMENT_FORBIDDEN');
  expect(() => assertNoAssetTransfer({ processed: {} })).toThrow();
});
