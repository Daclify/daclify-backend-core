import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { encodeEndorse } from '@daclify/modules/sdk';
import { encodeAction } from '../../sdk/index.js';
import { researchDao, nativePush } from '../helpers/native-research.js';
it('enforces native endorsement admission and rejects direct callback keys and offboarded witnesses', async () => {
  const f = await researchDao(),
    { daoId, actor, act, gateway } = f,
    id = daoId,
    applicant = PrivateKey.generate('K1');
  await act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 1,
      value: '{"application":"Native fixture admission"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  await act(
    'daclifycore',
    'setadmit',
    encodeAction('setadmit', {
      ...actor(),
      enabled: true,
      source: 'endorse',
      threshold: 2,
      allow_agents: false,
      admin_override: false,
    }),
  );
  await expect(
    nativePush(
      'daclifycore',
      'enroll',
      encodeAction('enroll', {
        dao_id: daoId,
        member_id: '4',
        native_account: '',
        signing_key: applicant.toPublic().toString(),
        encryption_key: 'fixture',
        custody: 0,
      }),
    ),
  ).rejects.toThrow('ADMISSION_REQUIRED');
  await expect(
    nativePush(
      'daclifycore',
      'admitfrom',
      encodeAction('admitfrom', {
        dao_id: daoId,
        source: 'endorse',
        application_id: id,
        revision: '1',
      }),
      'endorse',
    ),
  ).rejects.toThrow('SOURCE_SENDER');
  await act(
    'endorse',
    'applyjoin',
    encodeEndorse('applyjoin', {
      ...actor(),
      application_id: id,
      signing_key: applicant.toPublic().toString(),
      encryption_key: 'fixture',
      custody: 0,
      kind: 0,
      operator_label: '',
      document_id: '1',
      document_version: 1,
      expires: Math.floor(Date.now() / 1000) + 1200,
    }),
  );
  for (const member of ['2', '3'])
    await act(
      'endorse',
      'witness',
      encodeEndorse('witness', { ...actor(member), application_id: id, revision: '1' }),
      member,
    );
  await act(
    'daclifycore',
    'setactive',
    encodeAction('setactive', { ...actor(), target: '3', active: false }),
  );
  await expect(
    act(
      'endorse',
      'admit',
      encodeEndorse('admit', { ...actor(), application_id: id, revision: '1' }),
    ),
  ).rejects.toThrow('ENDORSEMENT_THRESHOLD');
  await act(
    'endorse',
    'witness',
    encodeEndorse('witness', { ...actor(), application_id: id, revision: '1' }),
  );
  await act(
    'endorse',
    'admit',
    encodeEndorse('admit', { ...actor(), application_id: id, revision: '1' }),
  );
  expect((await gateway.table('members', daoId, '4', 1))[0]).toMatchObject({
    id: '4',
    admin: false,
    reviewer: false,
    credits: '0',
    signing_key: applicant.toPublic().toString(),
  });
  await expect(
    act(
      'endorse',
      'admit',
      encodeEndorse('admit', { ...actor(), application_id: id, revision: '1' }),
    ),
  ).rejects.toThrow('APPLICATION_FROZEN');
  const state = await gateway.moduleState(daoId);
  expect(state.joinApplications.find((a) => a.id === id)?.member_id).toBe('4');
  expect((await gateway.governance(daoId)).admission?.admin_override).toBe(false);
  writeFileSync(
    '.artifacts/native/admission-evidence.json',
    JSON.stringify(
      {
        fixture: 'daclify-research-native',
        reference: f.reference,
        checks: [
          'owner-path-enforced',
          'source-sender',
          'current-witness-eligibility',
          'once-only-ordinary-membership',
        ],
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
}, 30_000);
