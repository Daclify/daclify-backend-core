import { expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { CreateDaoSchema, privateCreationCommitment } from '../protocol/api.js';
import { DaoClaimRoutes, DaoClaimIssueSchema } from '../protocol/dao-claims.js';
import { defaultDaoSetup } from '../protocol/dao.js';
import { EncryptionPublicKeySchema } from '../protocol/crypto.js';
import { PrivateDaoSetupSchema } from '../protocol/private-records.js';

const envelope = {
  version: 1,
  algorithm: 'AES-256-GCM',
  iv: btoa('i'.repeat(12)),
  ciphertext: btoa('c'.repeat(32)),
};
const publicKey = EncryptionPublicKeySchema.parse(
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }),
);
const draft = {
  schemaVersion: 1,
  stage: 'invitation',
  daoId: '7',
  documentId: '41',
  contextCommitment: 'aa'.repeat(32),
  envelope,
};
const sealed = {
  ...draft,
  stage: 'founder',
  epochCommitment: 'ab'.repeat(32),
  selfGrant: { version: 1, ephemeralKey: publicKey, salt: btoa('s'.repeat(32)), envelope },
};
const setup = defaultDaoSetup();
const request = {
  metadata: {
    schemaVersion: 4,
    title: 'Private DAO',
    description: '',
    purpose: 'community',
    setup,
    privateIdentity: null,
  },
  privacy: 'encrypted-user-controlled',
  token: { chainId: 'ab'.repeat(32), contract: 'eosio.token', symbol: 'TLOS', precision: 4 },
  setup,
  privateSetup: sealed,
};
it('binds sealed setup to canonical reviewed operational fields and the full deployment', () => {
  const dao = {
    chainId: request.token.chainId,
    contract: 'daclifycore',
    daoId: '7',
    interfaceVersion: 1 as const,
  };
  const original = privateCreationCommitment(dao, request);
  expect(privateCreationCommitment(dao, { ...request, privateSetup: draft })).toBe(original);
  const changedSetup = { ...setup, governance: { ...setup.governance, duration: 600 } };
  for (const changed of [
    { ...request, setup: changedSetup, metadata: { ...request.metadata, setup: changedSetup } },
    { ...request, privacy: 'encrypted-managed-allowed' },
    { ...request, token: { ...request.token, symbol: 'OTHER' } },
    {
      ...request,
      metadata: {
        ...request.metadata,
        publicIdentity: { title: 'Published alias', description: '' },
      },
    },
  ])
    expect(privateCreationCommitment(dao, changed)).not.toBe(original);
  expect(privateCreationCommitment({ ...dao, contract: 'othercore' }, request)).not.toBe(original);
  expect(privateCreationCommitment({ ...dao, daoId: '8' }, request)).not.toBe(original);
});

it('accepts only sealed private setup with a canonical prospective DAO and document identity', () => {
  expect(PrivateDaoSetupSchema.parse(draft)).toEqual(draft);
  expect(PrivateDaoSetupSchema.parse(sealed)).toEqual(sealed);
  expect(CreateDaoSchema.parse(request)).toEqual(request);
  for (const bad of [
    { ...draft, daoId: '07' },
    { ...draft, documentId: '0' },
    { ...draft, contentKey: 'must stay in the browser fragment' },
    { ...sealed, epochCommitment: 'invalid' },
    { ...sealed, selfGrant: { ...sealed.selfGrant, signingKey: 'private key' } },
    { ...draft, envelope: { ...envelope, ciphertext: 'a'.repeat(49156) } },
  ])
    expect(PrivateDaoSetupSchema.safeParse(bad).success).toBe(false);
});

it('refuses public leakage, public-policy private setup and changed operational provenance', () => {
  for (const bad of [
    { ...request, privacy: 'public' },
    {
      ...request,
      metadata: { schemaVersion: 1, title: 'Leaked name', description: 'Leaked mission' },
    },
    {
      ...request,
      metadata: {
        ...request.metadata,
        setup: { ...setup, governance: { ...setup.governance, duration: 600 } },
      },
    },
    {
      ...request,
      metadata: {
        ...request.metadata,
        privateIdentity: {
          documentId: '41',
          version: 1,
          commitment: 'aa'.repeat(32),
          keyEpoch: '1',
        },
      },
    },
  ])
    expect(CreateDaoSchema.safeParse(bad).success).toBe(false);
});

it('separates issuer draft keys from claimant initialization without accepting private keys at either API', () => {
  expect(
    DaoClaimIssueSchema.parse({ request: { ...request, privateSetup: draft } }).request
      .privateSetup,
  ).toEqual(draft);
  const claim = { token: 'a'.repeat(43), method: 'free', privateSetup: sealed };
  expect(DaoClaimRoutes.daoClaimConfirm.input.parse(claim)).toEqual(claim);
  expect(
    DaoClaimRoutes.daoClaimConfirm.input.safeParse({ ...claim, contentKey: 'never send this' })
      .success,
  ).toBe(false);
  expect(
    DaoClaimRoutes.daoClaimConfirm.input.safeParse({ ...claim, privateSetup: draft }).success,
  ).toBe(false);
});
