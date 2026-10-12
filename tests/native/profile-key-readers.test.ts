import { afterAll, beforeAll, expect, it } from 'vitest';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
import { createRecoveryRecipient } from '../../sdk/recovery.js';
import { PrivateKey } from '@wharfkit/antelope';
import { encodeAction } from '../../sdk/index.js';
let fixture: NativeContracts;
beforeAll(async () => {
  fixture = await nativeContracts();
}, 90000);
afterAll(async () => fixture?.stop());
it('verifies exact native member keys, skips legacy invalid keys and excludes inactive recipients', async () => {
  const dao = await fixture.dummyDao();
  expect(await fixture.gateway.profileKeyMember(dao.daoId, '1')).toBeNull();
  const keys = await Promise.all([createRecoveryRecipient(), createRecoveryRecipient()]);
  for (const [index, member] of ['6', '7'].entries()) {
    const pair = keys[index];
    if (!pair) throw new Error('FIXTURE_KEYS');
    await fixture.call(
      'daclifycore',
      'enroll',
      {
        dao_id: dao.daoId,
        member_id: member,
        native_account: '',
        signing_key: PrivateKey.generate('K1').toPublic().toString(),
        encryption_key: JSON.stringify(pair.publicKey),
        custody: 0,
      },
      'alice',
    );
    expect(await fixture.gateway.profileKeyMember(dao.daoId, member)).toEqual({
      memberId: member,
      active: true,
      encryptionKey: pair.publicKey,
    });
  }
  expect((await fixture.gateway.profileKeyRecipients(dao.daoId)).recipients).toHaveLength(2);
  expect(
    (await fixture.gateway.profileKeyRecipients(dao.daoId, '6')).recipients.map(
      (value) => value.memberId,
    ),
  ).toEqual(['7']);
  await dao.act(
    'daclifycore',
    'setactive',
    encodeAction('setactive', { ...dao.actor(), target: '7', active: false }),
  );
  expect(
    (await fixture.gateway.profileKeyRecipients(dao.daoId)).recipients.map(
      (value) => value.memberId,
    ),
  ).toEqual(['6']);
  expect((await fixture.gateway.profileKeyMember(dao.daoId, '7'))?.active).toBe(false);
  expect(await fixture.gateway.profileKeyMember(dao.daoId, '99')).toBeNull();
  expect(await fixture.gateway.profileKeyRecipients(dao.daoId, '18446744073709551615')).toEqual({
    recipients: [],
    next: null,
  });
});
