// Owned disposable chain only; shared by research module/receipt qualification tests.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import {
  Action,
  APIClient,
  APIError,
  PrivateKey,
  Transaction,
  SignedTransaction,
  Serializer,
} from '@wharfkit/antelope';
import { encodeAction, makeInstruction, instructionDigest } from '../../sdk/index.js';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { ModulePermissions } from '@daclify/modules';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { fixtureKey } from '../../tools/native/keys.js';
export const researchNetwork = z
  .object({
    url: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/),
    chainId: z.string().regex(/^[0-9a-f]{64}$/),
    container: z.enum(['daclify-research-native', 'daclify-integration-native']),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
export const researchRpc = new APIClient({ url: researchNetwork.url });
type NativePushResult = Awaited<ReturnType<APIClient['v1']['chain']['push_transaction']>>;
// Fresh headers test contract replay protection instead of the node duplicate-transaction cache.
let transactionSequence = 0;
export async function nativePush(
  account: string,
  name: string,
  data: Uint8Array,
  actor = 'alice',
  key = fixtureKey(actor),
): Promise<NativePushResult> {
  const info = await researchRpc.v1.chain.get_info();
  if (info.chain_id.toString() !== researchNetwork.chainId)
    throw new Error('FIXTURE_CHAIN_MISMATCH');
  const transaction = Transaction.from({
    ...info.getTransactionHeader(120 + (transactionSequence++ % 60)),
    actions: [
      Action.from({ account, name, authorization: [{ actor, permission: 'active' }], data }),
    ],
  });
  try {
    return await researchRpc.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: [key.signDigest(transaction.signingDigest(researchNetwork.chainId))],
      }),
    );
  } catch (cause) {
    const error = z
      .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
      .safeParse(cause instanceof APIError ? cause.response.json : undefined);
    for (const detail of error.success ? error.data.error.details : []) {
      const code = detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
      if (code) throw new Error(code);
    }
    throw new Error('NATIVE_ACTION_REJECTED');
  }
}
export async function researchDao(governedWorks = false) {
  execFileSync(process.execPath, ['--import', 'tsx', 'tools/native/install-modules.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const daoId = String(Date.now()),
    keys = [PrivateKey.generate('K1'), PrivateKey.generate('K1'), PrivateKey.generate('K1')];
  const gateway = new NativeChainGateway({
    rpcUrl: researchNetwork.url,
    chainId: researchNetwork.chainId,
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: fixtureKey('relay'),
    modules: [
      { id: 'decide', account: 'decide' },
      { id: 'works', account: 'works' },
      { id: 'payroll', account: 'payroll' },
      { id: 'grants-rounds', account: 'grants' },
      { id: 'endorsement-admission', account: 'endorse' },
    ],
  });
  const reference = {
    chainId: researchNetwork.chainId,
    contract: 'daclifycore',
    daoId,
    interfaceVersion: 1 as const,
  };
  await nativePush(
    'daclifycore',
    'setfees',
    encodeAction('setfees', {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    }),
    'daclifycore',
  );
  for (const [id, account] of [
    ['decide', 'decide'],
    ['works', 'works'],
    ['payroll', 'payroll'],
    ['grants-rounds', 'grants'],
    ['endorsement-admission', 'endorse'],
  ] as const)
    await nativePush(
      'daclifycore',
      'listmod',
      encodeAction('listmod', {
        account,
        publisher: 'alice',
        party: 0,
        accepts_fee_rule: 1,
        price: '0.0000 TLOS',
        code_hash: ModuleCodeHashes[id],
        title: 'Research fixture ' + id,
      }),
      'daclifycore',
    );
  // Run before the paid-creation fixture: production creation cannot use this bootstrap action.
  await nativePush(
    'daclifycore',
    'createdao',
    encodeAction('createdao', {
      dao_id: daoId,
      owner: 'alice',
      metadata: JSON.stringify({
        schemaVersion: 1,
        title: 'Research module fixture',
        description: '',
      }),
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    }),
  );
  await nativePush(
    'daclifycore',
    'initgov',
    encodeAction('initgov', {
      dao_id: daoId,
      settings: {
        participant_mode: 0,
        decide: 'decide',
        guardian: 'alice',
        kind: 0,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        governed_works: governedWorks,
        max_commitment: '100000',
        daily_commitment: '300000',
      },
    }),
  );
  for (const [index, key] of keys.entries())
    await nativePush(
      'daclifycore',
      'enroll',
      encodeAction('enroll', {
        dao_id: daoId,
        member_id: String(index + 1),
        native_account: '',
        signing_key: key.toPublic().toString(),
        encryption_key: 'fixture',
        custody: 0,
      }),
    );
  for (const [id, account] of [
    ['decide', 'decide'],
    ['works', 'works'],
    ['payroll', 'payroll'],
    ['grants-rounds', 'grants'],
    ['endorsement-admission', 'endorse'],
  ] as const)
    await nativePush(
      'daclifycore',
      'setmodule',
      encodeAction('setmodule', {
        dao_id: daoId,
        account,
        version: 1,
        actions: [...ModulePermissions[id].actions],
        grants: [...ModulePermissions[id].grants],
        code_hash: ModuleCodeHashes[id],
      }),
    );
  const tokenAbi = (await researchRpc.v1.chain.get_abi('eosio.token')).abi;
  if (!tokenAbi) throw new Error('FIXTURE_TOKEN_ABI');
  await nativePush(
    'eosio.token',
    'transfer',
    Serializer.encode({
      abi: tokenAbi,
      type: 'transfer',
      object: { from: 'alice', to: 'daclifycore', quantity: '10.0000 TLOS', memo: 'dao:' + daoId },
    }).array,
  );
  async function act(
    target: string,
    action: string,
    data: Uint8Array,
    member = '1',
  ): Promise<NativePushResult> {
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
      data,
    );
    return nativePush(
      'daclifycore',
      'submit',
      encodeAction('submit', {
        request,
        sig: key.signDigest(instructionDigest(request)).toString(),
      }),
      'relay',
    );
  }
  return {
    daoId,
    reference,
    keys,
    gateway,
    act,
    actor: (member = '1') => ({ runtime: 'daclifycore', dao_id: daoId, member_id: member }),
  };
}
