import { expect, it } from 'vitest';
import { cardRamPrice, DEFAULT_RESOURCE_POLICY } from '../protocol/resources.js';
it('converts the complete native acquisition cost to USD and adds only the card markup', () => {
  expect(cardRamPrice(1000000n, '10000', 4, DEFAULT_RESOURCE_POLICY)).toEqual({
    base: 10000n,
    fee: 2000n,
    total: 12000n,
  });
  expect(cardRamPrice(1n, '12345', 4, DEFAULT_RESOURCE_POLICY)).toEqual({
    base: 1n,
    fee: 1n,
    total: 2n,
  });
  for (const args of [
    [0n, '1', 0],
    [1n, '0', 0],
    [1n, '1', 19],
    [1n, '1', -1],
  ] as const)
    expect(() => cardRamPrice(args[0], args[1], args[2], DEFAULT_RESOURCE_POLICY)).toThrow();
});
