import { describe, expect, it } from 'vitest';
import { MetadataSchema, CreateDaoSchema } from '../protocol/index.js';

const governance = {
  weight: 'member',
  duration: 259200,
  quorumBasisPoints: 5000,
  approvalBasisPoints: 5001,
  governedWorks: true,
  maxCommitment: '100000',
  dailyCommitment: '500000',
  guardian: '',
};
const setup = { presetId: 'community', presetVersion: 1, participantMode: 'humans', governance };
const token = { chainId: 'ab'.repeat(32), contract: 'eosio.token', symbol: 'TLOS', precision: 4 };
const identity = { title: 'Ocean Commons', description: 'Shared projects' };

describe('versioned DAO preset boundaries', () => {
  it('keeps legacy metadata readable', () => {
    expect(MetadataSchema.parse({ schemaVersion: 1, ...identity })).toMatchObject(identity);
  });
  it('accepts explicit purpose and resolved preset provenance', () => {
    expect(
      MetadataSchema.safeParse({
        schemaVersion: 2,
        ...identity,
        purpose: 'community',
        setup,
      }).success,
    ).toBe(true);
  });
  it('accepts a setup independent of the treasury asset and privacy', () => {
    expect(
      CreateDaoSchema.safeParse({
        metadata: { schemaVersion: 1, ...identity },
        privacy: 'public',
        token,
        setup,
      }).success,
    ).toBe(true);
  });
  it.each([0, 2, 99])('rejects unsupported preset version %s', (presetVersion) => {
    expect(
      CreateDaoSchema.safeParse({
        metadata: { schemaVersion: 1, ...identity },
        privacy: 'public',
        token,
        setup: { ...setup, presetVersion },
      }).success,
    ).toBe(false);
  });
  it('rejects agent-only setup without guardians or bounded commitments', () => {
    expect(
      CreateDaoSchema.safeParse({
        metadata: { schemaVersion: 1, ...identity },
        privacy: 'public',
        token,
        setup: {
          ...setup,
          participantMode: 'agents-guarded',
          governance: { ...governance, guardian: '', maxCommitment: '0' },
        },
      }).success,
    ).toBe(false);
  });
  it.each(['1.5', '-1', '01', '4611686018427387904'])(
    'rejects noncanonical commitment %s',
    (maxCommitment) => {
      expect(
        CreateDaoSchema.safeParse({
          metadata: { schemaVersion: 1, ...identity },
          privacy: 'public',
          token,
          setup: { ...setup, governance: { ...governance, maxCommitment } },
        }).success,
      ).toBe(false);
    },
  );
  it('rejects private key material in setup', () => {
    expect(
      CreateDaoSchema.safeParse({
        metadata: { schemaVersion: 1, ...identity },
        privacy: 'public',
        token,
        setup: { ...setup, signingPrivateKey: 'do-not-store-this' },
      }).success,
    ).toBe(false);
  });
});
