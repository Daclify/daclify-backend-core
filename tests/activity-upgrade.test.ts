import { expect, it } from 'vitest';
import { activityInitializationBatches } from '../tools/deploy/member-activity.js';

it('initializes existing members in bounded batches using sorted uint64 cursors', () => {
  const ids = Array.from({ length: 102 }, (_, index) => String(index + 1)).reverse();
  ids.push('18446744073709551615');
  expect(activityInitializationBatches('1', ids)).toEqual([
    { dao_id: '1', after: '1', limit: 50 },
    { dao_id: '1', after: '51', limit: 50 },
    { dao_id: '1', after: '101', limit: 3 },
  ]);
});
it('never initializes an empty DAO or permits duplicated/malformed membership IDs', () => {
  expect(activityInitializationBatches('1', [])).toEqual([]);
  for (const ids of [['1', '1'], ['0'], ['18446744073709551616'], ['private-account']])
    expect(() => activityInitializationBatches('1', ids)).toThrow();
  expect(() => activityInitializationBatches('0', ['1'])).toThrow();
});
