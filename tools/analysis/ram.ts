// AGPL-3.0-only. Actual C++/Spring billing on one explicitly owned local fixture.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ABI,
  Action,
  APIClient,
  PrivateKey,
  Transaction,
  SignedTransaction,
  Serializer,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { DaoRefSchema, EncryptionPublicKeySchema, EpochGrantSchema } from '../../protocol/index.js';
import {
  runtimeAbi,
  RuntimeCodeHash,
  RuntimeRawAbiHash,
  makeInstruction,
  instructionDigest,
} from '../../sdk/index.js';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { ModulePermissions } from '@daclify/modules';
import { fixtureKey } from '../native/keys.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';

const network = z
  .object({
    container: z.literal('daclify-ram-native'),
    url: z.literal('http://127.0.0.1:20488'),
    chainId: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .parse(JSON.parse(readFileSync('.artifacts/native/network.json', 'utf8')));
const api = new APIClient({ url: network.url });
const abi = ABI.from(runtimeAbi);
const decideAbi = ABI.from(readFileSync('.artifacts/module-contracts/decide.abi', 'utf8'));
const population = { daos: 200, membersPerDao: 200 };
const accounts = ['daclifycore', 'daclifyhub', 'decide', 'works', 'payroll', 'grants', 'endorse'];
const measurements: { stage: string; ramBytes: Record<string, number> }[] = [];
const samples: Record<string, number> = {};
const nonces = new Map<string, bigint>();
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const size = (text: string) => Buffer.byteLength(text);
async function rpc(path: string, data: object): Promise<unknown> {
  const response = await fetch(network.url + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`LOCAL_RPC_REJECTED:${path}`);
  return response.json();
}
function core(name: string, data: Record<string, unknown>, actor = 'alice') {
  return Action.from(
    { account: 'daclifycore', name, authorization: [{ actor, permission: 'active' }], data },
    abi,
  );
}
async function push(actions: Action[], actor = 'alice') {
  const info = await api.v1.chain.get_info();
  assert.equal(info.chain_id.toString(), network.chainId);
  const tx = Transaction.from({ ...info.getTransactionHeader(300), actions });
  const result = await api.v1.chain.push_transaction(
    SignedTransaction.from({
      ...tx,
      signatures: [fixtureKey(actor).signDigest(tx.signingDigest(network.chainId))],
    }),
  );
  executedChainResult(result, tx.id.toString());
}
async function batches(actions: Action[], actor = 'alice') {
  for (let i = 0; i < actions.length; i += 25) await push(actions.slice(i, i + 25), actor);
}
async function rows(table: string, scope: string, account = 'daclifycore') {
  return z.object({ rows: z.array(z.record(z.string(), z.unknown())), more: z.boolean() }).parse(
    await rpc('/v1/chain/get_table_rows', {
      json: true,
      code: account,
      scope,
      table,
      limit: 1000,
    }),
  );
}
async function snapshot(stage: string) {
  const ramBytes: Record<string, number> = {};
  for (const account of accounts)
    ramBytes[account] = z
      .object({ ram_usage: z.number().int().nonnegative() })
      .parse(await rpc('/v1/chain/get_account', { account_name: account })).ram_usage;
  measurements.push({ stage, ramBytes });
  writeFileSync(
    '.artifacts/ram-measurements.json',
    JSON.stringify({ population, samples, measurements }, null, 2) + '\n',
  );
  console.log(stage, JSON.stringify(ramBytes));
  return ramBytes;
}
async function instruction(
  dao: number,
  member: number,
  target: string,
  action: string,
  data: Record<string, unknown>,
) {
  const domain = DaoRefSchema.parse({
    chainId: network.chainId,
    contract: 'daclifycore',
    daoId: String(dao),
    interfaceVersion: 1,
  });
  const nonceKey = `${dao}:${member}`;
  const nonce = nonces.get(nonceKey) ?? 0n;
  nonces.set(nonceKey, nonce + 1n);
  const payload = Serializer.encode({
    abi: target === 'daclifycore' ? abi : decideAbi,
    type: action,
    object: { runtime: 'daclifycore', dao_id: String(dao), member_id: String(member), ...data },
  }).array;
  const request = makeInstruction(
    domain,
    String(member),
    String(nonce),
    Math.floor(Date.now() / 1000) + 600,
    target,
    action,
    payload,
  );
  const key = keys[member - 1];
  assert(key);
  return core(
    'submit',
    { request, sig: key.signDigest(instructionDigest(request)).toString() },
    'relay',
  );
}
const deployed = z
  .object({ code_hash: z.string(), abi_hash: z.string() })
  .parse(await rpc('/v1/chain/get_raw_abi', { account_name: 'daclifycore' }));
assert.equal(deployed.code_hash, RuntimeCodeHash);
assert.equal(deployed.abi_hash, RuntimeRawAbiHash);
assert.equal((await rows('daos', 'daclifycore')).rows.length, 0, 'Use a fresh owned fixture.');
const keys = [fixtureKey('alice'), ...Array.from({ length: 199 }, () => PrivateKey.generate('K1'))];
writeFileSync(
  '.artifacts/native/ram-member-keys.json',
  JSON.stringify(keys.map((key) => key.toString())),
  { mode: 0o600 },
);
for (const account of ['decide', 'works', 'payroll', 'grants', 'endorse']) {
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'set',
      'contract',
      account,
      '/work/.artifacts/module-contracts',
      `${account}.wasm`,
      `${account}.abi`,
      '-p',
      `${account}@active`,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  execFileSync(
    'docker',
    [
      'exec',
      network.container,
      'cleos',
      '--wallet-url',
      'http://127.0.0.1:8900',
      'set',
      'account',
      'permission',
      account,
      'active',
      '--add-code',
      '-p',
      `${account}@active`,
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
await snapshot('deployed_code_and_fixture_permissions');
await push(
  [
    Action.from(
      {
        account: 'daclifyhub',
        name: 'regdeploy',
        authorization: [{ actor: 'daclifycore', permission: 'active' }],
        data: {
          runtime: 'daclifycore',
          owner: 'daclifycore',
          chain_id: network.chainId,
          interface_version: 1,
          code_hash: RuntimeCodeHash,
          abi_hash: RuntimeRawAbiHash,
          metadata: '{"schemaVersion":1,"operator":"Simulation","daos":[]}',
          listed: true,
        },
      },
      ABI.from(readFileSync('.artifacts/contracts/hub.abi', 'utf8')),
    ),
  ],
  'daclifycore',
);
await push(
  [
    core(
      'setfees',
      {
        third_party_bps: 0,
        first_party_bps: 0,
        treasury: 'alice',
        token_contract: 'eosio.token',
        token_symbol: '4,TLOS',
        names: '',
      },
      'daclifycore',
    ),
    core(
      'setcreate',
      { shared_usd: 0, independent_usd: 5000, premium_bps: 2000, settler: 'alice' },
      'daclifycore',
    ),
    core('sethosted', { free_members: 10, settler: 'alice' }, 'daclifycore'),
  ],
  'daclifycore',
);
const metadata = JSON.stringify({
  schemaVersion: 1,
  title: 'RAM simulation DAO',
  description: 'x'.repeat(128),
});
samples.daoMetadataBytes = size(metadata);
const coordinate = Buffer.alloc(32, 1).toString('base64url');
const encryptionKey = JSON.stringify(
  EncryptionPublicKeySchema.parse({ kty: 'EC', crv: 'P-256', x: coordinate, y: coordinate }),
);
samples.memberEncryptionKeyBytes = size(encryptionKey);
// Synthetic fixed-length encrypted envelope: measures storage, not decryption correctness.
const envelope = JSON.stringify(
  EpochGrantSchema.parse({
    version: 1,
    ephemeralKey: JSON.parse(encryptionKey),
    salt: Buffer.alloc(32).toString('base64'),
    envelope: {
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: Buffer.alloc(12).toString('base64'),
      ciphertext: Buffer.alloc(48).toString('base64'),
    },
  }),
);
samples.epochEnvelopeBytes = size(envelope);
const expires = Math.floor(Date.now() / 1000) + 2592000;
const createActions: Action[] = [];
for (let dao = 1; dao <= population.daos; dao++) {
  const reference = hash(`ram-create-${dao}`);
  createActions.push(core('orderfree', { reference, creator: keys[0]?.toPublic().toString() }));
  createActions.push(
    core('createpaid', {
      dao_id: String(dao),
      owner: 'alice',
      metadata,
      privacy: dao === 2 ? 1 : 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      reference,
      creator: keys[0]?.toPublic().toString(),
    }),
  );
  createActions.push(
    core('setcapacity', {
      dao_id: String(dao),
      member_limit: 200,
      expires,
      receipt: hash(`ram-capacity-${dao}`),
    }),
  );
}
await batches(createActions);
await snapshot('200_daos_orders_and_capacity');
for (let dao = 1; dao <= population.daos; dao++) {
  const actions = keys.map((key, i) =>
    core('enroll', {
      dao_id: String(dao),
      member_id: String(i + 1),
      native_account: i === 0 ? 'alice' : '',
      signing_key: key.toPublic().toString(),
      encryption_key: encryptionKey,
      custody: 0,
    }),
  );
  await batches(actions);
  if (dao % 25 === 0) console.log(`Enrolled ${dao * 200} membership records`);
}
let membershipCount = 0;
const daoRows = await rows('daos', 'daclifycore');
assert.equal(daoRows.rows.length, 200);
for (let dao = 1; dao <= 200; dao++) {
  const members = await rows('members', String(dao));
  assert.equal(members.more, false);
  assert.equal(members.rows.length, 200);
  assert(members.rows.every((row) => row.active === true || row.active === 1));
  membershipCount += members.rows.length;
}
assert.equal(membershipCount, 40000);
await snapshot('40000_active_memberships');
const profileActions: Action[] = [];
for (let member = 1; member <= 200; member++) {
  const name =
    'sim' +
    String.fromCharCode(97 + Math.floor((member - 1) / 26)) +
    String.fromCharCode(97 + ((member - 1) % 26));
  const empty = JSON.stringify({ name, introduction: '' });
  const profile = JSON.stringify({ name, introduction: 'x'.repeat(512 - size(empty)) });
  assert.equal(size(profile), 512);
  profileActions.push(
    await instruction(1, member, 'daclifycore', 'setprofile', { account_name: name, profile }),
  );
}
await batches(profileActions, 'relay');
await snapshot('sample_200_profiles_512_bytes');
await push(
  [
    await instruction(2, 1, 'daclifycore', 'commitepoch', {
      epoch: '1',
      commitment: hash('synthetic-epoch-key'),
      self_grant: envelope,
    }),
  ],
  'relay',
);
await snapshot('sample_private_epoch_and_founder_grant');
const grantActions: Action[] = [];
for (let member = 2; member <= 200; member++)
  grantActions.push(
    await instruction(2, 1, 'daclifycore', 'grantkey', {
      recipient: String(member),
      epoch: '1',
      envelope,
    }),
  );
await batches(grantActions, 'relay');
await snapshot('sample_200_private_epoch_grants');
const cid = 'bafkreifh7ykjtd44awrofnr4wp62ryq7g3xr73ud6rgfbpwlnsglhb7vie';
const documentMetadata = JSON.stringify({ title: 'Archive example', description: 'x'.repeat(128) });
samples.documentMetadataBytes = size(documentMetadata);
const documentActions: Action[] = [];
for (let doc = 1; doc <= 100; doc++)
  documentActions.push(
    await instruction(1, 1, 'daclifycore', 'putdoc', {
      document_id: String(doc),
      version: 1,
      cid,
      metadata: documentMetadata,
      commitment: hash(`document-${doc}`),
      bytes: 1048576,
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
await batches(documentActions, 'relay');
await snapshot('sample_100_ipfs_document_records');
const actions = [...ModulePermissions.decide.actions];
const grants = [...ModulePermissions.decide.grants];
await push(
  [
    core(
      'listmod',
      {
        account: 'decide',
        publisher: 'alice',
        party: 0,
        accepts_fee_rule: 1,
        price: '0.0000 TLOS',
        code_hash: ModuleCodeHashes.decide,
        title: 'Decide',
      },
      'daclifycore',
    ),
  ],
  'daclifycore',
);
await batches(
  Array.from({ length: 200 }, (_, i) =>
    core('setmodule', {
      dao_id: String(i + 1),
      account: 'decide',
      version: 1,
      actions,
      grants,
      code_hash: ModuleCodeHashes.decide,
    }),
  ),
);
await snapshot('200_decide_installations');
const ballotMetadata = JSON.stringify({ title: 'RAM vote example', description: 'x'.repeat(128) });
samples.ballotMetadataBytes = size(ballotMetadata);
await push(
  [
    await instruction(1, 1, 'decide', 'open', {
      ballot_id: '1',
      kind: 0,
      choices: 2,
      duration: 60,
      quorum: 5000,
      approval: 5001,
      metadata: ballotMetadata,
    }),
  ],
  'relay',
);
await snapshot('sample_one_open_ballot');
const voteActions: Action[] = [];
for (let member = 1; member <= 200; member++)
  voteActions.push(await instruction(1, member, 'decide', 'vote', { ballot_id: '1', choice: 1 }));
await batches(voteActions, 'relay');
await snapshot('sample_200_votes');
assert.equal((await rows('votes', 'daclifycore', 'decide')).rows.length, 200);
const ballot = (await rows('ballots', 'daclifycore', 'decide')).rows[0];
assert(ballot);
const closes = z.number().int().parse(ballot.closes);
console.log('Waiting for the 60-second sample ballot to close.');
while (Math.floor(Date.now() / 1000) <= closes + 1)
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
await push([
  Action.from(
    {
      account: 'decide',
      name: 'finalize',
      authorization: [{ actor: 'alice', permission: 'active' }],
      data: { runtime: 'daclifycore', dao_id: '1', ballot_id: '1' },
    },
    decideAbi,
  ),
]);
await snapshot('sample_finalized_ballot_keeps_200_votes');
assert.equal((await rows('votes', 'daclifycore', 'decide')).rows.length, 200);
const jsonActions: Action[] = [];
const emptyJson = JSON.stringify({ text: '' });
const value = JSON.stringify({ text: 'x'.repeat(1024 - size(emptyJson)) });
for (let doc = 1; doc <= 100; doc++)
  jsonActions.push(
    await instruction(1, 1, 'daclifycore', 'putjson', {
      document_id: String(1000 + doc),
      version: 1,
      value,
      envelope_version: 0,
      key_epoch: '0',
    }),
  );
await batches(jsonActions, 'relay');
await snapshot('sample_100_inline_json_1024_bytes');
const beforeClone = z
  .object({ ram_usage: z.number() })
  .parse(await rpc('/v1/chain/get_account', { account_name: 'permprobe' })).ram_usage;
execFileSync(
  'docker',
  [
    'exec',
    network.container,
    'cleos',
    '--wallet-url',
    'http://127.0.0.1:8900',
    'set',
    'contract',
    'permprobe',
    '/work/.artifacts/contracts',
    'runtime.wasm',
    'runtime.abi',
    '-p',
    'permprobe@active',
  ],
  { stdio: ['pipe', 'pipe', 'pipe'] },
);
samples.additionalRuntimeCodeBytes =
  z
    .object({ ram_usage: z.number() })
    .parse(await rpc('/v1/chain/get_account', { account_name: 'permprobe' })).ram_usage -
  beforeClone;
await snapshot('additional_runtime_code_measured_separately');
console.log(
  'Verified 200 DAOs, 40,000 active memberships, native RAM deltas and 200 actual signed votes.',
);
