import { expect, it } from 'vitest';
import { DaoRefSchema } from '../protocol/base.js';
import { privateHandoverCommitment } from '../sdk/account-exit.js';
const reference = DaoRefSchema.parse({
  chainId: 'ab'.repeat(32),
  contract: 'daclifycore',
  daoId: '1',
  interfaceVersion: 1,
});
const handover = {
  dao_id: '1',
  initiator: '1',
  departing: '2',
  successor: '1',
  departing_credentials: '1',
  successor_credentials: '1',
  successor_key: 'cd'.repeat(32),
  key_epoch: '9',
  history_policy: 0,
  last_epoch: '8',
  cursor: '0',
  complete: false,
  accepted: false,
  expires: 1900000000,
};
it('accepts the canonical API descriptor while refusing unknown descriptor fields', () => {
  const commitment = privateHandoverCommitment(reference, handover);
  const descriptor = { ...handover, commitment, status: 'pending' as const };
  expect(privateHandoverCommitment(reference, descriptor)).toBe(commitment);
  const unknownDescriptor = { ...descriptor, unrecognized: true };
  expect(() => privateHandoverCommitment(reference, unknownDescriptor)).toThrow();
});
it('binds immutable preparation, exact deployment and expiry while scans leave the commitment stable', () => {
  const original = privateHandoverCommitment(reference, handover);
  expect(original).toMatch(/^[0-9a-f]{64}$/);
  expect(
    privateHandoverCommitment(reference, {
      ...handover,
      cursor: '8',
      complete: true,
      accepted: true,
    }),
  ).toBe(original);
  for (const changed of [
    { ...handover, departing: '3' },
    { ...handover, successor_credentials: '2' },
    { ...handover, successor_key: 'de'.repeat(32) },
    { ...handover, expires: handover.expires + 1 },
    { ...handover, key_epoch: '10' },
    { ...handover, history_policy: 1 },
  ])
    expect(privateHandoverCommitment(reference, changed)).not.toBe(original);
  expect(privateHandoverCommitment({ ...reference, chainId: 'ef'.repeat(32) }, handover)).not.toBe(
    original,
  );
  expect(() => privateHandoverCommitment({ ...reference, daoId: '2' }, handover)).toThrow(
    'PRIVATE_HANDOVER_CONTEXT',
  );
});
it('preserves uint64 identifiers and rejects rounding or foreign member contexts', () => {
  const maximum = '18446744073709551615';
  const full = { ...handover, dao_id: maximum, departing: maximum, departing_credentials: maximum };
  expect(privateHandoverCommitment({ ...reference, daoId: maximum }, full)).toMatch(
    /^[0-9a-f]{64}$/,
  );
  expect(() =>
    privateHandoverCommitment(reference, { ...handover, departing: '18446744073709551616' }),
  ).toThrow();
});
