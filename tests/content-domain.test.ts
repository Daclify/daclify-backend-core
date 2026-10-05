import { describe, it, expect } from 'vitest';
import { DaoRefSchema, contentDomain, epochGrantDomain } from '../protocol/index.js';
const dao = DaoRefSchema.parse({
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
});
describe('canonical encrypted content domains', () => {
  it('separates independent deployments and versions of the same document', () => {
    expect(contentDomain(dao, '1', 1, '1')).not.toBe(
      contentDomain({ ...dao, contract: 'daclifytwo' }, '1', 1, '1'),
    );
    expect(contentDomain(dao, '1', 1, '1')).not.toBe(contentDomain(dao, '1', 2, '1'));
  });
  it('binds a key grant to its exact DAO, epoch and recipient', () => {
    expect(epochGrantDomain(dao, '1', '1')).not.toBe(epochGrantDomain(dao, '1', '2'));
    expect(epochGrantDomain(dao, '1', '1')).not.toBe(epochGrantDomain(dao, '2', '1'));
  });
  it('rejects ambiguous identifiers and document versions', () => {
    expect(() => contentDomain(dao, '01', 1, '1')).toThrow();
    expect(() => contentDomain(dao, '1', 0, '1')).toThrow();
    expect(() => epochGrantDomain(dao, '0', '1')).toThrow();
  });
});
