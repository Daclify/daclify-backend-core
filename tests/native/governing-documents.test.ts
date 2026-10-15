import { beforeAll, afterAll, expect, it } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { Checksum256 } from '@wharfkit/antelope';
import { z } from 'zod';
import { ModulePermissions } from '@daclify/modules';
import {
  encodeDecide,
  prepareBallotVote,
  ModuleCodeHashes,
  DecideTableSchemas,
} from '@daclify/modules/sdk';
import { encodeAction } from '../../sdk/index.js';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
let f: NativeContracts;
beforeAll(async () => {
  f = await nativeContracts();
}, 60000);
afterAll(async () => {
  await f?.stop();
});
const measure = (result: unknown) =>
  z
    .object({
      processed: z.object({
        receipt: z.object({ cpu_usage_us: z.number(), net_usage_words: z.number() }),
      }),
    })
    .parse(JSON.parse(JSON.stringify(result))).processed.receipt;
it('dispatches exact-version approval and acceptance with real permissions and measured RAM/CPU', async () => {
  const dao = await f.dummyDao();
  await dao.document('7');
  const before = BigInt((await f.api.v1.chain.get_account('decide')).ram_usage.toString());
  const register = await dao.act(
    'decide',
    'regdoc',
    encodeDecide('regdoc', {
      ...dao.actor(),
      document_id: '7',
      category: 0,
      approval: 0,
      track_acceptance: true,
    }),
  );
  const page = await f.gateway.governingDocuments(dao.daoId, {}),
    registered = page.registrations[0];
  if (!registered) throw new Error('FIXTURE_REGISTRATION');
  const proposal = await dao.act(
    'decide',
    'proposedoc',
    encodeDecide('proposedoc', {
      ...dao.actor(),
      register_id: registered.id,
      document_version: 1,
      expected_revision: '0',
      ballot_id: '0',
    }),
  );
  const pending = (await f.gateway.governingDocuments(dao.daoId, {})).changes[0];
  if (!pending) throw new Error('FIXTURE_PROPOSAL');
  await expect(
    f.call('decide', 'adoptdoc', { ...dao.actor(), proposal_id: pending.id }, 'relay'),
  ).rejects.toThrow('ACTOR_SENDER');
  await expect(
    dao.act(
      'decide',
      'adoptdoc',
      encodeDecide('adoptdoc', { ...dao.actor('2'), proposal_id: pending.id }),
      '2',
    ),
  ).rejects.toThrow('ADMIN_REQUIRED');
  const adoption = await dao.act(
    'decide',
    'adoptdoc',
    encodeDecide('adoptdoc', { ...dao.actor(), proposal_id: pending.id }),
  );
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '7',
      version: 2,
      value: '{"draft":true}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  const accepted = await dao.act(
    'decide',
    'ackdoc',
    encodeDecide('ackdoc', { ...dao.actor('2'), adoption_id: pending.id }),
    '2',
  );
  await expect(
    dao.act(
      'decide',
      'ackdoc',
      encodeDecide('ackdoc', { ...dao.actor('2'), adoption_id: pending.id }),
      '2',
    ),
  ).rejects.toThrow('DOCUMENT_ALREADY_ACCEPTED');
  const saved = await f.gateway.governingDocuments(dao.daoId, { adoptionId: pending.id });
  expect(saved.changes[0]?.document_version).toBe(1);
  expect(saved.acceptances[0]?.member_id).toBe('2');
  const after = BigInt((await f.api.v1.chain.get_account('decide')).ram_usage.toString());
  expect(after > before).toBe(true);
  mkdirSync('.artifacts/native', { recursive: true });
  writeFileSync(
    '.artifacts/native/governing-documents-evidence.json',
    JSON.stringify(
      {
        kind: 'disposable-native-contract-flow',
        moduleCodeHash: ModuleCodeHashes.decide,
        ramBytes: Number(after - before),
        actions: {
          register: measure(register),
          propose: measure(proposal),
          adopt: measure(adoption),
          accept: measure(accepted),
        },
        preservesAdoptedVersion: true,
        duplicateAcceptanceRejected: true,
        unsignedDispatchRejected: true,
      },
      null,
      2,
    ) + '\n',
  );
}, 60000);
it('preserves adoption and acceptance across a real code change while refusing old pending approvals', async () => {
  const dao = await f.dummyDao();
  await dao.document('8');
  await dao.act(
    'decide',
    'regdoc',
    encodeDecide('regdoc', {
      ...dao.actor(),
      document_id: '8',
      category: 0,
      approval: 0,
      track_acceptance: true,
    }),
  );
  const registered = (await f.gateway.governingDocuments(dao.daoId, {})).registrations[0];
  if (!registered) throw new Error('FIXTURE_REGISTRATION');
  await dao.act(
    'decide',
    'proposedoc',
    encodeDecide('proposedoc', {
      ...dao.actor(),
      register_id: registered.id,
      document_version: 1,
      expected_revision: '0',
      ballot_id: '0',
    }),
  );
  const adopted = (await f.gateway.governingDocuments(dao.daoId, {})).changes[0];
  if (!adopted) throw new Error('FIXTURE_ADOPTION');
  await dao.act(
    'decide',
    'adoptdoc',
    encodeDecide('adoptdoc', { ...dao.actor(), proposal_id: adopted.id }),
  );
  await dao.act(
    'decide',
    'ackdoc',
    encodeDecide('ackdoc', { ...dao.actor('2'), adoption_id: adopted.id }),
    '2',
  );
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '8',
      version: 2,
      value: '{"draft":true}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  await dao.act(
    'decide',
    'proposedoc',
    encodeDecide('proposedoc', {
      ...dao.actor(),
      register_id: registered.id,
      document_version: 2,
      expected_revision: '1',
      ballot_id: '0',
    }),
  );
  const pending = (await f.gateway.governingDocuments(dao.daoId, {})).changes.find((row) => row.register_id === registered.id && row.status === 0);
  if (!pending) throw new Error('FIXTURE_PROPOSAL');
  const probe = '../daclify-backend-modules/.artifacts/governing-document-upgrade/decide';
  const hash = Checksum256.hash(readFileSync(probe + '.wasm')).toString();
  expect(hash).not.toBe(ModuleCodeHashes.decide);
  await f.deploy('decide', probe);
  try {
    await f.call('daclifycore', 'listmod', {
      account: 'decide',
      publisher: 'alice',
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: hash,
      title: 'Disposable upgrade fixture',
    });
    await f.call(
      'daclifycore',
      'setmodule',
      {
        dao_id: dao.daoId,
        account: 'decide',
        version: 1,
        actions: ModulePermissions.decide.actions,
        grants: ModulePermissions.decide.grants,
        code_hash: hash,
      },
      'alice',
    );
    await expect(
      dao.act(
        'decide',
        'adoptdoc',
        encodeDecide('adoptdoc', { ...dao.actor(), proposal_id: pending.id }),
      ),
    ).rejects.toThrow('DOCUMENT_SOURCE_UPDATED');
    const rows = await f.api.v1.chain.get_table_rows({
      code: 'decide',
      scope: 'daclifycore',
      table: 'docchanges',
      limit: 25,
    });
    expect(
      z
        .array(DecideTableSchemas.docchanges)
        .parse(rows.rows)
        .some((row) => row.id === adopted.id && row.dao_id === dao.daoId && row.status === 1),
    ).toBe(true);
    const acceptances = await f.api.v1.chain.get_table_rows({
      code: 'decide',
      scope: 'daclifycore',
      table: 'docaccepts',
      limit: 25,
    });
    expect(
      z
        .array(DecideTableSchemas.docaccepts)
        .parse(acceptances.rows)
        .some((row) => row.adoption_id === adopted.id && row.member_id === '2'),
    ).toBe(true);
  } finally {
    await f.deploy('decide', '../daclify-backend-modules/.artifacts/contracts/decide');
    await f.call('daclifycore', 'listmod', {
      account: 'decide',
      publisher: 'alice',
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: ModuleCodeHashes.decide,
      title: 'Disposable restored fixture',
    });
  }
}, 60000);

it('adopts only the document version approved by a real member ballot', async () => {
  const dao = await f.dummyDao();
  await dao.document('10');
  await dao.act(
    'decide',
    'regdoc',
    encodeDecide('regdoc', {
      ...dao.actor(),
      document_id: '10',
      category: 0,
      approval: 1,
      track_acceptance: true,
    }),
  );
  const registered = (await f.gateway.governingDocuments(dao.daoId, {})).registrations[0];
  if (!registered) throw new Error('FIXTURE_REGISTRATION');
  await dao.act(
    'decide',
    'proposedoc',
    encodeDecide('proposedoc', {
      ...dao.actor(),
      register_id: registered.id,
      document_version: 1,
      expected_revision: '0',
      ballot_id: dao.daoId,
    }),
  );
  const first = await f.gateway.governingDocuments(dao.daoId, {}),
    pending = first.changes[0],
    ballot = first.ballots[0];
  if (!pending || !ballot) throw new Error('FIXTURE_VOTE');
  await expect(
    dao.act(
      'decide',
      'adoptdoc',
      encodeDecide('adoptdoc', { ...dao.actor(), proposal_id: pending.id }),
    ),
  ).rejects.toThrow('BALLOT_NOT_PASSED');
  for (const member of ['1', '2']) {
    const vote = prepareBallotVote({
      dao: dao.reference,
      decide: 'decide',
      memberId: member,
      ballot,
      definitions: first.ballotDefinitions,
      documentChange: pending,
      choice: 1,
    });
    await dao.act('decide', vote.action, encodeDecide(vote.action, vote.fields), member);
  }
  await dao.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...dao.actor(),
      document_id: '10',
      version: 2,
      value: '{"laterDraft":true}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  while (Math.floor(Date.now() / 1000) <= ballot.closes)
    await new Promise((resolve) => setTimeout(resolve, 500));
  expect((await f.gateway.finalize({ dao: dao.reference, ballotId: dao.daoId })).state).toBe(
    'finalized',
  );
  await expect(
    dao.act(
      'decide',
      'canceldoc',
      encodeDecide('canceldoc', { ...dao.actor(), proposal_id: pending.id }),
    ),
  ).rejects.toThrow('DOCUMENT_APPROVAL_READY');
  const adopted = await dao.act(
    'decide',
    'adoptdoc',
    encodeDecide('adoptdoc', { ...dao.actor('3'), proposal_id: pending.id }),
    '3',
  );
  const page = await f.gateway.governingDocuments(dao.daoId, {});
  expect(page.changes[0]).toMatchObject({ document_version: 1, status: 1, ballot_id: dao.daoId });
  writeFileSync(
    '.artifacts/native/governing-documents-vote-evidence.json',
    JSON.stringify(
      {
        kind: 'disposable-native-member-vote',
        moduleCodeHash: ModuleCodeHashes.decide,
        version: 1,
        laterDraftVersion: 2,
        memberVotePassed: true,
        administratorVetoRejected: true,
        adopt: measure(adopted),
      },
      null,
      2,
    ) + '\n',
  );
}, 90000);
