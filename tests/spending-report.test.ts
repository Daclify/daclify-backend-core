import { expect, it } from 'vitest';
import { DaoSummarySchema } from '../protocol/api.js';
import { TreasurySchema } from '../protocol/treasury.js';
import { DaoContentSchema } from '../protocol/content.js';
import { ModuleStateSchema } from '@daclify/modules';
import { buildSpendingReport, spendingCsv } from '../services/api/src/reporting/spending.js';
const reference = {
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
};
const dao = DaoSummarySchema.parse({
  reference,
  title: 'Private narrative never exported',
  description: 'Secret-looking title',
  privacy: 'encrypted-user-controlled',
  owner: 'alice',
  token: { chainId: reference.chainId, contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
  members: 1,
  available: '0',
  reserved: '0',
  claims: '0',
  keyEpoch: '1',
});
const obligation = {
  id: '1',
  source: 'works',
  source_id: '1',
  recipient: '1',
  quantity: '1.0000 TLOS',
  due: 1,
  status: 2,
};
const receipt = {
  id: '1',
  kind: 0,
  obligation_id: '1',
  recipient: '1',
  destination: '',
  token_contract: 'eosio.token',
  quantity: '1.0000 TLOS',
  at: 1,
  transaction_id: 'ab'.repeat(32),
};
const modules = ModuleStateSchema.parse({
  dao: reference,
  modules: [],
  ballots: [],
  votes: [],
  projects: [],
  milestones: [],
  schedules: [],
  entries: [],
  controls: [],
});
const content = DaoContentSchema.parse({
  dao: reference,
  members: [],
  documents: [],
  keyGrants: [],
  epochs: [],
});
const read = {
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(1).toISOString(),
  atomic: false as const,
};
it('counts a claim credit and withdrawal as one settled expense, and exports only public references', () => {
  const treasury = TreasurySchema.parse({
    dao: reference,
    obligations: [obligation],
    evidence: [],
    receiptsAvailable: true,
    receipts: [receipt, { ...receipt, id: '2', kind: 2, obligation_id: '0', destination: 'alice' }],
  });
  const report = buildSpendingReport({ dao, treasury, content, modules, read, issues: [] });
  expect(report.summary).toMatchObject({
    settledObligations: '10000',
    externalCashflow: '10000',
    legacyUnknownSettlements: '0',
  });
  expect(report.obligations[0]?.settlement).toBe('internal-claim');
  expect(report.complete).toBe(true);
  expect(JSON.stringify(report)).not.toContain('Secret-looking');
  const legacy = buildSpendingReport({
    dao,
    treasury: TreasurySchema.parse({ dao: reference, obligations: [obligation], evidence: [] }),
    content,
    modules,
    read,
    issues: [],
  });
  expect(legacy.obligations[0]?.settlement).toBe('legacy-unknown');
  expect(legacy.summary?.legacyUnknownSettlements).toBe('10000');
});
it('rejects foreign DAO/asset records and duplicate settlements; labels partial live reads honestly', () => {
  const treasury = TreasurySchema.parse({
    dao: reference,
    obligations: [obligation],
    evidence: [],
    receiptsAvailable: true,
    receipts: [receipt],
  });
  expect(() =>
    buildSpendingReport({
      dao,
      treasury: { ...treasury, dao: { ...treasury.dao, daoId: '2' } },
      content,
      modules,
      read,
      issues: [],
    }),
  ).toThrow('DAO_REFERENCE');
  expect(() =>
    buildSpendingReport({
      dao,
      treasury: { ...treasury, obligations: [{ ...obligation, quantity: '1.00 TLOS' }] },
      content,
      modules,
      read,
      issues: [],
    }),
  ).toThrow('CHAIN_RESPONSE_INVALID');
  expect(() =>
    buildSpendingReport({
      dao,
      treasury: { ...treasury, receipts: [receipt, { ...receipt, id: '2' }] },
      content,
      modules,
      read,
      issues: [],
    }),
  ).toThrow('CHAIN_RESPONSE_INVALID');
  const partial = buildSpendingReport({
    dao,
    content,
    modules,
    read,
    issues: ['treasury-unavailable'],
  });
  expect(partial.complete).toBe(false);
  expect(partial.summary).toBeNull();
  const changed = buildSpendingReport({
    dao: { ...dao, claims: '1' },
    treasury,
    content,
    modules,
    read,
    issues: [],
  });
  expect(changed.issues).toContain('reconciliation-changed');
});
it('neutralizes untrusted spreadsheet formulas and distinguishes a DAO statement from settlement', () => {
  const treasury = TreasurySchema.parse({
    dao: reference,
    obligations: [obligation],
    evidence: [
      {
        id: '1',
        dao_id: '1',
        obligation_id: '1',
        recipient: '1',
        quantity: '1.0000 TLOS',
        chain: '=HYPERLINK(bad)',
        payer: ' +SUM(1)',
        reference: 'cd'.repeat(32),
        mode: 1,
      },
    ],
  });
  const report = buildSpendingReport({ dao, treasury, content, modules, read, issues: [] });
  const csv = spendingCsv(report);
  expect(csv).toContain("'=HYPERLINK(bad)");
  expect(csv).toContain("' +SUM(1)");
  expect(csv).toContain('dao-confirmed-statement');
});
it('labels a live read incomplete when a Works document reference is missing', () => {
  const manifest = {
    id: 'works',
    version: '0.4.0-alpha.1',
    coreRange: '^0.4.0-alpha.1',
    interfaceVersion: 1,
    configVersion: 1,
    capabilities: ['obligation.create'],
    helpTopic: 'works',
  };
  const linked = ModuleStateSchema.parse({
    ...modules,
    modules: [
      {
        deployment: {
          id: 'works',
          account: 'works',
          version: manifest.version,
          codeHash: 'ab'.repeat(32),
        },
        manifest,
        enabled: true,
        installed: true,
        compatible: true,
        codeVerified: true,
        actions: ['propose'],
        grants: ['reserve'],
      },
    ],
    projects: [
      {
        id: '1',
        dao_id: '1',
        creator: '1',
        contributor: '1',
        document_id: '99',
        document_version: 1,
        milestones: ['1'],
        status: 1,
      },
    ],
    milestones: [
      {
        id: '1',
        dao_id: '1',
        project_id: '1',
        quantity: '1.0000 TLOS',
        due: 1,
        status: 4,
        submission_doc: '0',
        submission_version: 0,
        review_doc: '0',
        review_version: 0,
        reviewer: '0',
      },
    ],
  });
  const treasury = TreasurySchema.parse({
    dao: reference,
    obligations: [obligation],
    evidence: [],
    receiptsAvailable: true,
    receipts: [receipt],
  });
  const report = buildSpendingReport({ dao, treasury, content, modules: linked, read, issues: [] });
  expect(report.complete).toBe(false);
  expect(report.issues).toContain('document-reference-unavailable');
});
