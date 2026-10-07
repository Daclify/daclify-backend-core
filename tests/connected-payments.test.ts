import { describe, expect, it } from 'vitest';
import {
  PaymentPolicySchema,
  PaymentProductInputSchema,
  PublicEndpointSchema,
  paymentFee,
  daoPaymentKey,
} from '../protocol/payments.js';
describe('canonical DAO payment boundaries', () => {
  it('uses exact integer cents and rounds a five percent commission down', () => {
    expect(paymentFee(10000, 500)).toBe(500);
    expect(paymentFee(1999, 500)).toBe(99);
    expect(paymentFee(100, 0)).toBe(0);
    for (const value of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER])
      expect(() => paymentFee(value, 500)).toThrow();
    expect(() => paymentFee(100, 10000)).toThrow();
  });
  it('defaults to five percent and distinguishes full DAO identities', () => {
    expect(PaymentPolicySchema.parse({ revision: '0' }).basisPoints).toBe(500);
    const dao = {
      chainId: 'ab'.repeat(32),
      contract: 'daoone',
      daoId: '1',
      interfaceVersion: 1 as const,
    };
    expect(daoPaymentKey(dao)).not.toBe(daoPaymentKey({ ...dao, contract: 'daotwo' }));
  });
  it('rejects forged commission and unsafe registry endpoints', () => {
    expect(
      PaymentProductInputSchema.safeParse({
        dao: { chainId: 'ab'.repeat(32), contract: 'daoone', daoId: '1', interfaceVersion: 1 },
        id: crypto.randomUUID(),
        moduleId: 'works',
        title: 'Support work',
        amountMinor: 1000,
        feeBps: 0,
      }).success,
    ).toBe(false);
    for (const value of [
      'http://dao.example',
      'https://user:secret@dao.example',
      'https://127.0.0.1',
      'https://localhost',
      'https://dao.example/?token=secret',
      'javascript:alert(1)',
    ])
      expect(PublicEndpointSchema.safeParse(value).success).toBe(false);
    expect(PublicEndpointSchema.parse('https://api.dao.example')).toBe('https://api.dao.example');
  });
});
