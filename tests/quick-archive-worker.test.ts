import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { QuickBallotArchiveInputSchema } from '@daclify/modules/archive';
import { planQuickArchive } from '../services/api/src/quick-ballots/archive-worker.js';

function fixture() {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL('./fixtures/quick-ballots/archive-snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  const snapshot = QuickBallotArchiveInputSchema.omit({ kind: true, rows: true })
    .extend({
      responses: QuickBallotArchiveInputSchema.shape.rows,
      grants: QuickBallotArchiveInputSchema.shape.rows,
    })
    .parse(raw);
  const { responses, grants: _grants, ...base } = snapshot;
  return { ...base, kind: 'quick-ballot-responses' as const, rows: responses };
}
it('verifies the native frozen encrypted rows in an isolated planner', async () => {
  const result = await planQuickArchive(fixture());
  expect(result.blocked).toEqual([]);
  expect(result.families[0]?.chunks[0]?.rows).toHaveLength(2);
  expect(result.pruningAuthorized).toBe(false);
});
it('rejects a substituted native row instead of returning an archive plan', async () => {
  const input = fixture();
  const first = input.rows[0];
  if (!first) throw Error('FIXTURE');
  first.packed = 'ff' + first.packed.slice(2);
  await expect(planQuickArchive(input)).rejects.toThrow('QUICK_ARCHIVE_PLAN_INVALID');
});
it('terminates planning when the job loses its lease', async () => {
  const controller = new AbortController();
  const pending = planQuickArchive(fixture(), controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow('QUICK_ARCHIVE_CANCELLED');
});
