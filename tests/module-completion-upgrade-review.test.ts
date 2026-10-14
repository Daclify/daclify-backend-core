import { expect, it } from 'vitest';
import { DecideTableSchemas } from '@daclify/modules/sdk';
import { RuntimeTableSchemas } from '../sdk/generated/schemas.js';
import {
  completionActions,
  reviewLegacyBallots,
} from '../tools/deploy/module-completion-review.js';
const ballot = DecideTableSchemas.ballots.parse({
  id: '1',
  dao_id: '1',
  creator: '1',
  kind: 0,
  choices: 2,
  closes: 1000,
  quorum: 5000,
  approval: 5001,
  denominator: '2',
  max_member: '2',
  metadata: '{"schemaVersion":1,"title":"test1","options":["Reject","Approve"]}',
  cast: '0',
  tallies: ['0', '0'],
  status: 0,
  winner: 0,
});
const dao = RuntimeTableSchemas.daos.parse({
  id: '1',
  owner: 'alice',
  metadata: '{}',
  privacy: 0,
  token_contract: 'eosio.token',
  token_symbol: '4,TLOS',
  available: '0',
  reserved: '0',
  claims: '0',
  staked: '0',
  credit_supply: '0',
  member_count: '2',
  max_member: '2',
  active_ballots: 1,
  eligible_credits: '0',
  eligible_stake: '0',
  admin_count: 1,
  key_epoch: '0',
  history_policy: 0,
});
it('accepts the qualified ordinary ballot while rejecting changed semantics and unexplained governance locks', () => {
  expect(() => reviewLegacyBallots([ballot], [dao])).not.toThrow();
  expect(() =>
    reviewLegacyBallots(
      [
        {
          ...ballot,
          metadata: '{"schemaVersion":3,"semantics":"poll","title":"Changed","options":["A","B"]}',
        },
      ],
      [dao],
    ),
  ).toThrow();
  expect(() => reviewLegacyBallots([], [dao])).toThrow('PENDING_VOTE_REQUIRES_REVIEW');
  expect(() => reviewLegacyBallots([{ ...ballot, status: 3 }], [dao])).toThrow(
    'PENDING_MODULE_STATE_REQUIRES_REVIEW',
  );
});
it('preserves custom selected actions and adds only their corresponding new path once', () => {
  expect(completionActions('decide', ['vote'])).toEqual(['vote', 'votecommit']);
  expect(completionActions('decide', ['vote', 'votecommit'])).toEqual(['vote', 'votecommit']);
  expect(completionActions('works', ['submitwork'])).toEqual(['submitwork']);
  expect(completionActions('payroll', ['commit'])).toEqual(['commit', 'commitdoc']);
  expect(completionActions('grants', ['applygrant', 'amendapp', 'submitapp'])).toEqual([
    'applygrant',
    'amendapp',
    'submitapp',
    'submitprot',
    'offerprot',
  ]);
  expect(() =>
    completionActions('decide', ['vote', ...Array.from({ length: 15 }, (_, i) => 'action' + i)]),
  ).toThrow('MODULE_ACTION_BOUNDS');
});
