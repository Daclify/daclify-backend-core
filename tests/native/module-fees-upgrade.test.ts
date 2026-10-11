import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Authority, PrivateKey, UInt64 } from '@wharfkit/antelope';
import { nativeProcess } from '../helpers/native-process.js';
import { CoreContextActions } from '../../sdk/permissions.js';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
} from '../../sdk/index.js';
it('upgrades the exact deployed alpha.6 binary and preserves documents, member keys, roles and nonces before adding a fee', async () => {
  const previous = '.artifacts/module-fees-before/runtime';
  expect(
    createHash('sha256')
      .update(readFileSync(previous + '.wasm'))
      .digest('hex'),
  ).toBe('4235158cdd149a4bebf1006a69b5f3943a842a9b437db14abf823acbd6cc277b');
  const f = await nativeProcess();
  try {
    for (const name of ['daclifycore', 'alice', 'relay', 'eosio.token']) await f.create(name);
    let abi = await f.deploy('daclifycore', previous);
    const root = PrivateKey.generate('K1');
    await f.update(
      'daclifycore',
      'active',
      'owner',
      Authority.from({
        threshold: 1,
        keys: [{ key: f.key('daclifycore').toPublic(), weight: 1 }],
        accounts: [{ permission: { actor: 'daclifycore', permission: 'eosio.code' }, weight: 1 }],
        waits: [],
      }),
    );
    await f.update(
      'daclifycore',
      'execctx',
      'active',
      Authority.from({
        threshold: 1,
        keys: [],
        accounts: [{ permission: { actor: 'daclifycore', permission: 'eosio.code' }, weight: 1 }],
        waits: [],
      }),
    );
    await f.push(
      CoreContextActions.map((type) =>
        f.system(
          'linkauth',
          { account: 'daclifycore', code: 'daclifycore', type, requirement: 'execctx' },
          'daclifycore',
          'owner',
        ),
      ),
      [f.key('daclifycore')],
    );
    const call = async (name: string, data: object, actor = 'daclifycore') =>
      f.push(
        [f.action('daclifycore', name, data, [{ actor, permission: 'active' }], abi)],
        [f.key(actor)],
      );
    await call('init', { chain_id: f.chainId });
    await call(
      'createdao',
      {
        dao_id: '1',
        owner: 'alice',
        metadata: '{}',
        privacy: 0,
        token_contract: 'eosio.token',
        token_symbol: '4,TLOS',
      },
      'alice',
    );
    await call(
      'enroll',
      {
        dao_id: '1',
        member_id: '1',
        native_account: '',
        signing_key: root.toPublic(),
        encryption_key: 'owned-fixture',
        custody: 0,
      },
      'alice',
    );
    async function rows(table: string, scope = '1') {
      return (
        await f.api.v1.chain.get_table_rows({
          code: 'daclifycore',
          scope,
          table,
          json: false,
          limit: 100,
        })
      ).rows;
    }
    const request = makeInstruction(
      { chainId: f.chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      '1',
      '0',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'putjson',
      encodeAction('putjson', {
        runtime: 'daclifycore',
        dao_id: '1',
        member_id: '1',
        document_id: '1',
        version: 1,
        value: '{"owned":true}',
        envelope_version: 0,
        key_epoch: '0',
      }),
    );
    await call('submit', { request, sig: root.signDigest(instructionDigest(request)) }, 'relay');
    const before = {
      members: await rows('members'),
      documents: await rows('documents'),
      dao: await rows('daos', 'daclifycore'),
    };
    abi = await f.deploy('daclifycore', '.artifacts/contracts/runtime');
    expect({
      members: await rows('members'),
      documents: await rows('documents'),
      dao: await rows('daos', 'daclifycore'),
    }).toEqual(before);
    await f.create('decide');
    await f.deploy('decide', '../daclify-backend-modules/.artifacts/contracts/decide');
    const code = (await f.api.v1.chain.get_raw_abi('decide')).code_hash;
    await call('setfees', {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    });
    await call('listmod', {
      account: 'decide',
      publisher: 'alice',
      party: 0,
      accepts_fee_rule: 1,
      price: '0.0000 TLOS',
      code_hash: code,
      title: 'Decide',
    });
    await call('setgov', { dao_id: '1' });
    const fee = makeInstruction(
      { chainId: f.chainId, contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
      '1',
      '1',
      Math.floor(Date.now() / 1000) + 300,
      'daclifycore',
      'govmodfee',
      encodeAction('govmodfee', {
        runtime: 'daclifycore',
        dao_id: '1',
        member_id: '1',
        account: 'decide',
        expected_revision: '0',
        monthly_usd: 200,
        actions: ['open'],
      }),
    );
    await call('submit', { request: fee, sig: root.signDigest(instructionDigest(fee)) }, 'relay');
    const member = RuntimeTableSchemas.members.parse(
      (
        await f.api.v1.chain.get_table_rows({
          code: 'daclifycore',
          scope: '1',
          table: 'members',
          lower_bound: UInt64.from(1),
          limit: 1,
        })
      ).rows[0],
    );
    expect(member).toMatchObject({
      nonce: '2',
      active: true,
      admin: true,
      signing_key: root.toPublic().toString(),
    });
    expect(await rows('documents')).toEqual(before.documents);
  } finally {
    await f.stop();
  }
}, 90000);
