import { expect, it } from 'vitest';
import { GatewayFundingSchema, GatewayAllowanceStatusSchema } from '../protocol/storage.js';
const funding = {
  id: '613c972c-d56c-4e01-8e5f-a2a73e01cfe7',
  providerScope: 'fixture',
  gateway: 'https://fixture.mypinata.cloud',
  startsAt: '2026-11-01T00:00:00.000Z',
  endsAt: '2026-12-01T00:00:00.000Z',
  byteLimit: '1000',
  requestLimit: '10',
  fundingReference: 'fixture-no-provider-funding',
};
it('requires non-secret exact gateway origins and bounded positive period/capacity', () => {
  expect(GatewayFundingSchema.safeParse(funding).success).toBe(true);
  for (const gateway of [
    'http://example.test',
    'https://user:secret@example.test',
    'https://example.test?key=secret',
    'https://example.test#secret',
    'https://example.test/ipfs/',
  ])
    expect(GatewayFundingSchema.safeParse({ ...funding, gateway }).success).toBe(false);
  for (const extra of [
    { byteLimit: '0' },
    { requestLimit: '0' },
    { byteLimit: '9223372036854775808' },
    { endsAt: funding.startsAt },
    { endsAt: '2027-01-01T00:00:00.000Z' },
    { fundingReference: 'unsafe\r\nreference' },
    { paid: true },
  ])
    expect(GatewayFundingSchema.safeParse({ ...funding, ...extra }).success).toBe(false);
});
it('rejects impossible consumption or funding references in a public status', () => {
  const status = {
    state: 'available',
    startsAt: funding.startsAt,
    endsAt: funding.endsAt,
    byteLimit: '1000',
    reservedBytes: '999',
    requestLimit: '10',
    requests: '1',
    fundingQualification: 'operator-attested',
  };
  expect(GatewayAllowanceStatusSchema.safeParse(status).success).toBe(true);
  for (const extra of [
    { reservedBytes: '1001' },
    { requests: '11' },
    { fundingReference: 'private-reference' },
    { startsAt: null },
    { endsAt: funding.startsAt },
    { fundingQualification: 'unconfigured' },
  ])
    expect(GatewayAllowanceStatusSchema.safeParse({ ...status, ...extra }).success).toBe(false);
});
