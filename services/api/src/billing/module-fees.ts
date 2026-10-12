import { createHash } from 'node:crypto';
import { ownsAccount } from '../auth/account-ownership.js';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';
import { z } from 'zod';
import { AccountSchema, type Account } from '../../../../protocol/api.js';
import type { DaoRef } from '../../../../protocol/base.js';
import {
  ModuleFeeApprovalSchema,
  ModuleFeeOrderSchema,
  ModuleFeeStatusSchema,
  moduleFeePricingHash,
} from '../../../../protocol/module-fees.js';
import { daoPaymentKey } from '../../../../protocol/payments.js';
import type { NativeChainGateway } from '../native-chain.js';
import { ApiError } from '../errors.js';
import { rollbackTransaction } from '../transaction.js';
import { createStripeClient } from './stripe.js';
import { requireCheckoutUrl } from './checkout.js';
import { moduleMonth } from './module-fee-period.js';
import type { ModuleFeesConfig } from './module-fees-config.js';
const Row = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  dao_key: z.string(),
  module_account: z.string(),
  approval: ModuleFeeApprovalSchema,
  stripe_account: z.string(),
  livemode: z.boolean(),
  state: ModuleFeeOrderSchema.shape.state,
  checkout_id: z.string().nullable(),
  checkout_url: z.string().nullable(),
  payment_intent: z.string().nullable(),
  receipt: z.string().nullable(),
  expected_receipt: z.string().nullable(),
  starts: z.coerce.number().int().nullable(),
  expires: z.coerce.number().int().nullable(),
  created_at: z.date(),
});
type Order = z.infer<typeof Row>;
type Chain = Pick<
  NativeChainGateway,
  | 'network'
  | 'memberships'
  | 'moduleFeeState'
  | 'attestModuleTerm'
  | 'revokeModuleTerm'
  | 'resumeModuleTerm'
>;
const zero = '00'.repeat(32);
export class ModuleFees {
  private readonly stripe: Stripe;
  constructor(
    private readonly pool: Pool,
    private readonly chain: Chain,
    readonly config: ModuleFeesConfig,
    stripe?: Stripe,
  ) {
    this.stripe = stripe ?? createStripeClient(config.secretKey);
  }
  async admin(account: Account, dao: DaoRef) {
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
  async status(account: Account, dao: DaoRef) {
    await this.admin(account, dao);
    return ModuleFeeStatusSchema.parse({
      ...(await this.chain.moduleFeeState(dao)),
      configured: true,
      paymentMode: this.config.livemode ? 'live' : 'test',
    });
  }
  private view(row: Order) {
    return ModuleFeeOrderSchema.parse({
      id: row.id,
      approval: row.approval,
      state: row.state,
      checkoutUrl: row.checkout_url === null ? null : requireCheckoutUrl(row.checkout_url),
      starts: row.starts,
      expires: row.expires,
      receipt: row.receipt,
    });
  }
  private async locked<T>(id: string, run: (row: Order, client: PoolClient) => Promise<T>) {
    z.uuid().parse(id);
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      const found = await client.query(
        'SELECT dao_key,module_account FROM module_fee_orders WHERE id=$1',
        [id],
      );
      if (!found.rows[0]) throw new ApiError('MODULE_ORDER_UNKNOWN', 404);
      const key = z
        .object({ dao_key: z.string(), module_account: z.string() })
        .parse(found.rows[0]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'module-access:' + key.dao_key + ':' + key.module_account,
      ]);
      const row = Row.parse(
        (await client.query('SELECT * FROM module_fee_orders WHERE id=$1 FOR UPDATE', [id]))
          .rows[0],
      );
      if (row.stripe_account !== this.config.accountId || row.livemode !== this.config.livemode)
        throw new ApiError('MODULE_ORDER_PROVIDER', 409);
      const result = await run(row, client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      discard = await rollbackTransaction(client);
      throw error;
    } finally {
      client.release(discard);
    }
  }
  private async provider() {
    if ((await this.stripe.accounts.retrieveCurrent()).id !== this.config.accountId)
      throw new ApiError('MODULE_ORDER_PROVIDER', 409);
    const network = await this.chain.network();
    if (
      (network.environment === 'mainnet') !== this.config.livemode ||
      (this.config.livemode && !this.config.liveChargesEnabled)
    )
      throw new ApiError('LIVE_PAYMENTS_DISABLED', 409);
  }
  async checkout(account: Account, value: unknown) {
    const approval = ModuleFeeApprovalSchema.parse(value),
      id = approval.requestId;
    await this.admin(account, approval.dao);
    const known = await this.pool.query('SELECT id FROM module_fee_orders WHERE id=$1', [id]);
    if (!known.rowCount) {
      const status = await this.chain.moduleFeeState(approval.dao),
        plan = status.modules.find((m) => m.pricing.account === approval.account);
      if (
        !plan ||
        plan.pricing.monthlyUsdCents !== approval.monthlyUsdCents ||
        moduleFeePricingHash(plan.pricing) !== approval.pricingHash ||
        plan.codeHash !== approval.codeHash
      )
        throw new ApiError('MODULE_APPROVAL_CHANGED', 409);
      if (!plan.installed) throw new ApiError('MODULE_NOT_INSTALLED', 409);
      if (status.activeMembers <= status.freeMembers || plan.pricing.monthlyUsdCents === 0)
        throw new ApiError('MODULE_ACCESS_FREE', 409);
      if (plan.term && !plan.term.revoked && plan.term.expires > Date.now() / 1000 + 7 * 86400)
        throw new ApiError('MODULE_RENEWAL_EARLY', 409);
      await this.provider();
      await this.pool.query(
        `INSERT INTO module_fee_orders(id,account_id,dao_key,module_account,approval,stripe_account,livemode) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          id,
          account.id,
          daoPaymentKey(approval.dao),
          approval.account,
          approval,
          this.config.accountId,
          this.config.livemode,
        ],
      );
      if (!(await this.pool.query('SELECT id FROM module_fee_orders WHERE id=$1', [id])).rowCount)
        throw new ApiError('MODULE_ORDER_PENDING', 409);
    }
    return this.locked(id, async (row, client) => {
      if (
        !(await ownsAccount(client, account.id, row.account_id)) ||
        !isDeepStrictEqual(row.approval, approval)
      )
        throw new ApiError('MODULE_ORDER_CONFLICT', 409);
      if (!row.checkout_id) {
        // Stripe only guarantees idempotency for 24 hours. Unknown expired checkouts need review, never a second charge.
        if (Date.now() > row.created_at.getTime() + 25 * 60000)
          throw new ApiError('MODULE_CHECKOUT_REVIEW', 409);
        await this.provider();
        const state = await this.chain.moduleFeeState(approval.dao),
          plan = state.modules.find((m) => m.pricing.account === approval.account);
        if (
          !plan ||
          moduleFeePricingHash(plan.pricing) !== approval.pricingHash ||
          plan.codeHash !== approval.codeHash ||
          !plan.installed ||
          state.activeMembers <= 10
        )
          throw new ApiError('MODULE_APPROVAL_CHANGED', 409);
        const metadata = {
          purpose: 'dao-module',
          order_id: row.id,
          account_id: row.account_id,
          dao_key: row.dao_key,
          module: row.module_account,
          pricing_hash: approval.pricingHash,
        };
        const url = new URL('/module-access', this.config.frontendOrigin);
        url.searchParams.set('dao', JSON.stringify(approval.dao));
        url.searchParams.set('order', id);
        const checkout = await this.stripe.checkout.sessions.create(
          {
            mode: 'payment',
            payment_method_types: ['card'],
            currency: 'usd',
            client_reference_id: row.account_id,
            metadata,
            payment_intent_data: { metadata },
            expires_at: Math.floor(row.created_at.getTime() / 1000) + 3600,
            success_url: url.href,
            cancel_url: url.href,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: 'usd',
                  unit_amount: approval.monthlyUsdCents,
                  product_data: { name: 'Daclify ' + plan.title + ' — one calendar month' },
                },
              },
            ],
          },
          { idempotencyKey: 'daclify-module:' + id, timeout: 15000 },
        );
        if (checkout.mode !== 'payment' || checkout.livemode !== row.livemode)
          throw new ApiError('MODULE_RECEIPT_INVALID', 409);
        row.checkout_id = checkout.id;
        row.checkout_url = requireCheckoutUrl(checkout.url);
        await client.query(
          'UPDATE module_fee_orders SET checkout_id=$1,checkout_url=$2 WHERE id=$3',
          [row.checkout_id, row.checkout_url, id],
        );
      }
      return this.view(row);
    });
  }
  async order(account: Account, id: string) {
    await this.locked(id, async (row) => this.admin(account, row.approval.dao));
    await this.reconcile(id);
    return this.locked(id, async (row) => this.view(row));
  }
  private async proof(row: Order) {
    if (!row.checkout_id) return null;
    const session = await this.stripe.checkout.sessions.retrieve(
      row.checkout_id,
      { expand: ['payment_intent.latest_charge'] },
      { timeout: 15000 },
    );
    const metadata = {
      purpose: 'dao-module',
      order_id: row.id,
      account_id: row.account_id,
      dao_key: row.dao_key,
      module: row.module_account,
      pricing_hash: row.approval.pricingHash,
    };
    const matches = (actual: Stripe.Metadata | null) =>
      actual !== null && Object.entries(metadata).every(([key, value]) => actual[key] === value);
    if (
      session.id !== row.checkout_id ||
      session.mode !== 'payment' ||
      session.livemode !== row.livemode ||
      session.currency !== 'usd' ||
      session.amount_total !== row.approval.monthlyUsdCents ||
      session.client_reference_id !== row.account_id ||
      !matches(session.metadata)
    )
      throw new ApiError('MODULE_RECEIPT_INVALID', 409);
    if (session.payment_status !== 'paid')
      return session.status === 'expired' ? { state: 'expired' as const } : null;
    const pi = session.payment_intent;
    if (
      !pi ||
      typeof pi === 'string' ||
      pi.status !== 'succeeded' ||
      pi.livemode !== row.livemode ||
      pi.currency !== 'usd' ||
      pi.amount !== row.approval.monthlyUsdCents ||
      pi.amount_received !== pi.amount ||
      !matches(pi.metadata)
    )
      throw new ApiError('MODULE_RECEIPT_INVALID', 409);
    const charge = pi.latest_charge;
    if (
      !charge ||
      typeof charge === 'string' ||
      !charge.paid ||
      !charge.captured ||
      charge.status !== 'succeeded' ||
      charge.livemode !== row.livemode ||
      charge.currency !== 'usd' ||
      charge.amount !== pi.amount ||
      (typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id) !== pi.id ||
      charge.created < Math.floor(row.created_at.getTime() / 1000) - 5 ||
      charge.created > Math.floor(row.created_at.getTime() / 1000) + 3600
    )
      throw new ApiError('MODULE_RECEIPT_INVALID', 409);
    const [refunds, disputes] = await Promise.all([
      this.stripe.refunds.list({ charge: charge.id, limit: 100 }, { timeout: 15000 }),
      this.stripe.disputes.list({ payment_intent: pi.id, limit: 100 }, { timeout: 15000 }),
    ]);
    if (refunds.has_more || disputes.has_more) throw new ApiError('MODULE_RECEIPT_INVALID', 409);
    const revoked =
      charge.amount_refunded > 0 ||
      refunds.data.some((r) => r.status !== 'failed' && r.status !== 'canceled') ||
      disputes.data.some((d) => d.status !== 'won') ||
      (charge.disputed && !disputes.data.some((d) => d.status === 'won'));
    return {
      state: revoked ? ('revoked' as const) : ('paid' as const),
      intent: pi.id,
      paidAt: charge.created,
    };
  }
  async reconcile(id: string) {
    await this.provider();
    // Persist the exact paid interval before native publication; a lost acknowledgement must not buy a longer interval on retry.
    const fulfill = await this.locked(id, async (row, client) => {
      if (row.state === 'review' || row.state === 'refunded' || row.state === 'expired')
        return false;
      if (!row.checkout_id && Date.now() > row.created_at.getTime() + 3600000) {
        await client.query("UPDATE module_fee_orders SET state='review' WHERE id=$1", [id]);
        return false;
      }
      let proof;
      try {
        proof = await this.proof(row);
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'MODULE_RECEIPT_INVALID') throw error;
        if (row.receipt)
          await this.chain.revokeModuleTerm(row.approval.dao, row.module_account, row.receipt);
        await client.query("UPDATE module_fee_orders SET state='review' WHERE id=$1", [id]);
        return false;
      }
      if (!proof) return false;
      if (proof.state === 'expired') {
        await client.query("UPDATE module_fee_orders SET state='expired' WHERE id=$1", [id]);
        return false;
      }
      if (row.payment_intent && row.payment_intent !== proof.intent)
        throw new ApiError('MODULE_RECEIPT_INVALID', 409);
      await client.query('UPDATE module_fee_orders SET payment_intent=$1 WHERE id=$2', [
        proof.intent,
        id,
      ]);
      if (proof.state === 'revoked') {
        if (row.receipt)
          await this.chain.revokeModuleTerm(row.approval.dao, row.module_account, row.receipt);
        await client.query('UPDATE module_fee_orders SET state=$1 WHERE id=$2', [
          row.state === 'refunding' ? 'refunded' : 'revoked',
          id,
        ]);
        return false;
      }
      const state = await this.chain.moduleFeeState(row.approval.dao),
        plan = state.modules.find((m) => m.pricing.account === row.module_account);
      if (!row.receipt) {
        const result = await client.query(
          'SELECT a.id,a.signing_key AS "signingKey",a.encryption_key AS "encryptionKey",a.custody FROM accounts h JOIN accounts a ON a.id=coalesce(h.merged_into,h.id) WHERE h.id=$1',
          [row.account_id],
        );
        let authorized = true;
        try {
          await this.admin(AccountSchema.parse(result.rows[0]), row.approval.dao);
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== 'PAYMENT_ADMIN_REQUIRED') throw error;
          authorized = false;
        }
        if (
          !authorized ||
          !plan ||
          !plan.installed ||
          plan.codeHash !== row.approval.codeHash ||
          state.activeMembers <= 10 ||
          plan.pricing.monthlyUsdCents === 0
        ) {
          await this.refund(row, proof.intent, client);
          return false;
        }
        let period;
        try {
          period = moduleMonth(
            proof.paidAt,
            plan.term && !plan.term.revoked ? plan.term.expires : null,
          );
        } catch {
          await client.query("UPDATE module_fee_orders SET state='review' WHERE id=$1", [id]);
          return false;
        }
        if (period.expires <= Date.now() / 1000) {
          await this.refund(row, proof.intent, client);
          return false;
        }
        const receipt = createHash('sha256')
          .update(JSON.stringify([row.stripe_account, row.livemode, proof.intent, row.approval]))
          .digest('hex');
        await client.query(
          "UPDATE module_fee_orders SET state='paid',receipt=$1,expected_receipt=$2,starts=$3,expires=$4 WHERE id=$5",
          [receipt, plan.term?.receipt ?? zero, period.starts, period.expires, id],
        );
      }
      return true;
    });
    if (fulfill)
      await this.locked(id, async (row, client) => {
        if (
          !['paid', 'active', 'revoked'].includes(row.state) ||
          !row.receipt ||
          row.expires === null ||
          !row.expected_receipt
        )
          return;
        const state = await this.chain.moduleFeeState(row.approval.dao),
          plan = state.modules.find((m) => m.pricing.account === row.module_account);
        if (row.expires <= Date.now() / 1000) {
          if (row.state === 'paid' && plan?.term?.receipt !== row.receipt && row.payment_intent)
            await this.refund(row, row.payment_intent, client);
          else await client.query("UPDATE module_fee_orders SET state='expired' WHERE id=$1", [id]);
          return;
        }
        if (plan?.term?.receipt === row.receipt && plan.term.expires === row.expires) {
          if (plan.term.revoked)
            await this.chain.resumeModuleTerm(row.approval.dao, row.module_account, row.receipt);
        } else if (row.state === 'paid') {
          if (
            !plan ||
            !plan.installed ||
            plan.codeHash !== row.approval.codeHash ||
            state.activeMembers <= 10 ||
            plan.pricing.monthlyUsdCents === 0
          ) {
            if (row.payment_intent) await this.refund(row, row.payment_intent, client);
            return;
          }
          if ((plan.term?.receipt ?? zero) !== row.expected_receipt) {
            await client.query("UPDATE module_fee_orders SET state='review' WHERE id=$1", [id]);
            return;
          }
          await this.chain.attestModuleTerm(
            row.approval.dao,
            row.module_account,
            row.expected_receipt,
            row.expires,
            row.receipt,
          );
        } else return; // A later renewal supersedes this receipt; old disputes cannot change its access.
        await client.query("UPDATE module_fee_orders SET state='active' WHERE id=$1", [id]);
      });
    await this.pool.query(
      "UPDATE module_fee_orders SET next_check_at=now()+interval '5 minutes' WHERE id=$1",
      [id],
    );
  }
  private async refund(row: Order, intent: string, client: PoolClient) {
    const refund = await this.stripe.refunds.create(
      { payment_intent: intent },
      { idempotencyKey: 'daclify-module-refund:' + row.id, timeout: 15000 },
    );
    if (row.receipt)
      await this.chain.revokeModuleTerm(row.approval.dao, row.module_account, row.receipt);
    await client.query('UPDATE module_fee_orders SET state=$1 WHERE id=$2', [
      refund.status === 'succeeded' ? 'refunded' : 'refunding',
      row.id,
    ]);
  }
  async reconcileDue() {
    const due = await this.pool.query<{ id: string }>(
      "SELECT id FROM module_fee_orders WHERE stripe_account=$1 AND livemode=$2 AND state IN ('pending','paid','active','revoked','refunding') AND next_check_at<=now() ORDER BY next_check_at,id LIMIT 25",
      [this.config.accountId, this.config.livemode],
    );
    for (const row of due.rows) {
      try {
        await this.reconcile(row.id);
      } catch {
        await this.pool.query(
          "UPDATE module_fee_orders SET next_check_at=now()+interval '30 seconds' WHERE id=$1",
          [row.id],
        );
        console.error('MODULE_PAYMENT_RECONCILE_PENDING');
      }
    }
    return due.rowCount ? 'progress' : 'idle';
  }
}
