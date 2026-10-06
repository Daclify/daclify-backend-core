import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { creationCardEvent } from '../services/api/src/billing/creation.js';
const accountId: string = randomUUID(),
  orderId: string = randomUUID();
function event() {
  return {
    type: 'checkout.session.completed',
    created: 100,
    data: {
      object: {
        id: 'cs_test_fixture',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'usd',
        amount_total: 2000,
        client_reference_id: accountId,
        metadata: { purpose: 'dao-creation', account_id: accountId, order_id: orderId },
      },
    },
  };
}
describe('DAO card event isolation', () => {
  it('extracts the verified session identifiers and captured amount', () => {
    expect(creationCardEvent(event())).toEqual({
      kind: 'paid',
      input: { accountId, orderId, checkoutId: 'cs_test_fixture', usdCents: 2000, paidAt: 100 },
    });
  });
  it('does not treat a hosted-service receipt as a creation payment', () => {
    const input = event();
    input.data.object.metadata.purpose = 'service';
    expect(creationCardEvent(input).kind).toBe('other');
  });
  it('rejects a different account, currency, negative amount and malformed order', () => {
    const inputs = [event(), event(), event(), event()];
    const [account, currency, amount, order] = inputs;
    if (!account || !currency || !amount || !order) throw new Error('Fixture');
    account.data.object.client_reference_id = randomUUID();
    currency.data.object.currency = 'eur';
    amount.data.object.amount_total = -1;
    order.data.object.metadata.order_id = 'guess';
    for (const input of inputs) expect(creationCardEvent(input).kind).toBe('invalid');
  });
  it('ignores unpaid, free and failed sessions', () => {
    for (const payment of ['unpaid', 'no_payment_required']) {
      const input = event();
      input.data.object.payment_status = payment;
      expect(creationCardEvent(input).kind).toBe('ignore');
    }
    const input = event();
    input.type = 'checkout.session.async_payment_failed';
    expect(creationCardEvent(input).kind).toBe('ignore');
  });
});
