import { z } from 'zod';
import { calendarMonthAt } from './storage-period.js';
const seconds = z.int().min(0).max(4294967295);
export function moduleMonth(
  paidAt: number,
  priorExpiry: number | null,
): { starts: number; expires: number } {
  const paid = seconds.parse(paidAt),
    prior = priorExpiry === null ? 0 : seconds.parse(priorExpiry);
  if (prior > paid + 7 * 86400) throw new Error('MODULE_RENEWAL_EARLY');
  const starts = Math.max(paid, prior),
    expires = Date.parse(calendarMonthAt(new Date(starts * 1000).toISOString(), 1)) / 1000;
  if (!seconds.safeParse(expires).success || expires > paid + 40 * 86400)
    throw new Error('MODULE_TERM_RANGE');
  return { starts, expires };
}
