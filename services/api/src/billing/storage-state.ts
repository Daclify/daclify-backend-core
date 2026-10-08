import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { DaoRef } from '../../../../protocol/base.js';
import {
  StoragePricingSchema,
  StorageFundingSchema,
  storageCapacity,
  type StoragePricing,
} from '../../../../protocol/storage.js';
import { contentDaoKey } from '../content/ledger.js';
import { storageGraceDeadline, storageTermState } from './storage-period.js';
const TermRowSchema = z.object({
  period_start: z.date(),
  period_end: z.date(),
  pricing: StoragePricingSchema,
  units: z.int().min(1).max(999999),
  state: z.enum(['verified', 'revoked', 'review']),
  base_state: z.enum(['pending', 'verified', 'revoked', 'review']).nullable(),
  base_invoice: z.string().nullable(),
});
export async function storageFunding(
  db: Pool | PoolClient,
  dao: DaoRef,
  scope: string,
  fallback: StoragePricing,
  now: Date,
): Promise<z.infer<typeof StorageFundingSchema>> {
  if (!Number.isFinite(now.getTime())) throw new RangeError('STORAGE_PERIOD_RANGE');
  const pricing = StoragePricingSchema.parse(fallback),
    free = pricing.freeBytes;
  const result = await db.query<Record<string, unknown>>(
    `SELECT i.period_start,i.period_end,i.state,i.base_invoice,b.state AS base_state,a.pricing,a.units
     FROM storage_subscriptions s JOIN storage_invoices i ON i.subscription_id=s.id
     JOIN storage_approvals a ON a.request_id=i.approval_id LEFT JOIN storage_invoices b ON b.invoice_id=i.base_invoice
     WHERE s.dao_key=$1 AND s.provider_scope=$2 AND i.verified_at IS NOT NULL
     ORDER BY i.period_end DESC,((a.pricing->>'freeBytes')::numeric+a.units::numeric*(a.pricing->>'unitBytes')::numeric) DESC`,
    [contentDaoKey(dao), scope],
  );
  const rows = result.rows.map((row) => TermRowSchema.parse(row));
  const started = rows.filter((term) => term.period_start.getTime() <= now.getTime());
  const backed = (term: z.infer<typeof TermRowSchema>) =>
    term.state === 'verified' && (!term.base_invoice || term.base_state === 'verified');
  const paid = started.find((term) => backed(term) && term.period_end.getTime() > now.getTime());
  const uncertain = started.filter(
    (term) => term.state === 'review' || term.base_state === 'review',
  );
  // A future prepayment cannot erase an older unpaid gap or reset its retention deadline.
  const future = rows
    .filter((term) => term.period_start.getTime() > now.getTime())
    .sort((a, b) => a.period_start.getTime() - b.period_start.getTime())[0];
  const row = paid ?? started[0] ?? future;
  if (!row)
    return StorageFundingSchema.parse({
      state: 'free',
      pricing,
      units: 0,
      paidThrough: null,
      graceEndsAt: null,
      uploadCapacityBytes: free,
      retainedCapacityBytes: free,
    });
  const period = { startsAt: row.period_start.toISOString(), endsAt: row.period_end.toISOString() };
  const timeState = storageTermState(period, now),
    deadline = storageGraceDeadline(period.endsAt);
  const funded = backed(row);
  const state = uncertain.length
    ? 'review'
    : funded
      ? timeState
      : timeState === 'active'
        ? 'grace'
        : timeState;
  const bytes = storageCapacity(row.units, row.pricing),
    acceptedFree = row.pricing.freeBytes;
  let retained =
    state === 'active' || state === 'grace' || state === 'review' ? bytes : BigInt(acceptedFree);
  let retentionDeadline = deadline;
  // A paid reduction does not erase the previous larger term's original grace.
  for (const term of started) {
    const grace = storageGraceDeadline(term.period_end.toISOString());
    if (Date.parse(grace) <= now.getTime()) continue;
    const capacity = storageCapacity(term.units, term.pricing);
    if (capacity > retained) {
      retained = capacity;
      retentionDeadline = grace;
    } else if (capacity === retained && Date.parse(grace) > Date.parse(retentionDeadline))
      retentionDeadline = grace;
  }
  for (const hold of uncertain) {
    const capacity = storageCapacity(hold.units, hold.pricing);
    if (capacity > retained) retained = capacity;
  }
  return StorageFundingSchema.parse({
    state,
    pricing: row.pricing,
    units: row.units,
    paidThrough: period.endsAt,
    graceEndsAt: retentionDeadline,
    uploadCapacityBytes: paid ? storageCapacity(paid.units, paid.pricing).toString() : acceptedFree,
    retainedCapacityBytes: retained.toString(),
  });
}
