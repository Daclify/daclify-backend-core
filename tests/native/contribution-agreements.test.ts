import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { encodeWorks } from '@daclify/modules/sdk';
import { encodeAction } from '../../sdk/index.js';
import { spendingReport } from '../../services/api/src/reporting/spending.js';
import { nativePush, researchDao } from '../helpers/native-research.js';
it('enforces contributor consent and preserves approved claims/atomic native receipts after cancellation and offboarding', async () => {
  const fixture = await researchDao(),
    { act, actor, daoId, gateway } = fixture,
    id = daoId;
  const now = Math.floor(Date.now() / 1000);
  await act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 1,
      value: '{"scope":"Research delivery and report"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  await act(
    'works',
    'propose',
    encodeWorks('propose', {
      ...actor(),
      project_id: id,
      contributor: '2',
      document_id: '1',
      document_version: 1,
      payments: ['1.0000 TLOS', '2.0000 TLOS'],
      dues: [now - 1, now - 1],
    }),
  );
  await act(
    'works',
    'offeragr',
    encodeWorks('offeragr', {
      ...actor(),
      project_id: id,
      term_start: now - 60,
      term_end: now + 3600,
    }),
  );
  await expect(
    act('works', 'accept', encodeWorks('accept', { ...actor(), project_id: id })),
  ).rejects.toThrow('AGREEMENT_CONSENT');
  await expect(
    act('works', 'acceptagr', encodeWorks('acceptagr', { ...actor(), project_id: id })),
  ).rejects.toThrow('CONTRIBUTOR_REQUIRED');
  await act('works', 'acceptagr', encodeWorks('acceptagr', { ...actor('2'), project_id: id }), '2');
  await act('works', 'accept', encodeWorks('accept', { ...actor(), project_id: id }));
  const state = await gateway.moduleState(daoId),
    project = state.projects.find((p) => p.id === id),
    milestone = state.milestones.find((m) => m.project_id === id);
  expect(state.agreements.find((a) => a.project_id === id)?.accepted).toBe(true);
  if (!project || !milestone) throw new Error('FIXTURE_PROJECT');
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
  await act('works', 'cancel', encodeWorks('cancel', { ...actor(), project_id: id }));
  const settlement = await nativePush(
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
  let records = await gateway.treasury(daoId);
  expect(records.receipts[0]?.transaction_id).toBe(settlement.transaction_id.toString());
  expect(records.receipts[0]?.kind).toBe(0);
  await act(
    'daclifycore',
    'setactive',
    encodeAction('setactive', { ...actor(), target: '2', active: false }),
  );
  const withdrawal = await act(
    'daclifycore',
    'withdraw',
    encodeAction('withdraw', { ...actor('2'), destination: 'bob', quantity: '1.0000 TLOS' }),
    '2',
  );
  records = await gateway.treasury(daoId);
  expect(records.receipts[1]?.kind).toBe(2);
  expect(records.receipts[1]?.transaction_id).toBe(withdrawal.transaction_id.toString());
  const report = await spendingReport(gateway, daoId);
  expect(report.complete).toBe(true);
  expect(report.summary).toMatchObject({
    reserved: '0',
    claims: '0',
    settledObligations: '10000',
    externalCashflow: '10000',
  });
  expect(report.obligations[0]?.agreementTerms).toBeTruthy();
  writeFileSync(
    '.artifacts/native/agreements-evidence.json',
    JSON.stringify(
      {
        fixture: 'daclify-research-native',
        reference: fixture.reference,
        settlement: records.receipts[0]?.transaction_id,
        withdrawal: records.receipts[1]?.transaction_id,
        checks: [
          'contributor-consent',
          'approved-liability-preserved',
          'inactive-claim-exit',
          'once-only-settlement',
          'receipt-transaction-id',
          'report-reconciliation',
        ],
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
}, 30_000);
