import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { DaoRefSchema, type DaoRef } from '../../../../protocol/base.js';
import {
  HostedPricingSchema,
  HostingStatusSchema,
  HostingChangeInputSchema,
  hostedMonthlyPrice,
  hostedPricingHash,
  type HostedPricing,
  type HostingChangeInput,
} from '../../../../protocol/hosting.js';
import { daoPaymentKey } from '../../../../protocol/payments.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import { createStripeClient, readStripeEvent } from './stripe.js';
import { verifiedRecurringInvoice } from './recurring-invoice.js';
import { requireCheckoutUrl } from './checkout.js';
import type { HostingConfig } from './hosting-config.js';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest();
const SubscriptionRow = z.object({
  id: z.uuid(),
  dao_key: z.string(),
  dao: DaoRefSchema,
  request_id: z.uuid(),
  created_by: z.uuid(),
  pricing: HostedPricingSchema,
  extra_slots: z.int(),
  price_key: z.string(),
  stripe_subscription: z.string().nullable(),
  checkout_id: z.string().nullable(),
  checkout_url: z.string().nullable(),
  invoice_url: z.string().nullable(),
  state: HostingStatusSchema.shape.subscription.unwrap().shape.state,
  created_at: z.date(),
});
type SubscriptionRow = z.infer<typeof SubscriptionRow>;
const ChangeRow = z.object({
  request_id: z.uuid(),
  subscription_id: z.uuid(),
  pricing: HostedPricingSchema,
  price_key: z.string(),
  extra_slots: z.int(),
  state: z.enum(['pending', 'applied', 'expired']),
  created_at: z.date(),
});
const PriceRow = z.object({
  policy_key: z.string(),
  pricing: HostedPricingSchema,
  stripe_price: z.string().nullable(),
  created_at: z.date(),
});
const InvoiceRow = z.object({
  invoice_id: z.string(),
  base_invoice: z.string().nullable(),
  subscription_id: z.uuid(),
  receipt: z.string(),
  members: z.int(),
  expires: z.coerce.number().int().positive().max(4294967295),
  state: z.enum(['pending', 'settled', 'revoked', 'expired']),
});
function invoiceUrl(value: string | null) {
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'invoice.stripe.com' ||
    url.username ||
    url.password ||
    url.port
  )
    throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
  return url.toString();
}
export class HostedSubscriptions {
  private readonly stripe: Stripe;
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    readonly config: HostingConfig,
    stripe?: Stripe,
  ) {
    this.stripe = stripe ?? createStripeClient(config.secretKey);
  }
  private async admin(account: Account, dao: DaoRef) {
    if (
      !(await this.chain.memberships(account)).some(
        (m) => daoPaymentKey(m.dao) === daoPaymentKey(dao) && m.active && m.admin,
      )
    )
      throw new ApiError('HOSTING_ADMIN_REQUIRED', 403);
  }
  private async chainState(dao: DaoRef) {
    if (!this.chain.hosting) throw new ApiError('HOSTING_UNAVAILABLE', 503);
    return this.chain.hosting(dao);
  }
  private async row(dao: DaoRef, db: Pool | PoolClient = this.pool) {
    const result = await db.query<Record<string, unknown>>(
      "SELECT * FROM hosting_subscriptions WHERE dao_key=$1 AND state<>'ended'",
      [daoPaymentKey(dao)],
    );
    return result.rows[0] ? SubscriptionRow.parse(result.rows[0]) : undefined;
  }
  private async pending(row: SubscriptionRow, db: Pool | PoolClient = this.pool) {
    const result = await db.query<Record<string, unknown>>(
      "SELECT * FROM hosting_changes WHERE subscription_id=$1 AND state='pending'",
      [row.id],
    );
    return result.rows[0] ? ChangeRow.parse(result.rows[0]) : undefined;
  }
  async status(account: Account, dao: DaoRef) {
    await this.admin(account, dao);
    const row = await this.row(dao);
    if (row) await this.reconcile(row);
    return this.view(dao);
  }
  private async view(dao: DaoRef) {
    const state = await this.chainState(dao),
      row = await this.row(dao),
      pending = row ? await this.pending(row) : undefined;
    return HostingStatusSchema.parse({
      ...state,
      configured: !this.config.livemode || this.config.liveChargesEnabled,
      subscription: row
        ? {
            id: row.id,
            requestId: row.request_id,
            state: row.state,
            extraSlots: row.extra_slots,
            pricing: row.pricing,
            monthlyUsdCents: hostedMonthlyPrice(row.extra_slots, row.pricing),
            checkoutUrl: row.checkout_url,
            invoiceUrl: row.invoice_url,
            pendingChange: pending
              ? {
                  requestId: pending.request_id,
                  extraSlots: pending.extra_slots,
                  pricing: pending.pricing,
                  monthlyUsdCents: hostedMonthlyPrice(pending.extra_slots, pending.pricing),
                }
              : null,
          }
        : null,
    });
  }
  private async price(dao: DaoRef, pricing: HostedPricing) {
    const key = hash(
      JSON.stringify([
        dao.chainId,
        dao.contract,
        this.config.productId,
        this.config.livemode,
        hostedPricingHash(pricing),
      ]),
    ).toString('hex');
    await this.pool.query(
      'INSERT INTO hosting_prices(policy_key,pricing) VALUES($1,$2) ON CONFLICT(policy_key) DO NOTHING',
      [key, pricing],
    );
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM hosting_prices WHERE policy_key=$1',
      [key],
    );
    const row = PriceRow.parse(result.rows[0]);
    if (row.stripe_price) return { key, id: row.stripe_price };
    if (Date.now() - row.created_at.getTime() > 23 * 3600000)
      throw new ApiError('HOSTING_RECONCILIATION_REQUIRED', 409);
    const price = await this.stripe.prices.create(
      {
        product: this.config.productId,
        currency: 'usd',
        recurring: { interval: 'month', usage_type: 'licensed' },
        billing_scheme: 'tiered',
        tiers_mode: 'graduated',
        tiers: [
          { up_to: 40, unit_amount: pricing.rates.first_usd },
          { up_to: 240, unit_amount: pricing.rates.next_usd },
          { up_to: 'inf', unit_amount: pricing.rates.rest_usd },
        ],
        expand: ['tiers'],
      },
      { idempotencyKey: 'hosting-price-' + key, timeout: 15000 },
    );
    const tiers = price.tiers;
    if (
      (typeof price.product === 'string' ? price.product : price.product.id) !==
        this.config.productId ||
      price.livemode !== this.config.livemode ||
      price.currency !== 'usd' ||
      price.billing_scheme !== 'tiered' ||
      price.tiers_mode !== 'graduated' ||
      price.recurring?.interval !== 'month' ||
      price.recurring.interval_count !== 1 ||
      !tiers ||
      tiers.length !== 3 ||
      tiers[0]?.up_to !== 40 ||
      tiers[0].unit_amount !== pricing.rates.first_usd ||
      tiers[1]?.up_to !== 240 ||
      tiers[1].unit_amount !== pricing.rates.next_usd ||
      tiers[2]?.up_to !== null ||
      tiers[2].unit_amount !== pricing.rates.rest_usd ||
      tiers.some((t) => (t.flat_amount ?? 0) !== 0)
    )
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    await this.pool.query(
      'UPDATE hosting_prices SET stripe_price=$2 WHERE policy_key=$1 AND stripe_price IS NULL',
      [key, price.id],
    );
    return { key, id: price.id };
  }
  async change(account: Account, value: HostingChangeInput) {
    const input = HostingChangeInputSchema.parse(value);
    await this.admin(account, input.dao);
    if (this.config.livemode && !this.config.liveChargesEnabled)
      throw new ApiError('HOSTING_LIVE_DISABLED', 503);
    const state = await this.chainState(input.dao);
    if (state.exempt) throw new ApiError('HOSTING_EXEMPT', 409);
    let row = await this.row(input.dao);
    if (row) {
      await this.reconcile(row);
      row = await this.row(input.dao);
    }
    const savedChange = row
      ? await this.pool.query<Record<string, unknown>>(
          'SELECT * FROM hosting_changes WHERE request_id=$1 AND subscription_id=$2',
          [input.requestId, row.id],
        )
      : undefined;
    const agreed = savedChange?.rows[0] ? ChangeRow.parse(savedChange.rows[0]) : undefined;
    const pricing =
      agreed?.pricing ??
      (row && (row.state === 'pending' || !input.acceptCurrentPricing)
        ? row.pricing
        : state.pricing);
    if (input.extraSlots + pricing.freeSlots > 5000)
      throw new ApiError('HOSTING_CAPACITY_RANGE', 400);
    if (
      input.pricingHash !== hostedPricingHash(pricing) ||
      input.monthlyUsdCents !== hostedMonthlyPrice(input.extraSlots, pricing)
    )
      throw new ApiError('HOSTING_APPROVAL_CHANGED', 409);
    if (!row) {
      if (input.extraSlots === 0) return this.view(input.dao);
      const price = await this.price(input.dao, pricing);
      await this.pool.query(
        "INSERT INTO hosting_subscriptions(id,dao_key,dao,created_by,request_id,pricing,extra_slots,price_key)VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(dao_key) WHERE state<>'ended' DO NOTHING",
        [
          randomUUID(),
          daoPaymentKey(input.dao),
          input.dao,
          account.id,
          input.requestId,
          pricing,
          input.extraSlots,
          price.key,
        ],
      );
      row = await this.row(input.dao);
      if (!row) throw new ApiError('HOSTING_RECONCILIATION_REQUIRED', 503);
    }
    if (row.state === 'pending' && !row.stripe_subscription) {
      if (
        row.request_id !== input.requestId ||
        row.extra_slots !== input.extraSlots ||
        hostedPricingHash(row.pricing) !== input.pricingHash
      )
        throw new ApiError('HOSTING_REQUEST_CONFLICT', 409);
      if (row.checkout_id) return this.view(input.dao);
      if (Date.now() - row.created_at.getTime() > 23 * 3600000)
        throw new ApiError('HOSTING_RECONCILIATION_REQUIRED', 409);
      const result = await this.pool.query<Record<string, unknown>>(
        'SELECT * FROM hosting_prices WHERE policy_key=$1',
        [row.price_key],
      );
      const price = PriceRow.parse(result.rows[0]);
      if (!price.stripe_price) throw new ApiError('HOSTING_RECONCILIATION_REQUIRED', 503);
      const url = new URL('/hosting', this.config.frontendOrigin);
      url.searchParams.set('dao', JSON.stringify(input.dao));
      const metadata = {
        purpose: 'dao-hosting',
        agreement_id: row.id,
        dao_key: hash(row.dao_key).toString('hex'),
      };
      const checkout = await this.stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: price.stripe_price, quantity: row.extra_slots }],
          metadata,
          subscription_data: { metadata },
          success_url: url.toString(),
          cancel_url: url.toString(),
          expires_at: Math.floor(row.created_at.getTime() / 1000) + 3600,
        },
        { idempotencyKey: 'hosting-checkout-' + row.id, timeout: 15000 },
      );
      if (checkout.livemode !== this.config.livemode)
        throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
      await this.pool.query(
        'UPDATE hosting_subscriptions SET checkout_id=$2,checkout_url=$3 WHERE id=$1 AND checkout_id IS NULL',
        [row.id, checkout.id, requireCheckoutUrl(checkout.url)],
      );
      return this.view(input.dao);
    }
    if (!row.stripe_subscription) throw new ApiError('HOSTING_RECONCILIATION_REQUIRED', 409);
    const price =
      input.extraSlots === 0
        ? { key: row.price_key, id: '' }
        : await this.price(input.dao, pricing);
    const client = await this.pool.connect();
    let change: z.infer<typeof ChangeRow>;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM hosting_subscriptions WHERE id=$1 FOR UPDATE', [row.id]);
      await client.query(
        "INSERT INTO hosting_changes(request_id,subscription_id,pricing,price_key,extra_slots)VALUES($1,$2,$3,$4,$5)ON CONFLICT(subscription_id)WHERE state='pending' DO NOTHING",
        [input.requestId, row.id, pricing, price.key, input.extraSlots],
      );
      const found = await client.query<Record<string, unknown>>(
        'SELECT * FROM hosting_changes WHERE request_id=$1',
        [input.requestId],
      );
      if (!found.rows[0]) throw new ApiError('HOSTING_CHANGE_PENDING', 409);
      change = ChangeRow.parse(found.rows[0]);
      if (
        change.subscription_id !== row.id ||
        change.extra_slots !== input.extraSlots ||
        hostedPricingHash(change.pricing) !== input.pricingHash
      )
        throw new ApiError('HOSTING_REQUEST_CONFLICT', 409);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    if (change.state !== 'pending') return this.view(input.dao);
    if (Date.now() - change.created_at.getTime() > 23 * 3600000)
      throw new ApiError('HOSTING_RECONCILIATION_REQUIRED', 409);
    await this.admin(account, input.dao);
    const sub = await this.stripe.subscriptions.retrieve(
      row.stripe_subscription,
      {},
      { timeout: 15000 },
    );
    const item = sub.items.data[0];
    if (!item || sub.items.data.length !== 1 || sub.items.has_more || sub.pending_update)
      throw new ApiError('HOSTING_CHANGE_PENDING', 409);
    if (input.extraSlots === 0)
      await this.stripe.subscriptions.update(
        sub.id,
        { cancel_at_period_end: true },
        { idempotencyKey: 'hosting-change-' + input.requestId, timeout: 15000 },
      );
    else
      await this.stripe.subscriptions.update(
        sub.id,
        {
          items: [{ id: item.id, price: price.id, quantity: input.extraSlots }],
          payment_behavior: 'pending_if_incomplete',
          proration_behavior:
            input.extraSlots > row.extra_slots ||
            input.monthlyUsdCents > hostedMonthlyPrice(row.extra_slots, row.pricing)
              ? 'always_invoice'
              : 'none',
        },
        { idempotencyKey: 'hosting-change-' + input.requestId, timeout: 15000 },
      );
    await this.reconcile(row);
    return this.view(input.dao);
  }
  private async invoicePaid(invoice: Stripe.Invoice, subscriptionId: string) {
    return verifiedRecurringInvoice(
      this.stripe,
      invoice,
      subscriptionId,
      this.config.livemode,
      'HOSTING',
    );
  }
  private async reconcile(
    row: SubscriptionRow,
    checkoutHint?: string,
    db: Pool | PoolClient = this.pool,
  ) {
    let subscriptionId = row.stripe_subscription;
    if (!subscriptionId) {
      const id = row.checkout_id ?? checkoutHint;
      if (!id) return;
      const checkout = await this.stripe.checkout.sessions.retrieve(
        id,
        { expand: ['line_items'] },
        { timeout: 15000 },
      );
      const priceResult = await db.query<Record<string, unknown>>(
        'SELECT * FROM hosting_prices WHERE policy_key=$1',
        [row.price_key],
      );
      const price = PriceRow.parse(priceResult.rows[0]);
      const lines = checkout.line_items?.data;
      if (
        checkout.id !== id ||
        checkout.livemode !== this.config.livemode ||
        checkout.mode !== 'subscription' ||
        checkout.metadata?.purpose !== 'dao-hosting' ||
        checkout.metadata.agreement_id !== row.id ||
        checkout.metadata.dao_key !== hash(row.dao_key).toString('hex') ||
        !lines ||
        lines.length !== 1 ||
        checkout.line_items?.has_more ||
        lines[0]?.price?.id !== price.stripe_price ||
        lines[0].quantity !== row.extra_slots
      )
        throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
      subscriptionId =
        typeof checkout.subscription === 'string'
          ? checkout.subscription
          : (checkout.subscription?.id ?? null);
      await db.query(
        'UPDATE hosting_subscriptions SET checkout_id=$2,stripe_subscription=$3 WHERE id=$1 AND stripe_subscription IS NULL',
        [row.id, id, subscriptionId],
      );
      if (checkout.status === 'expired') {
        await db.query(
          "UPDATE hosting_subscriptions SET state='ended',updated_at=now() WHERE id=$1 AND stripe_subscription IS NULL",
          [row.id],
        );
        return;
      }
      if (!subscriptionId) return;
    }
    const subscription = await this.stripe.subscriptions.retrieve(
      subscriptionId,
      {},
      { timeout: 15000 },
    );
    if (
      subscription.livemode !== this.config.livemode ||
      subscription.metadata.purpose !== 'dao-hosting' ||
      subscription.metadata.agreement_id !== row.id ||
      subscription.metadata.dao_key !== hash(row.dao_key).toString('hex') ||
      subscription.collection_method !== 'charge_automatically' ||
      subscription.currency !== 'usd' ||
      (subscription.application_fee_percent ?? 0) !== 0 ||
      subscription.transfer_data
    )
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    const item = subscription.items.data[0];
    if (
      !item ||
      subscription.items.data.length !== 1 ||
      subscription.items.has_more ||
      item.price.currency !== 'usd' ||
      item.price.billing_scheme !== 'tiered' ||
      item.price.tiers_mode !== 'graduated' ||
      item.price.recurring?.interval !== 'month' ||
      item.price.recurring.interval_count !== 1
    )
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    let pricing = row.pricing,
      extra = row.extra_slots,
      key = row.price_key;
    const stored = await db.query<Record<string, unknown>>(
      'SELECT * FROM hosting_prices WHERE policy_key=$1',
      [row.price_key],
    );
    const current = PriceRow.parse(stored.rows[0]);
    const change = await this.pending(row, db);
    if (change?.extra_slots === 0 && subscription.cancel_at_period_end)
      await db.query("UPDATE hosting_changes SET state='applied' WHERE request_id=$1", [
        change.request_id,
      ]);
    else if (change && change.extra_slots > 0) {
      const selected = await db.query<Record<string, unknown>>(
        'SELECT * FROM hosting_prices WHERE policy_key=$1',
        [change.price_key],
      );
      const next = PriceRow.parse(selected.rows[0]);
      if (
        item.price.id === next.stripe_price &&
        item.quantity === change.extra_slots &&
        !subscription.pending_update
      ) {
        pricing = change.pricing;
        extra = change.extra_slots;
        key = change.price_key;
        await db.query("UPDATE hosting_changes SET state='applied' WHERE request_id=$1", [
          change.request_id,
        ]);
        await db.query(
          'UPDATE hosting_subscriptions SET pricing=$2,extra_slots=$3,price_key=$4 WHERE id=$1',
          [row.id, pricing, extra, key],
        );
      } else if (
        Date.now() - change.created_at.getTime() > 23 * 3600000 &&
        !subscription.pending_update
      )
        await db.query("UPDATE hosting_changes SET state='expired' WHERE request_id=$1", [
          change.request_id,
        ]);
    }
    const selectedPrice =
      key === row.price_key
        ? current.stripe_price
        : (
            await db.query<{ stripe_price: string }>(
              'SELECT stripe_price FROM hosting_prices WHERE policy_key=$1',
              [key],
            )
          ).rows[0]?.stripe_price;
    if (item.price.id !== selectedPrice || item.quantity !== extra)
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    const state =
      subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
        ? 'ended'
        : subscription.status === 'past_due' || subscription.status === 'unpaid'
          ? 'past-due'
          : subscription.status === 'active'
            ? subscription.cancel_at_period_end
              ? 'canceling'
              : 'active'
            : subscription.status === 'incomplete'
              ? 'pending'
              : 'review';
    const latest =
      typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;
    if (!latest) {
      await db.query('UPDATE hosting_subscriptions SET state=$2 WHERE id=$1', [row.id, state]);
      return;
    }
    const invoice = await this.stripe.invoices.retrieve(latest, {}, { timeout: 15000 });
    await db.query(
      'UPDATE hosting_subscriptions SET state=$2,invoice_url=$3,updated_at=now() WHERE id=$1',
      [row.id, state, invoiceUrl(invoice.hosted_invoice_url ?? null)],
    );
    const safe = await this.invoicePaid(invoice, subscriptionId);
    const known = await db.query('SELECT invoice_id FROM hosting_invoices WHERE invoice_id=$1', [
      invoice.id,
    ]);
    if (!safe) {
      if (known.rows[0]) await this.queue(invoice.id, db);
      return;
    }
    if (state === 'ended' || state === 'review' || known.rows[0]) return;
    if (
      invoice.lines.has_more ||
      !invoice.lines.data.some(
        (line) =>
          line.pricing?.price_details?.price === item.price.id &&
          line.quantity === extra &&
          line.period.end === item.current_period_end,
      )
    )
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    if (
      ['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '') &&
      invoice.subtotal !== hostedMonthlyPrice(extra, pricing)
    )
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    let baseInvoice: string | null = null;
    if (invoice.billing_reason === 'subscription_update') {
      const base = await db.query<{ invoice_id: string }>(
        "SELECT invoice_id FROM hosting_invoices WHERE subscription_id=$1 AND expires=$2 AND base_invoice IS NULL AND state IN('pending','settled') ORDER BY created_at LIMIT 1",
        [row.id, item.current_period_end],
      );
      baseInvoice = base.rows[0]?.invoice_id ?? null;
      if (!baseInvoice) throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    } else if (
      !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '')
    )
      throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    const members = pricing.freeSlots + extra;
    const reference = hash(
      JSON.stringify([
        'daclify.hosting.v1',
        row.dao_key,
        this.config.livemode,
        invoice.id,
        members,
        item.current_period_end,
      ]),
    ).toString('hex');
    await db.query(
      'INSERT INTO hosting_invoices(invoice_id,subscription_id,receipt,members,expires,base_invoice)VALUES($1,$2,$3,$4,$5,$6)ON CONFLICT(invoice_id)DO NOTHING',
      [invoice.id, row.id, reference, members, item.current_period_end, baseInvoice],
    );
    await this.queue(invoice.id, db);
  }
  private async queue(invoiceId: string, db: Pool | PoolClient = this.pool) {
    await db.query(
      "INSERT INTO jobs(module_id,kind,job_key,payload,due_at)VALUES('core-hosting','attest',$1,$2,now())ON CONFLICT(job_key)DO UPDATE SET state='pending',due_at=now(),last_error_code=NULL WHERE jobs.state<>'running'",
      ['hosting:' + invoiceId, { invoiceId }],
    );
  }
  async attest(invoiceId: string) {
    const found = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM hosting_invoices WHERE invoice_id=$1',
      [invoiceId],
    );
    if (!found.rows[0]) throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
    const receipt = InvoiceRow.parse(found.rows[0]);
    if (receipt.state === 'expired') return 'completed' as const;
    if (receipt.expires <= Date.now() / 1000) {
      await this.pool.query("UPDATE hosting_invoices SET state='expired' WHERE invoice_id=$1", [
        invoiceId,
      ]);
      return 'completed' as const;
    }
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM hosting_subscriptions WHERE id=$1',
      [receipt.subscription_id],
    );
    const row = SubscriptionRow.parse(result.rows[0]);
    if (!row.stripe_subscription || !this.chain.attestCapacity)
      throw new ApiError('HOSTING_UNAVAILABLE', 503);
    const invoice = await this.stripe.invoices.retrieve(invoiceId, {}, { timeout: 15000 });
    const base = receipt.base_invoice
      ? await this.stripe.invoices.retrieve(receipt.base_invoice, {}, { timeout: 15000 })
      : null;
    if (
      !(await this.invoicePaid(invoice, row.stripe_subscription)) ||
      (base && !(await this.invoicePaid(base, row.stripe_subscription)))
    ) {
      const state = await this.chainState(row.dao);
      if (state.receipt === receipt.receipt || receipt.state === 'settled') {
        if (!this.chain.revokeCapacity) throw new ApiError('HOSTING_UNAVAILABLE', 503);
        await this.chain.revokeCapacity(row.dao, receipt.receipt);
      }
      await this.pool.query("UPDATE hosting_invoices SET state='revoked' WHERE invoice_id=$1", [
        invoiceId,
      ]);
      if (!receipt.base_invoice) {
        const children = await this.pool.query<{ invoice_id: string }>(
          'SELECT invoice_id FROM hosting_invoices WHERE base_invoice=$1',
          [invoiceId],
        );
        for (const child of children.rows) await this.queue(child.invoice_id);
      }
      const fallback = await this.pool.query<{ invoice_id: string }>(
        "SELECT invoice_id FROM hosting_invoices WHERE subscription_id=$1 AND state='settled' AND expires>$2 ORDER BY expires DESC,members DESC",
        [row.id, Math.floor(Date.now() / 1000)],
      );
      for (const record of fallback.rows) await this.queue(record.invoice_id);
      return 'completed' as const;
    }
    if (receipt.state === 'settled') {
      const state = await this.chainState(row.dao);
      if ((state.expires ?? 0) >= receipt.expires && state.effectiveCapacity >= receipt.members)
        return 'completed' as const;
    }
    if (receipt.state === 'revoked') {
      if (!this.chain.restoreCapacity) throw new ApiError('HOSTING_UNAVAILABLE', 503);
      await this.chain.restoreCapacity(row.dao, receipt.receipt);
    } else
      await this.chain.attestCapacity(row.dao, receipt.members, receipt.expires, receipt.receipt);
    await this.pool.query("UPDATE hosting_invoices SET state='settled' WHERE invoice_id=$1", [
      invoiceId,
    ]);
    if (receipt.state === 'revoked' && !receipt.base_invoice) {
      const children = await this.pool.query<{ invoice_id: string }>(
        'SELECT invoice_id FROM hosting_invoices WHERE base_invoice=$1',
        [invoiceId],
      );
      for (const child of children.rows) await this.queue(child.invoice_id);
    }
    return 'completed' as const;
  }
  async webhook(raw: Buffer, signature: string) {
    const event = readStripeEvent(this.stripe, raw, signature, this.config.webhookSecret);
    if (event.livemode !== this.config.livemode || event.account)
      throw new ApiError('HOSTING_RECEIPT_INVALID', 400);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [
        hash('hosting:' + event.id)
          .readBigInt64BE()
          .toString(),
      ]);
      const seen = await client.query<{ payload_hash: Buffer }>(
        'SELECT payload_hash FROM hosting_events WHERE event_id=$1',
        [event.id],
      );
      if (seen.rows[0]) {
        if (!seen.rows[0].payload_hash.equals(hash(raw)))
          throw new ApiError('HOSTING_EVENT_CONFLICT', 409);
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
        })
        .safeParse(event.data.object);
      if (data.success) {
        const parent = data.data.parent?.subscription_details?.subscription;
        const subId = typeof parent === 'string' ? parent : parent?.id;
        const found = await client.query<Record<string, unknown>>(
          'SELECT * FROM hosting_subscriptions WHERE id::text=$1 OR checkout_id=$2 OR stripe_subscription=$3',
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
      }
      if (
        [
          'charge.refunded',
          'charge.dispute.created',
          'charge.dispute.closed',
          'refund.updated',
        ].includes(event.type)
      ) {
        const payment = z
          .object({
            payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullable(),
          })
          .safeParse(event.data.object);
        if (payment.success && payment.data.payment_intent) {
          const intent =
            typeof payment.data.payment_intent === 'string'
              ? payment.data.payment_intent
              : payment.data.payment_intent.id;
          const linked = await this.stripe.invoicePayments.list(
            { payment: { type: 'payment_intent', payment_intent: intent }, limit: 100 },
            { timeout: 15000 },
          );
          if (linked.has_more) throw new ApiError('HOSTING_RECEIPT_INVALID', 409);
          for (const record of linked.data) {
            const invoiceId =
              typeof record.invoice === 'string' ? record.invoice : record.invoice.id;
            const found = await client.query<{ invoice_id: string }>(
              'SELECT invoice_id FROM hosting_invoices WHERE invoice_id=$1 OR base_invoice=$1',
              [invoiceId],
            );
            for (const related of found.rows) await this.queue(related.invoice_id, client);
          }
        }
      }
      await client.query('INSERT INTO hosting_events(event_id,payload_hash)VALUES($1,$2)', [
        event.id,
        hash(raw),
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
