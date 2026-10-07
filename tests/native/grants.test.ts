import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { encodeGrants, encodeDecide, encodeWorks } from '@daclify/modules/sdk';
import { encodeAction } from '../../sdk/index.js';
import { nativePush, researchDao } from '../helpers/native-research.js';
it('executes a voted native grant once and rolls back all state when a later milestone has insufficient backing', async () => {
  const f = await researchDao(true),
    { actor, act, daoId, gateway } = f,
    now = Math.floor(Date.now() / 1000),
    second = String(BigInt(daoId) + 1n);
  await act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 1,
      value: '{"rules":"Fixture funded grants"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  await act(
    'grants',
    'newround',
    encodeGrants('newround', {
      ...actor(),
      round_id: daoId,
      document_id: '1',
      document_version: 1,
      applications_close: now + 1200,
      review_close: now + 1800,
      awards_close: now + 3600,
      maximum: '20.0000 TLOS',
      allow_agents: false,
      works: 'works',
    }),
  );
  for (const [application, payments] of [
    [daoId, ['1.0000 TLOS']],
    [second, ['6.0000 TLOS', '6.0000 TLOS']],
  ] as const) {
    await act(
      'grants',
      'applygrant',
      encodeGrants('applygrant', {
        ...actor('2'),
        round_id: daoId,
        application_id: application,
        document_id: '1',
        document_version: 1,
        payments: [...payments],
        dues: payments.map(() => now),
        term_start: now - 60,
        term_end: now + 3600,
      }),
      '2',
    );
    await act(
      'grants',
      'submitapp',
      encodeGrants('submitapp', { ...actor('2'), application_id: application }),
      '2',
    );
    await act(
      'grants',
      'reviewapp',
      encodeGrants('reviewapp', {
        ...actor(),
        application_id: application,
        eligible: true,
        document_id: '1',
        document_version: 1,
      }),
    );
    await act(
      'decide',
      'openaward',
      encodeDecide('openaward', {
        ...actor(),
        ballot_id: application,
        grants: 'grants',
        round_id: daoId,
        application_id: application,
        project_id: application,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    for (const member of ['1', '2'])
      await act(
        'decide',
        'vote',
        encodeDecide('vote', { ...actor(member), ballot_id: application, choice: 1 }),
        member,
      );
  }
  const closing = Math.max(...(await gateway.moduleState(daoId)).ballots.map((b) => b.closes));
  while (Math.floor(Date.now() / 1000) <= closing)
    await new Promise((resolve) => setTimeout(resolve, 500));
  for (const ballot of [daoId, second])
    await gateway.finalize({ dao: f.reference, ballotId: ballot });
  const execution = await gateway.execute({ dao: f.reference, ballotId: daoId });
  expect(execution.state).toBe('executed');
  expect(await gateway.execute({ dao: f.reference, ballotId: daoId })).toEqual({
    state: 'already-executed',
  });
  const before = await gateway.dao(daoId);
  await expect(gateway.execute({ dao: f.reference, ballotId: second })).rejects.toMatchObject({
    code: 'INSUFFICIENT_AVAILABLE',
  });
  const state = await gateway.moduleState(daoId),
    after = await gateway.dao(daoId);
  expect([after.available, after.reserved, after.claims]).toEqual([
    before.available,
    before.reserved,
    before.claims,
  ]);
  expect(state.rounds.find((r) => r.id === daoId)?.awarded).toBe('10000');
  expect(state.applications.find((a) => a.id === second)?.status).toBe(2);
  expect(state.grantPlans.find((p) => p.ballot_id === second)?.executed).toBe(false);
  expect(state.projects.some((p) => p.id === second)).toBe(false);
  const milestone = state.milestones.find((m) => m.project_id === daoId);
  if (!milestone) throw new Error('FIXTURE_MILESTONE');
  await act(
    'works',
    'submitwork',
    encodeWorks('submitwork', {
      ...actor('2'),
      milestone_id: milestone.id,
      document_id: '1',
      document_version: 1,
    }),
    '2',
  );
  await act(
    'works',
    'review',
    encodeWorks('review', {
      ...actor(),
      milestone_id: milestone.id,
      approve: true,
      document_id: '1',
      document_version: 1,
    }),
  );
  const payment = await nativePush(
    'works',
    'settle',
    encodeWorks('settle', { runtime: 'daclifycore', dao_id: daoId, milestone_id: milestone.id }),
    'relay',
  );
  await expect(
    nativePush(
      'works',
      'settle',
      encodeWorks('settle', { runtime: 'daclifycore', dao_id: daoId, milestone_id: milestone.id }),
      'relay',
    ),
  ).rejects.toThrow('NOT_PAYABLE');
  expect((await gateway.treasury(daoId)).receipts[0]?.transaction_id).toBe(
    payment.transaction_id.toString(),
  );
  writeFileSync(
    '.artifacts/native/grants-evidence.json',
    JSON.stringify(
      {
        fixture: 'daclify-research-native',
        reference: f.reference,
        execution,
        payment: payment.transaction_id.toString(),
        checks: [
          'native-approved-award',
          'full-reservation',
          'insufficient-backing-rollback',
          'same-Works-settlement',
          'actual-receipt-id',
        ],
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
}, 100_000);
