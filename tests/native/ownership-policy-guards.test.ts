import { afterAll, beforeAll, expect, it } from 'vitest';
import { Authority, PrivateKey } from '@wharfkit/antelope';
import {
  nativeContracts,
  type NativeContracts,
  type DummyDao,
} from '../helpers/native-contracts.js';
let owned: NativeContracts | undefined, dao: DummyDao;
const f = () => {
  if (!owned) throw new Error('FIXTURE_REQUIRED');
  return owned;
};
beforeAll(async () => {
  owned = await nativeContracts();
  dao = await owned.dummyDao();
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
it.each([
  [{ creator: 'daclifycore' }, 'NATIVE_CREATOR'],
  [{ creator: 'works' }, 'NATIVE_CREATOR'],
  [{ creator: 'unknown' }, 'NATIVE_CREATOR'],
  [{ contracts: ['works', 'works'] }, 'NATIVE_CONTRACT_DUPLICATE'],
  [{ contracts: ['relay'] }, 'NATIVE_CONTRACT'],
  [{ inline_code: ['names'] }, 'NATIVE_INLINE_CODE'],
  [{ inline_code: ['works', 'works'] }, 'NATIVE_INLINE_CODE'],
] as const)('rejects invalid ownership policy %j atomically', async (change, error) => {
  const data = {
    dao_id: dao.daoId,
    creator: 'recovery',
    contracts: ['works'],
    inline_code: ['works'],
    service_key: f().key('relay').toPublic(),
    ...change,
  };
  await expect(
    f().call('daclifycore', 'setnativegov', data, 'daclifycore', 'owner'),
  ).rejects.toThrow(error);
  expect(
    (
      await f().api.v1.chain.get_table_rows({
        code: 'daclifycore',
        scope: 'daclifycore',
        table: 'nativegov',
        limit: 1,
      })
    ).rows,
  ).toEqual([]);
});
it('rejects service authority hidden in creator owner even with a distinct active key', async () => {
  await f().update(
    'recovery',
    'active',
    'owner',
    Authority.from({
      threshold: 1,
      keys: [{ key: PrivateKey.generate('K1').toPublic(), weight: 1 }],
      accounts: [],
      waits: [],
    }),
  );
  await expect(
    f().call(
      'daclifycore',
      'setnativegov',
      {
        dao_id: dao.daoId,
        creator: 'recovery',
        contracts: ['works'],
        inline_code: ['works'],
        service_key: f().key('recovery').toPublic(),
      },
      'daclifycore',
      'owner',
    ),
  ).rejects.toThrow('SERVICE_KEY_CREATOR');
});
