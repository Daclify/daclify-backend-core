import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { PrivateKey, Checksum256, Serializer, UInt64 } from '@wharfkit/antelope';
import {
  encodeWorks,
  encodeDecide,
  ModuleCodeHashes,
  WorksTableSchemas,
} from '@daclify/modules/sdk';
import { ModulePermissions } from '@daclify/modules';
import { encodeAction, makeInstruction, instructionDigest } from '../../sdk/index.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { spendingReport } from '../../services/api/src/reporting/spending.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { researchNetwork, researchRpc, nativePush } from '../helpers/native-research.js';
it('upgrades actual old rows, preserves claims and liabilities, and invalidates old execution code pins without changing ordinary commitment bytes', async () => {
  const runtime = 'upgcore',
    decide = 'upgdecide',
    works = 'upgworks',
    daoId = String(Date.now()),
    project = daoId,
    oldPaid = String(BigInt(daoId) + 1n),
    pending = String(BigInt(daoId) + 2n),
    nextVote = String(BigInt(daoId) + 3n),
    keys = [PrivateKey.generate('K1'), PrivateKey.generate('K1')];
  const reference = {
    chainId: researchNetwork.chainId,
    contract: runtime,
    daoId,
    interfaceVersion: 1 as const,
  };
  function cleos(args: string[]) {
    try {
      return execFileSync(
        'docker',
        [
          'exec',
          researchNetwork.container,
          'cleos',
          '--wallet-url',
          'http://127.0.0.1:8900',
          ...args,
        ],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch {
      throw new Error('OWNED_UPGRADE_STEP_REJECTED');
    }
  }
  unlockFixtureWallet(researchNetwork.container);
  for (const account of [runtime, decide, works]) {
    let exists = true;
    try {
      cleos(['get', 'account', account]);
    } catch {
      exists = false;
    }
    if (!exists)
      cleos(['create', 'account', 'eosio', account, fixtureKey('alice').toPublic().toString()]);
    cleos([
      'set',
      'account',
      'permission',
      account,
      'active',
      '--add-code',
      '-p',
      account + '@active',
    ]);
  }
  function install(account: string, directory: string, contract: string) {
    cleos([
      'set',
      'contract',
      account,
      directory,
      contract + '.wasm',
      contract + '.abi',
      '-p',
      account + '@active',
    ]);
  }
  install(runtime, '/work/.artifacts/upgrade/core', 'runtime');
  for (const [account, contract] of [
    [decide, 'decide'],
    [works, 'works'],
  ] as const)
    install(account, '/work/.artifacts/upgrade/modules', contract);
  configureFixtureContext(researchNetwork.container, runtime, { decide, works });
  const initialized = await researchRpc.v1.chain.get_table_rows({
    json: true,
    code: runtime,
    scope: runtime,
    table: 'settings',
  });
  if (!initialized.rows.length)
    await nativePush(
      runtime,
      'init',
      encodeAction('init', { chain_id: researchNetwork.chainId }),
      runtime,
      fixtureKey('alice'),
    );
  const gateway = new NativeChainGateway({
    rpcUrl: researchNetwork.url,
    chainId: researchNetwork.chainId,
    runtime,
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: fixtureKey('relay'),
    modules: [
      { id: 'decide', account: decide },
      { id: 'works', account: works },
    ],
  });
  await nativePush(
    runtime,
    'setfees',
    encodeAction('setfees', {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    }),
    runtime,
    fixtureKey('alice'),
  );
  const legacyHashes = {
    decide: Checksum256.hash(readFileSync('.artifacts/upgrade/modules/decide.wasm')).toString(),
    works: Checksum256.hash(readFileSync('.artifacts/upgrade/modules/works.wasm')).toString(),
  };
  async function configure(hashes: typeof legacyHashes) {
    for (const [account, id] of [
      [decide, 'decide'],
      [works, 'works'],
    ] as const) {
      await nativePush(
        runtime,
        'listmod',
        encodeAction('listmod', {
          account,
          publisher: 'alice',
          party: 0,
          accepts_fee_rule: 1,
          price: '0.0000 TLOS',
          code_hash: hashes[id],
          title: 'Owned upgrade fixture',
        }),
        runtime,
        fixtureKey('alice'),
      );
      await nativePush(
        runtime,
        'setmodule',
        encodeAction('setmodule', {
          dao_id: daoId,
          account,
          version: 1,
          actions: [...ModulePermissions[id].actions],
          grants: [...ModulePermissions[id].grants],
          code_hash: hashes[id],
        }),
      );
    }
  }
  await nativePush(
    runtime,
    'createdao',
    encodeAction('createdao', {
      dao_id: daoId,
      owner: 'alice',
      metadata: '{"schemaVersion":1,"title":"Legacy upgrade fixture","description":""}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    }),
  );
  const settings = {
    participant_mode: 0,
    decide,
    guardian: 'alice',
    kind: 0,
    duration: 60,
    quorum: 5000,
    approval: 5001,
    governed_works: false,
    max_commitment: '100000',
    daily_commitment: '300000',
  };
  await nativePush(runtime, 'initgov', encodeAction('initgov', { dao_id: daoId, settings }));
  for (const [i, key] of keys.entries())
    await nativePush(
      runtime,
      'enroll',
      encodeAction('enroll', {
        dao_id: daoId,
        member_id: String(i + 1),
        native_account: '',
        signing_key: key.toPublic().toString(),
        encryption_key: 'fixture',
        custody: 0,
      }),
    );
  await configure(legacyHashes);
  const tokenAbi = (await researchRpc.v1.chain.get_abi('eosio.token')).abi;
  if (!tokenAbi) throw new Error('FIXTURE_TOKEN_ABI');
  await nativePush(
    'eosio.token',
    'transfer',
    Serializer.encode({
      abi: tokenAbi,
      type: 'transfer',
      object: { from: 'alice', to: runtime, quantity: '10.0000 TLOS', memo: 'dao:' + daoId },
    }).array,
  );
  const actor = (member = '1') => ({ runtime, dao_id: daoId, member_id: member });
  async function act(target: string, action: string, bytes: Uint8Array, member = '1') {
    const person = (await gateway.table('members', daoId, member, 1))[0],
      key = keys[Number(member) - 1];
    if (!person || person.id !== member || !key) throw new Error('FIXTURE_MEMBER');
    const request = makeInstruction(
      reference,
      member,
      person.nonce,
      Math.floor(Date.now() / 1000) + 120,
      target,
      action,
      bytes,
    );
    return nativePush(
      runtime,
      'submit',
      encodeAction('submit', {
        request,
        sig: key.signDigest(instructionDigest(request)).toString(),
      }),
      'relay',
    );
  }
  await act(
    runtime,
    'putjson',
    encodeAction('putjson', {
      ...actor(),
      document_id: '1',
      version: 1,
      value: '{"legacy":"Ordinary milestone terms"}',
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
  async function propose(id: string) {
    await act(
      works,
      'propose',
      encodeWorks('propose', {
        ...actor(),
        project_id: id,
        contributor: '2',
        document_id: '1',
        document_version: 1,
        payments: ['1.0000 TLOS'],
        dues: [0],
      }),
    );
    const rows = await researchRpc.v1.chain.get_table_rows({
      json: true,
      code: works,
      scope: runtime,
      table: 'projects',
      key_type: 'i64',
      lower_bound: UInt64.from(id),
      limit: 1,
    });
    const p = WorksTableSchemas.projects.parse(rows.rows[0]);
    if (p.id !== id || !p.milestones[0]) throw new Error('FIXTURE_PROJECT');
    return p.milestones[0];
  }
  for (const id of [project, oldPaid]) {
    const milestone = await propose(id);
    await act(works, 'accept', encodeWorks('accept', { ...actor(), project_id: id }));
    await act(
      works,
      'submitwork',
      encodeWorks('submitwork', {
        ...actor('2'),
        milestone_id: milestone,
        document_id: '1',
        document_version: 1,
      }),
      '2',
    );
    await act(
      works,
      'review',
      encodeWorks('review', {
        ...actor(),
        milestone_id: milestone,
        approve: true,
        document_id: '1',
        document_version: 1,
      }),
    );
    if (id === oldPaid)
      await nativePush(
        works,
        'settle',
        encodeWorks('settle', { runtime, dao_id: daoId, milestone_id: milestone }),
        'relay',
      );
  }
  await propose(pending);
  await act(
    runtime,
    'setdaogov',
    encodeAction('setdaogov', { ...actor(), settings: { ...settings, governed_works: true } }),
  );
  const funding = (id: string) => ({
    ...actor(),
    ballot_id: id,
    works,
    project_id: pending,
    duration: 60,
    quorum: 5000,
    approval: 5001,
    metadata: '{}',
  });
  await act(decide, 'openwork', encodeDecide('openwork', funding(pending)));
  for (const member of ['1', '2'])
    await act(
      decide,
      'vote',
      encodeDecide('vote', { ...actor(member), ballot_id: pending, choice: 1 }),
      member,
    );
  // The runtime/member/obligation/ballot/project layouts are unchanged; no rows are rewritten.
  install(runtime, '/work/.artifacts/contracts', 'runtime');
  mkdirSync('.artifacts/upgrade/current', { recursive: true });
  for (const contract of ['works', 'decide']) {
    for (const ext of ['wasm', 'abi'])
      copyFileSync(
        '../daclify-backend-modules/.artifacts/contracts/' + contract + '.' + ext,
        '.artifacts/upgrade/current/' + contract + '.' + ext,
      );
    install(contract === 'works' ? works : decide, '/work/.artifacts/upgrade/current', contract);
  }
  await configure({ works: ModuleCodeHashes.works, decide: ModuleCodeHashes.decide });
  let state = await gateway.moduleState(daoId);
  const ballot = state.ballots.find((b) => b.id === pending);
  if (!ballot) throw new Error('FIXTURE_BALLOT');
  while (Math.floor(Date.now() / 1000) <= ballot.closes)
    await new Promise((resolve) => setTimeout(resolve, 500));
  await gateway.finalize({ dao: reference, ballotId: pending });
  await expect(
    nativePush(
      decide,
      'execute',
      encodeDecide('execute', { runtime, dao_id: daoId, ballot_id: pending }),
      'relay',
    ),
  ).rejects.toThrow('MODULE_CODE');
  await act(decide, 'openwork', encodeDecide('openwork', funding(nextVote)));
  state = await gateway.moduleState(daoId);
  expect(state.executions.find((p) => p.ballot_id === nextVote)?.commitment).toBe(
    state.executions.find((p) => p.ballot_id === pending)?.commitment,
  );
  expect(state.projects.find((p) => p.id === pending)?.status).toBe(0);
  const legacy = await gateway.treasury(daoId),
    approved = legacy.obligations.find((o) => o.status === 1);
  if (!approved) throw new Error('FIXTURE_APPROVED_LIABILITY');
  expect(legacy.receipts).toHaveLength(0);
  expect((await gateway.table('members', daoId, '2', 1))[0]?.claim).toBe('10000');
  const settlement = await nativePush(
    runtime,
    'payob',
    encodeAction('payob', { dao_id: daoId, source: works, source_id: approved.source_id }),
    'relay',
  );
  const withdrawalData = encodeAction('withdraw', {
    ...actor('2'),
    destination: 'bob',
    quantity: '2.0000 TLOS',
  });
  const receiverRows = await researchRpc.v1.chain.get_table_rows({
    code: 'eosio.token',
    scope: 'bob',
    table: 'accounts',
    json: true,
  });
  if (!receiverRows.rows.length)
    await expect(act(runtime, 'withdraw', withdrawalData, '2')).rejects.toThrow(
      'PAYOUT_TOKEN_ROW_REQUIRED',
    );
  await nativePush(
    'eosio.token',
    'open',
    Serializer.encode({
      abi: tokenAbi,
      type: 'open',
      object: { owner: 'bob', symbol: '4,TLOS', ram_payer: 'bob' },
    }).array,
    'bob',
    fixtureKey('bob'),
  );
  const withdrawal = await act(runtime, 'withdraw', withdrawalData, '2');
  const receipts = (await gateway.treasury(daoId)).receipts;
  expect(receipts.map((r) => r.transaction_id)).toEqual([
    settlement.transaction_id.toString(),
    withdrawal.transaction_id.toString(),
  ]);
  const report = await spendingReport(gateway, daoId);
  expect(report.summary).toMatchObject({
    settledObligations: '20000',
    legacyUnknownSettlements: '10000',
    externalCashflow: '20000',
    claims: '0',
    reserved: '0',
  });
  writeFileSync(
    '.artifacts/native/upgrade-evidence.json',
    JSON.stringify(
      {
        fixture: researchNetwork.container,
        reference,
        baseline: { core: '933f57e', modules: '3a06bea' },
        legacyHashes,
        currentHashes: { works: ModuleCodeHashes.works, decide: ModuleCodeHashes.decide },
        checks: [
          'actual-legacy-rows',
          'approved-liability-preserved',
          'old-code-pin-invalidated',
          'ordinary-commitment-unchanged',
          'legacy-settlement-labelled-unknown',
          'claims-withdrawn',
          'actual-new-receipt-ids',
        ],
        productionQualified: false,
      },
      null,
      2,
    ) + '\n',
  );
}, 100_000);
