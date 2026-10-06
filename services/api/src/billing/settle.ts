import type { Pool, PoolClient } from 'pg';
import type { ServiceDecision } from './decision.js';

export interface ServiceReceipt {
  status: 'paid' | 'failed';
  currency: string | null;
  amountMinor: number | null;
  paymentStatus: string;
}

interface StoredPayment {
  checkoutId: string;
  accountId: string;
  priceId: string;
  currency: string | null;
  amountMinor: number | null;
  status: 'paid' | 'failed';
  paymentStatus: string;
}

interface ServicePaymentStore {
  claimEvent(eventId: string, payloadHash: Buffer): Promise<boolean>;
  hasAccount(accountId: string): Promise<boolean>;
  read(checkoutId: string): Promise<StoredPayment | undefined>;
  write(payment: StoredPayment): Promise<void>;
  receipts(accountId: string): Promise<ServiceReceipt[]>;
}

export type ServiceOutcome = 'paid' | 'failed' | 'unchanged' | 'duplicate' | 'ignored';

export async function settleServicePayment(
  store: ServicePaymentStore,
  decision: ServiceDecision,
  priceId: string,
  payloadHash: Buffer,
): Promise<{ outcome: ServiceOutcome }> {
  if (decision.kind === 'ignore') return { outcome: 'ignored' };
  const fresh = await store.claimEvent(decision.eventId, payloadHash);
  if (!fresh) return { outcome: 'duplicate' };
  if (decision.priceId !== priceId) return { outcome: 'ignored' };
  if (!(await store.hasAccount(decision.accountId))) return { outcome: 'ignored' };
  const existing = await store.read(decision.checkoutId);
  if (decision.kind === 'fail') {
    if (existing?.status === 'paid') return { outcome: 'unchanged' };
    await store.write({
      checkoutId: decision.checkoutId,
      accountId: decision.accountId,
      priceId: decision.priceId,
      currency: null,
      amountMinor: null,
      status: 'failed',
      paymentStatus: 'failed',
    });
    return { outcome: 'failed' };
  }
  await store.write({
    checkoutId: decision.checkoutId,
    accountId: decision.accountId,
    priceId: decision.priceId,
    currency: decision.currency,
    amountMinor: decision.amountMinor,
    status: 'paid',
    paymentStatus: decision.paymentStatus,
  });
  return { outcome: 'paid' };
}

export class MemoryServicePayments implements ServicePaymentStore {
  private readonly events = new Set<string>();
  private readonly payments = new Map<string, StoredPayment>();

  constructor(private readonly accounts: readonly string[]) {}

  async claimEvent(eventId: string): Promise<boolean> {
    if (this.events.has(eventId)) return false;
    this.events.add(eventId);
    return true;
  }

  async hasAccount(accountId: string): Promise<boolean> {
    return this.accounts.includes(accountId);
  }

  async read(checkoutId: string): Promise<StoredPayment | undefined> {
    return this.payments.get(checkoutId);
  }

  async write(payment: StoredPayment): Promise<void> {
    const existing = this.payments.get(payment.checkoutId);
    if (existing?.status === 'paid') return;
    if (existing && existing.accountId !== payment.accountId) return;
    this.payments.set(payment.checkoutId, payment);
  }

  async receipts(accountId: string): Promise<ServiceReceipt[]> {
    return [...this.payments.values()]
      .filter((payment) => payment.accountId === accountId)
      .map((payment) => ({
        status: payment.status,
        currency: payment.currency,
        amountMinor: payment.amountMinor,
        paymentStatus: payment.paymentStatus,
      }));
  }
}

export class PostgresServicePayments {
  constructor(private readonly pool: Pool) {}

  async settle(
    decision: ServiceDecision,
    priceId: string,
    payloadHash: Buffer,
  ): Promise<{ outcome: ServiceOutcome }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const outcome = await settleServicePayment(
        new PostgresTransaction(client),
        decision,
        priceId,
        payloadHash,
      );
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async receipts(accountId: string): Promise<ServiceReceipt[]> {
    const result = await this.pool.query<{
      status: 'paid' | 'failed';
      currency: string | null;
      amount_minor: string | null;
      payment_status: string;
    }>(
      `SELECT status, currency, amount_minor::text, payment_status
       FROM service_payments WHERE account_id=$1 ORDER BY updated_at DESC`,
      [accountId],
    );
    return result.rows.map((row) => ({
      status: row.status,
      currency: row.currency,
      amountMinor: minorUnits(row.amount_minor),
      paymentStatus: row.payment_status,
    }));
  }
}

class PostgresTransaction implements ServicePaymentStore {
  constructor(private readonly client: PoolClient) {}

  async claimEvent(eventId: string, payloadHash: Buffer): Promise<boolean> {
    const result = await this.client.query(
      `INSERT INTO billing_events(provider, event_id, payload_hash)
       VALUES('stripe',$1,$2)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, payloadHash],
    );
    return result.rows.length === 1;
  }

  async hasAccount(accountId: string): Promise<boolean> {
    const result = await this.client.query('SELECT 1 FROM accounts WHERE id=$1', [accountId]);
    return result.rows.length === 1;
  }

  async read(checkoutId: string): Promise<StoredPayment | undefined> {
    const result = await this.client.query<{
      checkout_id: string;
      account_id: string;
      price_id: string;
      currency: string | null;
      amount_minor: string | null;
      status: 'paid' | 'failed';
      payment_status: string;
    }>(
      `SELECT checkout_id, account_id::text, price_id, currency, amount_minor::text, status, payment_status
       FROM service_payments WHERE checkout_id=$1`,
      [checkoutId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      checkoutId: row.checkout_id,
      accountId: row.account_id,
      priceId: row.price_id,
      currency: row.currency,
      amountMinor: minorUnits(row.amount_minor),
      status: row.status,
      paymentStatus: row.payment_status,
    };
  }

  async write(payment: StoredPayment): Promise<void> {
    await this.client.query(
      `INSERT INTO service_payments(checkout_id, account_id, price_id, currency, amount_minor, status, payment_status)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (checkout_id) DO UPDATE SET
         status=EXCLUDED.status,
         payment_status=EXCLUDED.payment_status,
         currency=EXCLUDED.currency,
         amount_minor=EXCLUDED.amount_minor,
         price_id=EXCLUDED.price_id,
         updated_at=now()
       WHERE service_payments.status<>'paid' AND service_payments.account_id=EXCLUDED.account_id`,
      [
        payment.checkoutId,
        payment.accountId,
        payment.priceId,
        payment.currency,
        payment.amountMinor,
        payment.status,
        payment.paymentStatus,
      ],
    );
  }

  async receipts(): Promise<ServiceReceipt[]> {
    throw new Error('SERVICE_PAYMENT_TRANSACTION');
  }
}

function minorUnits(value: string | null): number | null {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new Error('SERVICE_AMOUNT');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('SERVICE_AMOUNT');
  return amount;
}
