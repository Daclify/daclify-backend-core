import { NativeQuickBallots } from '../../services/api/src/quick-ballots/chain.js';
import { waitForIrreversibleBlock } from '../../services/api/src/chain-confirmation.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  ABI,
  Authority,
  Bytes,
  Checksum256,
  Name,
  PrivateKey,
  Serializer,
  UInt32,
  UInt64,
} from '@wharfkit/antelope';
import { z } from 'zod';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import {
  encodeQuickAnchor,
  quickAccountDigest,
  QuickAuthTableSchemas,
} from '../../sdk/quick-accounts.js';
import { CoreContextActions } from '../../sdk/permissions.js';
import { buildArchiveTree, encodeArchiveChunk } from '@daclify/modules/archive';
import { QuickBallotTableSchemas, verifyQuickBallotSnapshot } from '@daclify/modules/quick-ballots';
import { CID } from 'multiformats/cid';
import { create as multihash } from 'multiformats/hashes/digest';
import {
  createBallotKey,
  encryptBallotChoice,
  addBallotCiphertexts,
  proveBallotTally,
} from '../helpers/ballot-proof.js';

const runtime = 'daclifycore1',
  authority = 'quickauth',
  source = 'quickvote';
const zeroCipher = '00'.repeat(192);
let f: NativeProcess, core: ABI, auth: ABI, vote: ABI, sourceHash: string;
const accounts = new Map<string, z.infer<typeof QuickAuthTableSchemas.qaccounts>>();
const accountKeys = new Map<string, PrivateKey>();
const measurements: {
  account: string;
  ramAccount: string;
  action: string;
  cpuMicroseconds: number;
  ramDeltaBytes: string;
}[] = [];
const expiration = () => Math.floor(Date.now() / 1000) + 120;
function hash(parts: Uint8Array[]) {
  const bytes = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return Checksum256.hash(bytes).toString();
}
const packed = (object: Name | UInt32 | UInt64) => Serializer.encode({ object }).array;
function context(tag: string, id: string, definition: string, suffix: Uint8Array[] = []) {
  return hash([
    new TextEncoder().encode(`daclify.quick-ballot.context.${tag}.v1\0`),
    Checksum256.from(f.chainId).array,
    packed(Name.from(runtime)),
    packed(UInt64.from(id)),
    Checksum256.from(definition).array,
    packed(UInt32.from(1)),
    ...suffix,
  ]);
}
async function call(account: string, action: string, data: object, actors: string[] = ['gateway']) {
  const abi = account === runtime ? core : account === authority ? auth : vote;
  const ramAccount = account === authority && action === 'qsubmit' ? source : account;
  const before = (await f.api.v1.chain.get_account(ramAccount)).ram_usage;
  const result = await f.push(
    [
      f.action(
        account,
        action,
        data,
        actors.map((actor) => ({ actor, permission: 'active' })),
        abi,
      ),
    ],
    actors.map((actor) => f.key(actor)),
  );
  const receipt = z
    .object({ processed: z.object({ receipt: z.object({ cpu_usage_us: z.number() }) }) })
    .parse(JSON.parse(JSON.stringify(result)));
  const after = (await f.api.v1.chain.get_account(ramAccount)).ram_usage;
  measurements.push({
    account,
    ramAccount,
    action,
    cpuMicroseconds: receipt.processed.receipt.cpu_usage_us,
    ramDeltaBytes: String(BigInt(after.toString()) - BigInt(before.toString())),
  });
  return result;
}
async function rows(account: string, table: string, scope = runtime) {
  return (await f.api.v1.chain.get_table_rows({ code: account, scope, table, limit: 100 })).rows;
}
const ballotRow = z.object({
  id: z.coerce.string(),
  definition_hash: z.string(),
  count: z.number(),
  identities: z.number(),
  aggregate: z.string(),
  closed_at: z.number(),
  response_root: z.string(),
  up: z.number(),
  final_proof: z.string(),
  verified: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .transform((value) => value === true || value === 1),
});
async function ballot(id: string) {
  const page = await f.api.v1.chain.get_table_rows({
    code: source,
    scope: runtime,
    table: 'qballots',
    lower_bound: UInt64.from(id),
    limit: 1,
  });
  const value = ballotRow.parse(page.rows[0]);
  expect(value.id).toBe(id);
  return value;
}
async function executive(
  action: string,
  data: object,
  alter?: (data: string) => string,
  daoId = '1',
  target = source,
) {
  const member = z
    .object({ nonce: z.coerce.string() })
    .parse((await rows(runtime, 'members', daoId))[0]);
  const request = {
    version: 1,
    chain_id: f.chainId,
    deployment: runtime,
    dao_id: daoId,
    member_id: '1',
    nonce: member.nonce,
    expires: expiration(),
    target,
    action,
    data: Serializer.encode({
      abi: target === runtime ? core : vote,
      type: action,
      object: { runtime, dao_id: daoId, member_id: '1', ...data },
    }).hexString,
  };
  if (alter) request.data = alter(request.data);
  const signature = f
    .key('alice')
    .signDigest(
      Checksum256.hash(Serializer.encode({ abi: core, type: 'instruction', object: request })),
    );
  return call(runtime, 'submit', { request, sig: signature.toString() });
}
async function open(
  id: string,
  audience: string[] = [],
  closes = 0,
  patch: Record<string, unknown> = {},
  alter?: (data: string) => string,
  daoId = '1',
  grants = ['ab'.repeat(96)],
) {
  const definition = {
    protocol: 1,
    question: 'Should we do this?',
    explanation: 'An encrypted up/down question',
    all_accounts: !audience.length,
    audience,
    closes,
    readers: [
      { member_id: '1', encryption_key: '{"kty":"EC","crv":"P-256","x":"fixture","y":"fixture"}' },
    ],
    ...patch,
  };
  const definitionHash = hash([
    Serializer.encode({ object: 'daclify.quick-ballot.definition.v1', type: 'string' }).array,
    Checksum256.from(f.chainId).array,
    packed(Name.from(runtime)),
    packed(Name.from(source)),
    packed(UInt64.from(id)),
    packed(UInt64.from(daoId)),
    packed(UInt64.from(1)),
    Serializer.encode({ abi: vote, type: 'quick_definition', object: definition }).array,
  ]);
  const key = createBallotKey(context('key', id, definitionHash));
  // Opaque grant fixture tests native bounds/reader snapshots, not recipient decryption.
  await executive(
    'open',
    {
      ballot_id: id,
      definition,
      key: key.publicKey,
      possession: key.proof,
      grants,
    },
    alter,
    daoId,
  );
  expect((await ballot(id)).definition_hash).toBe(definitionHash);
  return { id, definitionHash, ...key };
}
async function registered(actor: string, signer = f.key(actor)) {
  const anchor = encodeQuickAnchor({ kind: 'key', publicKey: signer.toPublic().toString() });
  const cfg = QuickAuthTableSchemas.qcfg.parse((await rows(authority, 'qcfg'))[0]);
  const request = {
    version: 1,
    chain_id: f.chainId,
    runtime,
    authority,
    anchor,
    account_id: '0',
    epoch: '0',
    expires: expiration(),
  };
  await call(authority, 'qregister', {
    request,
    proof: Serializer.encode({
      object: signer.signDigest(quickAccountDigest('qregister', request)),
    }).hexString,
  });
  const page = await f.api.v1.chain.get_table_rows({
    code: authority,
    scope: runtime,
    table: 'qaccounts',
    lower_bound: UInt64.from(cfg.next_id),
    limit: 1,
  });
  const value = QuickAuthTableSchemas.qaccounts.parse(page.rows[0]);
  expect(value.id).toBe(cfg.next_id);
  accounts.set(actor, value);
  accountKeys.set(actor, signer);
}
async function accountInstruction(
  actor: string,
  action: 'respond' | 'remove',
  data: object,
  useDefault = false,
) {
  const previous = accounts.get(actor);
  if (!previous) throw Error('REGISTERED_ACCOUNT_REQUIRED');
  const page = await f.api.v1.chain.get_table_rows({
    code: authority,
    scope: runtime,
    table: 'qaccounts',
    lower_bound: UInt64.from(previous.id),
    limit: 1,
  });
  const value = QuickAuthTableSchemas.qaccounts.parse(page.rows[0]);
  const signer = accountKeys.get(actor);
  if (!signer) throw Error('REGISTERED_SIGNER_REQUIRED');
  const anchor = encodeQuickAnchor({ kind: 'key', publicKey: signer.toPublic().toString() });
  const credential = useDefault ? value.approval : anchor;
  const request = {
    control: {
      version: 1,
      chain_id: f.chainId,
      runtime,
      authority,
      anchor,
      account_id: value.id,
      epoch: value.epoch,
      nonce: value.nonce,
      expires: expiration(),
      use_default: useDefault,
    },
    target: source,
    action,
    code_hash: sourceHash,
    data: Serializer.encode({
      abi: vote,
      type: action,
      object: { actor: { runtime, authority, account_id: value.id, credential }, ...data },
    }).hexString,
  };
  return call(
    authority,
    'qsubmit',
    {
      request,
      proof: useDefault
        ? ''
        : Serializer.encode({
            object: signer.signDigest(quickAccountDigest('qsubmit', request)),
          }).hexString,
    },
    useDefault ? ['gateway', actor] : ['gateway'],
  );
}
async function respond(
  actor: string,
  b: Awaited<ReturnType<typeof open>>,
  choice: number,
  expected = '0',
  useDefault = false,
  receipt = '',
) {
  const account = accounts.get(actor);
  if (!account) throw Error('REGISTERED_ACCOUNT_REQUIRED');
  const encryption = encryptBallotChoice(
    context('response', b.id, b.definitionHash, [
      Checksum256.from(account.identity).array,
      packed(UInt64.from(BigInt(expected) + 1n)),
    ]),
    b.publicKey,
    choice,
  );
  await accountInstruction(
    actor,
    'respond',
    { ballot_id: b.id, expected_revision: expected, ...encryption, receipt },
    useDefault,
  );
  return encryption;
}
async function close(id: string) {
  await executive('close', { ballot_id: id });
}
async function prepare(id: string, limit = 25) {
  return call(source, 'prepare', { runtime, ballot_id: id, limit }, ['bob']);
}

async function age(id: string, closedAt: number) {
  const fixture = await f.deploy(
    source,
    '../daclify-backend-modules/.artifacts/contracts/quickfixture',
  );
  await call(
    runtime,
    'setramcode',
    { account: source, code_hash: (await f.api.v1.chain.get_raw_abi(source)).code_hash.toString() },
    [runtime],
  );
  await f.push(
    [
      f.action(
        source,
        'age',
        { runtime, ballot_id: id, closed_at: closedAt },
        [{ actor: source, permission: 'active' }],
        fixture,
      ),
    ],
    [f.key(source)],
  );
  await f.deploy(source, '../daclify-backend-modules/.artifacts/contracts/quickvote');
  await call(runtime, 'setramcode', { account: source, code_hash: sourceHash }, [runtime]);
  return prepare(id);
}

async function archiveChunk(
  id: string,
  daoId: string,
  table: 'qresponses' | 'qgrants',
  write: unknown,
) {
  const target = z
    .object({ processed: z.object({ block_num: z.number() }) })
    .parse(JSON.parse(JSON.stringify(write))).processed.block_num;
  let irreversible = false;
  for (let i = 0; i < 100; ++i) {
    if ((await f.api.v1.chain.get_info()).last_irreversible_block_num.toNumber() >= target) {
      irreversible = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!irreversible) throw Error('IRREVERSIBLE_SNAPSHOT_REQUIRED');
  const block = await f.api.v1.chain.get_block(target);
  const raw = z.array(z.string()).parse(
    (
      await f.api.v1.chain.get_table_rows({
        code: source,
        scope: runtime,
        table,
        limit: 100,
        json: false,
      })
    ).rows,
  );
  const type = table === 'qresponses' ? 'quick_response' : 'quick_grant';
  const records = raw.flatMap((packed) => {
    const value = Serializer.objectify(Serializer.decode({ abi: vote, type, data: packed }));
    const row = z
      .object({ id: z.coerce.string(), ballot_id: z.coerce.string().optional() })
      .parse(value);
    if ((table === 'qresponses' ? row.ballot_id : row.id) !== id) return [];
    expect(Serializer.encode({ abi: vote, type, object: value }).hexString === packed).toBe(true);
    return [{ primaryKey: row.id, packed }];
  });
  const schema =
    table === 'qresponses'
      ? 'daclify.quick-ballot.responses.row.v1'
      : 'daclify.quick-ballot.grants.row.v1';
  const domain = {
    format_version: 1 as const,
    chain_id: f.chainId,
    runtime,
    dao_id: daoId,
    source,
    code_hash: sourceHash,
    abi_hash: Checksum256.hash(Serializer.encode({ object: vote })).toString(),
    schema_hash: Checksum256.hash(new TextEncoder().encode(schema)).toString(),
    table,
    scope: Name.from(runtime).value.toString(),
    chunk_ordinal: 0,
    leaf_count: records.length,
  };
  const tree = buildArchiveTree(domain, records),
    bytes = encodeArchiveChunk(domain, records);
  const cid = (value: Uint8Array) =>
    CID.createV1(0x55, multihash(0x12, Checksum256.hash(value).array)).toString();
  const first = records[0],
    last = records.at(-1);
  if (!first || !last) throw Error('FIXTURE_ARCHIVE_ROWS');
  const manifest = {
    format_version: 1,
    chain_id: f.chainId,
    runtime,
    dao_id: daoId,
    source,
    code_hash: sourceHash,
    abi_hash: domain.abi_hash,
    block_number: target,
    block_id: block.id.toString(),
    timestamp: block.timestamp.toDate().toISOString(),
    families: [
      {
        kind: table === 'qresponses' ? 'quick-ballot-responses' : 'quick-ballot-grants',
        parent_id: id,
        table,
        scope: domain.scope,
        schema_hash: domain.schema_hash,
        records: String(records.length),
        chunks: [
          {
            domain,
            root: tree.root,
            cid: cid(bytes),
            bytes: bytes.length,
            commitment: Checksum256.hash(bytes).toString(),
            first_key: first.primaryKey,
            last_key: last.primaryKey,
          },
        ],
      },
    ],
    files: [],
  };
  const body = new TextEncoder().encode(JSON.stringify(manifest));
  // Owned verifier attestation fixture; provider upload and independent backup are qualified separately.
  const attestation = {
    dao_id: daoId,
    manifest,
    manifest_cid: cid(body),
    manifest_bytes: body.length,
    manifest_commitment: Checksum256.hash(body).toString(),
    backup_commitment: Checksum256.hash(bytes).toString(),
    retention_seconds: 90 * 86400,
  };
  await call(runtime, 'archattest', attestation, ['gateway']);
  const anchor = z
    .object({ id: z.coerce.string() })
    .parse((await rows(runtime, 'archives', daoId)).at(-1));
  return { attestation, anchor, records, tree };
}

async function createDao(daoId: string) {
  await call(
    runtime,
    'createdao',
    {
      dao_id: daoId,
      owner: 'alice',
      metadata: '{}',
      privacy: 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    },
    ['alice'],
  );
  await call(
    runtime,
    'enroll',
    {
      dao_id: daoId,
      member_id: '1',
      native_account: 'alice',
      signing_key: f.key('alice').toPublic().toString(),
      encryption_key: '{"kty":"EC","crv":"P-256","x":"fixture","y":"fixture"}',
      custody: 0,
    },
    ['alice'],
  );
  await call(
    runtime,
    'appoint',
    { dao_id: daoId, member_ids: ['1'], inactivity_seconds: 0, quorum_bps: 10000 },
    ['alice'],
  );
  await call(
    runtime,
    'setmodule',
    {
      dao_id: daoId,
      account: source,
      version: 1,
      actions: ['open', 'close'],
      grants: [],
      code_hash: sourceHash,
    },
    ['alice'],
  );
}

describe('native encrypted Quick ballot state and proofs', () => {
  beforeAll(async () => {
    f = await nativeProcess();
    const bls = f.featureDigests.get('BLS_PRIMITIVES2');
    if (!bls) throw Error('BLS_FEATURE_REQUIRED');
    await f.activate(bls);
    for (const actor of [runtime, authority, source, 'alice', 'bob', 'gateway', 'eosio.token'])
      await f.create(actor);
    core = await f.deploy(runtime, '.artifacts/contracts/runtime');
    auth = await f.deploy(authority, '.artifacts/contracts/quickauth');
    vote = await f.deploy(source, '../daclify-backend-modules/.artifacts/contracts/quickvote');
    sourceHash = (await f.api.v1.chain.get_raw_abi(source)).code_hash.toString();
    await call(runtime, 'init', { chain_id: f.chainId }, [runtime]);
    const { Authority } = await import('@wharfkit/antelope');
    for (const actor of [runtime, authority, source])
      await f.update(
        actor,
        'active',
        'owner',
        Authority.from({
          threshold: 1,
          keys: [{ key: f.key(actor).toPublic(), weight: 1 }],
          accounts: [{ permission: { actor, permission: 'eosio.code' }, weight: 1 }],
          waits: [],
        }),
      );
    for (const [actor, actions] of [
      [runtime, ['open', 'close']],
      [authority, ['respond', 'remove']],
    ] as const) {
      await f.update(
        actor,
        'execctx',
        'active',
        Authority.from({
          threshold: 1,
          keys: [],
          accounts: [{ permission: { actor, permission: 'eosio.code' }, weight: 1 }],
          waits: [],
        }),
      );
      for (const action of actions)
        await f.push(
          [
            f.system(
              'linkauth',
              { account: actor, code: source, type: action, requirement: 'execctx' },
              actor,
            ),
          ],
          [f.key(actor)],
        );
    }
    for (const action of CoreContextActions)
      await f.push(
        [
          f.system(
            'linkauth',
            { account: runtime, code: runtime, type: action, requirement: 'execctx' },
            runtime,
          ),
        ],
        [f.key(runtime)],
      );
    await call(runtime, 'initramobs', {}, [runtime]);
    for (const actor of [authority, source])
      await call(
        runtime,
        'setramcode',
        {
          account: actor,
          code_hash: (await f.api.v1.chain.get_raw_abi(actor)).code_hash.toString(),
        },
        [runtime],
      );
    await call(runtime, 'setlifecode', { account: source, code_hash: sourceHash, kind: 9 }, [
      runtime,
    ]);
    await call(
      authority,
      'qconfig',
      {
        runtime,
        source,
        code_hash: sourceHash,
        gateway: { actor: 'gateway', permission: 'active' },
        maximum: 5000,
      },
      [runtime, authority],
    );
    await call(
      source,
      'init',
      {
        runtime,
        authority,
        authority_hash: (await f.api.v1.chain.get_raw_abi(authority)).code_hash.toString(),
      },
      [runtime, source],
    );
    await call(
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
      ['alice'],
    );
    await call(
      runtime,
      'enroll',
      {
        dao_id: '1',
        member_id: '1',
        native_account: 'alice',
        signing_key: f.key('alice').toPublic().toString(),
        encryption_key: '{"kty":"EC","crv":"P-256","x":"fixture","y":"fixture"}',
        custody: 0,
      },
      ['alice'],
    );
    await call(
      runtime,
      'appoint',
      { dao_id: '1', member_ids: ['1'], inactivity_seconds: 0, quorum_bps: 10000 },
      ['alice'],
    );
    await call(
      runtime,
      'setfees',
      {
        third_party_bps: 500,
        first_party_bps: 10000,
        treasury: 'alice',
        token_contract: 'eosio.token',
        token_symbol: '4,TLOS',
        names: '',
      },
      [runtime],
    );
    await call(
      runtime,
      'listmod',
      {
        account: source,
        publisher: 'alice',
        party: 0,
        accepts_fee_rule: 1,
        price: '0.0000 TLOS',
        code_hash: sourceHash,
        title: 'Quick ballot fixture',
      },
      [runtime],
    );
    await call(
      runtime,
      'setmodule',
      {
        dao_id: '1',
        account: source,
        version: 1,
        actions: ['open', 'close'],
        grants: [],
        code_hash: sourceHash,
      },
      ['alice'],
    );
    await registered('alice');
    await registered('bob');
  }, 60000);
  afterAll(async () => {
    try {
      mkdirSync('.artifacts/quick-ballots', { recursive: true });
      writeFileSync(
        '.artifacts/quick-ballots/ballot-native-measurements.json',
        JSON.stringify(
          {
            compiler: 'CDT 4.1.1 -O=s',
            runtime: 'Spring 1.2.2',
            artifacts: Object.fromEntries(
              [
                ['runtime', '.artifacts/contracts/runtime.wasm'],
                ['quickvote', '../daclify-backend-modules/.artifacts/contracts/quickvote.wasm'],
              ].map(([name, path]) => {
                if (!name || !path) throw Error('FIXTURE_ARTIFACT');
                const bytes = readFileSync(path);
                return [
                  name,
                  { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
                ];
              }),
            ),
            measurements,
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      if (f) await f.stop();
    }
  });

  it('allows a registered nonmember to vote on an all-account ballot without disclosing its choice', async () => {
    const b = await open('101');
    const encrypted = await respond('bob', b, 1);
    expect(await ballot(b.id)).toMatchObject({
      count: 1,
      identities: 1,
      aggregate: encrypted.ciphertext,
      up: 0,
    });
    const responses = await rows(source, 'qresponses');
    expect(responses).toHaveLength(1);
    expect(responses[0]).not.toHaveProperty('choice');
    expect(responses[0]).not.toHaveProperty('up');
  });

  it('checks current selected-DAO membership using the proved credential', async () => {
    const b = await open('102', ['1']);
    await expect(respond('bob', b, 1)).rejects.toThrow('QUICK_AUDIENCE');
    await respond('alice', b, 0);
    expect((await ballot(b.id)).count).toBe(1);
  });

  it('replaces and removes one current response with monotonic revisions', async () => {
    const b = await open('103');
    await respond('bob', b, 0);
    await expect(respond('bob', b, 1)).rejects.toThrow('QUICK_REVISION');
    const changed = await respond('bob', b, 1, '1');
    expect(await ballot(b.id)).toMatchObject({
      count: 1,
      identities: 1,
      aggregate: changed.ciphertext,
    });
    await accountInstruction('bob', 'remove', { ballot_id: b.id, expected_revision: '2' });
    expect(await ballot(b.id)).toMatchObject({ count: 0, identities: 1, aggregate: zeroCipher });
    await expect(
      accountInstruction('bob', 'remove', { ballot_id: b.id, expected_revision: '2' }),
    ).rejects.toThrow('QUICK_REVISION');
    await respond('bob', b, 0, '3');
    expect((await ballot(b.id)).identities).toBe(1);
  });

  it('binds response proofs to the exact ballot, identity and revision', async () => {
    const b = await open('104');
    const encryption = encryptBallotChoice('11'.repeat(32), b.publicKey, 1);
    await expect(
      accountInstruction('bob', 'respond', {
        ballot_id: b.id,
        expected_revision: '0',
        ...encryption,
        receipt: '',
      }),
    ).rejects.toThrow('BLS_VOTE_PROOF');
    expect((await ballot(b.id)).count).toBe(0);
  });

  it('freezes the complete source before accepting a public proof of the totals', async () => {
    const b = await open('105');
    const a = await respond('alice', b, 1),
      c = await respond('bob', b, 0);
    await expect(prepare(b.id)).rejects.toThrow('QUICK_NOT_CLOSED');
    await close(b.id);
    await expect(respond('bob', b, 1, '1')).rejects.toThrow('QUICK_CLOSED');
    await prepare(b.id, 1);
    await expect(
      call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof: '00'.repeat(64) }, [
        'bob',
      ]),
    ).rejects.toThrow('QUICK_SNAPSHOT');
    await prepare(b.id, 1);
    const frozen = await ballot(b.id);
    expect(frozen.aggregate).toBe(addBallotCiphertexts(a.ciphertext, c.ciphertext));
    const transcript = context('tally', b.id, b.definitionHash, [
      Checksum256.from(frozen.response_root).array,
      packed(UInt64.from(frozen.count)),
      Bytes.from(frozen.aggregate).array,
    ]);
    const proof = proveBallotTally(transcript, b.secret, frozen.aggregate, 2n, 1n);
    await expect(
      call(source, 'finalize', { runtime, ballot_id: b.id, up: 2, proof }, ['bob']),
    ).rejects.toThrow('BLS_TALLY_PROOF');
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof }, ['bob']);
    expect(await ballot(b.id)).toMatchObject({ up: 1, final_proof: proof });
    await prepare(b.id);
    expect((await ballot(b.id)).response_root).toBe(frozen.response_root);
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof }, ['bob']);
  });

  it('requires the same valid key/proof relation for an empty closed ballot', async () => {
    const b = await open('106');
    await close(b.id);
    await prepare(b.id);
    const frozen = await ballot(b.id);
    const transcript = context('tally', b.id, b.definitionHash, [
      Checksum256.from(frozen.response_root).array,
      packed(UInt64.from(0)),
      Bytes.from(frozen.aggregate).array,
    ]);
    const proof = proveBallotTally(transcript, b.secret, zeroCipher, 0n, 0n);
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 0, proof }, ['bob']);
    expect((await ballot(b.id)).final_proof).toBe(proof);
  });

  it('rejects definition/key-reader substitution and reuse of a permanent ballot ID', async () => {
    await expect(open('101')).rejects.toThrow('QUICK_BALLOT_EXISTS');
    await expect(open('107', [], 0, { question: 'x'.repeat(257) })).rejects.toThrow(
      'QUICK_QUESTION',
    );
    await expect(
      open('107', [], 0, { readers: [{ member_id: '2', encryption_key: 'another-reader' }] }),
    ).rejects.toThrow('QUICK_READERS');
    await expect(open('107', [], 0, { audience: ['1'], all_accounts: true })).rejects.toThrow(
      'QUICK_AUDIENCE',
    );
    await expect(prepare('101', 26)).rejects.toThrow('QUICK_BATCH');
  });

  it('rejects malformed UTF-8 before persisting text that would break public table reads', async () => {
    // Four packed uint64/name fields, uint16 protocol and the one-byte question length.
    for (const bytes of ['ff', '80', 'c0af', 'e08080', 'eda080', 'f4908080'])
      await expect(
        open('111', [], 0, {}, (data) => data.slice(0, 70) + bytes + data.slice(70 + bytes.length)),
      ).rejects.toThrow('QUICK_QUESTION');
    await expect(
      open('111', [], 0, {}, (data) => data.slice(0, 104) + 'e2' + data.slice(106)),
    ).rejects.toThrow('QUICK_QUESTION');
  });

  it('retains valid international questions and explanations', async () => {
    const b = await open('114', [], 0, {
      question: '¿Qué hacemos? 🌱',
      explanation: '世界 — a shared question',
    });
    await respond('bob', b, 1);
    expect((await ballot(b.id)).count).toBe(1);
  });

  it('fits the maximum eight-reader ballot in one signed instruction under target chain limits', async () => {
    await createDao('5');
    const readers = [
      { member_id: '1', encryption_key: '{"kty":"EC","crv":"P-256","x":"fixture","y":"fixture"}' },
    ];
    for (let member = 2; member <= 8; member++) {
      const encryption_key = 'x'.repeat(256),
        member_id = String(member);
      await call(
        runtime,
        'enroll',
        {
          dao_id: '5',
          member_id,
          native_account: '',
          signing_key: PrivateKey.generate('K1').toPublic().toString(),
          encryption_key,
          custody: 0,
        },
        ['alice'],
      );
      readers.push({ member_id, encryption_key });
    }
    await call(
      runtime,
      'appoint',
      {
        dao_id: '5',
        member_ids: readers.map((reader) => reader.member_id),
        inactivity_seconds: 0,
        quorum_bps: 10000,
      },
      ['alice'],
    );
    const b = await open(
      '118',
      [],
      0,
      { question: 'x'.repeat(256), explanation: 'x'.repeat(4096), readers },
      (data) => {
        expect(data.length / 2).toBeGreaterThan(12000);
        expect(data.length / 2).toBeLessThanOrEqual(16384);
        return data;
      },
      '5',
      readers.map(() => 'ab'.repeat(768)),
    );
    expect((await ballot(b.id)).count).toBe(0);
  });

  it('deploys the exact runtime binary with eight required native signatures', async () => {
    await f.create('multisig');
    const signers = [
      f.key('multisig'),
      ...Array.from({ length: 7 }, () => PrivateKey.generate('K1')),
    ];
    await f.update(
      'multisig',
      'active',
      'owner',
      Authority.from({
        threshold: signers.length,
        keys: signers.map((signer) => ({ key: signer.toPublic(), weight: 1 })),
        accounts: [],
        waits: [],
      }),
    );
    const binary = readFileSync('.artifacts/contracts/runtime.wasm');
    await f.push(
      [
        f.system(
          'setcode',
          { account: 'multisig', vmtype: 0, vmversion: 0, code: binary },
          'multisig',
        ),
      ],
      signers,
    );
    expect((await f.api.v1.chain.get_raw_abi('multisig')).code_hash.toString()).toBe(
      Checksum256.hash(binary).toString(),
    );
  });

  it('keeps one response identity when the already-approved native wallet replaces a key-signed vote', async () => {
    const b = await open('107', ['1']);
    await respond('alice', b, 0);
    const previous = accounts.get('alice');
    if (!previous) throw Error('REGISTERED_ACCOUNT_REQUIRED');
    const page = await f.api.v1.chain.get_table_rows({
      code: authority,
      scope: runtime,
      table: 'qaccounts',
      lower_bound: UInt64.from(previous.id),
      limit: 1,
    });
    const value = QuickAuthTableSchemas.qaccounts.parse(page.rows[0]);
    const request = {
      control: {
        version: 1,
        chain_id: f.chainId,
        runtime,
        authority,
        anchor: encodeQuickAnchor({ kind: 'key', publicKey: f.key('alice').toPublic().toString() }),
        account_id: value.id,
        epoch: value.epoch,
        nonce: value.nonce,
        expires: expiration(),
        use_default: false,
      },
      method: encodeQuickAnchor({ kind: 'native', account: 'alice', permission: 'active' }),
    };
    await call(
      authority,
      'qdefault',
      {
        request,
        incoming: '',
        proof: Serializer.encode({
          object: f.key('alice').signDigest(quickAccountDigest('qdefault', request)),
        }).hexString,
      },
      ['gateway', 'alice'],
    );
    const changed = await respond('alice', b, 1, '1', true);
    expect(await ballot(b.id)).toMatchObject({
      count: 1,
      identities: 1,
      aggregate: changed.ciphertext,
    });
  });

  it('rejects forged direct account contexts even when the companion active key signs the transaction', async () => {
    const value = accounts.get('bob');
    if (!value) throw Error('REGISTERED_ACCOUNT_REQUIRED');
    await expect(
      call(
        source,
        'respond',
        {
          actor: {
            runtime,
            authority,
            account_id: value.id,
            credential: encodeQuickAnchor({
              kind: 'key',
              publicKey: f.key('bob').toPublic().toString(),
            }),
          },
          ballot_id: '101',
          expected_revision: '1',
          ciphertext: zeroCipher,
          proof: '00'.repeat(128),
          receipt: '',
        },
        [authority],
      ),
    ).rejects.toThrow('QUICK_SENDER');
  });

  it('closes voting at its deadline and records the deadline despite a delayed clock job', async () => {
    const deadline = Math.floor(Date.now() / 1000) + 2;
    const b = await open('108', [], deadline);
    await respond('bob', b, 1);
    await new Promise((resolve) => setTimeout(resolve, 3200));
    await expect(respond('bob', b, 0, '1')).rejects.toThrow('QUICK_CLOSED');
    await call(source, 'tick', { runtime, ballot_id: b.id }, ['bob']);
    expect((await ballot(b.id)).closed_at).toBe(deadline);
  });

  it('leaves an empty or lost-key ballot unverified when no valid proof is available', async () => {
    const b = await open('109');
    await close(b.id);
    await prepare(b.id);
    await expect(
      call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof: '00'.repeat(64) }, [
        'bob',
      ]),
    ).rejects.toThrow('BLS_TALLY_BOUNDS');
    await expect(
      call(source, 'finalize', { runtime, ballot_id: b.id, up: 0, proof: '00'.repeat(64) }, [
        'bob',
      ]),
    ).rejects.toThrow('BLS_PROOF_NONCE');
    expect((await ballot(b.id)).final_proof).toBe('00'.repeat(64));
  });

  it('freezes open questions during DAO closure and still accepts a valid proof after closure', async () => {
    await createDao('2');
    const b = await open('112', [], 0, {}, undefined, '2');
    await respond('bob', b, 1);
    await executive('startclose', {}, undefined, '2', runtime);
    await expect(respond('bob', b, 0, '1')).rejects.toThrow('QUICK_CLOSED');
    await call(source, 'scanclose', { runtime, dao_id: '2', limit: 1 }, ['bob']);
    await executive('closedao', {}, undefined, '2', runtime);
    await prepare(b.id);
    const frozen = await ballot(b.id);
    const transcript = context('tally', b.id, b.definitionHash, [
      Checksum256.from(frozen.response_root).array,
      packed(UInt64.from(frozen.count)),
      Bytes.from(frozen.aggregate).array,
    ]);
    const proof = proveBallotTally(transcript, b.secret, frozen.aggregate, 1n, 1n);
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof }, ['bob']);
    expect((await ballot(b.id)).final_proof).toBe(proof);
  });

  it('never prunes current or recently closed responses before the thirty-day boundary', async () => {
    const b = await open('115');
    await respond('bob', b, 1);
    const data = {
      runtime,
      ballot_id: b.id,
      archive_id: '1',
      chunk_ordinal: 0,
      start: 0,
      proofs: [{ primary_key: '1', siblings: [] }],
    };
    await expect(call(source, 'prune', data, ['bob'])).rejects.toThrow('QUICK_RETENTION');
    await close(b.id);
    await prepare(b.id);
    await expect(call(source, 'prune', data, ['bob'])).rejects.toThrow('QUICK_RETENTION');
  });

  it('still freezes, tallies and closes a DAO after its Quick module is disabled', async () => {
    await createDao('3');
    const b = await open('116', [], 0, {}, undefined, '3');
    await respond('bob', b, 1);
    await call(
      runtime,
      'setmodule',
      {
        dao_id: '3',
        account: source,
        version: 1,
        actions: [],
        grants: [],
        code_hash: '00'.repeat(32),
      },
      ['alice'],
    );
    await expect(
      accountInstruction('bob', 'remove', { ballot_id: b.id, expected_revision: '1' }),
    ).rejects.toThrow('MODULE_CODE');
    await call(source, 'tick', { runtime, ballot_id: b.id }, ['bob']);
    await prepare(b.id);
    const frozen = await ballot(b.id);
    const transcript = context('tally', b.id, b.definitionHash, [
      Checksum256.from(frozen.response_root).array,
      packed(UInt64.from(frozen.count)),
      Bytes.from(frozen.aggregate).array,
    ]);
    const proof = proveBallotTally(transcript, b.secret, frozen.aggregate, 1n, 1n);
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof }, ['bob']);
    await executive('startclose', {}, undefined, '3', runtime);
    await call(source, 'scanclose', { runtime, dao_id: '3', limit: 1 }, ['bob']);
    await executive('closedao', {}, undefined, '3', runtime);
    expect((await ballot(b.id)).final_proof).toBe(proof);
  });

  it('archives an untallied closed DAO and accepts its valid tally proof after encrypted rows are pruned', async () => {
    await createDao('4');
    const b = await open('117', [], 0, {}, undefined, '4');
    await respond('alice', b, 1);
    await respond('bob', b, 0);
    await executive('startclose', {}, undefined, '4', runtime);
    await call(source, 'scanclose', { runtime, dao_id: '4', limit: 25 }, ['bob']);
    await executive('closedao', {}, undefined, '4', runtime);
    await prepare(b.id);
    // Fresh native fixture simulates 30 days; it never appears in a deployment manifest.
    const aged = await age(b.id, Math.floor(Date.now() / 1000) - 30 * 86400);
    await call(
      runtime,
      'setarchcfg',
      { verifier: 'gateway', minimum_retention_seconds: 90 * 86400, pruning_enabled: false },
      [runtime],
    );
    const archived = await archiveChunk(b.id, '4', 'qresponses', aged);
    const grants = await archiveChunk(b.id, '4', 'qgrants', aged);
    const data = {
      runtime,
      ballot_id: b.id,
      archive_id: archived.anchor.id,
      chunk_ordinal: 0,
      start: 0,
      proofs: archived.records.map((row, at) => ({
        primary_key: row.primaryKey,
        siblings: archived.tree.proof(at),
      })),
    };
    await expect(call(source, 'prune', data, ['bob'])).rejects.toThrow('ARCHIVE_PRUNING_DISABLED');
    await call(
      runtime,
      'setarchcfg',
      { verifier: 'gateway', minimum_retention_seconds: 90 * 86400, pruning_enabled: true },
      [runtime],
    );
    const first = data.proofs[0],
      second = data.proofs[1];
    if (!first || !second) throw Error('FIXTURE_TWO_RESPONSES');
    await expect(
      call(
        source,
        'prune',
        { ...data, proofs: [first, { ...second, siblings: ['ff'.repeat(32)] }] },
        ['bob'],
      ),
    ).rejects.toThrow('ARCHIVE_PROOF');
    const retained = () =>
      rows(source, 'qresponses').then((values) =>
        values.filter(
          (value) => z.object({ ballot_id: z.coerce.string() }).parse(value).ballot_id === b.id,
        ),
      );
    expect(await retained()).toHaveLength(2);
    await call(
      runtime,
      'setarchcfg',
      { verifier: 'alice', minimum_retention_seconds: 90 * 86400, pruning_enabled: true },
      [runtime],
    );
    await expect(call(source, 'prune', data, ['bob'])).rejects.toThrow('ARCHIVE_VERIFIER_CHANGED');
    await call(
      runtime,
      'setarchcfg',
      { verifier: 'gateway', minimum_retention_seconds: 90 * 86400, pruning_enabled: true },
      [runtime],
    );
    const frozen = await ballot(b.id);
    expect(frozen.verified).toBe(false);
    await call(source, 'prune', data, ['bob']);
    await call(source, 'prune', data, ['bob']);
    expect(await retained()).toHaveLength(0);
    await call(
      source,
      'prunegrants',
      { runtime, ballot_id: b.id, archive_id: grants.anchor.id, siblings: grants.tree.proof(0) },
      ['bob'],
    );
    expect(
      (await rows(source, 'qgrants')).filter(
        (value) => z.object({ id: z.coerce.string() }).parse(value).id === b.id,
      ),
    ).toHaveLength(0);
    expect(await ballot(b.id)).toMatchObject({
      count: 2,
      identities: 2,
      aggregate: frozen.aggregate,
      response_root: frozen.response_root,
      verified: false,
    });
    const transcript = context('tally', b.id, b.definitionHash, [
      Checksum256.from(frozen.response_root).array,
      packed(UInt64.from(frozen.count)),
      Bytes.from(frozen.aggregate).array,
    ]);
    const proof = proveBallotTally(transcript, b.secret, frozen.aggregate, 2n, 1n);
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 1, proof }, ['bob']);
    expect(await ballot(b.id)).toMatchObject({ verified: true, up: 1, final_proof: proof });
  }, 30000);

  it('independently verifies the actual native snapshot with the released module SDK', async () => {
    const page = await f.api.v1.chain.get_table_rows({
      code: source,
      scope: runtime,
      table: 'qballots',
      lower_bound: UInt64.from('105'),
      limit: 1,
    });
    const frozen = QuickBallotTableSchemas.qballots.parse(page.rows[0]);
    expect(frozen.id).toBe('105');
    const responses = (await rows(source, 'qresponses'))
      .map((value) => QuickBallotTableSchemas.qresponses.parse(value))
      .filter((value) => value.ballot_id === frozen.id);
    const snapshot = { chainId: f.chainId, runtime, source, ballot: frozen, responses };
    expect(verifyQuickBallotSnapshot(snapshot).result).toEqual({ up: 1, down: 1, count: 2 });
    expect(() => verifyQuickBallotSnapshot({ ...snapshot, responses: responses.slice(1) })).toThrow(
      'QUICK_SNAPSHOT',
    );
  });

  it('qualifies native API pagination, own response lookup and permissionless snapshot/final proof submission', async () => {
    const api = new NativeQuickBallots(
      {
        rpcUrl: f.url,
        chainId: f.chainId,
        runtime,
        authority,
        source,
        gateway: { actor: 'gateway', permission: 'active' },
      },
      {
        key: f.key('gateway'),
        resources: async () => {},
        confirm: async (block) =>
          waitForIrreversibleBlock(
            async () => Number((await f.api.v1.chain.get_info()).last_irreversible_block_num),
            block,
          ),
      },
    );
    const b = await open('120');
    await respond('alice', b, 1);
    const alice = accounts.get('alice');
    if (!alice) throw Error('FIXTURE_ACCOUNT');
    expect((await api.list({ daoId: '1' })).ballots.some((row) => row.id === b.id)).toBe(true);
    expect((await api.ownResponse(b.id, { identity: alice.identity })).response).toMatchObject({
      ballot_id: b.id,
      identity: alice.identity,
      revision: '1',
      active: true,
    });
    expect((await api.ownResponse(b.id, { identity: 'ff'.repeat(32) })).response).toBeNull();
    expect((await api.responses(b.id, {})).responses).toHaveLength(1);
    expect(await api.advance(b.id)).toEqual({ transactionId: null, prepared: false });
    await executive('close', { ballot_id: b.id });
    expect((await api.advance(b.id)).prepared).toBe(true);
    const frozen = await ballot(b.id);
    const proof = proveBallotTally(
      context('tally', b.id, b.definitionHash, [
        Checksum256.from(frozen.response_root).array,
        packed(UInt64.from(frozen.count)),
        Bytes.from(frozen.aggregate).array,
      ]),
      b.secret,
      frozen.aggregate,
      1n,
      1n,
    );
    expect(
      (
        await api.finalize(b.id, {
          expectedDefinitionHash: b.definitionHash,
          expectedRoot: frozen.response_root,
          up: 1,
          proof,
        })
      ).prepared,
    ).toBe(true);
    expect(await ballot(b.id)).toMatchObject({ verified: true, up: 1 });
    await expect(
      api.finalize(b.id, {
        expectedDefinitionHash: b.definitionHash,
        expectedRoot: 'ff'.repeat(32),
        up: 1,
        proof,
      }),
    ).rejects.toThrow('QUICK_SNAPSHOT_CHANGED');
  });

  it('prepares all five thousand genuinely authorized current responses in bounded batches', async () => {
    await createDao('6');
    const b = await open('119', [], 0, {}, undefined, '6');
    await respond('alice', b, 1, '0', false, 'ab'.repeat(1024));
    await respond('bob', b, 0, '0', false, 'ab'.repeat(1024));
    for (let n = 2; n < 5000; ++n) {
      const actor = `load${n}`;
      await registered(actor, PrivateKey.generate('K1'));
      await respond(actor, b, n % 2, '0', false, 'ab'.repeat(1024));
      if ((n + 1) % 250 === 0)
        process.stdout.write(`Quick ballot load: ${n + 1}/5000 authorized votes\n`);
    }
    expect(await ballot(b.id)).toMatchObject({ count: 5000, identities: 5000 });
    await expect(registered('overflow', PrivateKey.generate('K1'))).rejects.toThrow(
      'QUICK_CAPACITY',
    );
    await executive('close', { ballot_id: b.id }, undefined, '6');
    for (let n = 0; n < 200; n++) await prepare(b.id, 25);
    const frozen = await ballot(b.id);
    const transcript = context('tally', b.id, b.definitionHash, [
      Checksum256.from(frozen.response_root).array,
      packed(UInt64.from(frozen.count)),
      Bytes.from(frozen.aggregate).array,
    ]);
    const proof = proveBallotTally(transcript, b.secret, frozen.aggregate, 5000n, 2500n);
    await call(source, 'finalize', { runtime, ballot_id: b.id, up: 2500, proof }, ['bob']);
    expect(await ballot(b.id)).toMatchObject({
      count: 5000,
      identities: 5000,
      verified: true,
      up: 2500,
    });
  }, 900000);

  it('keeps the original reader snapshot after the executive office changes', async () => {
    const b = await open('110');
    await call(
      runtime,
      'enroll',
      {
        dao_id: '1',
        member_id: '2',
        native_account: 'bob',
        signing_key: f.key('bob').toPublic().toString(),
        encryption_key: 'new-executive-key',
        custody: 0,
      },
      ['alice', 'bob'],
    );
    await call(
      runtime,
      'appoint',
      { dao_id: '1', member_ids: ['2'], inactivity_seconds: 0, quorum_bps: 10000 },
      ['alice'],
    );
    const page = await f.api.v1.chain.get_table_rows({
      code: source,
      scope: runtime,
      table: 'qballots',
      lower_bound: UInt64.from(b.id),
      limit: 1,
    });
    const snapshot = z
      .object({
        definition: z.object({ readers: z.array(z.object({ member_id: z.coerce.string() })) }),
      })
      .parse(page.rows[0]);
    expect(snapshot.definition.readers.map((reader) => reader.member_id)).toEqual(['1']);
    await expect(open('111')).rejects.toThrow('EXECUTIVE_REQUIRED');
  });
});
