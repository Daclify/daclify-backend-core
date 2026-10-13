import { it, expect } from 'vitest';
import { MiniAppListingInputSchema, MiniAppOriginProofSchema } from '../protocol/mini-apps.js';
import { verifyListingOrigin } from '../services/api/src/mini-apps/directory.js';
const input = {
  origin: 'https://apps.example',
  title: 'Garden tasks',
  description: 'A community tool',
  releases: ['a'.repeat(64)],
};
it('bounds directory text by UTF-8 bytes and requires canonical HTTPS origins', () => {
  expect(MiniAppListingInputSchema.parse(input).origin).toBe(input.origin);
  expect(MiniAppListingInputSchema.safeParse({ ...input, title: '🌱'.repeat(31) }).success).toBe(
    false,
  );
  for (const origin of [
    'http://apps.example',
    'https://apps.example/path',
    'https://u:p@apps.example',
  ])
    expect(MiniAppListingInputSchema.safeParse({ ...input, origin }).success).toBe(false);
});
it('verifies the exact origin-bound challenge over a pinned public address without redirecting', async () => {
  const proof = MiniAppOriginProofSchema.parse({
    version: 1,
    listingId: 'af8ac57f-4713-48b4-8434-494ebcf00eea',
    accountId: 'bf8ac57f-4713-48b4-8434-494ebcf00eea',
    origin: input.origin,
    challenge: 'c'.repeat(64),
    expires: new Date(Date.now() + 60000).toISOString(),
  });
  const dependencies = {
    lookup: async () => [{ address: '8.8.8.8', family: 4 as const }],
    request: async () => ({ status: 200, bytes: Buffer.from(JSON.stringify(proof)) }),
  };
  expect(await verifyListingOrigin(proof, dependencies)).toBe(true);
  expect(
    await verifyListingOrigin(proof, {
      ...dependencies,
      lookup: async () => [{ address: '127.0.0.1', family: 4 as const }],
    }),
  ).toBe(false);
  expect(
    await verifyListingOrigin(proof, {
      ...dependencies,
      request: async () => ({ status: 302, bytes: Buffer.from('') }),
    }),
  ).toBe(false);
  expect(
    await verifyListingOrigin(proof, {
      ...dependencies,
      request: async () => ({
        status: 200,
        bytes: Buffer.from(
          JSON.stringify({ ...proof, accountId: 'cf8ac57f-4713-48b4-8434-494ebcf00eea' }),
        ),
      }),
    }),
  ).toBe(false);
});
