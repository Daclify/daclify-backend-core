import assert from 'node:assert/strict';
import { z } from 'zod';
import { DecideTableSchemas } from '@daclify/modules/sdk';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';

// Only ordinary legacy voting was qualified with the currently deployed binaries.
export function reviewLegacyBallots(
  ballots: z.infer<typeof DecideTableSchemas.ballots>[],
  daos: z.infer<typeof RuntimeTableSchemas.daos>[],
) {
  for (const ballot of ballots) {
    assert.ok([0, 1, 2].includes(ballot.status), 'PENDING_MODULE_STATE_REQUIRES_REVIEW');
    if (ballot.status !== 0) continue;
    const metadata = z
      .object({
        schemaVersion: z.literal(1),
        title: z.string(),
        options: z.array(z.string()).min(2).max(16),
      })
      .parse(JSON.parse(ballot.metadata));
    assert.equal(ballot.choices, metadata.options.length, 'LEGACY_BALLOT_OPTIONS');
    assert.ok(
      daos.some((dao) => dao.id === ballot.dao_id),
      'BALLOT_DAO_UNKNOWN',
    );
  }
  for (const dao of daos)
    assert.equal(
      BigInt(dao.active_ballots),
      BigInt(ballots.filter((ballot) => ballot.dao_id === dao.id && ballot.status === 0).length),
      'PENDING_VOTE_REQUIRES_REVIEW',
    );
}

// Add the new approval paths only when the DAO already permitted their predecessor.
export function completionActions(contract: string, actions: readonly string[]) {
  const additions =
    contract === 'decide'
      ? [
          ['open', 'openpoll'],
          ['vote', 'votecommit'],
        ]
      : contract === 'works'
        ? [
            ['offeragr', 'offerprot'],
            ['acceptagr', 'acceptprot'],
          ]
        : contract === 'payroll'
          ? [['commit', 'commitdoc']]
          : contract === 'grants'
            ? [
                ['submitapp', 'submitprot'],
                ['applygrant', 'offerprot'],
                ['amendapp', 'offerprot'],
              ]
            : [];
  const result = [...actions];
  for (const [before, after] of additions)
    if (before && after && actions.includes(before) && !result.includes(after)) result.push(after);
  assert.ok(result.length <= 16, 'MODULE_ACTION_BOUNDS');
  return result;
}
