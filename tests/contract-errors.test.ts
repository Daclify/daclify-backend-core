import { expect, it } from 'vitest';
import { APIError } from '@wharfkit/antelope';
import { contractError } from '../services/api/src/errors.js';
function rejection(message: string) {
  return new APIError('/v1/chain/push_transaction', {
    status: 500,
    text: '',
    headers: {},
    json: {
      error: {
        code: 3050003,
        name: 'eosio_assert_message_exception',
        what: 'assertion failure',
        details: [{ message, file: 'contract.cpp', line_number: 1, method: 'apply' }],
      },
    },
  });
}
it('returns only allowlisted contract codes and redacts all other chain details', () => {
  for (const code of [
    'GOVERNANCE_LOCKED',
    'POLICY_CHANGED',
    'DAO_PAUSED',
    'SELF_REVIEW',
    'MODULE_ACTION',
  ])
    expect(contractError(rejection('assertion failure with message: ' + code)).code).toBe(code);
  expect(contractError(rejection('secret=fixture-private-value')).code).toBe(
    'CHAIN_ACTION_REJECTED',
  );
  expect(contractError(new Error('SELF_REVIEW internal database secret')).message).toBe(
    'CHAIN_ACTION_REJECTED',
  );
});
