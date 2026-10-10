import { describe, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { eurCardFee } from '../services/api/src/market/eur-reference.js';
import { verifiedNamePayment } from '../services/api/src/billing/name-payment.js';
import { nameReference } from '../services/api/src/billing/name.js';
const key = PrivateKey.generate('K1').toPublic().toString();
const purchase = {
  accountName: 'dacux1111111',
  ownerKey: key,
  activeKey: key,
  usdCents: 142,
  reference: nameReference('cs_test_margin'),
};
function proof() {
  return {
    session: {
      id: 'cs_test_margin',
      mode: 'payment',
      status: 'complete',
      payment_status: 'paid',
      currency: 'usd',
      amount_total: 142,
      livemode: false,
      payment_intent: 'pi_margin',
      client_reference_id: '00000000-0000-4000-8000-000000000001',
      metadata: {
        purpose: 'name',
        account_id: '00000000-0000-4000-8000-000000000001',
        account_name: purchase.accountName,
        owner_key: key,
        active_key: key,
        usd_cents: '142',
      },
    },
    intent: {
      id: 'pi_margin',
      livemode: false,
      currency: 'usd',
      status: 'succeeded',
      amount: 142,
      amount_received: 142,
      latest_charge: {
        id: 'ch_margin',
        payment_intent: 'pi_margin',
        livemode: false,
        currency: 'usd',
        amount: 142,
        paid: true,
        captured: true,
        refunded: false,
        amount_refunded: 0,
        disputed: false,
        balance_transaction: {
          id: 'txn_margin',
          source: 'ch_margin',
          currency: 'eur',
          amount: 127,
          fee: 33,
          net: 94,
          exchange_rate: 0.894,
        },
      },
    },
  };
}
describe('Names fee evidence', () => {
  it('converts the fixed €0.25 allowance upward and allows a weekend reference', () => {
    expect(
      eurCardFee(
        "<Envelope><Cube time='2026-10-09'><Cube currency='USD' rate='1.1206'/></Cube></Envelope>",
        new Date('2026-10-10T12:00:00Z'),
      ),
    ).toEqual({ fixedUsdCents: 29, observedAt: 1791504000 });
  });
  it.each([
    "<Cube time='2026-09-01'><Cube currency='USD' rate='1.12'/></Cube>",
    "<Cube time='2026-10-11'><Cube currency='USD' rate='1.12'/></Cube>",
    "<Cube time='2026-10-09'><Cube currency='USD' rate='NaN'/></Cube>",
    "<!DOCTYPE foo><Cube time='2026-10-09'><Cube currency='USD' rate='1.12'/></Cube>",
  ])('rejects untrusted/stale fee input %#', (xml) =>
    expect(() => eurCardFee(xml, new Date('2026-10-10T12:00:00Z'))).toThrow(),
  );
  it('uses actual EUR fees with conservative conversion rather than quoted fees', async () => {
    const data = proof();
    const result = await verifiedNamePayment(
      { session: async () => data.session, intent: async () => data.intent },
      'cs_test_margin',
      purchase,
      false,
    );
    expect(result.netUsdCents).toBe(105);
  });
  it('uses actual USD net proceeds without conversion', async () => {
    const data = proof();
    data.intent.latest_charge.balance_transaction = {
      id: 'txn_margin',
      source: 'ch_margin',
      currency: 'usd',
      amount: 142,
      fee: 32,
      net: 110,
      exchange_rate: 1,
    };
    expect(
      (
        await verifiedNamePayment(
          { session: async () => data.session, intent: async () => data.intent },
          'cs_test_margin',
          purchase,
          false,
        )
      ).netUsdCents,
    ).toBe(110);
  });
  it('retries pending fee evidence', async () => {
    const data = proof();
    const intent = {
      ...data.intent,
      latest_charge: { ...data.intent.latest_charge, balance_transaction: null },
    };
    await expect(
      verifiedNamePayment(
        { session: async () => data.session, intent: async () => intent },
        'cs_test_margin',
        purchase,
        false,
      ),
    ).rejects.toThrow('NAME_FEE_PENDING');
  });
  it.each([
    'refund',
    'dispute',
    'source',
    'net',
    'amount',
    'currency',
    'mode',
    'metadata',
    'conversion',
  ])('rejects inconsistent receipt %s', async (failure) => {
    const data = proof();
    const charge = data.intent.latest_charge;
    if (failure === 'refund') charge.amount_refunded = 1;
    if (failure === 'dispute') charge.disputed = true;
    if (failure === 'source') charge.balance_transaction.source = 'ch_other';
    if (failure === 'net') charge.balance_transaction.net = 100;
    if (failure === 'amount') charge.amount = 143;
    if (failure === 'currency') charge.balance_transaction.currency = 'gbp';
    if (failure === 'mode') data.session.livemode = true;
    if (failure === 'metadata') data.session.metadata.account_name = 'dacux2222222';
    if (failure === 'conversion') charge.balance_transaction.exchange_rate = 0.1;
    await expect(
      verifiedNamePayment(
        { session: async () => data.session, intent: async () => data.intent },
        'cs_test_margin',
        purchase,
        false,
      ),
    ).rejects.toThrow('NAME_RECEIPT_INVALID');
  });
});
