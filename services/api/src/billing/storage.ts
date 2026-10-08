import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { DaoRefSchema, type DaoRef } from '../../../../protocol/base.js';
import {
  StoragePricingSchema,
  StorageApprovalSchema,
  StorageBillingStatusSchema,
  StorageSubscriptionStateSchema,
  storagePricingHash,
  monthlyStorageUsdCents,
  validateStorageApproval,
  type StoragePricing,
  type StorageApproval,
} from '../../../../protocol/storage.js';
import type { ChainGateway } from '../chain.js';
import { contentDaoKey } from '../content/ledger.js';
import { ApiError } from '../errors.js';
import { createStripeClient, readStripeEvent } from './stripe.js';
import { requireCheckoutUrl } from './checkout.js';
import { verifiedRecurringInvoice } from './recurring-invoice.js';
import { calendarMonthAt } from './storage-period.js';
import { storageFunding } from './storage-state.js';
import type { StorageBillingConfig } from './storage-config.js';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const SubscriptionRow = z.object({
  id: z.uuid(),
  dao_key: z.string(),
  dao: DaoRefSchema,
  provider_scope: z.string(),
  created_by: z.uuid(),
  initial_request: z.uuid(),
  current_approval: z.uuid().nullable(),
  stripe_subscription: z.string().nullable(),
  checkout_id: z.string().nullable(),
  checkout_url: z.string().nullable(),
  invoice_url: z.string().nullable(),
  state: StorageSubscriptionStateSchema,
  created_at: z.date(),
});
type SubscriptionRow = z.infer<typeof SubscriptionRow>;
const ApprovalRow = z.object({
  request_id: z.uuid(),
  subscription_id: z.uuid(),
  pricing: StoragePricingSchema,
  pricing_hash: z.string(),
  price_key: z.string(),
  units: z.int().min(0).max(999999),
  monthly_usd_cents: z.int().min(0).max(99999999),
  created_at: z.date(),
});
type ApprovalRow = z.infer<typeof ApprovalRow>;
const PriceRow = z.object({
  policy_key: z.string(),
  pricing: StoragePricingSchema,
  stripe_price: z.string().nullable(),
  created_at: z.date(),
});
const ChangeRow = z.object({
  request_id: z.uuid(),
  subscription_id: z.uuid(),
  effective_at: z.date().nullable(),
  stripe_schedule: z.string().nullable(),
  state: z.enum(['pending', 'applied', 'expired', 'review']),
  created_at: z.date(),
});
function invoicePortal(value: string | null): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'invoice.stripe.com' ||
    url.username ||
    url.password ||
    url.port
  )
    throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
  return url.toString();
}
export class HostedStorage {
  private readonly stripe: Stripe;
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    readonly config: StorageBillingConfig,
    private readonly fallback: StoragePricing,
    stripe?: Stripe,
  ) {
    StoragePricingSchema.parse(fallback);
    this.stripe = stripe ?? createStripeClient(config.secretKey);
  }
  private async admin(account: Account, dao: DaoRef) {
    const network = await this.chain.network();
    if (
      network.chainId !== dao.chainId ||
      network.runtime !== dao.contract ||
      network.interfaceVersion !== dao.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    if (
      !(await this.chain.memberships(account)).some(
        (member) =>
          contentDaoKey(member.dao) === contentDaoKey(dao) &&
          member.dao.interfaceVersion === dao.interfaceVersion &&
          member.active &&
          member.admin,
      )
    )
      throw new ApiError('STORAGE_ADMIN_REQUIRED', 403);
  }
  private async row(dao: DaoRef, db: Pool | PoolClient = this.pool) {
    const result = await db.query<Record<string, unknown>>(
      "SELECT * FROM storage_subscriptions WHERE dao_key=$1 AND provider_scope=$2 AND state<>'ended'",
      [contentDaoKey(dao), this.config.providerScope],
    );
    return result.rows[0] ? SubscriptionRow.parse(result.rows[0]) : undefined;
  }
  private async approval(id: string, db: Pool | PoolClient = this.pool): Promise<ApprovalRow> {
    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM storage_approvals WHERE request_id=$1',
      [id],
    );
    const row = ApprovalRow.parse(result.rows[0]);
    if (
      row.pricing_hash !== storagePricingHash(row.pricing) ||
      row.monthly_usd_cents !== monthlyStorageUsdCents(row.units, row.pricing)
    )
      throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    return row;
  }
  private async pending(row: SubscriptionRow, db: Pool | PoolClient = this.pool) {
    const result = await db.query<Record<string, unknown>>(
      "SELECT * FROM storage_changes WHERE subscription_id=$1 AND state IN ('pending','review')",
      [row.id],
    );
    return result.rows[0] ? ChangeRow.parse(result.rows[0]) : undefined;
  }
  private async pricing(): Promise<StoragePricing> {
    const policy = await this.chain.resourcePolicy?.();
    if (!policy) throw new ApiError('RESOURCE_POLICY_UNCONFIGURED', 503);
    return policy.storage;
  }
  private async view(dao: DaoRef) {
    const row = await this.row(dao),
      current = await this.pricing();
    const approval = row
      ? await this.approval(row.current_approval ?? row.initial_request)
      : undefined;
    const pending = row ? await this.pending(row) : undefined;
    const next = pending ? await this.approval(pending.request_id) : undefined;
    return StorageBillingStatusSchema.parse({
      dao,
      configured: true,
      currentPricing: current,
      funding: await storageFunding(
        this.pool,
        dao,
        this.config.providerScope,
        this.fallback,
        new Date(),
      ),
      subscription:
        row && approval
          ? {
              id: row.id,
              requestId: row.initial_request,
              state: row.state,
              pricing: approval.pricing,
              units: approval.units,
              monthlyUsdCents: approval.monthly_usd_cents,
              checkoutUrl: row.checkout_url,
              invoiceUrl: row.invoice_url,
              pending:
                pending && next
                  ? {
                      requestId: next.request_id,
                      pricing: next.pricing,
                      units: next.units,
                      monthlyUsdCents: next.monthly_usd_cents,
                      effectiveAt: pending.effective_at?.toISOString() ?? null,
                    }
                  : null,
            }
          : null,
    });
  }
  async status(account: Account, dao: DaoRef) {
    await this.admin(account, dao);
    const row = await this.row(dao);
    if (row) await this.reconcile(row);
    return this.view(dao);
  }
  private async price(dao: DaoRef, pricing: StoragePricing) {
    const key = hash(
      JSON.stringify([
        dao.chainId,
        dao.contract,
        this.config.providerScope,
        this.config.productId,
        this.config.livemode,
        storagePricingHash(pricing),
      ]),
    );
    await this.pool.query(
      'INSERT INTO storage_prices(policy_key,pricing) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [key, pricing],
    );
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM storage_prices WHERE policy_key=$1',
      [key],
    );
    const row = PriceRow.parse(result.rows[0]);
    if (storagePricingHash(row.pricing) !== storagePricingHash(pricing))
      throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    if (row.stripe_price) return { key, id: row.stripe_price };
    if (Date.now() - row.created_at.getTime() > 23 * 3600000)
      throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    const price = await this.stripe.prices.create(
      {
        product: this.config.productId,
        currency: 'usd',
        unit_amount: pricing.monthlyUnitUsdCents,
        recurring: { interval: 'month', usage_type: 'licensed' },
      },
      { idempotencyKey: 'storage-price-' + key, timeout: 15000 },
    );
    if (
      price.livemode !== this.config.livemode ||
      price.currency !== 'usd' ||
      price.unit_amount !== pricing.monthlyUnitUsdCents ||
      price.billing_scheme !== 'per_unit' ||
      price.recurring?.interval !== 'month' ||
      price.recurring.interval_count !== 1 ||
      price.recurring.usage_type !== 'licensed' ||
      (typeof price.product === 'string' ? price.product : price.product.id) !==
        this.config.productId
    )
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    await this.pool.query(
      'UPDATE storage_prices SET stripe_price=$2 WHERE policy_key=$1 AND stripe_price IS NULL',
      [key, price.id],
    );
    return { key, id: price.id };
  }
  private async saveApproval(
    db: Pool | PoolClient,
    account: Account,
    subscriptionId: string,
    input: StorageApproval,
    pricing: StoragePricing,
    priceKey: string,
  ) {
    await db.query(
      `INSERT INTO storage_approvals(request_id,subscription_id,approved_by,pricing,pricing_hash,price_key,units,monthly_usd_cents,recurring_consent)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(request_id) DO NOTHING`,
      [
        input.requestId,
        subscriptionId,
        account.id,
        pricing,
        input.pricingHash,
        priceKey,
        input.units,
        input.monthlyUsdCents,
        input.recurringConsent,
      ],
    );
    const saved = await this.approval(input.requestId, db);
    if (
      saved.subscription_id !== subscriptionId ||
      saved.units !== input.units ||
      saved.pricing_hash !== input.pricingHash ||
      saved.monthly_usd_cents !== input.monthlyUsdCents
    )
      throw new ApiError('STORAGE_REQUEST_CONFLICT', 409);
    return saved;
  }
  async approve(account: Account, value: StorageApproval) {
    const input = StorageApprovalSchema.parse(value);
    await this.admin(account, input.dao);
    if (this.config.livemode && !this.config.liveChargesEnabled)
      throw new ApiError('STORAGE_LIVE_DISABLED', 503);
    let row = await this.row(input.dao);
    if (row) {
      await this.reconcile(row);
      row = await this.row(input.dao);
    }
    const initial = row
      ? await this.approval(row.current_approval ?? row.initial_request)
      : undefined;
    const saved = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM storage_approvals WHERE request_id=$1',
      [input.requestId],
    );
    const accepted = saved.rows[0] ? ApprovalRow.parse(saved.rows[0]) : undefined;
    if (
      accepted &&
      (!row ||
        accepted.subscription_id !== row.id ||
        accepted.units !== input.units ||
        accepted.pricing_hash !== input.pricingHash ||
        accepted.monthly_usd_cents !== input.monthlyUsdCents)
    )
      throw new ApiError('STORAGE_REQUEST_CONFLICT', 409);
    const pricing =
      accepted?.pricing ??
      (initial && !input.acceptCurrentPricing ? initial.pricing : await this.pricing());
    try {
      validateStorageApproval(input, pricing);
    } catch {
      throw new ApiError('STORAGE_APPROVAL_CHANGED', 409);
    }
    if (input.units > 0 && input.monthlyUsdCents < 50) throw new ApiError('STORAGE_AMOUNT_RANGE');
    if (!row && input.units === 0) return this.view(input.dao);
    if (!row) {
      const price = await this.price(input.dao, pricing),
        id = randomUUID(),
        client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `upload-dao:${contentDaoKey(input.dao)}`,
        ]);
        await client.query(
          `INSERT INTO storage_subscriptions(id,dao_key,dao,provider_scope,created_by,initial_request) VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT(dao_key,provider_scope) WHERE state<>'ended' DO NOTHING`,
          [
            id,
            contentDaoKey(input.dao),
            input.dao,
            this.config.providerScope,
            account.id,
            input.requestId,
          ],
        );
        row = await this.row(input.dao, client);
        if (!row) throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
        if (row.initial_request !== input.requestId)
          throw new ApiError('STORAGE_REQUEST_CONFLICT', 409);
        await this.saveApproval(client, account, row.id, input, pricing, price.key);
        await client.query(
          "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-storage','refresh',$1,$2,now()+interval '60 seconds') ON CONFLICT(job_key) DO NOTHING",
          ['storage-subscription:' + row.id, { subscriptionId: row.id }],
        );
        await client.query('COMMIT');
      } catch (cause) {
        await client.query('ROLLBACK');
        throw cause;
      } finally {
        client.release();
      }
    }
    if (!row.stripe_subscription) {
      const initial = await this.approval(row.initial_request);
      if (
        initial.request_id !== input.requestId ||
        initial.units !== input.units ||
        initial.pricing_hash !== input.pricingHash
      )
        throw new ApiError('STORAGE_REQUEST_CONFLICT', 409);
      if (row.checkout_id) return this.view(input.dao);
      if (Date.now() - row.created_at.getTime() > 23 * 3600000)
        throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
      const result = await this.pool.query<Record<string, unknown>>(
        'SELECT * FROM storage_prices WHERE policy_key=$1',
        [initial.price_key],
      );
      const price = PriceRow.parse(result.rows[0]);
      if (!price.stripe_price) throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
      const url = new URL('/resources', this.config.frontendOrigin);
      url.searchParams.set('dao', JSON.stringify(input.dao));
      const metadata = {
        purpose: 'dao-storage',
        agreement_id: row.id,
        dao_key: hash(row.dao_key),
        provider_scope: hash(row.provider_scope),
      };
      const checkout = await this.stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          automatic_tax: { enabled: false },
          allow_promotion_codes: false,
          payment_method_types: ['card'],
          line_items: [{ price: price.stripe_price, quantity: initial.units }],
          metadata,
          subscription_data: { metadata },
          success_url: url.toString(),
          cancel_url: url.toString(),
          expires_at: Math.floor(row.created_at.getTime() / 1000) + 3600,
        },
        { idempotencyKey: 'storage-checkout-' + row.id, timeout: 15000 },
      );
      if (
        checkout.livemode !== this.config.livemode ||
        checkout.mode !== 'subscription' ||
        checkout.metadata?.agreement_id !== row.id ||
        checkout.metadata?.dao_key !== metadata.dao_key ||
        checkout.metadata?.provider_scope !== metadata.provider_scope ||
        checkout.metadata?.purpose !== metadata.purpose
      )
        throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
      await this.pool.query(
        'UPDATE storage_subscriptions SET checkout_id=$2,checkout_url=$3 WHERE id=$1 AND checkout_id IS NULL',
        [row.id, checkout.id, requireCheckoutUrl(checkout.url)],
      );
      return this.view(input.dao);
    }
    if (
      accepted &&
      (accepted.request_id === row.initial_request || accepted.request_id === row.current_approval)
    )
      return this.view(input.dao);
    return this.change(account, input, row, pricing);
  }
  private async change(
    account: Account,
    input: StorageApproval,
    row: SubscriptionRow,
    pricing: StoragePricing,
  ) {
    const current = await this.approval(row.current_approval ?? row.initial_request);
    const price =
      input.units === 0 ? { key: current.price_key, id: '' } : await this.price(input.dao, pricing);
    const client = await this.pool.connect();
    let change: z.infer<typeof ChangeRow>;
    try {
      await client.query('BEGIN');
      const locked = await client.query<Record<string, unknown>>(
        'SELECT * FROM storage_subscriptions WHERE id=$1 FOR UPDATE',
        [row.id],
      );
      if (SubscriptionRow.parse(locked.rows[0]).current_approval !== row.current_approval)
        throw new ApiError('STORAGE_CHANGE_PENDING', 409);
      await this.saveApproval(client, account, row.id, input, pricing, price.key);
      await client.query(
        "INSERT INTO storage_changes(request_id,subscription_id) VALUES($1,$2) ON CONFLICT(subscription_id) WHERE state IN ('pending','review') DO NOTHING",
        [input.requestId, row.id],
      );
      const found = await client.query<Record<string, unknown>>(
        'SELECT * FROM storage_changes WHERE request_id=$1',
        [input.requestId],
      );
      if (!found.rows[0]) throw new ApiError('STORAGE_CHANGE_PENDING', 409);
      change = ChangeRow.parse(found.rows[0]);
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
    if (change.state === 'applied' || change.state === 'expired') return this.view(input.dao);
    if (Date.now() - change.created_at.getTime() > 23 * 3600000)
      throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    await this.admin(account, input.dao);
    if (!row.stripe_subscription) throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    const subscription = await this.stripe.subscriptions.retrieve(
      row.stripe_subscription,
      {},
      { timeout: 15000 },
    );
    const item = subscription.items.data[0];
    if (
      !item ||
      subscription.items.has_more ||
      subscription.items.data.length !== 1 ||
      subscription.pending_update
    )
      throw new ApiError('STORAGE_CHANGE_PENDING', 409);
    if (subscription.schedule && !change.stripe_schedule)
      throw new ApiError('STORAGE_CHANGE_PENDING', 409);
    const effective = new Date(item.current_period_end * 1000);
    if (input.units === 0) {
      await this.stripe.subscriptions.update(
        subscription.id,
        { cancel_at_period_end: true },
        { idempotencyKey: 'storage-change-' + input.requestId, timeout: 15000 },
      );
      await this.pool.query('UPDATE storage_changes SET effective_at=$2 WHERE request_id=$1', [
        input.requestId,
        effective,
      ]);
    } else if (input.units > current.units && input.pricingHash === current.pricing_hash) {
      await this.stripe.subscriptions.update(
        subscription.id,
        {
          items: [{ id: item.id, price: price.id, quantity: input.units }],
          payment_behavior: 'pending_if_incomplete',
          proration_behavior: 'always_invoice',
          cancel_at_period_end: false,
        },
        { idempotencyKey: 'storage-change-' + input.requestId, timeout: 15000 },
      );
    } else {
      // Lower capacity and newly accepted prices start at the next paid period, avoiding surprise credits/charges.
      const scheduleId =
        change.stripe_schedule ??
        (
          await this.stripe.subscriptionSchedules.create(
            { from_subscription: subscription.id },
            { idempotencyKey: 'storage-schedule-' + input.requestId, timeout: 15000 },
          )
        ).id;
      await this.pool.query(
        'UPDATE storage_changes SET stripe_schedule=$2,effective_at=$3 WHERE request_id=$1 AND stripe_schedule IS NULL',
        [input.requestId, scheduleId, effective],
      );
      await this.stripe.subscriptionSchedules.update(
        scheduleId,
        {
          end_behavior: 'release',
          proration_behavior: 'none',
          phases: [
            {
              start_date: item.current_period_start,
              end_date: item.current_period_end,
              items: [{ price: item.price.id, quantity: current.units }],
              proration_behavior: 'none',
            },
            {
              start_date: item.current_period_end,
              duration: { interval: 'month', interval_count: 1 },
              items: [{ price: price.id, quantity: input.units }],
              proration_behavior: 'none',
            },
          ],
        },
        { idempotencyKey: 'storage-schedule-update-' + input.requestId, timeout: 15000 },
      );
    }
    await this.reconcile(row);
    return this.view(input.dao);
  }
  async reconcileRetention(dao: DaoRef) {
    const row = await this.row(dao);
    if (row) await this.reconcile(row);
  }
  private async reconcile(
    row: SubscriptionRow,
    checkoutHint?: string,
    db: Pool | PoolClient = this.pool,
  ) {
    if (db === this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await this.reconcile(row, checkoutHint, client);
        await client.query('COMMIT');
        return;
      } catch (cause) {
        await client.query('ROLLBACK');
        throw cause;
      } finally {
        client.release();
      }
    }
    if (row.provider_scope !== this.config.providerScope)
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`upload-dao:${row.dao_key}`]);
    const snapshot = await db.query<Record<string, unknown>>(
      'SELECT * FROM storage_subscriptions WHERE id=$1 FOR UPDATE',
      [row.id],
    );
    row = SubscriptionRow.parse(snapshot.rows[0]);
    const initial = await this.approval(row.initial_request, db);
    let subscriptionId = row.stripe_subscription;
    const metadata = (value: Record<string, string> | null) =>
      value?.purpose === 'dao-storage' &&
      value.agreement_id === row.id &&
      value.dao_key === hash(row.dao_key) &&
      value.provider_scope === hash(row.provider_scope);
    if (!subscriptionId) {
      const id = row.checkout_id ?? checkoutHint;
      if (!id) return;
      const checkout = await this.stripe.checkout.sessions.retrieve(
        id,
        { expand: ['line_items'] },
        { timeout: 15000 },
      );
      const result = await db.query<Record<string, unknown>>(
        'SELECT * FROM storage_prices WHERE policy_key=$1',
        [initial.price_key],
      );
      const price = PriceRow.parse(result.rows[0]);
      const line = checkout.line_items?.data[0];
      if (
        checkout.id !== id ||
        checkout.livemode !== this.config.livemode ||
        checkout.mode !== 'subscription' ||
        !metadata(checkout.metadata) ||
        checkout.line_items?.has_more ||
        checkout.line_items?.data.length !== 1 ||
        line?.price?.id !== price.stripe_price ||
        line.quantity !== initial.units
      )
        throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
      subscriptionId =
        typeof checkout.subscription === 'string'
          ? checkout.subscription
          : (checkout.subscription?.id ?? null);
      await db.query(
        'UPDATE storage_subscriptions SET checkout_id=$2,stripe_subscription=$3 WHERE id=$1 AND stripe_subscription IS NULL',
        [row.id, id, subscriptionId],
      );
      if (!subscriptionId) {
        if (checkout.status === 'expired')
          await db.query(
            "UPDATE storage_subscriptions SET state='ended',updated_at=now() WHERE id=$1 AND stripe_subscription IS NULL",
            [row.id],
          );
        return;
      }
    }
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId, {}, { timeout: 15000 });
    if (
      sub.id !== subscriptionId ||
      sub.livemode !== this.config.livemode ||
      !metadata(sub.metadata) ||
      sub.currency !== 'usd' ||
      sub.collection_method !== 'charge_automatically' ||
      (sub.application_fee_percent ?? 0) !== 0 ||
      sub.transfer_data
    )
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    const item = sub.items.data[0];
    if (
      !item ||
      sub.items.has_more ||
      sub.items.data.length !== 1 ||
      item.price.currency !== 'usd' ||
      item.price.billing_scheme !== 'per_unit' ||
      item.price.recurring?.interval !== 'month' ||
      item.price.recurring.interval_count !== 1 ||
      item.price.recurring.usage_type !== 'licensed' ||
      (typeof item.price.product === 'string' ? item.price.product : item.price.product.id) !==
        this.config.productId
    )
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    let approval = await this.approval(row.current_approval ?? row.initial_request, db);
    const change = await this.pending(row, db);
    if (change) {
      const next = await this.approval(change.request_id, db);
      const selected = await db.query<{ stripe_price: string }>(
        'SELECT stripe_price FROM storage_prices WHERE policy_key=$1',
        [next.price_key],
      );
      if (next.units === 0 && sub.cancel_at_period_end) {
        await db.query("UPDATE storage_changes SET state='applied' WHERE request_id=$1", [
          next.request_id,
        ]);
      } else if (
        next.units > 0 &&
        !sub.pending_update &&
        item.price.id === selected.rows[0]?.stripe_price &&
        item.quantity === next.units
      ) {
        approval = next;
        await db.query("UPDATE storage_changes SET state='applied' WHERE request_id=$1", [
          next.request_id,
        ]);
        await db.query('UPDATE storage_subscriptions SET current_approval=$2 WHERE id=$1', [
          row.id,
          next.request_id,
        ]);
      }
    }
    const selected = await db.query<{ stripe_price: string }>(
      'SELECT stripe_price FROM storage_prices WHERE policy_key=$1',
      [approval.price_key],
    );
    if (
      item.price.id !== selected.rows[0]?.stripe_price ||
      item.quantity !== approval.units ||
      item.price.unit_amount !== approval.pricing.monthlyUnitUsdCents
    )
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    const state =
      sub.status === 'canceled' || sub.status === 'incomplete_expired'
        ? 'ended'
        : sub.status === 'past_due' || sub.status === 'unpaid'
          ? 'past-due'
          : sub.status === 'active'
            ? sub.cancel_at_period_end
              ? 'canceling'
              : 'active'
            : sub.status === 'incomplete'
              ? 'pending'
              : 'review';
    const invoiceId =
      typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
    const invoice = invoiceId
      ? await this.stripe.invoices.retrieve(invoiceId, {}, { timeout: 15000 })
      : undefined;
    if (invoice && invoice.id !== invoiceId) throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    await db.query(
      'UPDATE storage_subscriptions SET state=$2,invoice_url=$3,updated_at=now() WHERE id=$1',
      [row.id, state, invoicePortal(invoice?.hosted_invoice_url ?? null)],
    );
    if (!invoice) return;
    const paid = await verifiedRecurringInvoice(
      this.stripe,
      invoice,
      subscriptionId,
      this.config.livemode,
      'STORAGE',
    );
    if (!paid) {
      await db.query(
        "UPDATE storage_invoices SET state='revoked' WHERE invoice_id=$1 AND verified_at IS NOT NULL",
        [invoice.id],
      );
      return;
    }
    if (state === 'review') throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    const lines = invoice.lines.data;
    const matching = lines.filter(
      (line) =>
        line.pricing?.price_details?.price === item.price.id &&
        line.quantity === approval.units &&
        line.period.end === item.current_period_end,
    );
    const anchor = new Date(sub.billing_cycle_anchor * 1000),
      begins = new Date(item.current_period_start * 1000);
    const months =
      (begins.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
      begins.getUTCMonth() -
      anchor.getUTCMonth();
    if (
      !Number.isSafeInteger(months) ||
      months < 0 ||
      months > 1199 ||
      Date.parse(calendarMonthAt(anchor.toISOString(), months)) / 1000 !==
        item.current_period_start ||
      Date.parse(calendarMonthAt(anchor.toISOString(), months + 1)) / 1000 !==
        item.current_period_end
    )
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    const full = ['subscription_create', 'subscription_cycle'].includes(
      invoice.billing_reason ?? '',
    );
    if (
      invoice.lines.has_more ||
      matching.length !== 1 ||
      !matching[0] ||
      item.current_period_end <= item.current_period_start ||
      invoice.amount_paid !== invoice.total ||
      (full &&
        (matching[0].period.start !== item.current_period_start ||
          lines.length !== 1 ||
          invoice.total !== approval.monthly_usd_cents ||
          invoice.subtotal !== approval.monthly_usd_cents))
    )
      throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
    let base: string | null = null;
    if (!full) {
      if (
        matching[0].period.start < item.current_period_start ||
        matching[0].period.start >= item.current_period_end
      )
        throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
      if (invoice.billing_reason !== 'subscription_update')
        throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
      const result = await db.query<{ invoice_id: string }>(
        "SELECT invoice_id FROM storage_invoices WHERE subscription_id=$1 AND period_end=to_timestamp($2) AND base_invoice IS NULL AND state='verified' ORDER BY period_start DESC LIMIT 1",
        [row.id, item.current_period_end],
      );
      base = result.rows[0]?.invoice_id ?? null;
      if (!base) throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
      const original = await this.stripe.invoices.retrieve(base, {}, { timeout: 15000 });
      if (
        !(await verifiedRecurringInvoice(
          this.stripe,
          original,
          subscriptionId,
          this.config.livemode,
          'STORAGE',
        ))
      ) {
        await db.query("UPDATE storage_invoices SET state='revoked' WHERE invoice_id=$1", [base]);
        return;
      }
    }
    await db.query(
      `INSERT INTO storage_invoices(invoice_id,subscription_id,approval_id,period_start,period_end,base_invoice,state,verified_at)
      VALUES($1,$2,$3,to_timestamp($4),to_timestamp($5),$6,'verified',now()) ON CONFLICT(invoice_id) DO NOTHING`,
      [
        invoice.id,
        row.id,
        approval.request_id,
        matching[0].period.start,
        item.current_period_end,
        base,
      ],
    );
    const recorded = await db.query(
      "UPDATE storage_invoices SET state='verified',verified_at=COALESCE(verified_at,now()) WHERE invoice_id=$1 AND subscription_id=$2 AND approval_id=$3 AND period_start=to_timestamp($4) AND period_end=to_timestamp($5) AND base_invoice IS NOT DISTINCT FROM $6::text",
      [
        invoice.id,
        row.id,
        approval.request_id,
        matching[0].period.start,
        item.current_period_end,
        base,
      ],
    );
    if (recorded.rowCount !== 1) throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
  }
  async refresh(subscriptionId: string): Promise<'retry' | 'completed' | 'manual'> {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM storage_subscriptions WHERE id=$1',
      [z.uuid().parse(subscriptionId)],
    );
    if (!result.rows[0]) throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
    const row = SubscriptionRow.parse(result.rows[0]);
    if (
      !row.checkout_id &&
      !row.stripe_subscription &&
      Date.now() - row.created_at.getTime() > 23 * 3600000
    )
      return 'manual';
    await this.reconcile(row);
    const current = await this.pool.query<{ state: string }>(
      'SELECT state FROM storage_subscriptions WHERE id=$1',
      [row.id],
    );
    return current.rows[0]?.state === 'review' ? 'manual' : 'retry';
  }
  async webhook(raw: Buffer, signature: string): Promise<void> {
    const event = readStripeEvent(this.stripe, raw, signature, this.config.webhookSecret);
    if (event.livemode !== this.config.livemode) throw new ApiError('BILLING_MODE', 400);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'storage-event:' + event.id,
      ]);
      const previous = await client.query<{ payload_hash: Buffer }>(
        'SELECT payload_hash FROM storage_events WHERE event_id=$1',
        [event.id],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].payload_hash.toString('hex') !== hash(raw))
          throw new ApiError('STORAGE_EVENT_CONFLICT', 409);
        await client.query('COMMIT');
        return;
      }
      const data = z
        .object({
          id: z.string(),
          metadata: z.record(z.string(), z.string()).nullable().optional(),
          parent: z
            .object({
              subscription_details: z
                .object({ subscription: z.union([z.string(), z.object({ id: z.string() })]) })
                .nullable()
                .optional(),
            })
            .nullable()
            .optional(),
          payment_intent: z
            .union([z.string(), z.object({ id: z.string() })])
            .nullable()
            .optional(),
        })
        .safeParse(event.data.object);
      if (data.success) {
        const sub = data.data.parent?.subscription_details?.subscription;
        const subId = typeof sub === 'string' ? sub : sub?.id;
        const found = await client.query<Record<string, unknown>>(
          'SELECT * FROM storage_subscriptions WHERE id::text=$1 OR checkout_id=$2 OR stripe_subscription=$3',
          [
            data.data.metadata?.agreement_id ?? '',
            data.data.id,
            subId ?? (data.data.id.startsWith('sub_') ? data.data.id : ''),
          ],
        );
        for (const record of found.rows)
          await this.reconcile(
            SubscriptionRow.parse(record),
            data.data.id.startsWith('cs_') ? data.data.id : undefined,
            client,
          );
        if (data.data.payment_intent) {
          const intent =
            typeof data.data.payment_intent === 'string'
              ? data.data.payment_intent
              : data.data.payment_intent.id;
          const linked = await this.stripe.invoicePayments.list(
            { payment: { type: 'payment_intent', payment_intent: intent }, limit: 100 },
            { timeout: 15000 },
          );
          if (linked.has_more) throw new ApiError('STORAGE_REVIEW_REQUIRED', 409);
          for (const payment of linked.data) {
            const id = typeof payment.invoice === 'string' ? payment.invoice : payment.invoice.id;
            const invoice = await this.stripe.invoices.retrieve(id, {}, { timeout: 15000 });
            const rows = await client.query<Record<string, unknown>>(
              'SELECT s.* FROM storage_subscriptions s JOIN storage_invoices i ON i.subscription_id=s.id WHERE i.invoice_id=$1 AND s.provider_scope=$2',
              [id, this.config.providerScope],
            );
            for (const record of rows.rows) {
              const row = SubscriptionRow.parse(record);
              await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                `upload-dao:${row.dao_key}`,
              ]);
              if (invoice.id !== id) throw new ApiError('STORAGE_RECEIPT_INVALID', 409);
              if (
                !row.stripe_subscription ||
                !(await verifiedRecurringInvoice(
                  this.stripe,
                  invoice,
                  row.stripe_subscription,
                  this.config.livemode,
                  'STORAGE',
                ))
              )
                await client.query(
                  "UPDATE storage_invoices SET state='revoked' WHERE invoice_id=$1 AND verified_at IS NOT NULL",
                  [id],
                );
              else {
                await client.query(
                  "UPDATE storage_invoices SET state='verified' WHERE invoice_id=$1 AND verified_at IS NOT NULL",
                  [id],
                );
                await this.reconcile(row, undefined, client);
              }
            }
          }
        }
      }
      await client.query('INSERT INTO storage_events(event_id,payload_hash) VALUES($1,$2)', [
        event.id,
        Buffer.from(hash(raw), 'hex'),
      ]);
      await client.query('COMMIT');
    } catch (cause) {
      await client.query('ROLLBACK');
      throw cause;
    } finally {
      client.release();
    }
  }
}
