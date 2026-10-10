import { z } from 'zod';
import { verifiedNamePayment } from './name-payment.js';
import type { CreationService } from '../creation.js';
import { creationCardEvent } from './creation.js';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { billingReturnUrls, type StripeConfig } from './config.js';
import {
  checkoutSessionParams,
  integrationIdentifier,
  randomIntegrationSuffix,
  requireCheckoutUrl,
} from './checkout.js';
import {
  classifyStripeEvent,
  nameCheckoutIdentifier,
  nameCheckoutParams,
  nameReturnUrls,
  type NameFulfiller,
  type NamePurchase,
} from './name.js';
import { PostgresServicePayments, type ServiceReceipt } from './settle.js';
import { createStripeClient, readStripeEvent } from './stripe.js';

export class StripeBilling {
  private readonly stripe: ReturnType<typeof createStripeClient>;
  private readonly payments: PostgresServicePayments;

  constructor(
    pool: Pool,
    private readonly config: StripeConfig,
    private readonly origin: string,
    private readonly names?: NameFulfiller,
    private readonly creation?: CreationService,
  ) {
    this.stripe = createStripeClient(config.secretKey);
    this.payments = new PostgresServicePayments(pool);
  }

  async startCreationCheckout(input: {
    orderId: string;
    accountId: string;
    usdCents: number;
    expires: number;
  }): Promise<{ id: string; url: string }> {
    if (input.expires < Math.floor(Date.now() / 1000) + 1805)
      throw new Error('CREATION_CHECKOUT_EXPIRED');
    const path = '/create?order=' + encodeURIComponent(input.orderId);
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: input.accountId,
        success_url: new URL(path, this.origin).toString(),
        cancel_url: new URL(path, this.origin).toString(),
        expires_at: input.expires,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: input.usdCents,
              product_data: { name: 'Daclify shared DAO setup' },
            },
          },
        ],
        metadata: { purpose: 'dao-creation', account_id: input.accountId, order_id: input.orderId },
      },
      { idempotencyKey: 'dao-creation-' + input.orderId },
    );
    return { id: session.id, url: requireCheckoutUrl(session.url) };
  }
  async startNameCheckout(
    input: Omit<NamePurchase, 'reference' | 'netUsdCents'> & { accountId: string },
  ): Promise<{ url: string }> {
    const urls = nameReturnUrls(this.origin);
    const session = await this.stripe.checkout.sessions.create(
      nameCheckoutParams({
        accountId: input.accountId,
        accountName: input.accountName,
        ownerKey: input.ownerKey,
        activeKey: input.activeKey,
        usdCents: input.usdCents,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        integrationIdentifier: nameCheckoutIdentifier(),
      }),
    );
    return { url: requireCheckoutUrl(session.url) };
  }

  async startCheckout(accountId: string): Promise<{ url: string }> {
    const urls = billingReturnUrls(this.origin);
    const session = await this.stripe.checkout.sessions.create(
      checkoutSessionParams({
        priceId: this.config.priceId,
        accountId,
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        integrationIdentifier: integrationIdentifier(randomIntegrationSuffix()),
      }),
    );
    return { url: requireCheckoutUrl(session.url) };
  }

  async receiveWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const event = readStripeEvent(this.stripe, rawBody, signature, this.config.webhookSecret);
    const creation = creationCardEvent(event);
    if (creation.kind === 'invalid') throw new Error('SERVICE_EVENT_SHAPE');
    if (creation.kind === 'ignore') return;
    if (creation.kind === 'paid') {
      if (!this.creation) throw new Error('CREATION_UNCONFIGURED');
      await this.creation.recordCard(creation.input);
      return;
    }
    const decision = classifyStripeEvent(event);
    if (decision.kind === 'purchase') {
      if (!this.names) throw new Error('NAMES_UNCONFIGURED');
      const id = z
        .object({
          data: z.object({ object: z.object({ id: z.string().regex(/^cs_[A-Za-z0-9_]+$/) }) }),
        })
        .parse(event).data.object.id;
      const purchase = await verifiedNamePayment(
        {
          session: (id) => this.stripe.checkout.sessions.retrieve(id),
          intent: (id) =>
            this.stripe.paymentIntents.retrieve(id, {
              expand: ['latest_charge.balance_transaction'],
            }),
        },
        id,
        decision.purchase,
        this.config.secretKey.startsWith('sk_live_'),
      );
      await this.names.fulfillName(purchase);
      return;
    }
    if (decision.kind === 'invalid') throw new Error('SERVICE_EVENT_SHAPE');
    if (decision.kind === 'ignore' && decision.reason === 'SESSION_SHAPE') {
      throw new Error('SERVICE_EVENT_SHAPE');
    }
    if (decision.kind === 'ignore') return;
    await this.payments.settle(
      decision,
      this.config.priceId,
      createHash('sha256').update(rawBody).digest(),
    );
  }

  receipts(accountId: string): Promise<ServiceReceipt[]> {
    return this.payments.receipts(accountId);
  }
}
