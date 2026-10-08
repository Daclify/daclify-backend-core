import { z } from 'zod';
import {
  STORAGE_GRACE_SECONDS,
  StorageInstantSchema,
  StoragePeriodSchema,
} from '../../../../protocol/storage.js';
function instant(value: string): Date {
  const date = new Date(StorageInstantSchema.parse(value));
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1970)
    throw new RangeError('STORAGE_PERIOD_RANGE');
  return date;
}
export function calendarMonthAt(anchor: string, months: number): string {
  const date = instant(anchor);
  const offset = z.int().min(0).max(1200).parse(months);
  const month = date.getUTCMonth() + offset,
    year = date.getUTCFullYear() + Math.floor(month / 12);
  if (year > 9999) throw new RangeError('STORAGE_PERIOD_RANGE');
  const lastDay = new Date(Date.UTC(year, (month % 12) + 1, 0)).getUTCDate();
  date.setUTCFullYear(year, month % 12, Math.min(date.getUTCDate(), lastDay));
  return date.toISOString();
}
export function storageGraceDeadline(paidThrough: string): string {
  const deadline = new Date(instant(paidThrough).getTime() + STORAGE_GRACE_SECONDS * 1000);
  return StorageInstantSchema.parse(deadline.toISOString());
}
export function storageTermState(
  term: z.infer<typeof StoragePeriodSchema> | null,
  now: Date,
): 'free' | 'pending' | 'active' | 'grace' | 'overdue' {
  if (!Number.isFinite(now.getTime())) throw new RangeError('STORAGE_PERIOD_RANGE');
  if (term === null) return 'free';
  const period = StoragePeriodSchema.parse(term);
  if (now.getTime() < instant(period.startsAt).getTime()) return 'pending';
  const end = instant(period.endsAt).getTime();
  if (now.getTime() < end) return 'active';
  return now.getTime() < end + STORAGE_GRACE_SECONDS * 1000 ? 'grace' : 'overdue';
}
