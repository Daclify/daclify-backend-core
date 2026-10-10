import { ABI, Authority, PrivateKey, UInt64 } from '@wharfkit/antelope';
import { ModulePermissions } from '@daclify/modules';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { contextPermissionPlan } from '../../tools/deploy/permissions.js';
import {
  encodeAction,
  instructionDigest,
  makeInstruction,
  RuntimeCodeHash,
  RuntimeTableSchemas,
} from '../../sdk/index.js';
import { nativeProcess, type NativeProcess, type NativePushResult } from './native-process.js';

export const nativeModules = [
  { id: 'decide', account: 'decide' },
  { id: 'works', account: 'works' },
  { id: 'payroll', account: 'payroll' },
  { id: 'grants-rounds', account: 'grants' },
  { id: 'endorsement-admission', account: 'endorse' },
] as const;
export const testnetMissingLinks = [
  'setexecs',
  'heartbeat',
  'refreshgov',
  'setvoter',
  'archapprove',
  'archrevoke',
  'restoredoc',
  'govpayfees',
  'govhosted',
  'govseatfee',
  'govresources',
];

export async function nativeContracts() {
  const f: NativeProcess = await nativeProcess();
  try {
    const abis = new Map<string, ABI>();
    for (const account of [
      'alice',
      'bob',
      'carol',
      'relay',
      'recovery',
      'daclifycore',
      'daclifyhub',
      'eosio.token',
      ...nativeModules.map((module) => module.account),
    ])
      await f.create(account);
    abis.set('daclifycore', await f.deploy('daclifycore', '.artifacts/contracts/runtime'));
    abis.set('daclifyhub', await f.deploy('daclifyhub', '.artifacts/contracts/hub'));
    abis.set('eosio.token', await f.deploy('eosio.token', '.artifacts/contracts/testtoken'));
    if ((await f.api.v1.chain.get_raw_abi('daclifycore')).code_hash.toString() !== RuntimeCodeHash)
      throw new Error('FIXTURE_RUNTIME_RELEASE_MISMATCH');
    for (const module of nativeModules) {
      // Binary artifacts only; public pinned SDK hashes define the accepted release.
      const path = '../daclify-backend-modules/.artifacts/contracts/' + module.account;
      abis.set(module.account, await f.deploy(module.account, path));
      if (
        (await f.api.v1.chain.get_raw_abi(module.account)).code_hash.toString() !==
        ModuleCodeHashes[module.id]
      )
        throw new Error('FIXTURE_MODULE_RELEASE_MISMATCH');
    }
    function abi(account: string) {
      const value = abis.get(account);
      if (!value) throw new Error('FIXTURE_CONTRACT_ABI_REQUIRED');
      return value;
    }
    async function call(
      account: string,
      name: string,
      data: object,
      actor = account,
      permission = 'active',
      keys = [f.key(actor)],
    ): Promise<NativePushResult> {
      return f.push([f.action(account, name, data, [{ actor, permission }], abi(account))], keys);
    }
    const ownCode = (account: string) =>
      Authority.from({
        threshold: 1,
        keys: [{ key: f.key(account).toPublic(), weight: 1 }],
        waits: [],
        accounts: [{ permission: { actor: account, permission: 'eosio.code' }, weight: 1 }],
      });
    for (const account of ['daclifycore', ...nativeModules.map((module) => module.account)])
      await f.update(account, 'active', 'owner', ownCode(account));
    const context = contextPermissionPlan('daclifycore', nativeModules);
    await f.update('daclifycore', 'execctx', 'active', Authority.from(context.authority));
    await f.push(
      context.links
        .filter(
          (link) => link.account !== 'daclifycore' || !testnetMissingLinks.includes(link.action),
        )
        .map((link) =>
          f.system(
            'linkauth',
            {
              account: 'daclifycore',
              code: link.account,
              type: link.action,
              requirement: 'execctx',
            },
            'daclifycore',
            'owner',
          ),
        ),
      [f.key('daclifycore')],
    );
    await call('daclifycore', 'init', { chain_id: f.chainId });
    await call('eosio.token', 'create', { issuer: 'alice', maximum: '1000000.0000 TLOS' });
    await call(
      'eosio.token',
      'issue',
      { to: 'alice', quantity: '5000.0000 TLOS', memo: 'Disposable contract qualification' },
      'alice',
    );
    await call(
      'eosio.token',
      'transfer',
      { from: 'alice', to: 'bob', quantity: '1000.0000 TLOS', memo: 'Dummy DAO owner' },
      'alice',
    );
    await call('daclifycore', 'setfees', {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    });
    for (const module of nativeModules)
      await call('daclifycore', 'listmod', {
        account: module.account,
        publisher: 'alice',
        party: 0,
        accepts_fee_rule: 1,
        price: '0.0000 TLOS',
        code_hash: ModuleCodeHashes[module.id],
        title: 'Dummy ' + module.id,
      });
    const gateway = new NativeChainGateway({
      rpcUrl: f.url,
      chainId: f.chainId,
      runtime: 'daclifycore',
      hub: 'daclifyhub',
      environment: 'local',
      relayActor: 'relay',
      relayKey: f.key('relay'),
      modules: nativeModules,
    });
    let daoSequence = 90000;
    async function dummyDao(owner: 'alice' | 'bob' = 'alice', governedWorks = false) {
      const daoId = String(++daoSequence),
        keys = Array.from({ length: 3 }, () => PrivateKey.generate('K1'));
      await call(
        'daclifycore',
        'createdao',
        {
          dao_id: daoId,
          owner,
          metadata: '{}',
          privacy: 0,
          token_contract: 'eosio.token',
          token_symbol: '4,TLOS',
        },
        owner,
      );
      await call(
        'daclifycore',
        'initgov',
        {
          dao_id: daoId,
          settings: {
            participant_mode: 0,
            decide: 'decide',
            guardian: owner,
            kind: 0,
            duration: 60,
            quorum: 5000,
            approval: 5001,
            governed_works: governedWorks,
            max_commitment: '100000',
            daily_commitment: '300000',
          },
        },
        owner,
      );
      for (const [index, key] of keys.entries())
        await call(
          'daclifycore',
          'enroll',
          {
            dao_id: daoId,
            member_id: index + 1,
            native_account: '',
            signing_key: key.toPublic(),
            encryption_key: 'disposable',
            custody: 0,
          },
          owner,
        );
      for (const module of nativeModules)
        await call(
          'daclifycore',
          'setmodule',
          {
            dao_id: daoId,
            account: module.account,
            version: 1,
            actions: ModulePermissions[module.id].actions,
            grants: ModulePermissions[module.id].grants,
            code_hash: ModuleCodeHashes[module.id],
          },
          owner,
        );
      await call(
        'eosio.token',
        'transfer',
        { from: owner, to: 'daclifycore', quantity: '10.0000 TLOS', memo: 'dao:' + daoId },
        owner,
      );
      const reference = {
        chainId: f.chainId,
        contract: 'daclifycore',
        daoId,
        interfaceVersion: 1 as const,
      };
      const actor = (member = '1') => ({
        runtime: 'daclifycore',
        dao_id: daoId,
        member_id: member,
      });
      async function member(id = '1') {
        const rows = await f.api.v1.chain.get_table_rows({
          code: 'daclifycore',
          scope: daoId,
          table: 'members',
          key_type: 'i64',
          lower_bound: UInt64.from(id),
          limit: 1,
        });
        const value = RuntimeTableSchemas.members.parse(rows.rows[0]);
        if (value.id !== id) throw new Error('FIXTURE_MEMBER_REQUIRED');
        return value;
      }
      async function request(target: string, action: string, data: Uint8Array, id = '1') {
        const person = await member(id);
        return makeInstruction(
          reference,
          id,
          person.nonce,
          Math.floor(Date.now() / 1000) + 300,
          target,
          action,
          data,
        );
      }
      async function submit(
        input: ReturnType<typeof makeInstruction>,
        id = '1',
        incoming?: string,
      ): Promise<NativePushResult> {
        const key = keys[Number(id) - 1];
        if (!key) throw new Error('FIXTURE_MEMBER_KEY');
        const action = f.action(
          'daclifycore',
          'submit',
          { request: input, sig: key.signDigest(instructionDigest(input)) },
          [
            { actor: 'relay', permission: 'active' },
            ...(incoming ? [{ actor: incoming, permission: 'active' }] : []),
          ],
          abi('daclifycore'),
        );
        return f.push([action], [f.key('relay'), ...(incoming ? [f.key(incoming)] : [])]);
      }
      async function act(
        target: string,
        action: string,
        data: Uint8Array,
        id = '1',
        incoming?: string,
      ): Promise<NativePushResult> {
        return submit(await request(target, action, data, id), id, incoming);
      }
      async function document(id = '1') {
        await act(
          'daclifycore',
          'putjson',
          encodeAction('putjson', {
            ...actor(),
            document_id: id,
            version: 1,
            value: '{"test":"Native dummy DAO"}',
            envelope_version: 0,
            key_epoch: '0',
          }),
        );
      }
      return {
        daoId,
        owner,
        reference,
        keys,
        actor,
        member,
        request,
        submit,
        act,
        document,
        totals: () => gateway.dao(daoId),
        state: () => gateway.moduleState(daoId),
      };
    }
    async function executiveTree() {
      // Simulates the reviewed native tree; production handover/synchronization is pending.
      const active = Authority.from({
        threshold: 2,
        keys: [],
        waits: [],
        accounts: [
          { permission: { actor: 'alice', permission: 'active' }, weight: 1 },
          { permission: { actor: 'bob', permission: 'active' }, weight: 1 },
          { permission: { actor: 'daclifycore', permission: 'eosio.code' }, weight: 2 },
        ],
      });
      active.sort();
      await f.update('daclifycore', 'active', 'owner', active);
      await f.update(
        'daclifycore',
        'owner',
        '',
        Authority.from({
          threshold: 1,
          keys: [],
          waits: [],
          accounts: [{ permission: { actor: 'recovery', permission: 'active' }, weight: 1 }],
        }),
      );
      for (const account of ['daclifyhub', ...nativeModules.map((module) => module.account)]) {
        const owner = Authority.from({
          threshold: 1,
          keys: [],
          waits: [],
          accounts: [{ permission: { actor: 'daclifycore', permission: 'active' }, weight: 1 }],
        });
        const operational = Authority.from({
          threshold: 1,
          keys: [],
          waits: [],
          accounts: [
            ...owner.accounts,
            ...(account === 'daclifyhub'
              ? []
              : [{ permission: { actor: account, permission: 'eosio.code' }, weight: 1 }]),
          ],
        });
        operational.sort();
        await f.update(account, 'active', 'owner', operational);
        await f.update(account, 'owner', '', owner);
        await f.push(
          ['setcode', 'setabi'].map((type) =>
            f.system(
              'linkauth',
              { account, code: 'eosio', type, requirement: 'owner' },
              account,
              'owner',
            ),
          ),
          [f.key('alice'), f.key('bob')],
        );
      }
    }
    return Object.assign(f, { abi, call, context, gateway, dummyDao, executiveTree });
  } catch (error) {
    await f.stop();
    throw error;
  }
}

export type NativeContracts = Awaited<ReturnType<typeof nativeContracts>>;
export type DummyDao = Awaited<ReturnType<NativeContracts['dummyDao']>>;
