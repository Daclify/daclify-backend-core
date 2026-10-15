import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { sha256 } from 'multiformats/hashes/sha2';
import { CID } from 'multiformats/cid';
import { encodeDecide, encodeWorks } from '@daclify/modules/sdk';
import {
  contentDomain,
  epochGrantDomain,
  EncryptionPublicKeySchema,
  PrivateFilePayloadSchema,
} from '../../protocol/index.js';
import { sealRecoveryData, openRecoveryData, createRecoveryRecipient } from '../../sdk/recovery.js';
import { encodeAction } from '../../sdk/index.js';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
let fixture: NativeContracts;
beforeAll(async () => {
  fixture = await nativeContracts();
}, 60000);
afterAll(async () => fixture?.stop());
it('preserves hosted Markdown identity across separate adoption, acceptance and Works consent', async () => {
  const dao = await fixture.dummyDao();
  const body = new TextEncoder().encode(
    '# Synthetic reviewed contributor agreement\n\nVersion 1\n',
  );
  const digest = await sha256.digest(body),
    commitment = Buffer.from(digest.digest).toString('hex');
  const document = {
    ...dao.actor(),
    document_id: '42',
    version: 1,
    cid: CID.createV1(0x55, digest).toString(),
    metadata: '{"version":1,"filename":"Contributor agreement.md","mediaType":"text/markdown"}',
    bytes: body.length,
    commitment,
    envelope_version: 0,
    key_epoch: '0',
  };
  await dao.act('daclifycore', 'putdoc', encodeAction('putdoc', document));
  await dao.act(
    'decide',
    'regdoc',
    encodeDecide('regdoc', {
      ...dao.actor(),
      document_id: '42',
      category: 2,
      approval: 0,
      track_acceptance: true,
    }),
  );
  const reg = (await fixture.gateway.governingDocuments(dao.daoId, {})).registrations[0];
  if (!reg) throw new Error('FIXTURE_REGISTRATION');
  await dao.act(
    'decide',
    'proposedoc',
    encodeDecide('proposedoc', {
      ...dao.actor(),
      register_id: reg.id,
      document_version: 1,
      expected_revision: reg.revision,
      ballot_id: '0',
    }),
  );
  const proposal = (await fixture.gateway.governingDocuments(dao.daoId, {})).changes[0];
  if (!proposal) throw new Error('FIXTURE_PROPOSAL');
  expect(proposal.commitment).toBe(commitment);
  await dao.act(
    'decide',
    'adoptdoc',
    encodeDecide('adoptdoc', { ...dao.actor(), proposal_id: proposal.id }),
  );
  await dao.act(
    'decide',
    'ackdoc',
    encodeDecide('ackdoc', { ...dao.actor('2'), adoption_id: proposal.id }),
    '2',
  );
  await dao.act(
    'works',
    'propose',
    encodeWorks('propose', {
      ...dao.actor(),
      project_id: '42',
      contributor: '2',
      document_id: '42',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [Math.floor(Date.now() / 1000) + 100],
    }),
  );
  const now = Math.floor(Date.now() / 1000);
  await dao.act(
    'works',
    'offeragr',
    encodeWorks('offeragr', {
      ...dao.actor(),
      project_id: '42',
      term_start: now - 1,
      term_end: now + 1000,
    }),
  );
  await expect(
    dao.act('works', 'acceptagr', encodeWorks('acceptagr', { ...dao.actor(), project_id: '42' })),
  ).rejects.toThrow('CONTRIBUTOR_REQUIRED');
  await dao.act(
    'works',
    'acceptagr',
    encodeWorks('acceptagr', { ...dao.actor('2'), project_id: '42' }),
    '2',
  );
  await dao.act('daclifycore', 'putdoc', encodeAction('putdoc', { ...document, version: 2 }));
  expect((await fixture.gateway.contentDocument(dao.daoId, '42', 1)).document).toMatchObject({
    document_id: '42',
    version: 1,
    commitment,
    cid: document.cid,
  });
  expect((await fixture.gateway.contentDocument(dao.daoId, '42', 2)).document?.version).toBe(2);
  expect((await fixture.gateway.contentDocument(dao.daoId, '42', 3)).document).toBeNull();
  const state = await fixture.gateway.moduleState(dao.daoId),
    adopted = await fixture.gateway.governingDocuments(dao.daoId, { adoptionId: proposal.id });
  expect(state.projects.find((row) => row.id === '42')?.document_version).toBe(1);
  expect(state.agreements.find((row) => row.project_id === '42')?.accepted).toBe(true);
  expect(adopted.changes[0]?.document_version).toBe(1);
  expect(adopted.acceptances[0]?.member_id).toBe('2');
  await expect(
    dao.act('daclifycore', 'putdoc', encodeAction('putdoc', document)),
  ).rejects.toThrow();
  mkdirSync('.artifacts/native', { recursive: true });
  writeFileSync(
    '.artifacts/native/legal-template-public.json',
    JSON.stringify(
      {
        kind: 'disposable-native-hosted-reference',
        dao: dao.reference,
        documentId: '42',
        version: 1,
        commitment,
        cid: document.cid,
        adoptionId: proposal.id,
        worksProjectId: '42',
        acceptedBy: '2',
        preservesOriginalVersion: true,
      },
      null,
      2,
    ) + '\n',
  );
});

it('uses encrypted hosted bytes and permitted epoch references in a private DAO', async () => {
  const recipients = await Promise.all([
    createRecoveryRecipient(),
    createRecoveryRecipient(),
    createRecoveryRecipient(),
  ]);
  const dao = await fixture.dummyDao(
    'alice',
    false,
    0,
    recipients.map((row) => JSON.stringify(row.publicKey)),
    1,
  );
  const epoch = crypto.getRandomValues(new Uint8Array(32));
  const hash = async (bytes: Uint8Array) =>
    Buffer.from((await sha256.digest(bytes)).digest).toString('hex');
  async function grant(member: string) {
    const recipient = recipients[Number(member) - 1];
    if (!recipient) throw new Error('FIXTURE_RECIPIENT');
    const target = await crypto.subtle.importKey(
      'jwk',
      recipient.publicKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const shared = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: target },
      ephemeral.privateKey,
      256,
    );
    const input = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
    const salt = crypto.getRandomValues(new Uint8Array(32)),
      domain = epochGrantDomain(dao.reference, '1', member);
    const wrapping = new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt,
          info: new TextEncoder().encode('daclify.epoch.v1:' + domain),
        },
        input,
        256,
      ),
    );
    const exported = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);
    const publicKey = EncryptionPublicKeySchema.parse({
      kty: exported.kty,
      crv: exported.crv,
      x: exported.x,
      y: exported.y,
    });
    return JSON.stringify({
      version: 1,
      ephemeralKey: publicKey,
      salt: Buffer.from(salt).toString('base64'),
      envelope: await sealRecoveryData(epoch, wrapping, 'daclify.content.v1:' + domain),
    });
  }
  await dao.act(
    'daclifycore',
    'commitepoch',
    encodeAction('commitepoch', {
      ...dao.actor(),
      epoch: '1',
      commitment: await hash(epoch),
      self_grant: await grant('1'),
    }),
  );
  await dao.act(
    'daclifycore',
    'grantkey',
    encodeAction('grantkey', {
      ...dao.actor(),
      recipient: '2',
      epoch: '1',
      envelope: await grant('2'),
    }),
  );
  const domain = 'daclify.content.v1:' + contentDomain(dao.reference, '42', 1, '1');
  const payload = new TextEncoder().encode(
    JSON.stringify(
      PrivateFilePayloadSchema.parse({
        version: 1,
        filename: 'Private agreement.md',
        mediaType: 'text/markdown',
        content: Buffer.from('# Synthetic private agreement').toString('base64'),
      }),
    ),
  );
  const envelope = await sealRecoveryData(payload, epoch, domain),
    stored = new TextEncoder().encode(JSON.stringify(envelope));
  expect(await openRecoveryData(envelope, epoch, domain)).toEqual(payload);
  expect(new TextDecoder().decode(stored)).not.toContain('Synthetic private');
  const digest = await sha256.digest(stored);
  const document = {
    ...dao.actor(),
    document_id: '42',
    version: 1,
    cid: CID.createV1(0x55, digest).toString(),
    metadata: '{}',
    bytes: stored.length,
    commitment: Buffer.from(digest.digest).toString('hex'),
    envelope_version: 1,
    key_epoch: '1',
  };
  await expect(
    dao.act(
      'daclifycore',
      'putdoc',
      encodeAction('putdoc', { ...document, metadata: '{"title":"Private agreement"}' }),
    ),
  ).rejects.toThrow('PRIVATE_METADATA');
  await dao.act('daclifycore', 'putdoc', encodeAction('putdoc', document));
  await dao.act(
    'decide',
    'regdoc',
    encodeDecide('regdoc', {
      ...dao.actor(),
      document_id: '42',
      category: 2,
      approval: 0,
      track_acceptance: true,
    }),
  );
  const reg = (await fixture.gateway.governingDocuments(dao.daoId, {})).registrations[0];
  if (!reg) throw new Error('FIXTURE_REGISTRATION');
  await dao.act(
    'decide',
    'proposedoc',
    encodeDecide('proposedoc', {
      ...dao.actor(),
      register_id: reg.id,
      document_version: 1,
      expected_revision: reg.revision,
      ballot_id: '0',
    }),
  );
  const pending = (await fixture.gateway.governingDocuments(dao.daoId, {})).changes[0];
  if (!pending) throw new Error('FIXTURE_PROPOSAL');
  expect(pending.commitment).toBe(document.commitment);
  await dao.act(
    'decide',
    'adoptdoc',
    encodeDecide('adoptdoc', { ...dao.actor(), proposal_id: pending.id }),
  );
  await dao.act(
    'decide',
    'ackdoc',
    encodeDecide('ackdoc', { ...dao.actor('2'), adoption_id: pending.id }),
    '2',
  );
  expect(
    (await fixture.gateway.governingDocuments(dao.daoId, { adoptionId: pending.id })).acceptances[0]
      ?.member_id,
  ).toBe('2');
  mkdirSync('.artifacts/native', { recursive: true });
  writeFileSync(
    '.artifacts/native/legal-template-private.json',
    JSON.stringify(
      {
        kind: 'disposable-native-encrypted-hosted-reference',
        dao: dao.reference,
        documentId: '42',
        version: 1,
        commitment: document.commitment,
        cid: document.cid,
        envelopeVersion: 1,
        keyEpoch: '1',
        metadata: '{}',
        adoptionId: pending.id,
        acceptedBy: '2',
        plaintextMetadataRejected: true,
      },
      null,
      2,
    ) + '\n',
  );
});
