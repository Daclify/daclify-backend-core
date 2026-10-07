import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type Stripe from 'stripe';
import { AccountSchema, type Account, type UserMembership } from '../../../../protocol/api.js';
import { DaoRefSchema, type DaoRef } from '../../../../protocol/base.js';
import {
  PaymentProductSchema,
  PaymentProductInputSchema,
  PaymentStatusSchema,
  PaymentOrderSchema,
  PaymentPolicySchema,
  daoPaymentKey,
  paymentFee,
  type PaymentOrder,
} from '../../../../protocol/payments.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import { createStripeClient, readStripeEvent } from '../billing/stripe.js';
import { requireCheckoutUrl } from '../billing/checkout.js';
import { connectCheckoutParams, merchantReadiness, requireStripeConnectUrl } from './provider.js';
import type { ConnectConfig } from './config.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest();
const Merchant = z.object({
  dao_key: z.string(),
  dao: DaoRefSchema,
  creation_request: z.uuid(),
  created_at: z.date(),
  creation_started_at: z.date().nullable(),
  stripe_account: z.string().nullable(),
  account_kind: z.enum(['oauth', 'v2']).nullable(),
  state: z.enum(['pending', 'ready', 'restricted', 'disconnected']),
  charges_enabled: z.boolean(),
  payouts_enabled: z.boolean(),
  broker_hash: z.instanceof(Buffer).nullable(),
  broker_admin: z.uuid().nullable(),
});
const Order = z.object({
  id: z.uuid(),
  dao: DaoRefSchema,
  dao_key: z.string(),
  request_id: z.uuid(),
  product_id: z.uuid(),
  customer_reference: z.string(),
  customer_account: z.uuid().nullable(),
  stripe_account: z.string(),
  title: z.string(),
  module_id: z.string(),
  amount_minor: z.int(),
  fee_bps: z.int(),
  fee_revision: z.string(),
  application_fee: z.int(),
  checkout_id: z.string().nullable(),
  checkout_url: z.string().nullable(),
  return_url: z.string().nullable(),
  payment_intent: z.string().nullable(),
  state: PaymentOrderSchema.shape.state,
  refunded_minor: z.int(),
  dispute: PaymentOrderSchema.shape.dispute,
  created_at: z.date(),
});
type OrderRow = z.infer<typeof Order>;
const view = (row: OrderRow): PaymentOrder =>
  PaymentOrderSchema.parse({
    id: row.id,
    dao: row.dao,
    productId: row.product_id,
    title: row.title,
    moduleId: row.module_id,
    amountMinor: row.amount_minor,
    currency: 'usd',
    applicationFeeMinor: row.application_fee,
    policy: { basisPoints: row.fee_bps, revision: row.fee_revision },
    state: row.state,
    checkoutUrl: row.checkout_url,
    refundedMinor: row.refunded_minor,
    dispute: row.dispute,
  });
const SELECT_ORDER =
  'SELECT o.*,m.dao FROM dao_payment_orders o JOIN dao_merchants m USING(dao_key)';

export class ConnectedPayments {
  private readonly stripe: Stripe;
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    readonly config: ConnectConfig,
    stripe?: Stripe,
  ) {
    this.stripe = stripe ?? createStripeClient(config.secretKey);
  }
  async policy() {
    if (!this.chain.paymentPolicy) throw new ApiError('PAYMENT_POLICY_UNAVAILABLE', 503);
    return PaymentPolicySchema.parse(await this.chain.paymentPolicy());
  }
  async admin(account: Account, dao: DaoRef): Promise<UserMembership> {
    dao = DaoRefSchema.parse(dao);
    const network = await this.chain.network();
    if (dao.chainId !== network.chainId) throw new ApiError('PAYMENT_DAO', 403);
    const memberships = this.chain.paymentMemberships
      ? await this.chain.paymentMemberships(account, dao)
      : dao.contract === network.runtime
        ? await this.chain.memberships(account)
        : [];
    const member = memberships.find(
      (m) => daoPaymentKey(m.dao) === daoPaymentKey(dao) && m.active && m.admin,
    );
    if (!member) throw new ApiError('PAYMENT_ADMIN_REQUIRED', 403);
    return member;
  }
  private async merchant(dao: DaoRef, create = false) {
    const key = daoPaymentKey(dao);
    if (create)
      await this.pool.query(
        'INSERT INTO dao_merchants(dao_key,dao,creation_request) VALUES($1,$2,$3) ON CONFLICT(dao_key) DO NOTHING',
        [key, dao, randomUUID()],
      );
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM dao_merchants WHERE dao_key=$1',
      [key],
    );
    return result.rows[0] ? Merchant.parse(result.rows[0]) : undefined;
  }
  private async products(dao: DaoRef, active = false) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id,module_id,title,amount_minor,active FROM dao_payment_products WHERE dao_key=$1 ${active ? 'AND active' : ''} ORDER BY title,id`,
      [daoPaymentKey(dao)],
    );
    return result.rows.map((r) =>
      PaymentProductSchema.parse({
        dao,
        id: r.id,
        moduleId: r.module_id,
        title: r.title,
        amountMinor: r.amount_minor,
        active: r.active,
        currency: 'usd',
      }),
    );
  }
  private async readiness(merchant: z.infer<typeof Merchant>, db: Pool | PoolClient = this.pool) {
    if (!merchant.stripe_account || !merchant.account_kind || merchant.state === 'disconnected')
      return { chargesEnabled: false, payoutsEnabled: false };
    const value =
      merchant.account_kind === 'v2'
        ? await this.stripe.v2.core.accounts.retrieve(merchant.stripe_account, {
            include: ['configuration.merchant', 'defaults'],
          })
        : await this.stripe.accounts.retrieve(merchant.stripe_account);
    const ready = merchantReadiness(value, merchant.account_kind, this.config.livemode);
    await db.query(
      "UPDATE dao_merchants SET charges_enabled=$2,payouts_enabled=$3,state=$4,updated_at=now() WHERE dao_key=$1 AND stripe_account=$5 AND state<>'disconnected'",
      [
        merchant.dao_key,
        ready.chargesEnabled,
        ready.payoutsEnabled,
        ready.chargesEnabled && ready.payoutsEnabled ? 'ready' : 'restricted',
        merchant.stripe_account,
      ],
    );
    return ready;
  }
  async status(account: Account, dao: DaoRef) {
    await this.admin(account, dao);
    const merchant = await this.merchant(dao);
    const ready = merchant
      ? await this.readiness(merchant)
      : { chargesEnabled: false, payoutsEnabled: false };
    let policy = null;
    try {
      policy = await this.policy();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'PAYMENT_POLICY_UNAVAILABLE') throw error;
    }
    return PaymentStatusSchema.parse({
      dao,
      configured: true,
      accountId: merchant?.stripe_account ?? null,
      accountKind: merchant?.account_kind ?? null,
      state: !merchant?.stripe_account
        ? 'not-connected'
        : merchant.state === 'disconnected'
          ? 'disconnected'
          : ready.chargesEnabled && ready.payoutsEnabled
            ? 'ready'
            : 'restricted',
      ...ready,
      policy,
      products: await this.products(dao),
      brokerConfigured: !!merchant?.broker_hash,
    });
  }
  async catalogue(dao: DaoRef) {
    const merchant = await this.merchant(dao);
    const policy = await this.policy();
    return {
      dao,
      enabled:
        !!merchant?.charges_enabled &&
        !!merchant.payouts_enabled &&
        merchant.state !== 'disconnected' &&
        (!this.config.livemode || this.config.liveChargesEnabled),
      policy,
      products: await this.products(dao, true),
    };
  }
  private returnUrl(dao: DaoRef, order?: string) {
    const url = new URL('/payments', this.config.frontendOrigin);
    url.searchParams.set('dao', JSON.stringify(dao));
    if (order) url.searchParams.set('order', order);
    return url.toString();
  }
  private async checkoutReturnUrl(dao: DaoRef, order: string, operator: boolean) {
    if (operator && this.chain.hubDirectory) {
      let after: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await this.chain.hubDirectory(after);
        const entry = page.entries.find((e) => daoPaymentKey(e.reference) === daoPaymentKey(dao));
        if (entry) {
          if (entry.portal.mode === 'external') {
            const url = new URL(entry.portal.url);
            url.searchParams.set('daclify_order', order);
            url.searchParams.set('daclify_dao', JSON.stringify(dao));
            return url.toString();
          }
          break;
        }
        after = page.next ?? undefined;
        if (after && seen.has(after)) throw new ApiError('PAYMENT_DAO', 409);
        if (after) seen.add(after);
      } while (after);
    }
    return this.returnUrl(dao, order);
  }
  async onboard(
    account: Account,
    dao: DaoRef,
    mode: 'existing' | 'new' | 'resume',
    sessionToken: string,
  ) {
    await this.admin(account, dao);
    const merchant = await this.merchant(dao, true);
    if (!merchant) throw new ApiError('PAYMENT_MERCHANT_UNKNOWN', 404);
    if (mode === 'existing') {
      if (merchant.stripe_account && merchant.state !== 'disconnected')
        throw new ApiError('PAYMENT_ALREADY_CONNECTED', 409);
      const state = randomBytes(32).toString('base64url');
      await this.pool.query(
        'INSERT INTO dao_payment_oauth(state_hash,dao_key,account_id,session_hash) VALUES($1,$2,$3,$4)',
        [hash(state), merchant.dao_key, account.id, hash(sessionToken)],
      );
      const url = this.stripe.oauth.authorizeUrl({
        client_id: this.config.clientId,
        response_type: 'code',
        scope: 'read_write',
        redirect_uri: new URL('/v1/payments/stripe/callback', this.config.apiOrigin).toString(),
        state,
      });
      return { url: requireStripeConnectUrl(url) };
    }
    if (merchant.state === 'disconnected') throw new ApiError('PAYMENT_RECONNECT_REQUIRED', 409);
    if (mode === 'resume' && (!merchant.stripe_account || merchant.account_kind !== 'v2'))
      throw new ApiError('PAYMENT_ONBOARDING_REQUIRED', 409);
    if (mode === 'new' && merchant.account_kind === 'oauth')
      throw new ApiError('PAYMENT_ALREADY_CONNECTED', 409);
    let stripeAccount = merchant.stripe_account;
    if (!stripeAccount) {
      const started = await this.pool.query<{ creation_started_at: Date }>(
        'UPDATE dao_merchants SET creation_started_at=COALESCE(creation_started_at,now()) WHERE dao_key=$1 RETURNING creation_started_at',
        [merchant.dao_key],
      );
      const attempt = started.rows[0];
      if (!attempt || Date.now() - attempt.creation_started_at.getTime() > 23 * 3600000)
        throw new ApiError('PAYMENT_RECONCILIATION_REQUIRED', 409);
      const created = await this.stripe.v2.core.accounts.create(
        {
          display_name: `DAO ${dao.contract}/${dao.daoId}`,
          dashboard: 'full',
          configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
          defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
          metadata: { dao_key: hash(merchant.dao_key).toString('hex') },
          include: ['configuration.merchant', 'defaults'],
        },
        { idempotencyKey: 'dao-merchant-' + merchant.creation_request },
      );
      merchantReadiness(created, 'v2', this.config.livemode);
      stripeAccount = created.id;
      await this.admin(account, dao);
      const saved = await this.pool.query(
        "UPDATE dao_merchants SET stripe_account=$2,account_kind='v2',state='pending',charges_enabled=false,payouts_enabled=false,updated_at=now() WHERE dao_key=$1 AND (stripe_account IS NULL OR stripe_account=$2)",
        [merchant.dao_key, stripeAccount],
      );
      if (saved.rowCount !== 1) throw new ApiError('PAYMENT_ALREADY_CONNECTED', 409);
    }
    const link = await this.stripe.v2.core.accountLinks.create({
      account: stripeAccount,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant'],
          collection_options: { fields: 'eventually_due' },
          return_url: this.returnUrl(dao),
          refresh_url: this.returnUrl(dao),
        },
      },
    });
    return { url: requireStripeConnectUrl(link.url) };
  }
  async callback(account: Account, token: string, state: string, code: string | undefined) {
    const found = await this.pool.query<Record<string, unknown>>(
      'UPDATE dao_payment_oauth SET used_at=now() WHERE state_hash=$1 AND account_id=$2 AND session_hash=$3 AND used_at IS NULL AND expires_at>now() RETURNING dao_key',
      [hash(state), account.id, hash(token)],
    );
    const key = z.object({ dao_key: z.string() }).safeParse(found.rows[0]);
    if (!key.success) throw new ApiError('PAYMENT_OAUTH_INVALID', 403);
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM dao_merchants WHERE dao_key=$1',
      [key.data.dao_key],
    );
    const merchant = Merchant.parse(result.rows[0]);
    await this.admin(account, merchant.dao);
    if (!code) return this.returnUrl(merchant.dao) + '&onboarding=cancelled';
    // OAuth authorization codes must be exchanged once; retrying can revoke the connection.
    const granted = await this.stripe.oauth.token(
      { grant_type: 'authorization_code', code },
      { maxNetworkRetries: 0 },
    );
    if (
      granted.livemode !== this.config.livemode ||
      granted.scope !== 'read_write' ||
      !granted.stripe_user_id
    )
      throw new ApiError('PAYMENT_OAUTH_INVALID', 403);
    const ready = merchantReadiness(
      await this.stripe.accounts.retrieve(granted.stripe_user_id),
      'oauth',
      this.config.livemode,
    );
    await this.admin(account, merchant.dao);
    const saved = await this.pool
      .query(
        "UPDATE dao_merchants SET stripe_account=$2,account_kind='oauth',state=$3,charges_enabled=$4,payouts_enabled=$5,updated_at=now() WHERE dao_key=$1 AND (stripe_account IS NULL OR state='disconnected')",
        [
          merchant.dao_key,
          granted.stripe_user_id,
          ready.chargesEnabled && ready.payoutsEnabled ? 'ready' : 'restricted',
          ready.chargesEnabled,
          ready.payoutsEnabled,
        ],
      )
      .catch(() => {
        throw new ApiError('PAYMENT_ALREADY_CONNECTED', 409);
      });
    if (saved.rowCount !== 1) throw new ApiError('PAYMENT_ALREADY_CONNECTED', 409);
    return this.returnUrl(merchant.dao);
  }
  async product(account: Account, value: unknown) {
    const input = PaymentProductInputSchema.parse(value);
    await this.admin(account, input.dao);
    await this.merchant(input.dao, true);
    await this.pool.query(
      'INSERT INTO dao_payment_products(id,dao_key,module_id,title,amount_minor,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET module_id=EXCLUDED.module_id,title=EXCLUDED.title,amount_minor=EXCLUDED.amount_minor,active=EXCLUDED.active,updated_at=now() WHERE dao_payment_products.dao_key=EXCLUDED.dao_key',
      [
        input.id,
        daoPaymentKey(input.dao),
        input.moduleId,
        input.title,
        input.amountMinor,
        input.active,
      ],
    );
    const stored = (await this.products(input.dao)).find((p) => p.id === input.id);
    if (!stored) throw new ApiError('PAYMENT_PRODUCT_CONFLICT', 409);
    return stored;
  }
  async credential(account: Account, dao: DaoRef, revoke = false) {
    await this.admin(account, dao);
    await this.merchant(dao, true);
    const token = 'dcp_' + randomBytes(32).toString('base64url');
    await this.pool.query(
      'UPDATE dao_merchants SET broker_hash=$2,broker_admin=$3 WHERE dao_key=$1',
      [daoPaymentKey(dao), revoke ? null : hash(token), revoke ? null : account.id],
    );
    return revoke ? null : { token };
  }
  async broker(token: string, dao: DaoRef) {
    if (!/^dcp_[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError('PAYMENT_BROKER_INVALID', 401);
    const found = await this.pool.query<Record<string, unknown>>(
      'SELECT a.id,a.signing_key,a.encryption_key,a.custody FROM dao_merchants m JOIN accounts a ON a.id=m.broker_admin WHERE m.dao_key=$1 AND m.broker_hash=$2',
      [daoPaymentKey(dao), hash(token)],
    );
    const row = found.rows[0];
    if (!row) throw new ApiError('PAYMENT_BROKER_INVALID', 401);
    const account = AccountSchema.parse({
      id: row.id,
      signingKey: row.signing_key,
      encryptionKey: row.encryption_key,
      custody: row.custody,
    });
    await this.admin(account, dao);
    return account;
  }
  private async order(id: string) {
    const result = await this.pool.query<Record<string, unknown>>(SELECT_ORDER + ' WHERE o.id=$1', [
      z.uuid().parse(id),
    ]);
    if (!result.rows[0]) throw new ApiError('PAYMENT_ORDER_UNKNOWN', 404);
    return Order.parse(result.rows[0]);
  }
  async readOrder(account: Account, id: string) {
    const row = await this.order(id);
    if (row.customer_account !== account.id) await this.admin(account, row.dao);
    if (row.checkout_id) await this.reconcile(row);
    return view(await this.order(id));
  }
  async brokerOrder(dao: DaoRef, id: string) {
    const row = await this.order(id);
    if (daoPaymentKey(dao) !== row.dao_key) throw new ApiError('PAYMENT_ORDER_UNKNOWN', 404);
    if (row.checkout_id) await this.reconcile(row);
    return view(await this.order(id));
  }
  async checkout(
    dao: DaoRef,
    productId: string,
    requestId: string,
    customerReference: string,
    customerAccount: string | null,
  ) {
    if (this.config.livemode && !this.config.liveChargesEnabled)
      throw new ApiError('PAYMENT_LIVE_DISABLED', 503);
    const merchant = await this.merchant(dao);
    if (!merchant?.stripe_account || merchant.state === 'disconnected')
      throw new ApiError('PAYMENT_ONBOARDING_REQUIRED', 409);
    const ready = await this.readiness(merchant);
    if (!ready.chargesEnabled || !ready.payoutsEnabled)
      throw new ApiError('PAYMENT_ONBOARDING_REQUIRED', 409);
    const existing = await this.pool.query<Record<string, unknown>>(
      SELECT_ORDER + ' WHERE o.dao_key=$1 AND o.request_id=$2',
      [daoPaymentKey(dao), requestId],
    );
    let row = existing.rows[0] ? Order.parse(existing.rows[0]) : undefined;
    if (!row) {
      const product = (await this.products(dao, true)).find((p) => p.id === productId);
      if (!product) throw new ApiError('PAYMENT_PRODUCT_UNKNOWN', 404);
      const policy = await this.policy();
      await this.pool.query(
        'INSERT INTO dao_payment_orders(id,request_id,dao_key,product_id,customer_reference,customer_account,stripe_account,title,module_id,amount_minor,fee_bps,fee_revision,application_fee) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(dao_key,request_id) DO NOTHING',
        [
          randomUUID(),
          requestId,
          daoPaymentKey(dao),
          product.id,
          customerReference,
          customerAccount,
          merchant.stripe_account,
          product.title,
          product.moduleId,
          product.amountMinor,
          policy.basisPoints,
          policy.revision,
          paymentFee(product.amountMinor, policy.basisPoints),
        ],
      );
      const result = await this.pool.query<Record<string, unknown>>(
        SELECT_ORDER + ' WHERE o.dao_key=$1 AND o.request_id=$2',
        [daoPaymentKey(dao), requestId],
      );
      row = Order.parse(result.rows[0]);
    }
    if (
      row.product_id !== productId ||
      row.customer_reference !== customerReference ||
      row.customer_account !== customerAccount
    )
      throw new ApiError('PAYMENT_REQUEST_CONFLICT', 409);
    if (row.checkout_id) return view(row);
    if (Date.now() - row.created_at.getTime() > 23 * 3600000)
      throw new ApiError('PAYMENT_RECONCILIATION_REQUIRED', 409);
    if (!row.return_url) {
      const destination = await this.checkoutReturnUrl(dao, row.id, customerAccount === null);
      const saved = await this.pool.query<{ return_url: string }>(
        'UPDATE dao_payment_orders SET return_url=COALESCE(return_url,$2) WHERE id=$1 RETURNING return_url',
        [row.id, destination],
      );
      row.return_url = saved.rows[0]?.return_url ?? null;
    }
    if (!row.return_url) throw new ApiError('PAYMENT_RECONCILIATION_REQUIRED', 503);
    const session = await this.stripe.checkout.sessions.create(
      connectCheckoutParams({
        id: row.id,
        title: row.title,
        amountMinor: row.amount_minor,
        applicationFeeMinor: row.application_fee,
        returnUrl: row.return_url,
        daoKey: hash(row.dao_key).toString('hex'),
      }),
      {
        stripeContext: row.stripe_account,
        idempotencyKey: 'dao-checkout-' + row.id,
        timeout: 15000,
      },
    );
    if (session.livemode !== this.config.livemode) throw new ApiError('PAYMENT_MODE', 409);
    const url = requireCheckoutUrl(session.url);
    await this.pool.query(
      "UPDATE dao_payment_orders SET checkout_id=$2,checkout_url=$3,state=CASE WHEN state='pending' THEN 'open' ELSE state END,updated_at=now() WHERE id=$1 AND checkout_id IS NULL",
      [row.id, session.id, url],
    );
    return view(await this.order(row.id));
  }
  private async reconcile(row: OrderRow, checkoutHint?: string, db: Pool | PoolClient = this.pool) {
    const checkoutId = row.checkout_id ?? checkoutHint;
    if (!checkoutId) throw new ApiError('PAYMENT_RECONCILIATION_PENDING', 503);
    const session = await this.stripe.checkout.sessions.retrieve(
      checkoutId,
      {},
      { stripeContext: row.stripe_account, timeout: 15000 },
    );
    if (
      session.livemode !== this.config.livemode ||
      session.metadata?.purpose !== 'dao-module' ||
      session.metadata.order_id !== row.id ||
      session.metadata.dao_key !== hash(row.dao_key).toString('hex') ||
      session.amount_total !== row.amount_minor ||
      session.currency !== 'usd' ||
      session.mode !== 'payment'
    )
      throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    if (session.id !== checkoutId) throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    await db.query(
      'UPDATE dao_payment_orders SET checkout_id=$2 WHERE id=$1 AND checkout_id IS NULL',
      [row.id, checkoutId],
    );
    if (session.payment_status !== 'paid') {
      if (session.status === 'expired')
        await db.query(
          "UPDATE dao_payment_orders SET state='expired',updated_at=now() WHERE id=$1 AND state<>'paid'",
          [row.id],
        );
      return;
    }
    const id =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!id) throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    const intent = await this.stripe.paymentIntents.retrieve(
      id,
      { expand: ['latest_charge'] },
      { stripeContext: row.stripe_account, timeout: 15000 },
    );
    if (
      intent.status !== 'succeeded' ||
      intent.livemode !== this.config.livemode ||
      intent.amount_received !== row.amount_minor ||
      intent.currency !== 'usd' ||
      (intent.application_fee_amount ?? 0) !== row.application_fee ||
      intent.metadata.order_id !== row.id ||
      intent.metadata.dao_key !== hash(row.dao_key).toString('hex') ||
      intent.metadata.purpose !== 'dao-module'
    )
      throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    const charge = intent.latest_charge;
    if (!charge || typeof charge === 'string') throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    const chargeIntent =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (
      chargeIntent !== id ||
      charge.livemode !== this.config.livemode ||
      charge.amount !== row.amount_minor ||
      charge.currency !== 'usd' ||
      !charge.paid ||
      (charge.application_fee_amount ?? 0) !== row.application_fee ||
      !Number.isSafeInteger(charge.amount_refunded) ||
      charge.amount_refunded < 0 ||
      charge.amount_refunded > row.amount_minor
    )
      throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    let dispute: PaymentOrder['dispute'] = 'none';
    {
      const list = await this.stripe.disputes.list(
        { payment_intent: id, limit: 1 },
        { stripeContext: row.stripe_account, timeout: 15000 },
      );
      const status = list.data[0]?.status;
      dispute =
        status === 'won'
          ? 'won'
          : status === 'lost'
            ? 'lost'
            : status || charge.disputed
              ? 'open'
              : 'none';
    }
    const saved = await db.query(
      "UPDATE dao_payment_orders SET state='paid',payment_intent=$2,refunded_minor=GREATEST(refunded_minor,$3),dispute=$4,updated_at=now() WHERE id=$1 AND (payment_intent IS NULL OR payment_intent=$2)",
      [row.id, id, charge.amount_refunded, dispute],
    );
    if (saved.rowCount !== 1) throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
  }
  async refund(
    account: Account,
    dao: DaoRef,
    orderId: string,
    requestId: string,
    amountMinor: number,
  ) {
    await this.admin(account, dao);
    let row = await this.order(orderId);
    if (row.dao_key !== daoPaymentKey(dao)) throw new ApiError('PAYMENT_ORDER_UNKNOWN', 404);
    await this.reconcile(row);
    row = await this.order(orderId);
    if (row.state !== 'paid' || !row.payment_intent) throw new ApiError('PAYMENT_NOT_PAID', 409);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query<{ refunded_minor: number }>(
        'SELECT refunded_minor FROM dao_payment_orders WHERE id=$1 FOR UPDATE',
        [row.id],
      );
      const existing = await client.query<{
        order_id: string;
        amount_minor: number;
        stripe_refund: string | null;
        created_at: Date;
      }>('SELECT * FROM dao_payment_refunds WHERE request_id=$1', [requestId]);
      if (
        existing.rows[0] &&
        (existing.rows[0].order_id !== row.id || existing.rows[0].amount_minor !== amountMinor)
      )
        throw new ApiError('PAYMENT_REQUEST_CONFLICT', 409);
      if (!existing.rows[0]) {
        const reserved = await client.query<{ pending: string; issued: string }>(
          'SELECT COALESCE(sum(amount_minor) FILTER(WHERE stripe_refund IS NULL),0)::text AS pending,COALESCE(sum(amount_minor) FILTER(WHERE stripe_refund IS NOT NULL),0)::text AS issued FROM dao_payment_refunds WHERE order_id=$1',
          [row.id],
        );
        const known = BigInt(locked.rows[0]?.refunded_minor ?? 0),
          issued = BigInt(reserved.rows[0]?.issued ?? '0');
        if (
          (known > issued ? known : issued) +
            BigInt(reserved.rows[0]?.pending ?? '0') +
            BigInt(amountMinor) >
          BigInt(row.amount_minor)
        )
          throw new ApiError('PAYMENT_REFUND_AMOUNT', 409);
        await client.query(
          'INSERT INTO dao_payment_refunds(request_id,order_id,amount_minor) VALUES($1,$2,$3)',
          [requestId, row.id, amountMinor],
        );
      }
      await client.query('COMMIT');
      if (existing.rows[0]?.stripe_refund) return view(row);
      if (existing.rows[0] && Date.now() - existing.rows[0].created_at.getTime() > 23 * 3600000)
        throw new ApiError('PAYMENT_RECONCILIATION_REQUIRED', 409);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: row.payment_intent,
        amount: amountMinor,
        ...(row.application_fee ? { refund_application_fee: true } : {}),
        metadata: { request_id: requestId, order_id: row.id },
      },
      {
        stripeContext: row.stripe_account,
        idempotencyKey: 'dao-refund-' + requestId,
        timeout: 15000,
      },
    );
    const refundIntent =
      typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
    if (
      refund.amount !== amountMinor ||
      refund.currency !== 'usd' ||
      refundIntent !== row.payment_intent ||
      refund.metadata?.request_id !== requestId ||
      refund.metadata.order_id !== row.id
    )
      throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
    await this.pool.query(
      'UPDATE dao_payment_refunds SET stripe_refund=$2 WHERE request_id=$1 AND stripe_refund IS NULL',
      [requestId, refund.id],
    );
    await this.reconcile(row);
    return view(await this.order(row.id));
  }
  async webhook(raw: Buffer, signature: string) {
    const event = readStripeEvent(this.stripe, raw, signature, this.config.webhookSecret);
    if (event.livemode !== this.config.livemode) throw new ApiError('PAYMENT_MODE', 400);
    if (!event.account) throw new ApiError('PAYMENT_RECEIPT_INVALID', 400);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [
        hash('connect:' + event.id)
          .readBigInt64BE()
          .toString(),
      ]);
      const claimed = await client.query<Record<string, unknown>>(
        'SELECT payload_hash FROM dao_payment_events WHERE event_id=$1',
        [event.id],
      );
      if (claimed.rows[0]) {
        const previous = z.object({ payload_hash: z.instanceof(Buffer) }).parse(claimed.rows[0]);
        if (!previous.payload_hash.equals(hash(raw)))
          throw new ApiError('PAYMENT_EVENT_CONFLICT', 409);
        await client.query('COMMIT');
        return;
      }
      if (event.type === 'account.application.deauthorized')
        await client.query(
          "UPDATE dao_merchants SET state='disconnected',charges_enabled=false,payouts_enabled=false,broker_hash=NULL,broker_admin=NULL WHERE stripe_account=$1",
          [event.account],
        );
      else if (event.type === 'account.updated') {
        const result = await client.query<Record<string, unknown>>(
          'SELECT * FROM dao_merchants WHERE stripe_account=$1',
          [event.account],
        );
        if (result.rows[0]) await this.readiness(Merchant.parse(result.rows[0]), client);
      } else {
        const data = z
          .object({
            id: z.string(),
            metadata: z.record(z.string(), z.string()).nullable().optional(),
            payment_intent: z
              .union([z.string(), z.object({ id: z.string() })])
              .nullable()
              .optional(),
          })
          .safeParse(event.data.object);
        if (data.success) {
          const orderId = data.data.metadata?.order_id;
          const pi =
            typeof data.data.payment_intent === 'string'
              ? data.data.payment_intent
              : data.data.payment_intent?.id;
          const result = await client.query<Record<string, unknown>>(
            SELECT_ORDER + ' WHERE o.checkout_id=$1 OR o.id::text=$2 OR o.payment_intent=$3',
            [
              data.data.id,
              orderId ?? '',
              pi ?? (data.data.id.startsWith('pi_') ? data.data.id : ''),
            ],
          );
          for (const value of result.rows) {
            const order = Order.parse(value);
            if (order.stripe_account !== event.account)
              throw new ApiError('PAYMENT_RECEIPT_INVALID', 409);
            await this.reconcile(
              order,
              data.data.id.startsWith('cs_') ? data.data.id : undefined,
              client,
            );
          }
        }
      }
      await client.query('INSERT INTO dao_payment_events(event_id,payload_hash) VALUES($1,$2)', [
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
