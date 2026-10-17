import { beforeAll, afterAll, it, expect } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
import { RuntimeTableSchemas, encodeAction, instructionDigest } from '../../sdk/index.js';
import { encodeDecide, ModuleCodeHashes, DecideTableSchemas } from '@daclify/modules/sdk';
import { z } from 'zod';
let native: NativeContracts;
beforeAll(async () => {
  native = await nativeContracts();
}, 90000);
afterAll(async () => {
  await native?.stop();
});
it.each([0, 1, 2] as const)(
  'keeps scoped MCP-compatible native signatures and guardian control in participant mode %s',
  async (mode) => {
    const dao = await native.dummyDao('alice', false, mode),
      delegate = PrivateKey.generate('K1');
    const actors = await native.api.v1.chain.get_table_rows({
      code: 'daclifycore',
      scope: dao.daoId,
      table: 'actors',
      limit: 10,
    });
    expect(
      z
        .array(RuntimeTableSchemas.actors)
        .parse(actors.rows)
        .find((value) => value.id === '1')?.kind,
    ).toBe(mode === 0 ? 0 : 1);
    await dao.act(
      'daclifycore',
      'addsession',
      encodeAction('addsession', {
        ...dao.actor(),
        session_id: '101',
        signing_key: delegate.toPublic().toString(),
        expires: Math.floor(Date.now() / 1000) + 600,
        permissions: [
          { target: 'decide', action: 'votecommit', code_hash: ModuleCodeHashes.decide },
        ],
      }),
    );
    await dao.act(
      'decide',
      'open',
      encodeDecide('open', {
        ...dao.actor(),
        ballot_id: '91100' + mode,
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    const definition = (await dao.state()).ballotDefinitions.find(
      (row) => row.ballot_id === '91100' + mode,
    );
    if (!definition) throw Error('FROZEN_DEFINITION_REQUIRED');
    const request = await dao.request(
      'decide',
      'votecommit',
      encodeDecide('votecommit', {
        ...dao.actor(),
        ballot_id: '91100' + mode,
        choice: 1,
        expected: definition.commitment,
      }),
    );
    await native.call(
      'daclifycore',
      'submitsess',
      {
        request,
        session_id: '101',
        sig: delegate.signDigest(instructionDigest(request)).toString(),
      },
      'relay',
    );
    const votes = await native.api.v1.chain.get_table_rows({
      code: 'decide',
      scope: 'daclifycore',
      table: 'votes',
      limit: 100,
    });
    expect(
      z
        .array(DecideTableSchemas.votes)
        .parse(votes.rows)
        .some((value) => value.member === '1' && value.ballot === '91100' + mode),
    ).toBe(true);
    const nextId = '91200' + mode;
    await dao.act(
      'decide',
      'open',
      encodeDecide('open', {
        ...dao.actor(),
        ballot_id: nextId,
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      }),
    );
    const nextDefinition = (await dao.state()).ballotDefinitions.find(
      (row) => row.ballot_id === nextId,
    );
    if (!nextDefinition) throw Error('FROZEN_DEFINITION_REQUIRED');
    await native.call(
      'daclifycore',
      'guardpause',
      { dao_id: dao.daoId, until: Math.floor(Date.now() / 1000) + 60, reason: 'ab'.repeat(32) },
      'alice',
    );
    const next = await dao.request(
      'decide',
      'votecommit',
      encodeDecide('votecommit', {
        ...dao.actor(),
        ballot_id: nextId,
        choice: 0,
        expected: nextDefinition.commitment,
      }),
    );
    const pausedVote = native.call(
      'daclifycore',
      'submitsess',
      {
        request: next,
        session_id: '101',
        sig: delegate.signDigest(instructionDigest(next)).toString(),
      },
      'relay',
    );
    if (mode === 0) await pausedVote;
    else await expect(pausedVote).rejects.toThrow('DAO_PAUSED');
  },
);
