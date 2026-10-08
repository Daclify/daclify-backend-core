import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';
import { z } from 'zod';
import { AccountSchema, type Account } from '../../../../protocol/api.js';
import {
  CardRamApprovalSchema,
  CardRamTermsSchema,
  CardRamOrderSchema,
  cardRamPrice,
  tlosAsset,
  RamQuoteRequestSchema,
  type CardRamApproval,
} from '../../../../protocol/resources.js';
import { daoPaymentKey } from '../../../../protocol/payments.js';
import type { NativeChainGateway } from '../native-chain.js';
import { ApiError } from '../errors.js';
import { createStripeClient, readStripeEvent } from '../billing/stripe.js';
import { requireCheckoutUrl } from '../billing/checkout.js';
import type { RamCardConfig } from './card-config.js';
const Row = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  dao_key: z.string(),
  approval: CardRamApprovalSchema,
  reference: z.string(),
  stripe_account: z.string(),
  livemode: z.boolean(),
  state: CardRamOrderSchema.shape.state,
  checkout_id: z.string().nullable(),
  checkout_url: z.string().nullable(),
  payment_intent: z.string().nullable(),
  acquired_bytes: z.string().nullable(),
  settled_at: z.date().nullable(),
  created_at: z.date(),
});
type Order = z.infer<typeof Row>;
type Chain = Pick<
  NativeChainGateway,
  'network' | 'memberships' | 'ramQuote' | 'ramOrder' | 'fulfilRam' | 'platform'
>;
export class CardRam {
  private readonly stripe: Stripe;
  constructor(
    private readonly pool: Pool,
    private readonly chain: Chain,
    readonly config: RamCardConfig,
    stripe?: Stripe,
  ) {
    this.stripe = stripe ?? createStripeClient(config.secretKey);
  }
  private async admin(account: Account, dao: CardRamApproval['quote']['dao']) {
    const network = await this.chain.network();
    if (
      network.chainId !== dao.chainId ||
      network.runtime !== dao.contract ||
      network.interfaceVersion !== dao.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    if (
      !(await this.chain.memberships(account)).some(
        (m) => m.active && m.admin && daoPaymentKey(m.dao) === daoPaymentKey(dao),
      )
    )
      throw new ApiError('PAYMENT_ADMIN_REQUIRED', 403);
  }
  async offer(account: Account, value: unknown) {
    const input = RamQuoteRequestSchema.omit({ payer: true }).parse(value);
    await this.admin(account, input.dao);
    const platform = await this.chain.platform(),
      policy = platform.resourcePolicy,
      oracle = platform.creation;
    if (
      !platform.chainMatches ||
      !policy ||
      !oracle ||
      !platform.rateFresh ||
      !oracle.settler ||
      oracle.settler === input.dao.contract
    )
      throw new ApiError('RAM_RATE_UNAVAILABLE', 503);
    const quote = await this.chain.ramQuote({ ...input, payer: oracle.settler });
    const reserve = platform.ramReserve?.available;
    if (
      !reserve ||
      !/^(0|[1-9][0-9]*)\.[0-9]{4} TLOS$/.test(reserve) ||
      BigInt(reserve.replace('.', '').split(' ')[0] ?? '') < BigInt(quote.baseUnits)
    )
      throw new ApiError('RAM_RESERVE_INSUFFICIENT', 409);
    if (quote.order.policy_revision !== policy.revision)
      throw new ApiError('RESOURCE_POLICY_CHANGED', 409);
    const price = cardRamPrice(BigInt(quote.baseUnits), oracle.median, oracle.precision, policy);
    if (price.total < 500n || price.total > 99999999n)
      throw new ApiError('RAM_CARD_AMOUNT_RANGE', 409);
    return CardRamTermsSchema.parse({
      quote,
      policy,
      oracle: {
        median: oracle.median,
        precision: oracle.precision,
        observed_at: oracle.observed_at,
      },
      baseUsdCents: Number(price.base),
      feeUsdCents: Number(price.fee),
      totalUsdCents: Number(price.total),
    });
  }
  private view(row: Order) {
    return CardRamOrderSchema.parse({
      id: row.id,
      dao: row.approval.quote.dao,
      state: row.state,
      approval: row.approval,
      checkoutUrl: row.checkout_url === null ? null : requireCheckoutUrl(row.checkout_url),
      acquiredBytes: row.acquired_bytes,
      settledAt: row.settled_at?.toISOString() ?? null,
    });
  }
  private async locked<T>(id: string, run: (row: Order, client: PoolClient) => Promise<T>) {
    z.uuid().parse(id);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'ram-card:' + id,
      ]);
      const result = await client.query('SELECT * FROM ram_card_orders WHERE id=$1 FOR UPDATE', [
        id,
      ]);
      if (!result.rows[0]) throw new ApiError('RAM_ORDER_UNKNOWN', 404);
      const row = Row.parse(result.rows[0]);
      if (row.stripe_account !== this.config.accountId || row.livemode !== this.config.livemode)
        throw new ApiError('RAM_ORDER_PROVIDER', 409);
      const resultValue = await run(row, client);
      await client.query('COMMIT');
      return resultValue;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async checkout(account: Account, value: unknown) {
    const approval = CardRamApprovalSchema.parse(value);
    await this.admin(account, approval.quote.dao);
    if (this.config.livemode && !this.config.liveChargesEnabled)
      throw new ApiError('LIVE_PAYMENTS_DISABLED', 409);
    const existing = await this.pool.query('SELECT id FROM ram_card_orders WHERE id=$1', [
      approval.requestId,
    ]);
    if (!existing.rowCount) {
      const offer = await this.offer(account, {
        dao: approval.quote.dao,
        allocations: approval.quote.order.purchases.map((p) => ({
          receiver: p.receiver,
          minimumBytes: p.minimum_bytes,
        })),
      });
      const accepted = approval.quote,
        fresh = offer.quote;
      if (
        accepted.order.expires <= Date.now() / 1000 ||
        accepted.order.expires > fresh.order.expires ||
        !isDeepStrictEqual(approval.policy, offer.policy) ||
        !isDeepStrictEqual(approval.oracle, offer.oracle) ||
        !isDeepStrictEqual(accepted.order.purchases, fresh.order.purchases) ||
        accepted.baseUnits !== fresh.baseUnits ||
        accepted.systemCodeHash !== fresh.systemCodeHash ||
        accepted.systemRawAbiHash !== fresh.systemRawAbiHash ||
        accepted.order.payer !== fresh.order.payer
      )
        throw new ApiError('RAM_APPROVAL_CHANGED', 409);
      if (
        (
          await this.pool.query(
            "SELECT id FROM ram_card_orders WHERE dao_key=$1 AND state='review' LIMIT 1",
            [daoPaymentKey(approval.quote.dao)],
          )
        ).rowCount
      )
        throw new ApiError('RAM_PAYMENT_REVIEW', 409);
      const nativeReference = createHash('sha256')
        .update(JSON.stringify([approval.quote.dao, account.id, approval.requestId]))
        .digest('hex');
      await this.pool.query(
        `INSERT INTO ram_card_orders(id,account_id,dao_key,approval,reference,stripe_account,livemode) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [
          approval.requestId,
          account.id,
          daoPaymentKey(approval.quote.dao),
          approval,
          nativeReference,
          this.config.accountId,
          this.config.livemode,
        ],
      );
    }
    return this.locked(approval.requestId, async (row, client) => {
      if (row.account_id !== account.id || !isDeepStrictEqual(row.approval, approval))
        throw new ApiError('RAM_ORDER_CONFLICT', 409);
      if (!row.checkout_id) {
        if (row.approval.quote.order.expires <= Date.now() / 1000)
          throw new ApiError('RAM_QUOTE_EXPIRED', 409);
        const provider = await this.stripe.accounts.retrieveCurrent();
        if (provider.id !== this.config.accountId) throw new ApiError('RAM_ORDER_PROVIDER', 409);
        const metadata = { purpose: 'dao-ram', order_id: row.id, account_id: row.account_id };
        const url = new URL('/resources', this.config.frontendOrigin);
        url.searchParams.set('dao', JSON.stringify(approval.quote.dao));
        url.searchParams.set('ramOrder', row.id);
        const checkout = await this.stripe.checkout.sessions.create(
          {
            mode: 'payment',
            currency: 'usd',
            client_reference_id: row.account_id,
            metadata,
            payment_intent_data: { metadata },
            success_url: url.href,
            cancel_url: url.href,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: 'usd',
                  product: this.config.productId,
                  unit_amount: approval.totalUsdCents,
                },
              },
            ],
          },
          { idempotencyKey: 'daclify-ram:' + row.id, timeout: 15000 },
        );
        const checkoutUrl = requireCheckoutUrl(checkout.url);
        if (checkout.livemode !== row.livemode || checkout.mode !== 'payment')
          throw new ApiError('RAM_RECEIPT_INVALID', 409);
        await client.query(
          'UPDATE ram_card_orders SET checkout_id=$1,checkout_url=$2 WHERE id=$3',
          [checkout.id, checkoutUrl, row.id],
        );
        row.checkout_id = checkout.id;
        row.checkout_url = checkoutUrl;
        await this.enqueue(client, row.id);
      }
      return this.view(row);
    });
  }
  private async enqueue(client: Pick<PoolClient, 'query'>, id: string) {
    const result = await client.query(
      `INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-ram','reconcile',$1,$2,now()) ON CONFLICT(job_key) DO UPDATE SET
       payload=jsonb_build_object('orderId',$3::text,'generation',COALESCE((jobs.payload->>'generation')::bigint,0)+1),
       state=CASE WHEN jobs.state='running' THEN 'running' ELSE 'pending' END,due_at=now(),
       lease_owner=CASE WHEN jobs.state='running' THEN jobs.lease_owner ELSE NULL END,
       lease_until=CASE WHEN jobs.state='running' THEN jobs.lease_until ELSE NULL END WHERE jobs.module_id='core-ram' AND jobs.kind='reconcile' RETURNING id`,
      ['ram-card:' + id, { orderId: id, generation: 1 }, id],
    );
    if (result.rowCount !== 1) throw new ApiError('RAM_JOB_CONFLICT', 409);
  }
  async status(account: Account, id: string) {
    return this.locked(id, async (row) => {
      await this.admin(account, row.approval.quote.dao);
      return this.view(row);
    });
  }
  async webhook(raw: Buffer, signature: string) {
    const event = readStripeEvent(this.stripe, raw, signature, this.config.webhookSecret);
    if (
      event.livemode !== this.config.livemode ||
      (event.account && event.account !== this.config.accountId)
    )
      throw new ApiError('BILLING_MODE', 400);
    z.string()
      .regex(/^evt_[A-Za-z0-9_]+$/)
      .parse(event.id);
    const enqueueEvent = async (client: PoolClient, id: string) => {
      const provider = `ram-card:${this.config.accountId}:${this.config.livemode ? 'live' : 'test'}`,
        digest = createHash('sha256').update(raw).digest();
      const inserted = await client.query(
        'INSERT INTO billing_events(provider,event_id,payload_hash) VALUES($1,$2,$3) ON CONFLICT(provider,event_id) DO NOTHING RETURNING event_id',
        [provider, event.id, digest],
      );
      if (inserted.rowCount === 1) await this.enqueue(client, id);
      else {
        const previous = await client.query<{ payload_hash: Buffer }>(
          'SELECT payload_hash FROM billing_events WHERE provider=$1 AND event_id=$2',
          [provider, event.id],
        );
        if (!previous.rows[0]?.payload_hash.equals(digest))
          throw new ApiError('RAM_RECEIPT_INVALID', 409);
      }
    };
    const object = z
      .object({
        id: z.string(),
        metadata: z
          .object({ purpose: z.string().optional(), order_id: z.uuid().optional() })
          .nullish(),
        payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullish(),
      })
      .safeParse(event.data.object);
    if (!object.success) return;
    const intent =
      typeof object.data.payment_intent === 'string'
        ? object.data.payment_intent
        : object.data.payment_intent?.id;
    if (
      object.data.id.startsWith('cs_') &&
      object.data.metadata?.purpose === 'dao-ram' &&
      object.data.metadata.order_id
    ) {
      const known = await this.pool.query(
        'SELECT id FROM ram_card_orders WHERE id=$1 AND stripe_account=$2 AND livemode=$3',
        [object.data.metadata.order_id, this.config.accountId, this.config.livemode],
      );
      if (known.rowCount) {
        await this.locked(object.data.metadata.order_id, async (row, client) => {
          if (row.checkout_id && row.checkout_id !== object.data.id)
            throw new ApiError('RAM_RECEIPT_INVALID', 409);
          if (!row.checkout_id) {
            const session = await this.stripe.checkout.sessions.retrieve(
              object.data.id,
              {},
              { timeout: 15000 },
            );
            if (
              session.livemode !== row.livemode ||
              session.mode !== 'payment' ||
              session.currency !== 'usd' ||
              session.amount_total !== row.approval.totalUsdCents ||
              session.client_reference_id !== row.account_id ||
              session.metadata?.order_id !== row.id ||
              session.metadata?.account_id !== row.account_id ||
              session.metadata?.purpose !== 'dao-ram'
            )
              throw new ApiError('RAM_RECEIPT_INVALID', 409);
            await client.query(
              'UPDATE ram_card_orders SET checkout_id=$1,checkout_url=$2 WHERE id=$3',
              [session.id, session.url === null ? null : requireCheckoutUrl(session.url), row.id],
            );
          }
          await enqueueEvent(client, row.id);
        });
        return;
      }
    }
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM ram_card_orders WHERE stripe_account=$1 AND livemode=$2 AND (checkout_id=$3 OR payment_intent=$4)`,
      [this.config.accountId, this.config.livemode, object.data.id, intent ?? null],
    );
    for (const row of result.rows)
      await this.locked(row.id, async (_, client) => enqueueEvent(client, row.id));
  }
  private async paid(row: Order) {
    if (!row.checkout_id) return null;
    const session = await this.stripe.checkout.sessions.retrieve(
      row.checkout_id,
      { expand: ['payment_intent.latest_charge'] },
      { timeout: 15000 },
    );
    const intent = session.payment_intent;
    if (
      session.id !== row.checkout_id ||
      session.livemode !== row.livemode ||
      session.mode !== 'payment' ||
      session.currency !== 'usd' ||
      session.amount_total !== row.approval.totalUsdCents ||
      session.client_reference_id !== row.account_id ||
      session.metadata?.order_id !== row.id ||
      session.metadata?.purpose !== 'dao-ram' ||
      session.metadata?.account_id !== row.account_id
    )
      throw new ApiError('RAM_RECEIPT_INVALID', 409);
    if (
      session.payment_status !== 'paid' ||
      !intent ||
      typeof intent === 'string' ||
      intent.status !== 'succeeded'
    )
      return null;
    const charge = intent.latest_charge;
    if (
      intent.livemode !== row.livemode ||
      intent.currency !== 'usd' ||
      intent.amount !== row.approval.totalUsdCents ||
      intent.amount_received !== row.approval.totalUsdCents ||
      intent.metadata.order_id !== row.id ||
      !charge ||
      typeof charge === 'string' ||
      !charge.paid ||
      charge.status !== 'succeeded' ||
      charge.livemode !== row.livemode ||
      charge.currency !== 'usd' ||
      charge.amount !== row.approval.totalUsdCents ||
      charge.amount_refunded !== 0 ||
      charge.disputed ||
      (typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id) !== intent.id
    )
      throw new ApiError('RAM_RECEIPT_INVALID', 409);
    const refunds = await this.stripe.refunds.list(
      { charge: charge.id, limit: 100 },
      { timeout: 15000 },
    );
    if (
      refunds.has_more ||
      refunds.data.some((r) => r.status !== 'failed' && r.status !== 'canceled')
    )
      throw new ApiError('RAM_RECEIPT_INVALID', 409);
    return intent.id;
  }
  async reconcile(id: string): Promise<'completed' | 'retry' | 'manual'> {
    if (
      (await this.chain.network()).environment === 'mainnet' &&
      (!this.config.livemode || !this.config.liveChargesEnabled)
    )
      throw new ApiError('LIVE_PAYMENTS_DISABLED', 409);
    return this.locked(id, async (row, client) => {
      const payment = await this.paid(row).catch(async (error: unknown) => {
        if (!(error instanceof ApiError) || error.code !== 'RAM_RECEIPT_INVALID') throw error;
        await client.query("UPDATE ram_card_orders SET state='review' WHERE id=$1", [id]);
        return undefined;
      });
      if (payment === undefined) return 'manual';
      if (!payment) {
        if (row.settled_at !== null) {
          await client.query("UPDATE ram_card_orders SET state='review' WHERE id=$1", [id]);
          return 'manual';
        }
        return 'retry';
      }
      if (row.payment_intent && row.payment_intent !== payment)
        throw new ApiError('RAM_RECEIPT_INVALID', 409);
      await client.query('UPDATE ram_card_orders SET payment_intent=$1 WHERE id=$2', [payment, id]);
      const dao = row.approval.quote.dao;
      let native = await this.chain.ramOrder(row.reference);
      if (!native) {
        const accountResult = await client.query(
          'SELECT id,signing_key AS "signingKey",encryption_key AS "encryptionKey",custody FROM accounts WHERE id=$1',
          [row.account_id],
        );
        try {
          await this.admin(AccountSchema.parse(accountResult.rows[0]), dao);
        } catch {
          await client.query("UPDATE ram_card_orders SET state='review' WHERE id=$1", [id]);
          return 'manual';
        }
        await client.query("UPDATE ram_card_orders SET state='provisioning' WHERE id=$1", [id]);
        await this.chain.fulfilRam({
          dao_id: dao.daoId,
          reference: row.reference,
          policy_revision: row.approval.policy.revision,
          maximum: tlosAsset(BigInt(row.approval.quote.baseUnits)),
          expires: row.approval.quote.order.expires,
          purchases: row.approval.quote.order.purchases,
        });
        native = await this.chain.ramOrder(row.reference);
      }
      if (!native) return 'retry';
      const legs = row.approval.quote.order.purchases;
      if (
        !native.settled ||
        native.payer !== dao.contract ||
        native.dao_id !== dao.daoId ||
        native.reference !== row.reference ||
        native.fee_bps !== 0 ||
        native.policy_revision !== row.approval.policy.revision ||
        native.purchases.length !== legs.length ||
        !native.purchases.every(
          (p, i) =>
            p.receiver === legs[i]?.receiver &&
            p.quantity === legs[i]?.quantity &&
            p.minimum_bytes === legs[i]?.minimum_bytes &&
            BigInt(p.acquired_bytes) >= BigInt(p.minimum_bytes),
        )
      ) {
        await client.query("UPDATE ram_card_orders SET state='review' WHERE id=$1", [id]);
        return 'manual';
      }
      const bytes = native.purchases.reduce((n, p) => n + BigInt(p.acquired_bytes), 0n).toString();
      if (row.settled_at === null)
        await client.query(
          "UPDATE ram_card_orders SET state='settled',acquired_bytes=$1,settled_at=now() WHERE id=$2",
          [bytes, id],
        );
      return 'completed';
    });
  }
}
