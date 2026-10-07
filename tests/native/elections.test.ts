import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { encodeDecide } from '@daclify/modules/sdk';
import { encodeAction } from '../../sdk/index.js';
import { researchDao } from '../helpers/native-research.js';
it('finalizes a native representative election, records a term and recalls it without assigning powers', async () => {
  const f = await researchDao(),
    { daoId, actor, act, gateway } = f,
    now = Math.floor(Date.now() / 1000);
  await act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 1,
      value: '{"rules":"Native representative fixture"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  await act(
    'decide',
    'newelect',
    encodeDecide('newelect', {
      ...actor(),
      election_id: daoId,
      title: 'Pilot representatives',
      document_id: '1',
      document_version: 1,
      nomination_close: now + 2,
      term_start: now + 120,
      term_end: now + 3600,
      seats: 1,
    }),
  );
  for (const member of ['2', '3'])
    await act(
      'decide',
      'nominate',
      encodeDecide('nominate', { ...actor(member), election_id: daoId, active: true }),
      member,
    );
  while (Math.floor(Date.now() / 1000) < now + 2)
    await new Promise((resolve) => setTimeout(resolve, 100));
  await act('decide', 'startelect', encodeDecide('startelect', { ...actor(), election_id: daoId }));
  for (const member of ['1', '2'])
    await act(
      'decide',
      'vote',
      encodeDecide('vote', { ...actor(member), ballot_id: daoId, choice: 1 }),
      member,
    );
  await expect(
    act(
      'decide',
      'vote',
      encodeDecide('vote', { ...actor('2'), ballot_id: daoId, choice: 2 }),
      '2',
    ),
  ).rejects.toThrow('ALREADY_VOTED');
  const closes = (await gateway.moduleState(daoId)).ballots.find((b) => b.id === daoId)?.closes;
  if (!closes) throw new Error('FIXTURE_BALLOT');
  while (Math.floor(Date.now() / 1000) <= closes)
    await new Promise((resolve) => setTimeout(resolve, 500));
  const result = await gateway.finalize({ dao: f.reference, ballotId: daoId });
  expect(result.state).toBe('finalized');
  const state = await gateway.moduleState(daoId),
    term = state.terms.find((t) => t.election_id === daoId);
  expect(term).toMatchObject({
    member_id: '2',
    starts: now + 120,
    ends: now + 3600,
    recalled: false,
  });
  if (!term) throw new Error('FIXTURE_TERM');
  await expect(
    act(
      'decide',
      'recall',
      encodeDecide('recall', {
        ...actor('2'),
        term_id: term.id,
        document_id: '1',
        document_version: 1,
      }),
      '2',
    ),
  ).rejects.toThrow('ADMIN_REQUIRED');
  await act(
    'decide',
    'recall',
    encodeDecide('recall', { ...actor(), term_id: term.id, document_id: '1', document_version: 1 }),
  );
  const recalled = (await gateway.moduleState(daoId)).terms.find((t) => t.id === term.id);
  expect(recalled?.recalled).toBe(true);
  expect((await gateway.table('members', daoId, '2', 1))[0]).toMatchObject({
    admin: false,
    reviewer: false,
    credits: '0',
  });
  await expect(gateway.execute({ dao: f.reference, ballotId: daoId })).rejects.toMatchObject({
    code: 'EXECUTION_UNKNOWN',
  });
  writeFileSync(
    '.artifacts/native/elections-evidence.json',
    JSON.stringify(
      {
        fixture: 'daclify-research-native',
        reference: f.reference,
        result,
        term: recalled,
        checks: [
          'self-nomination',
          'snapshot-one-member-one-vote',
          'native-finalization',
          'term-recall',
          'no-added-powers',
        ],
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
}, 100_000);
