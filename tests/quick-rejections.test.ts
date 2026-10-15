import { expect, it } from 'vitest';
import { APIError } from '@wharfkit/antelope';
import { quickSubmissionRejection } from '../services/api/src/quick-ballots/rejections.js';
function rejection(message: string, code = 3050003) {
  return new APIError('/v1/chain/push_transaction', {
    status: 500,
    text: '',
    headers: {},
    json: {
      error: {
        code,
        name: 'eosio_assert_message_exception',
        what: 'assertion failure',
        details: [{ message }],
      },
    },
  });
}
it('returns only known exact native assertion codes and never leaks RPC details', () => {
  expect(
    quickSubmissionRejection(rejection('assertion failure with message: QUICK_REVISION'))?.code,
  ).toBe('QUICK_REVISION');
  expect(quickSubmissionRejection(rejection('QUICK_CLOSED'))?.code).toBe('QUICK_CLOSED');
  expect(quickSubmissionRejection(rejection('secret diagnostic QUICK_REVISION'))).toBeNull();
  expect(quickSubmissionRejection(rejection('PRIVATE_INTERNAL_CODE'))).toBeNull();
  expect(quickSubmissionRejection(rejection('QUICK_REVISION', 3080006))).toBeNull();
  expect(quickSubmissionRejection(Error('QUICK_REVISION'))).toBeNull();
});
