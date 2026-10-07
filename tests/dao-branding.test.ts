import { expect, it } from 'vitest';
import { MetadataSchema, defaultDaoSetup, BrandImageSchema } from '../protocol/dao.js';
import { validateBrandImage } from '../services/api/src/content/branding.js';
import { createHash } from 'node:crypto';
import { Blockchain } from '@proton/vert';
import { PrivateKey } from '@wharfkit/antelope';
import { loadContract, row, send } from './helpers/vert.js';
import { encodeAction, makeInstruction, instructionDigest } from '../sdk/index.js';
const image = BrandImageSchema.parse({
  cid: 'bafkreigh2akiscaildc46y7w5q5b5lzd2nmf34jshfeh7g7qy6uxy5yzlm',
  bytes: 8,
  mediaType: 'image/png',
  commitment: 'ab'.repeat(32),
});
it('reads old identities and adds bounded public branding without changing preset provenance', () => {
  for (const schemaVersion of [1, 2])
    expect(
      MetadataSchema.safeParse({
        schemaVersion,
        title: 'Existing',
        description: '',
        ...(schemaVersion === 2 ? { purpose: 'community', setup: defaultDaoSetup() } : {}),
      }).success,
    ).toBe(true);
  const branded = {
    schemaVersion: 3,
    title: 'Existing',
    description: '',
    purpose: 'community',
    setup: defaultDaoSetup(),
    branding: { summary: 'Brief public summary', logo: image },
  };
  expect(MetadataSchema.parse(branded)).toEqual(branded);
  for (const change of [
    { cid: 'https://bad.test/file' },
    { mediaType: 'image/svg+xml' },
    { bytes: 2097153 },
    { commitment: 'bad' },
  ])
    expect(BrandImageSchema.safeParse({ ...image, ...change }).success).toBe(false);
  expect(MetadataSchema.safeParse({ ...branded, purpose: 'ngo-grants' }).success).toBe(false);
  expect(MetadataSchema.safeParse({ ...branded, description: '🙂'.repeat(2000) }).success).toBe(
    false,
  );
});
it('rejects image type confusion, wrong size and changed commitments before serving a blob', () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(() =>
    validateBrandImage(
      { ...image, commitment: createHash('sha256').update(png).digest('hex') },
      png,
    ),
  ).not.toThrow();
  expect(() => validateBrandImage(image, png)).toThrow('CONTENT_INTEGRITY');
  for (const type of ['image/png', 'image/jpeg', 'image/webp'] as const)
    expect(() =>
      validateBrandImage({ ...image, mediaType: type }, new TextEncoder().encode('<svg/>')),
    ).toThrow();
});
it('updates compiled metadata while preserving original purpose/setup and rejecting unsafe image references', async () => {
  const chain = new Blockchain();
  chain.createAccounts('alice', 'relay');
  const runtime = loadContract(chain, 'daclifycore', '.artifacts/contracts/runtime'),
    key = PrivateKey.generate('K1');
  await send(runtime, 'init', ['ab'.repeat(32)], 'daclifycore@active');
  const original = {
    schemaVersion: 2,
    title: 'Existing',
    description: '',
    purpose: 'community',
    setup: defaultDaoSetup(),
  };
  await send(
    runtime,
    'createdao',
    [1, 'alice', JSON.stringify(original), 0, 'eosio.token', '4,TLOS'],
    'alice@active',
  );
  await send(
    runtime,
    'enroll',
    [1, 1, '', key.toPublic().toString(), 'fixture', 0],
    'alice@active',
  );
  const branded = { ...original, schemaVersion: 3, branding: { logo: image } };
  async function update(metadata: object, nonce: string) {
    const request = makeInstruction(
      { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      '1',
      nonce,
      chain.timestamp.toMilliseconds() / 1000 + 300,
      'daclifycore',
      'setmeta',
      encodeAction('setmeta', {
        runtime: 'daclifycore',
        dao_id: '1',
        member_id: '1',
        metadata: JSON.stringify(metadata),
      }),
    );
    return send(
      runtime,
      'submit',
      { request, sig: key.signDigest(instructionDigest(request)).toString() },
      'relay@active',
    );
  }
  await update(branded, '0');
  for (const bad of [
    { ...branded, purpose: 'team' },
    { ...branded, setup: { ...original.setup, presetVersion: 2 } },
    { ...branded, branding: { logo: { ...image, cid: 'https://bad.test' } } },
    { ...branded, branding: { logo: { ...image, mediaType: 'image/svg+xml' } } },
    original,
  ])
    await expect(update(bad, '1')).rejects.toThrow();
  expect(row(runtime, 'daos', runtime.toBigInt(), 1n)).toMatchObject({
    metadata: JSON.stringify(branded),
  });
});
