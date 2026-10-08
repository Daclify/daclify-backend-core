import { describe, it, expect } from 'vitest';
import {
  calendarMonthAt,
  storageGraceDeadline,
  storageTermState,
} from '../services/api/src/billing/storage-period.js';
describe('prepaid storage periods and the original thirty-day deadline', () => {
  it('keeps a January 31 UTC anniversary after February and in leap years', () => {
    const anchor = '2024-01-31T10:30:00Z';
    expect(calendarMonthAt(anchor, 1)).toBe('2024-02-29T10:30:00.000Z');
    expect(calendarMonthAt(anchor, 2)).toBe('2024-03-31T10:30:00.000Z');
    expect(calendarMonthAt('2025-01-31T10:30:00Z', 1)).toBe('2025-02-28T10:30:00.000Z');
    expect(calendarMonthAt('2024-12-31T10:30:00Z', 2)).toBe('2025-02-28T10:30:00.000Z');
  });
  it('uses UTC calendar months across daylight saving changes', () => {
    expect(calendarMonthAt('2026-03-08T01:30:00Z', 1)).toBe('2026-04-08T01:30:00.000Z');
    expect(calendarMonthAt('2026-10-08T01:30:00Z', 1)).toBe('2026-11-08T01:30:00.000Z');
  });
  it('starts grace at the paid term end and becomes overdue exactly thirty days later', () => {
    const end = '2026-10-31T10:30:00Z';
    const term = { startsAt: '2026-09-30T10:30:00Z', endsAt: end };
    expect(storageGraceDeadline(end)).toBe('2026-11-30T10:30:00.000Z');
    expect(storageTermState(term, new Date('2026-10-31T10:29:59.999Z'))).toBe('active');
    expect(storageTermState(term, new Date(end))).toBe('grace');
    expect(storageTermState(term, new Date('2026-11-30T10:29:59.999Z'))).toBe('grace');
    expect(storageTermState(term, new Date('2026-11-30T10:30:00Z'))).toBe('overdue');
    expect(storageTermState(null, new Date(end))).toBe('free');
    expect(storageTermState(term, new Date('2026-12-30T10:30:00Z'))).toBe('overdue');
  });
  it('does not turn malformed periods or invalid clocks into a funded term', () => {
    for (const value of ['not-a-date', '2026-02-30T00:00:00Z', '2026-10-08T00:00:00+01:00'])
      expect(() => calendarMonthAt(value, 1)).toThrow();
    for (const value of [-1, 0.5, Number.NaN, 1201])
      expect(() => calendarMonthAt('2026-10-08T00:00:00Z', value)).toThrow();
    expect(() =>
      storageTermState(
        { startsAt: '2026-09-08T00:00:00Z', endsAt: '2026-10-08T00:00:00Z' },
        new Date(Number.NaN),
      ),
    ).toThrow();
  });
});

it('does not grant future prepaid capacity early or accept a reversed period', () => {
  const future = { startsAt: '2026-11-08T12:00:00Z', endsAt: '2026-12-08T12:00:00Z' };
  expect(storageTermState(future, new Date('2026-10-08T12:00:00Z'))).toBe('pending');
  expect(storageTermState(future, new Date(future.startsAt))).toBe('active');
  expect(() =>
    storageTermState({ ...future, endsAt: future.startsAt }, new Date(future.startsAt)),
  ).toThrow();
});
