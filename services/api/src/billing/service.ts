import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { billingReturnUrls, type StripeConfig } from './config.js';
import {
  checkoutSessionParams,
  integrationIdentifier,
  randomIntegrationSuffix,
  requireCheckoutUrl,
} from './checkout.js';
import { decideStripeEvent } from './decision.js';
import { PostgresServicePayments, type ServiceReceipt } from './settle.js';
import { createStripeClient, readStripeEvent } from './stripe.js';

export class StripeBilling {
  private readonly stripe: ReturnType<typeof createStripeClient>;
  private readonly payments: PostgresServicePayments;

  constructor(
    pool: Pool,
    private readonly config: StripeConfig,
    private readonly origin: string,
  ) {
    this.stripe = createStripeClient(config.secretKey);
    this.payments = new PostgresServicePayments(pool);
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
    const decision = decideStripeEvent(event);
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
