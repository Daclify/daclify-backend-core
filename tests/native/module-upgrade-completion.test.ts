import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { ABI, Checksum256, Name, PrivateKey, Serializer, UInt64 } from '@wharfkit/antelope';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { DecideTableSchemas, ModuleCodeHashes } from '@daclify/modules/sdk';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
  RuntimeCodeHash,
} from '../../sdk/index.js';
import { localFixture, localFixtureRoot } from '../../tools/native/local.js';

it('preserves the deployed alpha22 core and alpha31 Decide open ballot across the real native upgrade', async () => {
  const fixture = localFixture(),
    dao = '77',
    scope = Name.from('daclifycore').value.toString();
  const prior = '.artifacts/module-completion-prior';
  const coreHash = '2b2755e64462a1e43a4b530e2f602f06479d8c3f85214feb8443d663a80fe3c3';
  const decideHash = 'be206e53fb5580c238e48536dc4dd9ff74ce0de61d2a9ec089512667823c7fe5';
  assert.equal(Checksum256.hash(readFileSync(prior + '/runtime.wasm')).toString(), coreHash);
  assert.equal(Checksum256.hash(readFileSync(prior + '/decide.wasm')).toString(), decideHash);
  const candidateCore = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
  const candidateDecide = ABI.from(
    readFileSync('../daclify-backend-modules/.artifacts/contracts/decide.abi', 'utf8'),
  );
  const oldDecide = ABI.from(readFileSync(prior + '/decide.abi', 'utf8'));
  const keys = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
  const push = (account: string, action: string, data: Uint8Array, actor = 'alice') =>
    fixture.push([fixture.action(account, action, data, actor)]);
  const core = (
    action: Parameters<typeof encodeAction>[0],
    data: Parameters<typeof encodeAction>[1],
    actor = 'alice',
  ) => push('daclifycore', action, encodeAction(action, data), actor);
  async function rows(code: string, table: string, tableScope: string, json: boolean) {
    const result = await fixture.rpc.v1.chain.get_table_rows({
      code,
      table,
      scope: tableScope,
      json,
      limit: 100,
      key_type: 'i64',
    });
    assert.equal(result.more, false);
    return result.rows;
  }
  async function signed(action: 'open' | 'vote', data: object, member: number, abi: ABI) {
    const result = await fixture.rpc.v1.chain.get_table_rows({
      code: 'daclifycore',
      table: 'members',
      scope: dao,
      lower_bound: UInt64.from(member),
      limit: 1,
      key_type: 'i64',
    });
    const person = RuntimeTableSchemas.members.parse(result.rows[0]),
      key = keys[member - 1];
    assert.ok(key);
    const request = makeInstruction(
      {
        chainId: fixture.network.chainId,
        contract: 'daclifycore',
        daoId: dao,
        interfaceVersion: 1,
      },
      String(member),
      person.nonce,
      Math.floor(Date.now() / 1000) + 300,
      'decide',
      action,
      Serializer.encode({ abi, type: action, object: data }).array,
    );
    return core(
      'submit',
      { request, sig: key.signDigest(instructionDigest(request)).toString() },
      'relay',
    );
  }
  await fixture.deploy('daclifycore', prior + '/runtime');
  await fixture.deploy('decide', prior + '/decide');
  await core(
    'setfees',
    {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    },
    'daclifycore',
  );
  const listing = {
    account: 'decide',
    publisher: 'alice',
    party: 0,
    accepts_fee_rule: 1,
    price: '0.0000 TLOS',
    code_hash: decideHash,
    title: 'Native legacy upgrade',
  };
  await core('listmod', listing, 'daclifycore');
  await core('createdao', {
    dao_id: dao,
    owner: 'alice',
    metadata: '{}',
    privacy: 0,
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
  });
  for (const [index, key] of keys.entries())
    await core('enroll', {
      dao_id: dao,
      member_id: String(index + 1),
      native_account: '',
      signing_key: key.toPublic().toString(),
      encryption_key: 'key',
      custody: 0,
    });
  const installed = {
    dao_id: dao,
    account: 'decide',
    version: 1,
    actions: ['open', 'vote'],
    grants: ['govlock'],
    code_hash: decideHash,
  };
  await core('setmodule', installed);
  const ballotId = '70',
    metadata = '{"schemaVersion":1,"title":"test1","options":["Reject","Approve"]}';
  await signed(
    'open',
    {
      runtime: 'daclifycore',
      dao_id: dao,
      member_id: '1',
      ballot_id: ballotId,
      kind: 0,
      choices: 2,
      duration: 300,
      quorum: 5000,
      approval: 5001,
      metadata,
    },
    1,
    oldDecide,
  );
  await signed(
    'vote',
    { runtime: 'daclifycore', dao_id: dao, member_id: '1', ballot_id: ballotId, choice: 1 },
    1,
    oldDecide,
  );
  const descriptors = [
    { code: 'daclifycore', table: 'daos', scope, abi: candidateCore },
    { code: 'daclifycore', table: 'members', scope: dao, abi: candidateCore },
    { code: 'daclifycore', table: 'modules', scope: dao, abi: candidateCore },
    { code: 'daclifycore', table: 'govlocks', scope: dao, abi: candidateCore },
    { code: 'decide', table: 'ballots', scope, abi: candidateDecide },
    { code: 'decide', table: 'votes', scope, abi: candidateDecide },
  ];
  const before = await Promise.all(
    descriptors.map(async (d) => {
      const saved = z.array(z.string()).parse(await rows(d.code, d.table, d.scope, false));
      const type = d.abi.tables.find((t) => t.name.toString() === d.table)?.type;
      assert.ok(type);
      for (const row of saved)
        assert.equal(
          Serializer.encode({
            abi: d.abi,
            type,
            object: Serializer.decode({ abi: d.abi, type, data: row }),
          }).hexString,
          row,
        );
      return saved;
    }),
  );
  const permissions = await Promise.all(
    ['daclifycore', 'decide'].map(async (account) =>
      Serializer.objectify((await fixture.rpc.v1.chain.get_account(account)).permissions),
    ),
  );
  await fixture.deploy('daclifycore', '.artifacts/contracts/runtime');
  await fixture.deploy('decide', '../daclify-backend-modules/.artifacts/contracts/decide');
  for (const [index, d] of descriptors.entries())
    expect(await rows(d.code, d.table, d.scope, false)).toEqual(before[index]);
  expect(
    await Promise.all(
      ['daclifycore', 'decide'].map(async (account) =>
        Serializer.objectify((await fixture.rpc.v1.chain.get_account(account)).permissions),
      ),
    ),
  ).toEqual(permissions);
  await core('listmod', { ...listing, code_hash: ModuleCodeHashes.decide }, 'daclifycore');
  await core('setmodule', {
    ...installed,
    actions: ['open', 'vote', 'votecommit'],
    code_hash: ModuleCodeHashes.decide,
  });
  await signed(
    'vote',
    { runtime: 'daclifycore', dao_id: dao, member_id: '2', ballot_id: ballotId, choice: 1 },
    2,
    candidateDecide,
  );
  const ballot = z
    .array(DecideTableSchemas.ballots)
    .parse(await rows('decide', 'ballots', scope, true))
    .find((b) => b.id === ballotId);
  expect(ballot).toMatchObject({ status: 0, metadata, cast: '2', tallies: ['0', '2'] });
  expect(
    z
      .array(DecideTableSchemas.ballotdefs)
      .parse(await rows('decide', 'ballotdefs', scope, true))
      .some((b) => b.ballot_id === ballotId),
  ).toBe(false);
  const result = {
    coreHash,
    decideHash,
    upgradedCore: (await fixture.rpc.v1.chain.get_raw_abi('daclifycore')).code_hash.toString(),
    upgradedDecide: ModuleCodeHashes.decide,
    preservedTables: descriptors.length,
    preservedRows: before.reduce((sum, r) => sum + r.length, 0),
    permissionsUnchanged: true,
    legacyVoteAfterUpgrade: true,
  };
  expect(result.upgradedCore).toBe(RuntimeCodeHash);
  writeFileSync(localFixtureRoot + '/legacy-upgrade.json', JSON.stringify(result, null, 2) + '\n', {
    mode: 0o600,
  });
}, 120000);
