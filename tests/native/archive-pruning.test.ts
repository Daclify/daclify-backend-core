import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  ABI,
  APIClient,
  APIError,
  Action,
  Transaction,
  SignedTransaction,
  Serializer,
  Checksum256,
  Name,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { buildArchiveTree, archiveSourceSchema } from '@daclify/modules/archive';
import { DecideTableSchemas } from '@daclify/modules/sdk';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
} from '../../sdk/index.js';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const random = (p: string) =>
    p +
    Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join(''),
  runtime = random('ramobs'),
  source = random('arcsrc');
const key = fixtureKey('alice'),
  api = new APIClient({ url: network.url }),
  coreAbi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8')),
  decideAbi = ABI.from(
    readFileSync('../daclify-backend-modules/.artifacts/contracts/decide.abi', 'utf8'),
  ),
  seedAbi = ABI.from(
    readFileSync('../daclify-backend-modules/.artifacts/archive-aged/decide.abi', 'utf8'),
  );
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex'),
  sourceHash = hash('../daclify-backend-modules/.artifacts/contracts/decide.wasm'),
  seedHash = hash('../daclify-backend-modules/.artifacts/archive-aged/decide.wasm'),
  commitment = randomBytes(32).toString('hex'),
  backup = randomBytes(32).toString('hex');
let sequence = 0;
function cleos(args: string[]) {
  try {
    return execFileSync(
      'docker',
      ['exec', network.container, 'cleos', '--wallet-url', 'http://127.0.0.1:8900', ...args],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new Error('OWNED_PRUNE_FIXTURE_SETUP_REJECTED');
  }
}
async function act(
  account: string,
  name: string,
  data: Record<string, unknown>,
  actor = runtime,
  abi = coreAbi,
) {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const tx = Transaction.from({
    ...info.getTransactionHeader(60 + sequence++),
    actions: [
      Action.from({ account, name, authorization: [{ actor, permission: 'active' }], data }, abi),
    ],
  });
  try {
    const result = await api.v1.chain.push_transaction(
      SignedTransaction.from({
        ...tx,
        signatures: [key.signDigest(tx.signingDigest(network.chainId))],
      }),
    );
    executedChainResult(result, tx.id.toString());
    return tx.id.toString();
  } catch (error) {
    const result = z
      .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
      .safeParse(error instanceof APIError ? error.response.json : undefined);
    for (const d of result.success ? result.data.error.details : []) {
      const code = d.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
      if (code) throw new Error(code);
    }
    throw new Error('NATIVE_PRUNE_REJECTED');
  }
}
async function rows(account: string, table: string, scope = '1') {
  return (await api.v1.chain.get_table_rows({ code: account, scope, table, json: true })).rows;
}
async function signedModule(action: 'open' | 'vote', data: Record<string, unknown>) {
  const member = RuntimeTableSchemas.members.parse((await rows(runtime, 'members'))[0]),
    now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  const packed = Serializer.encode({ abi: decideAbi, type: action, object: data }).array;
  const request = makeInstruction(
    { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    '1',
    member.nonce,
    now + 120,
    source,
    action,
    packed,
  );
  return act(runtime, 'submit', {
    request,
    sig: key.signDigest(instructionDigest(request)).toString(),
  });
}
async function configureSource(codeHash: string) {
  await act(runtime, 'listmod', {
    account: source,
    publisher: 'alice',
    party: 0,
    accepts_fee_rule: 1,
    price: '0.0000 TLOS',
    code_hash: codeHash,
    title: 'Owned native Archive fixture',
  });
  await act(runtime, 'setramcode', { account: source, code_hash: codeHash });
  await act(
    runtime,
    'setmodule',
    {
      dao_id: '1',
      account: source,
      version: 1,
      actions: ['open', 'vote'],
      grants: ['govlock'],
      code_hash: codeHash,
    },
    'alice',
  );
}
beforeAll(async () => {
  unlockFixtureWallet(network.container);
  for (const [account, directory, contract] of [
    [runtime, '/work/.artifacts/contracts', 'runtime'],
    [source, '/work/../daclify-backend-modules/.artifacts/archive-aged', 'decide'],
  ]) {
    if (!account || !directory || !contract) throw new Error('PRUNE_FIXTURE_ACCOUNT');
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
    // The sibling module directory is copied into the owned container explicitly below.
    if (account === source)
      execFileSync('docker', [
        'cp',
        '../daclify-backend-modules/.artifacts/archive-aged',
        network.container + ':/tmp/daclify-archive-aged',
      ]);
    cleos([
      'set',
      'contract',
      account,
      account === source ? '/tmp/daclify-archive-aged' : directory,
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
  configureFixtureContext(network.container, runtime, { decide: source });
  await act(runtime, 'init', { chain_id: network.chainId });
  await act(runtime, 'initramobs', {});
  await act(
    runtime,
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
    runtime,
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
  await act(runtime, 'setfees', {
    third_party_bps: 500,
    first_party_bps: 10000,
    treasury: 'alice',
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
    names: '',
  });
  await configureSource(seedHash);
  await signedModule('open', {
    runtime,
    dao_id: '1',
    member_id: '1',
    ballot_id: '7',
    kind: 0,
    choices: 2,
    duration: 60,
    quorum: 5000,
    approval: 5001,
    metadata: '{}',
  });
  await signedModule('vote', { runtime, dao_id: '1', member_id: '1', ballot_id: '7', choice: 1 });
}, 60000);
it('qualifies actual native proof deletion, atomic progress, retained tallies and exact RAM decrement', async () => {
  // Fixture-only seed makes an already terminal poll old; it cannot execute after the production WASM is restored.
  // Waiting 90 days is not a useful local test strategy. The production eligibility checks and Merkle proof remain real.
  const ballot = DecideTableSchemas.ballots.parse((await rows(source, 'ballots', runtime))[0]);
  // Seed fixture action only ages finalized rows. Advance the owned node clock by waiting for the 60-second ballot close.
  const wait = Math.max(0, (ballot.closes - Math.floor(Date.now() / 1000) + 1) * 1000);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 61000)));
  await act(source, 'finalize', { runtime, dao_id: '1', ballot_id: '7' }, 'alice', seedAbi);
  await act(source, 'ageterm', { runtime, ballot_id: '7' }, source, seedAbi);
  execFileSync('docker', [
    'cp',
    '../daclify-backend-modules/.artifacts/contracts',
    network.container + ':/tmp/daclify-prune-production',
  ]);
  cleos([
    'set',
    'contract',
    source,
    '/tmp/daclify-prune-production',
    'decide.wasm',
    'decide.abi',
    '-p',
    source + '@active',
  ]);
  await configureSource(sourceHash);
  await act(runtime, 'setarchcfg', {
    verifier: runtime,
    minimum_retention_seconds: 7776000,
    pruning_enabled: true,
  });
  const vote = DecideTableSchemas.votes.parse((await rows(source, 'votes', runtime))[0]),
    schema = archiveSourceSchema('ordinary-poll-votes'),
    domain = {
      format_version: 1 as const,
      chain_id: network.chainId,
      runtime,
      dao_id: '1',
      source,
      code_hash: sourceHash,
      abi_hash: schema.rawAbiHash,
      schema_hash: schema.schemaHash,
      table: 'votes',
      scope: Name.from(runtime).value.toString(),
      chunk_ordinal: 0,
      leaf_count: 1,
    };
  const original = {
      primaryKey: vote.id,
      packed: Serializer.encode({ abi: decideAbi, type: 'vote_record', object: vote }).hexString,
    },
    tree = buildArchiveTree(domain, [original]);
  const manifest = {
    format_version: 1,
    chain_id: network.chainId,
    runtime,
    dao_id: '1',
    source,
    code_hash: sourceHash,
    abi_hash: schema.rawAbiHash,
    block_number: 1,
    block_id: '00000001' + 'ab'.repeat(28),
    timestamp: '2026-01-01T00:00:00.000Z',
    families: [
      {
        kind: 'ordinary-poll-votes',
        parent_id: '7',
        table: 'votes',
        scope: domain.scope,
        schema_hash: domain.schema_hash,
        records: '1',
        chunks: [
          {
            domain,
            root: tree.root,
            cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            bytes: 500,
            commitment,
            first_key: vote.id,
            last_key: vote.id,
          },
        ],
      },
    ],
    files: [],
  };
  await act(runtime, 'archattest', {
    dao_id: '1',
    manifest,
    manifest_cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    manifest_bytes: 4096,
    manifest_commitment: commitment,
    backup_commitment: backup,
    retention_seconds: 7776000,
  });
  const member = RuntimeTableSchemas.members.parse((await rows(runtime, 'members'))[0]),
    now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000),
    descriptor = Checksum256.hash(
      Serializer.encode({ abi: coreAbi, type: 'archive_manifest_descriptor', object: manifest })
        .array,
    ).toString();
  const request = makeInstruction(
    { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    '1',
    member.nonce,
    now + 120,
    runtime,
    'archapprove',
    encodeAction('archapprove', {
      runtime,
      dao_id: '1',
      member_id: '1',
      manifest_commitment: commitment,
      descriptor_commitment: descriptor,
      backup_commitment: backup,
      retention_seconds: 7776000,
    }),
  );
  await act(runtime, 'submit', {
    request,
    sig: key.signDigest(instructionDigest(request)).toString(),
  });
  const tally = await rows(source, 'ballots', runtime),
    before = await api.v1.chain.get_account(source),
    counterBefore = RuntimeTableSchemas.ramstats.parse(
      (await rows(runtime, 'ramstats')).find(
        (r) => RuntimeTableSchemas.ramstats.parse(r).payer === source,
      ),
    );
  const payload = {
    runtime,
    dao_id: '1',
    archive_id: '1',
    chunk_ordinal: 0,
    start: 0,
    proofs: [{ primary_key: vote.id, siblings: [] }],
  };
  await expect(
    act(
      source,
      'prunevotes',
      { ...payload, proofs: [{ primary_key: '999', siblings: [] }] },
      'alice',
      decideAbi,
    ),
  ).rejects.toThrow('ARCHIVE_ROW_ORDER');
  await act(source, 'prunevotes', payload, 'alice', decideAbi);
  expect(await rows(source, 'votes', runtime)).toEqual([]);
  expect(await rows(source, 'ballots', runtime)).toEqual(tally);
  expect((await rows(runtime, 'archpos'))[0]).toMatchObject({ pruned: 1 });
  const after = await api.v1.chain.get_account(source),
    counterAfter = RuntimeTableSchemas.ramstats.parse(
      (await rows(runtime, 'ramstats')).find(
        (r) => RuntimeTableSchemas.ramstats.parse(r).payer === source,
      ),
    );
  const platformBefore = RuntimeTableSchemas.ramstats.parse(
    (await rows(runtime, 'ramstats', '0')).find(
      (r) => RuntimeTableSchemas.ramstats.parse(r).payer === source,
    ),
  );
  expect(BigInt(before.ram_usage.toString()) - BigInt(after.ram_usage.toString())).toBe(401n);
  expect(BigInt(counterBefore.activity) - BigInt(counterAfter.activity)).toBe(289n);
  expect(platformBefore.platform).toBeDefined();
  await act(source, 'prunevotes', payload, 'alice', decideAbi);
  expect((await api.v1.chain.get_account(source)).ram_usage.toString()).toBe(
    after.ram_usage.toString(),
  );
}, 90000);
