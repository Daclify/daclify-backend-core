import { expect, it } from 'vitest';
import { readStorageNoticesEnabled } from '../services/api/src/billing/storage-notices.js';
import { DEFAULT_STORAGE_PRICING, storageNotices } from '../protocol/storage.js';
const funding = {
  state: 'active' as const,
  pricing: DEFAULT_STORAGE_PRICING,
  units: 1,
  paidThrough: '2026-10-01T00:00:00Z',
  graceEndsAt: '2026-10-31T00:00:00Z',
  uploadCapacityBytes: '1100000000',
  retainedCapacityBytes: '1100000000',
};
it('uses the original term/deadline and shows the current notice without resetting grace', () => {
  expect(storageNotices(funding, new Date('2026-09-20T00:00:00Z'))).toEqual([]);
  expect(storageNotices(funding, new Date('2026-09-24T00:00:00Z'))[0]?.stage).toBe('renewal-due');
  expect(
    storageNotices({ ...funding, state: 'grace' }, new Date('2026-10-02T00:00:00Z'))[0],
  ).toEqual({
    stage: 'grace-started',
    paidThrough: funding.paidThrough,
    graceEndsAt: funding.graceEndsAt,
  });
  expect(
    storageNotices({ ...funding, state: 'grace' }, new Date('2026-10-24T00:00:00Z'))[0]?.stage,
  ).toBe('grace-ending');
  expect(
    storageNotices({ ...funding, state: 'overdue' }, new Date('2026-11-01T00:00:00Z'))[0]?.stage,
  ).toBe('hosting-ended');
  expect(
    storageNotices({ ...funding, state: 'review' }, new Date('2026-11-01T00:00:00Z'))[0]?.stage,
  ).toBe('billing-review');
  expect(
    storageNotices({ ...funding, state: 'free', paidThrough: null, graceEndsAt: null }, new Date()),
  ).toEqual([]);
  expect(() => storageNotices(funding, new Date('invalid'))).toThrow('STORAGE_PERIOD_RANGE');
});

it('requires explicitly configured mail and rejects ambiguous enablement', () => {
  expect(readStorageNoticesEnabled({}, false)).toBe(false);
  expect(() =>
    readStorageNoticesEnabled({ DACLIFY_STORAGE_NOTICES_ENABLED: 'true' }, false),
  ).toThrow('STORAGE_NOTICE_CONFIGURATION_INVALID');
  expect(readStorageNoticesEnabled({ DACLIFY_STORAGE_NOTICES_ENABLED: 'true' }, true)).toBe(true);
  expect(() => readStorageNoticesEnabled({ DACLIFY_STORAGE_NOTICES_ENABLED: '1' }, true)).toThrow(
    'STORAGE_NOTICE_CONFIGURATION_INVALID',
  );
});
