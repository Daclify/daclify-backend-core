import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  ABI,
  APIClient,
  APIError,
  Action,
  Transaction,
  SignedTransaction,
  Name,
  Serializer,
  Checksum256,
} from '@wharfkit/antelope';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
} from '../../sdk/index.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const random = (prefix: string) =>
    prefix +
    Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join(''),
  runtime = random('ramobs'),
  source = random('arcsrc'),
  key = fixtureKey('alice'),
  api = new APIClient({ url: network.url }),
  abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8')),
  sourceHash = createHash('sha256')
    .update(readFileSync('.artifacts/contracts/permprobe.wasm'))
    .digest('hex'),
  manifestHash = randomBytes(32).toString('hex'),
  backupHash = randomBytes(32).toString('hex');
let sequence = 0;
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('OWNED_ARCHIVE_FIXTURE_REJECTED');
  }
}
async function act(name: string, data: Record<string, unknown>, actor = runtime) {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const transaction = Transaction.from({
    ...info.getTransactionHeader(60 + sequence++),
    actions: [
      Action.from(
        { account: runtime, name, authorization: [{ actor, permission: 'active' }], data },
        abi,
      ),
    ],
  });
  try {
    const result = await api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...transaction,
        signatures: [
          (actor === 'bob' ? fixtureKey('bob') : key).signDigest(
            transaction.signingDigest(network.chainId),
          ),
        ],
      }),
    );
    executedChainResult(result, transaction.id.toString());
    return transaction.id.toString();
  } catch (error) {
    const failure = z
      .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
      .safeParse(error instanceof APIError ? error.response.json : undefined);
    for (const detail of failure.success ? failure.data.error.details : []) {
      const code = detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
      if (code) throw new Error(code);
    }
    throw new Error('NATIVE_ARCHIVE_ACTION_REJECTED');
  }
}
async function rows(table: string, scope = '1') {
  return (await api.v1.chain.get_table_rows({ code: runtime, scope, table, json: true })).rows;
}
function manifest() {
  return {
    format_version: 1,
    chain_id: network.chainId,
    runtime,
    dao_id: '1',
    source,
    code_hash: sourceHash,
    abi_hash: 'ad'.repeat(32),
    block_number: 1,
    block_id: '00000001' + 'ab'.repeat(28),
    timestamp: '2026-01-01T00:00:00.000Z',
    families: [
      {
        kind: 'ordinary-poll-votes',
        parent_id: '7',
        table: 'votes',
        scope: Name.from(runtime).value.toString(),
        schema_hash: 'be'.repeat(32),
        records: '0',
        chunks: [],
      },
    ],
    files: [],
  };
}
const payload = () => ({
  dao_id: '1',
  manifest: manifest(),
  manifest_cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  manifest_bytes: 4096,
  manifest_commitment: manifestHash,
  backup_commitment: backupHash,
  retention_seconds: 7776000,
});
const digest = () =>
  Checksum256.hash(
    Serializer.encode({ abi, type: 'archive_manifest_descriptor', object: manifest() }).array,
  ).toString();
async function approve(
  action: 'archapprove' | 'archrevoke' = 'archapprove',
  commitment = backupHash,
) {
  const member = RuntimeTableSchemas.members.parse((await rows('members'))[0]),
    now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000),
    fields = {
      runtime,
      dao_id: '1',
      member_id: '1',
      manifest_commitment: manifestHash,
      descriptor_commitment: digest(),
      backup_commitment: commitment,
      retention_seconds: 7776000,
    },
    request = makeInstruction(
      { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
      '1',
      member.nonce,
      now + 120,
      runtime,
      action,
      encodeAction(action, fields),
    );
  return act('submit', { request, sig: key.signDigest(instructionDigest(request)).toString() });
}
async function measured() {
  const account = await api.v1.chain.get_account(runtime),
    counters = z
      .array(RuntimeTableSchemas.ramstats)
      .parse([...(await rows('ramstats', '0')), ...(await rows('ramstats'))]),
    observer = RuntimeTableSchemas.ramobs.parse((await rows('ramobs', runtime))[0]);
  return {
    native: BigInt(account.ram_usage.toString()),
    ledger:
      BigInt(observer.meter_bytes) +
      counters.reduce(
        (n, r) =>
          n + BigInt(r.identity) + BigInt(r.activity) + BigInt(r.retained) + BigInt(r.platform),
        0n,
      ),
  };
}
beforeAll(async () => {
  unlockFixtureWallet(network.container);
  for (const [account, contract] of [
    [runtime, 'runtime'],
    [source, 'permprobe'],
  ]) {
    if (!account || !contract) throw new Error('ARCHIVE_FIXTURE_ACCOUNT');
    cleos([
      'system',
      'newaccount',
      'alice',
      account,
      key.toPublic().toString(),
      key.toPublic().toString(),
      '--buy-ram-bytes',
      '8388608',
      '--stake-net',
      '20.0000 TLOS',
      '--stake-cpu',
      '20.0000 TLOS',
    ]);
    cleos([
      'set',
      'contract',
      account,
      '/work/.artifacts/contracts',
      contract + '.wasm',
      contract + '.abi',
      '-p',
      account + '@active',
    ]);
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
  configureFixtureContext(network.container, runtime);
  await act('init', { chain_id: network.chainId });
  await act('initramobs', {});
  await act(
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
  await act(
    'enroll',
    {
      dao_id: '1',
      member_id: '1',
      native_account: '',
      signing_key: key.toPublic().toString(),
      encryption_key: 'owned-fixture',
      custody: 0,
    },
    'alice',
  );
  await act('setfees', {
    third_party_bps: 500,
    first_party_bps: 10000,
    treasury: 'alice',
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
    names: '',
  });
  await act('listmod', {
    account: source,
    publisher: 'alice',
    party: 0,
    accepts_fee_rule: 1,
    price: '0.0000 TLOS',
    code_hash: sourceHash,
    title: 'Owned archive authority fixture',
  });
  await act('setramcode', { account: source, code_hash: sourceHash });
  await act(
    'setmodule',
    {
      dao_id: '1',
      account: source,
      version: 1,
      actions: ['vote', 'finalize'],
      grants: [],
      code_hash: sourceHash,
    },
    'alice',
  );
  await act('setarchcfg', {
    verifier: 'bob',
    minimum_retention_seconds: 7776000,
    pruning_enabled: false,
  });
}, 60000);
it('uses real native restricted attestation and signed administrator context without authorizing pruning', async () => {
  const before = await measured();
  await expect(act('archattest', payload(), 'alice')).rejects.toThrow();
  const attestationTransaction = await act('archattest', payload(), 'bob');
  expect(
    RuntimeTableSchemas.archives.parse((await rows('archives'))[0]).attestation_transaction,
  ).toBe(attestationTransaction);
  const after = await measured();
  expect(after.native - before.native).toBe(after.ledger - before.ledger);
  const fields = {
    runtime,
    dao_id: '1',
    member_id: '1',
    manifest_commitment: manifestHash,
    descriptor_commitment: digest(),
    backup_commitment: backupHash,
    retention_seconds: 7776000,
  };
  await expect(act('archapprove', fields)).rejects.toThrow('ACTOR_SENDER');
  await expect(approve('archapprove', 'ff'.repeat(32))).rejects.toThrow('ARCHIVE_COMMITMENT');
  const approvalTransaction = await approve();
  expect(RuntimeTableSchemas.archives.parse((await rows('archives'))[0]).approval_transaction).toBe(
    approvalTransaction,
  );
  expect(RuntimeTableSchemas.archives.parse((await rows('archives'))[0])).toMatchObject({
    approved_by: '1',
    revoked: false,
    manifest_commitment: manifestHash,
  });
  await act('archattest', payload(), 'bob');
  expect(await rows('archives')).toHaveLength(1);
  await approve('archrevoke');
  expect(RuntimeTableSchemas.archives.parse((await rows('archives'))[0])).toMatchObject({
    revoked: true,
  });
  const final = await measured();
  expect(final.native - before.native).toBe(final.ledger - before.ledger);
  expect(RuntimeTableSchemas.archcfg.parse((await rows('archcfg', runtime))[0])).toMatchObject({
    pruning_enabled: false,
  });
});

it('preallocates fixed completion cursors and reconciles their actual native bytes', async () => {
  const value = manifest(),
    family = value.families[0];
  if (!family) throw new Error('ARCHIVE_FIXTURE_FAMILY');
  const chunk = {
    domain: {
      format_version: 1,
      chain_id: network.chainId,
      runtime,
      dao_id: '1',
      source,
      code_hash: sourceHash,
      abi_hash: value.abi_hash,
      schema_hash: family.schema_hash,
      table: 'votes',
      scope: family.scope,
      chunk_ordinal: 0,
      leaf_count: 1,
    },
    root: 'aa'.repeat(32),
    cid: payload().manifest_cid,
    bytes: 188,
    commitment: 'bb'.repeat(32),
    first_key: '1',
    last_key: '1',
  };
  const data = {
    ...payload(),
    manifest_commitment: randomBytes(32).toString('hex'),
    manifest: { ...value, families: [{ ...family, records: '1', chunks: [chunk] }] },
  };
  const before = await measured();
  await act('archattest', data, 'bob');
  const after = await measured();
  expect(after.native - before.native).toBe(after.ledger - before.ledger);
  const positions = z.array(RuntimeTableSchemas.archpos).parse(await rows('archpos'));
  expect(positions).toMatchObject([{ archive_id: '2', chunk_ordinal: 0, pruned: 0 }]);
  await act('archattest', data, 'bob');
  expect(await measured()).toEqual(after);
});

it('reads the actual irreversible native anchor through the pinned public gateway', async () => {
  const gateway = new NativeChainGateway({
    rpcUrl: network.url,
    chainId: network.chainId,
    runtime,
    hub: null,
    environment: 'local',
    relayActor: 'bob',
    relayKey: fixtureKey('bob'),
  });
  const dao = {
    chainId: network.chainId,
    contract: runtime,
    daoId: '1',
    interfaceVersion: 1 as const,
  };
  const anchor = await gateway.archiveAnchor(dao, manifestHash);
  expect(anchor).toMatchObject({ id: '1', manifest_commitment: manifestHash, revoked: true });
  expect(await gateway.attestArchive(payload())).toMatchObject({
    id: '1',
    backup_commitment: backupHash,
    retention_seconds: 7776000,
  });
  expect(await rows('archives')).toHaveLength(2);
  await expect(
    gateway.archiveAnchor({ ...dao, contract: 'daoother' }, manifestHash),
  ).rejects.toThrow('DAO_REFERENCE');
});
