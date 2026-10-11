import { expect, it } from 'vitest';
import {
  ModuleFeePriceSchema,
  ModuleFeeApprovalSchema,
  moduleFeePricingHash,
  type ModuleFeePrice,
} from '../protocol/module-fees.js';
import { moduleMonth } from '../services/api/src/billing/module-fee-period.js';
const price: ModuleFeePrice = {
  account: 'decide',
  revision: '1',
  monthlyUsdCents: 200,
  actions: ['open', 'newelect'],
};
it('binds approval to its module, amount, revision and new-activity policy and rejects unsupported fee actions', () => {
  const digest = moduleFeePricingHash(price);
  expect(digest).toMatch(/^[a-f0-9]{64}$/);
  for (const change of [
    { account: 'works' },
    { revision: '2' },
    { monthlyUsdCents: 300 },
    { actions: ['open'] },
  ])
    expect(moduleFeePricingHash(ModuleFeePriceSchema.parse({ ...price, ...change }))).not.toBe(
      digest,
    );
  expect(ModuleFeePriceSchema.safeParse({ ...price, monthlyUsdCents: 0 }).success).toBe(true);
  for (const change of [
    { monthlyUsdCents: 49 },
    { monthlyUsdCents: 1.5 },
    { monthlyUsdCents: 100000000 },
    { actions: ['vote'] },
    { actions: ['open', 'open'] },
    { actions: [] },
    { revision: '01' },
  ])
    expect(ModuleFeePriceSchema.safeParse({ ...price, ...change }).success).toBe(false);
  const approval = {
    schemaVersion: 1,
    requestId: 'dc6d31b5-514b-4cf3-839d-0b61c99a3759',
    dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '2', interfaceVersion: 1 },
    account: 'decide',
    pricingHash: digest,
    monthlyUsdCents: 200,
    codeHash: 'cd'.repeat(32),
  };
  expect(ModuleFeeApprovalSchema.parse(approval).monthlyUsdCents).toBe(200);
  expect(ModuleFeeApprovalSchema.safeParse({ ...approval, monthlyUsdCents: 0 }).success).toBe(
    false,
  );
});
it.each([
  ['2026-01-31T12:30:00Z', null, '2026-01-31T12:30:00.000Z', '2026-02-28T12:30:00.000Z'],
  ['2028-01-31T12:30:00Z', null, '2028-01-31T12:30:00.000Z', '2028-02-29T12:30:00.000Z'],
  [
    '2026-10-11T12:30:00Z',
    '2026-10-15T12:30:00Z',
    '2026-10-15T12:30:00.000Z',
    '2026-11-15T12:30:00.000Z',
  ],
  [
    '2026-10-11T12:30:00Z',
    '2026-10-10T12:30:00Z',
    '2026-10-11T12:30:00.000Z',
    '2026-11-11T12:30:00.000Z',
  ],
])(
  'buys one UTC calendar month without losing an existing paid period: %s',
  (paid, prior, start, end) => {
    const actual = moduleMonth(
      Math.floor(Date.parse(paid) / 1000),
      prior === null ? null : Math.floor(Date.parse(prior) / 1000),
    );
    expect(actual).toEqual({
      starts: Math.floor(Date.parse(start) / 1000),
      expires: Math.floor(Date.parse(end) / 1000),
    });
  },
);
it('bounds early renewal and uint32 native time rather than granting unbounded prepaid access', () => {
  const now = Date.parse('2026-10-11T12:00:00Z') / 1000;
  expect(() => moduleMonth(now, now + 7 * 86400 + 1)).toThrow('MODULE_RENEWAL_EARLY');
  expect(() => moduleMonth(4294967295, null)).toThrow('MODULE_TERM_RANGE');
  for (const value of [-1, 1.5, Infinity]) expect(() => moduleMonth(value, null)).toThrow();
});
