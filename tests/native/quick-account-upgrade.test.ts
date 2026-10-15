import { afterAll, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import { RuntimeCodeHash } from '../../sdk/index.js';

const runtime = 'daclifycore1';
const baseline = '.artifacts/quick-account-upgrade27/runtime';
let f: NativeProcess | undefined;
afterAll(async () => {
  await f?.stop();
});
it('preserves raw core27 DAO/member rows and native permissions through upgrade and rollback', async () => {
  expect(
    createHash('sha256')
      .update(readFileSync(baseline + '.wasm'))
      .digest('hex'),
  ).toBe('53a25162f0984a19a9b52e692d196fed9fabd7362d34543c7069d0801e0996de');
  const owned = (f = await nativeProcess());
  for (const name of [runtime, 'alice', 'eosio.token']) await owned.create(name);
  const abi = await owned.deploy(runtime, baseline);
  const act = (action: string, data: object, actor: string) =>
    owned.push(
      [owned.action(runtime, action, data, [{ actor, permission: 'active' }], abi)],
      [owned.key(actor)],
    );
  await act('init', { chain_id: owned.chainId }, runtime);
  await act(
    'createdao',
    {
      dao_id: '7',
      owner: 'alice',
      metadata: '{"title":"Before Quick ballots"}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  await act(
    'enroll',
    {
      dao_id: '7',
      member_id: '1',
      native_account: 'alice',
      signing_key: owned.key('alice').toPublic().toString(),
      encryption_key: 'original-encryption-key',
      custody: 0,
    },
    'alice',
  );
  await act(
    'appoint',
    { dao_id: '7', member_ids: ['1'], inactivity_seconds: 0, quorum_bps: 10000 },
    'alice',
  );
  const rows = async () =>
    Promise.all(
      [
        ['daos', runtime],
        ['members', '7'],
        ['executives', '7'],
        ['actors', '7'],
        ['createords', runtime],
      ].map(async ([table, scope]) => {
        if (!table || !scope) throw Error('FIXTURE_TABLE');
        return (
          await owned.api.v1.chain.get_table_rows({
            code: runtime,
            scope,
            table,
            json: false,
            limit: 100,
          })
        ).rows;
      }),
    );
  const before = await rows(),
    permissions = (await owned.api.v1.chain.get_account(runtime)).permissions;
  for (const path of ['.artifacts/contracts/runtime', baseline, '.artifacts/contracts/runtime']) {
    await owned.deploy(runtime, path);
    expect(await rows()).toEqual(before);
    expect((await owned.api.v1.chain.get_account(runtime)).permissions).toEqual(permissions);
  }
  expect((await owned.api.v1.chain.get_raw_abi(runtime)).code_hash.toString()).toBe(
    RuntimeCodeHash,
  );
}, 60000);
