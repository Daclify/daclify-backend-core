import { beforeAll, afterAll, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
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
  PrivateKey,
} from '@wharfkit/antelope';
import { z } from 'zod';
import {
  buildArchiveTree,
  archiveSourceSchema,
  archiveExportConsent,
} from '@daclify/modules/archive';
import { Pool } from 'pg';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AccountSchema,
  HostedUploadSchema,
  EncryptionPublicKeySchema,
  EpochGrantSchema,
} from '../../protocol/index.js';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { ContentService } from '../../services/api/src/content/service.js';
import { ArchiveHistory } from '../../services/api/src/archive/history.js';
import { EncryptedArchiveBackup } from '../../services/api/src/archive/backup.js';
import { LocalContentFixture } from '../../tools/native/content-fixture.js';
import { migrate } from '../../services/api/src/store.js';
import { DecideTableSchemas } from '@daclify/modules/sdk';
import {
  RuntimeTableSchemas,
  encodeAction,
  makeInstruction,
  instructionDigest,
  type RuntimeActions,
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
let sequence = 0,
  lastCpu = 0;
const memberKeys = new Map<string, PrivateKey>([['1', key]]);
const directory = mkdtempSync(join(tmpdir(), 'daclify-native-restore-'));
const privateDao = {
  chainId: network.chainId,
  contract: runtime,
  daoId: '2',
  interfaceVersion: 1 as const,
};
function privateClient(
  mode: 'prepare' | 'sign' | 'verify',
  input: Record<string, unknown> = {},
): unknown {
  try {
    return JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--import',
          import.meta.resolve('tsx'),
          resolve('../daclify-frontend/tools/private-recovery-fixture.ts'),
        ],
        {
          cwd: resolve('../daclify-frontend'),
          input: JSON.stringify({ mode, directory, dao: privateDao, ...input }),
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      ),
    );
  } catch {
    throw new Error('PRIVATE_RECOVERY_CLIENT_FAILED');
  }
}
const privateFixture = z
  .object({
    signingKey: z.string(),
    encryptionKey: EncryptionPublicKeySchema,
    commitment: z.string(),
    grant: EpochGrantSchema,
    file: HostedUploadSchema.pick({
      content: true,
      metadata: true,
      bytes: true,
      commitment: true,
      envelopeVersion: true,
    }),
  })
  .parse(privateClient('prepare'));
async function privateCore<K extends 'commitepoch' | 'putdoc'>(action: K, data: RuntimeActions[K]) {
  const member = RuntimeTableSchemas.members.parse((await rows(runtime, 'members', '2'))[0]);
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  const request = makeInstruction(
    privateDao,
    '1',
    member.nonce,
    now + 120,
    runtime,
    action,
    encodeAction(action, data),
  );
  const signed = z.object({ signature: z.string() }).parse(privateClient('sign', { request }));
  return act(runtime, 'submit', { request, sig: signed.signature });
}
afterAll(() => rmSync(directory, { recursive: true, force: true }));

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
    lastCpu = z
      .object({
        processed: z.object({ receipt: z.object({ cpu_usage_us: z.number().nonnegative() }) }),
      })
      .parse(result).processed.receipt.cpu_usage_us;
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
  const page = await api.v1.chain.get_table_rows({
    code: account,
    scope,
    table,
    json: true,
    limit: 100,
  });
  if (page.more) throw new Error('NATIVE_FIXTURE_ROW_LIMIT');
  return page.rows;
}
async function signedModule(action: 'open' | 'vote', data: Record<string, unknown>) {
  const memberId = z.string().parse(data.member_id),
    signer = memberKeys.get(memberId),
    member = RuntimeTableSchemas.members.parse(
      (await rows(runtime, 'members')).find(
        (r) => RuntimeTableSchemas.members.parse(r).id === memberId,
      ),
    ),
    now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  const packed = Serializer.encode({ abi: decideAbi, type: action, object: data }).array;
  const request = makeInstruction(
    { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    memberId,
    member.nonce,
    now + 120,
    source,
    action,
    packed,
  );
  return act(runtime, 'submit', {
    request,
    sig: (() => {
      if (!signer) throw new Error('FIXTURE_MEMBER_KEY');
      return signer.signDigest(instructionDigest(request)).toString();
    })(),
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
    if (account === source) {
      execFileSync('docker', [
        'exec',
        network.container,
        'mkdir',
        '-p',
        '/tmp/daclify-archive-aged',
      ]);
      for (const extension of ['wasm', 'abi'])
        execFileSync('docker', [
          'cp',
          '../daclify-backend-modules/.artifacts/archive-aged/decide.' + extension,
          network.container + ':/tmp/daclify-archive-aged/decide.' + extension,
        ]);
    }
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

  await act(
    runtime,
    'createdao',
    {
      dao_id: '2',
      owner: 'alice',
      metadata: '{}',
      privacy: 1,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    'alice',
  );
  await act(
    runtime,
    'enroll',
    {
      dao_id: '2',
      member_id: '1',
      native_account: '',
      signing_key: privateFixture.signingKey,
      encryption_key: JSON.stringify(privateFixture.encryptionKey),
      custody: 0,
    },
    'alice',
  );
  await privateCore('commitepoch', {
    runtime,
    dao_id: '2',
    member_id: '1',
    epoch: '1',
    commitment: privateFixture.commitment,
    self_grant: JSON.stringify(privateFixture.grant),
  });
  await act(runtime, 'setfees', {
    third_party_bps: 500,
    first_party_bps: 10000,
    treasury: 'alice',
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
    names: '',
  });
  await act(runtime, 'sethosted', { free_members: 50, settler: runtime });
  for (let id = 2; id <= 25; id++) {
    const signer = PrivateKey.generate('K1');
    memberKeys.set(String(id), signer);
    await act(
      runtime,
      'enroll',
      {
        dao_id: '1',
        member_id: String(id),
        native_account: '',
        signing_key: signer.toPublic().toString(),
        encryption_key: 'owned-fixture',
        custody: 0,
      },
      'alice',
    );
  }
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
  for (let id = 2; id <= 25; id++)
    await signedModule('vote', {
      runtime,
      dao_id: '1',
      member_id: String(id),
      ballot_id: '7',
      choice: 1,
    });
  await signedModule('open', {
    runtime,
    dao_id: '1',
    member_id: '1',
    ballot_id: '8',
    kind: 0,
    choices: 2,
    duration: 60,
    quorum: 100,
    approval: 5001,
    metadata: '{}',
  });
  await signedModule('vote', { runtime, dao_id: '1', member_id: '1', ballot_id: '8', choice: 0 });
}, 60000);
it('qualifies 25 native deletions with depth-16 proofs, atomic rollback/progress, retained tallies and exact RAM decrement', async () => {
  // Fixture-only seed makes an already terminal poll old; it cannot execute after the production WASM is restored.
  // Waiting 90 days is not a useful local test strategy. The production eligibility checks and Merkle proof remain real.
  // Seed fixture action only ages finalized rows. Advance the owned node clock by waiting for the 60-second ballot close.
  const lastClose = Math.max(
    ...z
      .array(DecideTableSchemas.ballots)
      .parse(await rows(source, 'ballots', runtime))
      .map((row) => row.closes),
  );
  const wait = Math.max(0, (lastClose - Math.floor(Date.now() / 1000) + 1) * 1000);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 61000)));
  await act(source, 'finalize', { runtime, dao_id: '1', ballot_id: '7' }, 'alice', seedAbi);
  await act(source, 'ageterm', { runtime, ballot_id: '7' }, source, seedAbi);
  await act(source, 'finalize', { runtime, dao_id: '1', ballot_id: '8' }, 'alice', seedAbi);
  await act(source, 'ageterm', { runtime, ballot_id: '8' }, source, seedAbi);
  execFileSync('docker', [
    'exec',
    network.container,
    'mkdir',
    '-p',
    '/tmp/daclify-prune-production',
  ]);
  for (const extension of ['wasm', 'abi'])
    execFileSync('docker', [
      'cp',
      '../daclify-backend-modules/.artifacts/contracts/decide.' + extension,
      network.container + ':/tmp/daclify-prune-production/decide.' + extension,
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
  const sourceAccount = await api.v1.chain.get_account(source);
  const sourceCounter = RuntimeTableSchemas.ramstats.parse(
    (await rows(runtime, 'ramstats')).find(
      (r) => RuntimeTableSchemas.ramstats.parse(r).payer === source,
    ),
  );
  const sharedCounter = RuntimeTableSchemas.ramstats.parse(
    (await rows(runtime, 'ramstats', '0')).find(
      (r) => RuntimeTableSchemas.ramstats.parse(r).payer === source,
    ),
  );
  const sourceMeasured = [sourceCounter, sharedCounter].reduce(
    (sum, r) =>
      sum + BigInt(r.identity) + BigInt(r.activity) + BigInt(r.retained) + BigInt(r.platform),
    0n,
  );
  const sourcePool = {
    payer: source,
    expected_quota: sourceAccount.ram_quota.toString(),
    baseline_bytes: (BigInt(sourceAccount.ram_usage.toString()) - sourceMeasured).toString(),
    platform_headroom: '131072',
  };
  await expect(act(runtime, 'setrampool', sourcePool)).rejects.toThrow('RAM_PAYER_RUNTIME');
  await act(source, 'bindrampool', { runtime }, source, decideAbi);
  await act(source, 'bindrampool', { runtime }, source, decideAbi);
  await expect(act(source, 'bindrampool', { runtime: 'alice' }, source, decideAbi)).rejects.toThrow(
    'RAM_PAYER_RUNTIME',
  );
  await expect(
    act(
      source,
      'open',
      {
        runtime: 'alice',
        dao_id: '1',
        member_id: '1',
        ballot_id: '8',
        kind: 0,
        choices: 2,
        duration: 60,
        quorum: 5000,
        approval: 5001,
        metadata: '{}',
      },
      'alice',
      decideAbi,
    ),
  ).rejects.toThrow('RAM_PAYER_RUNTIME');
  await act(runtime, 'setrampool', sourcePool);
  await act(runtime, 'grantdaoram', {
    dao_id: '1',
    payer: source,
    reference: '1',
    activity: '262144',
    identity: '0',
    completion: '32768',
  });
  await act(runtime, 'setarchcfg', {
    verifier: runtime,
    minimum_retention_seconds: 7776000,
    pruning_enabled: true,
  });
  const votes = z
      .array(DecideTableSchemas.votes)
      .parse(await rows(source, 'votes', runtime))
      .filter((row) => row.ballot === '7'),
    vote = votes[0],
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
      leaf_count: 65536,
    };
  if (!vote || votes.length !== 25) throw new Error('EXPECTED_25_NATIVE_VOTES');
  // Unposted padding leaves exercise maximum proof depth; this is a CPU/atomicity fixture, not export-completeness evidence.
  const originals = Array.from({ length: 65536 }, (_, index) => {
      const row = votes[index] ?? { ...vote, id: String(index + 1), member: String(index + 1) };
      return {
        primaryKey: row.id,
        packed: Serializer.encode({ abi: decideAbi, type: 'vote_record', object: row }).hexString,
      };
    }),
    tree = buildArchiveTree(domain, originals);
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
        records: '65536',
        chunks: [
          {
            domain,
            root: tree.root,
            cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            bytes: 4000000,
            commitment,
            first_key: vote.id,
            last_key: '65536',
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
    proofs: votes.map((v, index) => ({ primary_key: v.id, siblings: tree.proof(index) })),
  };
  const actionBytes = Serializer.encode({ abi: decideAbi, type: 'prunevotes', object: payload })
    .array.length;
  expect(actionBytes).toBeLessThanOrEqual(16384);
  expect(payload.proofs.every((proof) => proof.siblings?.length === 16)).toBe(true);
  await expect(
    act(
      source,
      'prunevotes',
      { ...payload, proofs: [{ primary_key: '999999', siblings: [] }] },
      'alice',
      decideAbi,
    ),
  ).rejects.toThrow('ARCHIVE_ROW_ORDER');
  const broken = payload.proofs.map((proof, index) =>
    index === 24
      ? { ...proof, siblings: Array.from({ length: 16 }, () => '00'.repeat(32)) }
      : proof,
  );
  await expect(
    act(source, 'prunevotes', { ...payload, proofs: broken }, 'alice', decideAbi),
  ).rejects.toThrow('ARCHIVE_PROOF');
  expect(
    z
      .array(DecideTableSchemas.votes)
      .parse(await rows(source, 'votes', runtime))
      .filter((row) => row.ballot === '7'),
  ).toEqual(votes);
  expect((await rows(runtime, 'archpos'))[0]).toMatchObject({ pruned: 0 });
  expect((await api.v1.chain.get_account(source)).ram_usage.toString()).toBe(
    before.ram_usage.toString(),
  );
  await act(source, 'prunevotes', payload, 'alice', decideAbi);
  const batchCpu = lastCpu;
  expect(
    z
      .array(DecideTableSchemas.votes)
      .parse(await rows(source, 'votes', runtime))
      .filter((row) => row.ballot === '7'),
  ).toEqual([]);
  expect(await rows(source, 'ballots', runtime)).toEqual(tally);
  expect((await rows(runtime, 'archpos'))[0]).toMatchObject({ pruned: 25 });
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
  expect(BigInt(before.ram_usage.toString()) - BigInt(after.ram_usage.toString())).toBe(7225n);
  expect(BigInt(counterBefore.activity) - BigInt(counterAfter.activity)).toBe(7225n);
  expect(platformBefore.platform).toBeDefined();
  await act(source, 'prunevotes', payload, 'alice', decideAbi);
  expect((await api.v1.chain.get_account(source)).ram_usage.toString()).toBe(
    after.ram_usage.toString(),
  );
  writeFileSync(
    '.artifacts/native-max-pruning.json',
    JSON.stringify(
      {
        runtime,
        source,
        rows: 25,
        proofDepth: 16,
        actionBytes,
        cpuMicroseconds: batchCpu,
        freedBytes: '7225',
        unusedLeaves: 'synthetic padding',
        replayFreedBytes: '0',
      },
      null,
      2,
    ),
  );
}, 120000);

it('exports, verifies, backs up, approves and prunes actual native votes, then rebuilds from an empty database and decrypts a retained private file with its original kit', async () => {
  const url = process.env.DATABASE_URL;
  if (
    !url ||
    new URL(url).hostname !== '127.0.0.1' ||
    new URL(url).port !== '18532' ||
    !new URL(url).pathname.endsWith('_test')
  )
    throw new Error('OWNED_RESOURCES_DATABASE_REQUIRED');
  const coordinator = new Pool({ connectionString: url }),
    database = 'daclify_native_restore_' + randomUUID().replaceAll('-', '') + '_test';
  const restoredUrl = new URL(url);
  restoredUrl.pathname = '/' + database;
  await coordinator.query(`CREATE DATABASE "${database}"`);
  let pool = new Pool({ connectionString: restoredUrl.toString() });
  const dao = { ...privateDao, daoId: '1' },
    provider = new LocalContentFixture(join(directory, 'pins'));
  const account = AccountSchema.parse({
    id: randomUUID(),
    signingKey: key.toPublic().toString(),
    encryptionKey: privateFixture.encryptionKey,
    custody: 'user-controlled',
  });
  const privateAccount = AccountSchema.parse({
    ...account,
    id: randomUUID(),
    signingKey: privateFixture.signingKey,
  });
  const gateway = () =>
    new NativeChainGateway(
      {
        rpcUrl: network.url,
        chainId: network.chainId,
        runtime,
        hub: null,
        environment: 'local',
        relayActor: runtime,
        relayKey: key,
        modules: [{ id: 'decide', account: source }],
      },
      pool,
    );
  const register = async () => {
    for (const user of [account, privateAccount])
      await pool.query(
        'INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,$2,$3,$4)',
        [user.id, user.signingKey, user.encryptionKey, user.custody],
      );
  };
  try {
    await migrate(pool);
    await register();
    const chain = gateway(),
      backup = new EncryptedArchiveBackup({
        directory: join(directory, 'backup'),
        storeId: 'owned-native-restore',
        keyId: 'disposable-drill',
        key: randomBytes(32),
      });
    const content = new ContentService(
      pool,
      chain,
      provider,
      100_000_000n,
      'local-fixture',
      'local-fixture',
      backup,
    );
    const pin = await provider.upload(
      randomUUID(),
      Buffer.from(privateFixture.file.content, 'base64'),
    );
    await privateCore('putdoc', {
      runtime,
      dao_id: '2',
      member_id: '1',
      document_id: '7',
      version: 1,
      cid: pin.cid,
      metadata: '{}',
      commitment: privateFixture.file.commitment,
      bytes: privateFixture.file.bytes,
      envelope_version: 1,
      key_epoch: '1',
    });
    const originalPrivate = await chain.content('2'),
      originalVotes = await chain.archiveLiveVotes({ dao, parentId: '8' });
    expect(originalVotes).toHaveLength(1);
    const info = await api.v1.chain.get_info();
    for (let i = 0; i < 30; i++) {
      if (
        Number((await api.v1.chain.get_info()).last_irreversible_block_num) >=
        Number(info.head_block_num)
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const selection = { dao, ballotIds: ['8'], retentionSeconds: 90 * 86400 },
      plan = await chain.archivePreview(selection);
    expect(plan.blocked).toEqual([]);
    expect(plan.families[0]?.chunks.flatMap((c) => c.rows)).toHaveLength(1);
    const created = await content.archive.create(account, {
      requestId: randomUUID(),
      selection,
      ...archiveExportConsent(plan),
    });
    let completed = false;
    for (let i = 0; i < 12; i++) {
      if ((await content.archive.reconcile(created.id)) === 'completed') {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);
    const bundle = await content.archive.bundle(account, created.id),
      backed = await content.archive.backup(account, created.id, bundle.manifestFile.commitment);
    if (!backed.backup) throw new Error('EXPECTED_INDEPENDENT_BACKUP');
    const attested = await content.archive.attest(account, created.id, {
      manifestCommitment: bundle.manifestFile.commitment,
      descriptorCommitment: bundle.manifest.descriptorCommitment,
      backupCommitment: backed.backup.commitment,
      retentionSeconds: selection.retentionSeconds,
    });
    expect(attested.anchor?.approved_by).toBe('0');
    const member = RuntimeTableSchemas.members.parse((await rows(runtime, 'members'))[0]),
      now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
    const request = makeInstruction(
      dao,
      '1',
      member.nonce,
      now + 120,
      runtime,
      'archapprove',
      encodeAction('archapprove', {
        runtime,
        dao_id: '1',
        member_id: '1',
        manifest_commitment: bundle.manifestFile.commitment,
        descriptor_commitment: bundle.manifest.descriptorCommitment,
        backup_commitment: backed.backup.commitment,
        retention_seconds: selection.retentionSeconds,
      }),
    );
    await act(runtime, 'submit', {
      request,
      sig: key.signDigest(instructionDigest(request)).toString(),
    });
    const before = await api.v1.chain.get_account(source);
    expect(
      (await content.archive.prune(account, created.id, bundle.manifestFile.commitment)).state,
    ).toBe('pruning');
    expect(
      (await content.archive.prune(account, created.id, bundle.manifestFile.commitment)).state,
    ).toBe('completed');
    expect(await chain.archiveLiveVotes({ dao, parentId: '8' })).toEqual([]);
    expect(
      BigInt(before.ram_usage.toString()) -
        BigInt((await api.v1.chain.get_account(source)).ram_usage.toString()),
    ).toBe(401n);

    await pool.end();
    await coordinator.query(`DROP DATABASE "${database}"`);
    await coordinator.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ connectionString: restoredUrl.toString() });
    await migrate(pool);
    for (const table of [
      'accounts',
      'archive_exports',
      'uploads',
      'hosted_objects',
      'storage_invoices',
      'native_links',
      'evm_links',
    ])
      expect((await pool.query(`SELECT count(*)::text AS count FROM ${table}`)).rows[0]).toEqual({
        count: '0',
      });
    // Re-import public account identity. No old pairing, invoice, export UUID or private key is supplied to the API.
    await register();
    const recoveredChain = gateway(),
      history = new ArchiveHistory(recoveredChain, provider),
      recoveredContent = new ContentService(
        pool,
        recoveredChain,
        provider,
        100_000_000n,
        'local-fixture',
        'local-fixture',
      );
    const discovered = await history.list(account, { dao });
    expect(
      discovered.anchors.some((a) => a.manifest_commitment === bundle.manifestFile.commitment),
    ).toBe(true);
    const page = await history.page(account, {
      dao,
      manifestCommitment: bundle.manifestFile.commitment,
    });
    expect(page.records).toEqual(originalVotes);
    expect(page.liveRowsIncluded).toBe(true);
    expect(
      (await history.recover(account, { dao, manifestCommitment: bundle.manifestFile.commitment }))
        .manifest,
    ).toEqual(bundle.manifest);
    const archives = await recoveredContent.recoverStorage(account, {
      dao,
      kind: 'archive',
      after: attested.anchor?.id,
    });
    expect(archives.billingRestored).toBe(false);
    expect(archives.objects).toHaveLength(2);
    expect(archives.objects.every((o) => o.state === 'recovered')).toBe(true);
    const files = await recoveredContent.recoverStorage(privateAccount, {
      dao: privateDao,
      kind: 'document-version',
    });
    expect(files.objects).toMatchObject([{ cid: pin.cid, state: 'recovered' }]);
    const recoveredPrivate = await recoveredChain.content('2');
    expect(recoveredPrivate.documents).toEqual(originalPrivate.documents);
    expect(recoveredPrivate.epochs).toEqual(originalPrivate.epochs);
    expect(recoveredPrivate.keyGrants).toEqual(originalPrivate.keyGrants);
    const bytes = await recoveredContent.retrieve('2', '7', 1);
    expect(bytes).toEqual(Buffer.from(privateFixture.file.content, 'base64'));
    const client = z
      .object({
        originalKitDecrypted: z.literal(true),
        replacementKitRejected: z.literal(true),
        plaintextBytes: z.number().positive(),
      })
      .parse(
        privateClient('verify', {
          document: recoveredPrivate.documents[0],
          epoch: recoveredPrivate.epochs[0],
          grant: recoveredPrivate.keyGrants[0],
          content: Buffer.from(bytes).toString('base64'),
        }),
      );
    expect(
      (await pool.query('SELECT count(*)::text AS count FROM storage_invoices')).rows[0],
    ).toEqual({ count: '0' });
    const retrieve = provider.retrieve.bind(provider);
    provider.retrieve = async () => {
      throw new Error('Synthetic primary loss');
    };
    await expect(
      history.page(account, { dao, manifestCommitment: bundle.manifestFile.commitment }),
    ).rejects.toThrow('ARCHIVE_BUNDLE_UNAVAILABLE');
    provider.retrieve = async (cid, count) => {
      const value = await retrieve(cid, count);
      value[0] = (value[0] ?? 0) ^ 1;
      return value;
    };
    await expect(
      history.page(account, { dao, manifestCommitment: bundle.manifestFile.commitment }),
    ).rejects.toThrow('ARCHIVE_BUNDLE_UNAVAILABLE');
    writeFileSync(
      '.artifacts/native-database-recovery.json',
      JSON.stringify(
        {
          runtime,
          source,
          votes: originalVotes.length,
          freedBytes: '401',
          freshDatabaseRecreated: true,
          archivePinsRecovered: archives.objects.length,
          privateFilePinsRecovered: files.objects.length,
          billingInvented: false,
          ...client,
          limits: [
            'Owned native system and local disk provider; no live Pinata/Stripe proof.',
            'Private document, epoch and grant remain on chain; document pruning is still disabled.',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
    await coordinator.query(`DROP DATABASE IF EXISTS "${database}"`);
    await coordinator.end();
  }
}, 120000);
