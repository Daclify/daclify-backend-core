import { describe, expect, it } from 'vitest';
import { PrivateRecordReferenceSchema, PrivateRecordPayloadSchema } from '../protocol/index.js';

const reference = { documentId: '41', version: 2, commitment: 'ab'.repeat(32), keyEpoch: '3' };
const identity = {
  schemaVersion: 1,
  kind: 'dao-identity',
  source: 'daclifycore1',
  recordId: '7',
  body: { title: 'Confidential community', description: 'Private mission' },
};

describe('protected descriptive records', () => {
  it('keeps the full Quick-question byte limits in a separate protected payload', () => {
    const payload = { ...identity, kind: 'quick-question', source: 'quickvote', body: { question: 'q'.repeat(256), explanation: 'e'.repeat(4096) } };
    expect(PrivateRecordPayloadSchema.parse(payload)).toEqual(payload);
    for (const body of [
      { ...payload.body, question: 'q'.repeat(257) },
      { ...payload.body, question: '💫'.repeat(65) },
      { ...payload.body, explanation: 'e'.repeat(4097) },
      { ...payload.body, voteKey: 'must not be part of the question' },
    ]) expect(PrivateRecordPayloadSchema.safeParse({ ...payload, body }).success).toBe(false);
  });
  it('accepts a canonical ciphertext reference and rejects unbound or ambiguous references', () => {
    expect(PrivateRecordReferenceSchema.parse(reference)).toEqual(reference);
    for (const invalid of [
      { ...reference, documentId: '041' },
      { ...reference, keyEpoch: '0' },
      { ...reference, version: 0 },
      { ...reference, version: 4294967296 },
      { ...reference, commitment: 'A'.repeat(64) },
      { ...reference, title: 'leaked title' },
      { ...reference, url: 'https://foreign.example/document' },
    ])
      expect(PrivateRecordReferenceSchema.safeParse(invalid).success).toBe(false);
  });
  it('validates confidential identity fields and only accepts encrypted branding references', () => {
    expect(PrivateRecordPayloadSchema.parse(identity)).toEqual(identity);
    expect(
      PrivateRecordPayloadSchema.safeParse({
        ...identity,
        body: { ...identity.body, branding: { logo: reference } },
      }).success,
    ).toBe(true);
    for (const invalid of [
      { ...identity, source: 'invalid contract' },
      { ...identity, recordId: '07' },
      { ...identity, schemaVersion: 2 },
      { ...identity, kind: 'unknown' },
      { ...identity, accountKey: 'must never be here' },
      { ...identity, body: { ...identity.body, title: 'x'.repeat(161) } },
      { ...identity, body: { ...identity.body, description: 'x'.repeat(4001) } },
      { ...identity, body: { ...identity.body, branding: { logo: { cid: 'public image' } } } },
    ])
      expect(PrivateRecordPayloadSchema.safeParse(invalid).success).toBe(false);
  });
  it('binds a ballot body to explicit semantics and unique ordered choices', () => {
    const ballot = {
      ...identity,
      kind: 'ballot-content',
      source: 'decide',
      body: {
        title: 'A private decision',
        description: 'Private explanation',
        semantics: 'proposal',
        options: ['Reject', 'Approve'],
      },
    };
    expect(PrivateRecordPayloadSchema.safeParse(ballot).success).toBe(true);
    for (const options of [['Approve', 'Reject'], ['Reject'], ['Reject', 'Approve', 'Other']])
      expect(
        PrivateRecordPayloadSchema.safeParse({ ...ballot, body: { ...ballot.body, options } })
          .success,
      ).toBe(false);
    const poll = {
      ...ballot,
      body: { ...ballot.body, semantics: 'poll', options: ['First', 'Second'] },
    };
    expect(PrivateRecordPayloadSchema.safeParse(poll).success).toBe(true);
    for (const options of [
      ['First', 'FIRST'],
      ['é', 'e\u0301'],
      Array.from({ length: 17 }, (_, i) => String(i)),
    ])
      expect(
        PrivateRecordPayloadSchema.safeParse({ ...poll, body: { ...poll.body, options } }).success,
      ).toBe(false);
  });
  it('keeps agreed payroll names distinct from later display labels and bounds UTF-8 bytes', () => {
    const label = {
      ...identity,
      kind: 'payroll-label',
      source: 'payroll',
      body: { purpose: 'agreed', label: 'Private payroll name' },
    };
    expect(PrivateRecordPayloadSchema.safeParse(label).success).toBe(true);
    expect(
      PrivateRecordPayloadSchema.safeParse({
        ...label,
        body: { purpose: 'display', label: 'Renamed display' },
      }).success,
    ).toBe(true);
    expect(
      PrivateRecordPayloadSchema.safeParse({
        ...label,
        body: { purpose: 'agreed', label: '😀'.repeat(21) },
      }).success,
    ).toBe(false);
    expect(
      PrivateRecordPayloadSchema.safeParse({
        ...label,
        body: { purpose: 'unknown', label: 'name' },
      }).success,
    ).toBe(false);
  });
});
