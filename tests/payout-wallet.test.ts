import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ABI, Serializer } from '@wharfkit/antelope';
import { nativeTokenOpenAction } from '../sdk/index.js';
const chainId = 'ab'.repeat(32);
const token = { chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 };
const wallet = { chainId, account: 'bob', permission: 'active' as const };
it('encodes owner-funded preparation using the compiled reference token ABI', () => {
  const action = nativeTokenOpenAction(token, wallet, 'bob');
  const abi = ABI.from(
    JSON.parse(readFileSync('.artifacts/reference-token/reference.abi', 'utf8')),
  );
  expect(action.account.toString()).toBe('eosio.token');
  expect(action.name.toString()).toBe('open');
  expect(action.authorization.map((level) => level.toString())).toEqual(['bob@active']);
  expect(
    action.data.equals(
      Serializer.encode({
        abi,
        type: 'open',
        object: {
          owner: 'bob',
          symbol: '4,TLOS',
          ram_payer: 'bob',
        },
      }),
    ),
  ).toBe(true);
});
it('refuses another receiver, another chain, or invalid token precision', () => {
  expect(() => nativeTokenOpenAction(token, wallet, 'alice')).toThrow('PAYOUT_WALLET_REQUIRED');
  expect(() =>
    nativeTokenOpenAction(token, { ...wallet, chainId: 'cd'.repeat(32) }, 'bob'),
  ).toThrow('PAYOUT_WALLET_REQUIRED');
  expect(() => nativeTokenOpenAction({ ...token, precision: 19 }, wallet, 'bob')).toThrow();
});
