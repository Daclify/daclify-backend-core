import { expect, it } from 'vitest';
import {
  DaoClaimIssueSchema,
  DaoClaimTokenSchema,
  DaoClaimRoutes,
} from '../protocol/dao-claims.js';
import { defaultDaoSetup } from '../protocol/dao.js';

const request = {
  metadata: { schemaVersion: 1, title: 'Claimable community', description: '' },
  privacy: 'public',
  token: { chainId: 'ab'.repeat(32), contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
  setup: defaultDaoSetup(),
};
it('requires a bounded human or mixed setup and rejects caller-supplied authority', () => {
  expect(DaoClaimIssueSchema.parse({ request }).request.setup?.participantMode).toBe('humans');
  expect(DaoClaimIssueSchema.safeParse({ request: { ...request, setup: undefined } }).success).toBe(
    false,
  );
  expect(DaoClaimIssueSchema.safeParse({ request, founderExecutive: true }).success).toBe(false);
  expect(
    DaoClaimIssueSchema.safeParse({
      request: { ...request, metadata: { ...request.metadata, title: 'x'.repeat(161) } },
    }).success,
  ).toBe(false);
});
it('accepts only 256-bit URL-safe claim secrets and uses POST for preview', () => {
  expect(DaoClaimTokenSchema.safeParse('a'.repeat(43)).success).toBe(true);
  expect(DaoClaimTokenSchema.safeParse('a'.repeat(42)).success).toBe(false);
  expect(DaoClaimTokenSchema.safeParse('/'.repeat(43)).success).toBe(false);
  expect(DaoClaimRoutes.daoClaimPreview.method).toBe('POST');
});
