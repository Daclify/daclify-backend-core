import { describe, it, expect } from 'vitest';
import {
  SettlementRequestSchema,
  SettlementResultSchema,
  TreasurySchema,
  evidenceForDao,
  evidenceTableMissing,
} from '../protocol/treasury.js';
const dao = { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 };
describe('core treasury public protocol', () => {
  it('binds settlement to one full DAO and a source obligation', () => {
    const request = { dao, source: 'works', sourceId: '9' };
    expect(SettlementRequestSchema.parse(request)).toEqual(request);
    for (const invalid of [
      { ...request, sourceId: '0' },
      { ...request, source: 'bad.name.' },
      { ...request, destination: 'alice' },
      { ...request, dao: { ...dao, interfaceVersion: 2 } },
    ])
      expect(SettlementRequestSchema.safeParse(invalid).success).toBe(false);
  });
  it('distinguishes a submitted settlement from an already settled obligation', () => {
    expect(
      SettlementResultSchema.parse({ state: 'settled', transactionId: '12'.repeat(32) }).state,
    ).toBe('settled');
    expect(SettlementResultSchema.parse({ state: 'already-settled' }).state).toBe(
      'already-settled',
    );
    expect(SettlementResultSchema.safeParse({ state: 'settled' }).success).toBe(false);
  });
  it('uses contract-generated obligation records', () => {
    const treasury = TreasurySchema.parse({
      dao,
      obligations: [
        {
          id: '1',
          source: 'works',
          source_id: '9',
          recipient: '2',
          quantity: '1.0000 TLOS',
          due: 0,
          status: 1,
        },
      ],
      evidence: [
        {
          id: '4',
          dao_id: '1',
          obligation_id: '1',
          recipient: '2',
          quantity: '1.0000 TLOS',
          chain: 'telos',
          payer: 'alice',
          reference: 'cd'.repeat(32),
          mode: 1,
        },
      ],
    });
    expect(treasury.obligations[0]?.recipient).toBe('2');
    expect(treasury.evidence[0]?.reference).toBe('cd'.repeat(32));
    expect(TreasurySchema.safeParse({ ...treasury, evidence: [{ mode: 1 }] }).success).toBe(false);
  });
  it('keeps another DAO’s statement off this treasury and recognizes a runtime without the table', () => {
    const rows = [
      { dao_id: '1', id: '4' },
      { dao_id: '2', id: '5' },
    ];
    expect(evidenceForDao(rows, '1')).toEqual([{ dao_id: '1', id: '4' }]);
    expect(
      evidenceTableMissing({
        error: { details: [{ message: 'Table evidence is not specified in the ABI' }] },
      }),
    ).toBe(true);
    expect(evidenceTableMissing({ error: { details: [{ message: 'OTHER' }] } })).toBe(false);
    expect(evidenceTableMissing(null)).toBe(false);
  });
});
