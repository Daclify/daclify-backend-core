import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  HostedUploadSchema,
  HostedBytesSchema,
  MAX_HOSTED_CONTENT_BYTES,
} from '../protocol/storage.js';
const content = Buffer.from('Synthetic content fixture');
const fixture = {
  schemaVersion: 1,
  requestId: randomUUID(),
  dao: { chainId: '11'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
  documentId: '1',
  version: 1,
  metadata: '{}',
  commitment: createHash('sha256').update(content).digest('hex'),
  bytes: content.length,
  envelopeVersion: 0,
  keyEpoch: '0',
  content: content.toString('base64'),
};
describe('canonical hosted-content request boundary', () => {
  it('accepts a bounded public request and rejects extra fields', () => {
    expect(HostedUploadSchema.parse(fixture)).toEqual(fixture);
    expect(
      HostedUploadSchema.safeParse({ ...fixture, providerToken: 'not an input' }).success,
    ).toBe(false);
  });
  it('rejects unsupported content coordinates and size', () => {
    for (const changes of [
      { version: 0 },
      { version: 4294967296 },
      { bytes: 0 },
      { bytes: MAX_HOSTED_CONTENT_BYTES + 1 },
      { envelopeVersion: 2 },
    ])
      expect(HostedUploadSchema.safeParse({ ...fixture, ...changes }).success).toBe(false);
  });
  it('requires canonical base64 including its unused padding bits', () => {
    expect(HostedBytesSchema.safeParse('YQ==').success).toBe(true);
    for (const invalid of ['', 'YQ', 'YQ===', 'YR==', 'YQ==\n', '-Q=='])
      expect(HostedBytesSchema.safeParse(invalid).success).toBe(false);
  });
  it('validates the full advertised upload limit without overflowing the stack', () => {
    const encoded = Buffer.alloc(MAX_HOSTED_CONTENT_BYTES).toString('base64');
    expect(HostedBytesSchema.parse(encoded)).toBe(encoded);
    for (const invalid of ['A===', 'AA=A', 'AA!A', 'AA-_', 'AAA\n', 'AB==', 'AAB='])
      expect(HostedBytesSchema.safeParse(invalid).success).toBe(false);
  });
});
