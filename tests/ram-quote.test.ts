import { expect, it } from 'vitest';
import { ABI, Serializer } from '@wharfkit/antelope';
import { RamQuoteSchema, RamQuoteRequestSchema } from '../protocol/resources.js';
import { nativeRamActions, runtimeAbi } from '../sdk/index.js';
const quote = RamQuoteSchema.parse({
  dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  rail: 'tlos',
  baseUnits: '100',
  feeUnits: '5',
  totalUnits: '105',
  feeBps: 500,
  order: {
    dao_id: '1',
    payer: 'alice',
    reference: 'cd'.repeat(32),
    policy_revision: '1',
    maximum: '0.0105 TLOS',
    expires: Math.floor(Date.parse('2026-10-08T12:00:00.000Z') / 1000) + 300,
    purchases: [{ receiver: 'daclifycore', quantity: '0.0100 TLOS', minimum_bytes: '1024' }],
  },
  systemCodeHash: 'ef'.repeat(32),
  systemRawAbiHash: 'fe'.repeat(32),
  quotedAt: '2026-10-08T12:00:00.000Z',
});
it('binds disclosed fee, exact native ceiling, DAO and acquired byte minimum', () => {
  for (const changed of [
    { ...quote, feeUnits: '6' },
    { ...quote, totalUnits: '106' },
    { ...quote, rail: 'card' },
    { ...quote, order: { ...quote.order, maximum: '0.0106 TLOS' } },
    { ...quote, order: { ...quote.order, dao_id: '2' } },
    {
      ...quote,
      order: {
        ...quote.order,
        purchases: [{ receiver: 'daclifycore', quantity: '0.0099 TLOS', minimum_bytes: '1024' }],
      },
    },
    {
      ...quote,
      order: {
        ...quote.order,
        purchases: [{ receiver: 'daclifycore', quantity: '0.0100 TLOS', minimum_bytes: '0' }],
      },
    },
  ])
    expect(RamQuoteSchema.safeParse(changed).success).toBe(false);
  expect(
    RamQuoteRequestSchema.safeParse({
      dao: quote.dao,
      payer: 'alice',
      allocations: [
        { receiver: 'decide', minimumBytes: '1' },
        { receiver: 'decide', minimumBytes: '2' },
      ],
    }).success,
  ).toBe(false);
});
it('builds one atomic order-and-payment transaction authorized only by its native payer', () => {
  const actions = nativeRamActions(quote);
  expect(actions.map((a) => [a.account.toString(), a.name.toString()])).toEqual([
    ['daclifycore', 'orderram'],
    ['eosio.token', 'transfer'],
  ]);
  expect(
    actions.every(
      (a) =>
        a.authorization.length === 1 &&
        a.authorization[0]?.actor.toString() === 'alice' &&
        a.authorization[0].permission.toString() === 'active',
    ),
  ).toBe(true);
  const order = actions[0];
  if (!order) throw new Error('ORDER_ACTION_REQUIRED');
  expect(
    JSON.parse(
      JSON.stringify(
        Serializer.decode({ abi: ABI.from(runtimeAbi), type: 'orderram', data: order.data }),
      ),
    ),
  ).toEqual({
    ...quote.order,
    dao_id: 1,
    policy_revision: 1,
    purchases: [{ receiver: 'daclifycore', quantity: '0.0100 TLOS', minimum_bytes: 1024 }],
  });
});
