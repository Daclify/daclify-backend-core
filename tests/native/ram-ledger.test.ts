import { Pool } from 'pg';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import {
  APIClient,
  APIError,
  Action,
  ABI,
  Transaction,
  SignedTransaction,
  Serializer,
  Checksum256,
  PrivateKey,
  Name,
} from '@wharfkit/antelope';
import { fixtureNetwork } from '../../tools/native/network.js';
import { fixtureKey } from '../../tools/native/keys.js';
import { unlockFixtureWallet } from '../../tools/native/wallet.js';
import { executedChainResult } from '../../services/api/src/chain-result.js';
import { configureFixtureContext } from '../../tools/native/permissions.js';
import { ModulePermissions } from '@daclify/modules';
import { buildArchiveTree } from '@daclify/modules/archive';
import { RuntimeTableSchemas } from '../../sdk/index.js';
import { DecideTableSchemas } from '@daclify/modules/sdk';
const network = fixtureNetwork();
if (network.container !== 'daclify-resources-native' || network.url !== 'http://127.0.0.1:20588')
  throw new Error('OWNED_RESOURCE_FIXTURE_REQUIRED');
const runtime =
    'ramobs' +
    Array.from(randomBytes(6), (v) => '12345abcdefghijklmnopqrstuvwxyz'.charAt(v % 31)).join(''),
  api = new APIClient({ url: network.url });
const abi = ABI.from(readFileSync('.artifacts/contracts/runtime.abi', 'utf8'));
const key = fixtureKey('alice');
const daoScopes = ['0', '1', '2', Name.from(runtime).value.toString()];
let seq = 0;
function cleos(args: string[]) {
  try {
    const result = execFileSync(
      'docker',
      [
        'exec',
        network.container,
        'cleos',
        '--wallet-url',
        'http://127.0.0.1:8900',
        ...args,
        ...(args[0] === 'push' ? ['-j'] : []),
      ],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (args[0] === 'push') {
      const raw: unknown = JSON.parse(result);
      executedChainResult(raw, z.object({ transaction_id: z.string() }).parse(raw).transaction_id);
    }
    return result;
  } catch {
    throw new Error('RAM_LEDGER_FIXTURE_REJECTED');
  }
}
async function rpc(path: string, body: object): Promise<unknown> {
  const response = await fetch(network.url + '/v1/chain/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('RAM_LEDGER_QUERY_FAILED');
  return response.json();
}
async function push(
  name: string,
  data: Record<string, unknown>,
  actor = 'alice',
  target = runtime,
) {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const tx = Transaction.from({
    ...info.getTransactionHeader(60 + (seq++ % 60)),
    actions: [
      Action.from(
        { account: target, name, authorization: [{ actor, permission: 'active' }], data },
        target === runtime
          ? abi
          : ABI.from(readFileSync('.artifacts/modules-release/' + target + '.abi', 'utf8')),
      ),
    ],
  });
  const result = await api.v1.chain
    .push_transaction(
      SignedTransaction.from({
        ...tx,
        signatures: [
          (actor === runtime || actor === 'alice' ? key : fixtureKey(actor)).signDigest(
            tx.signingDigest(network.chainId),
          ),
        ],
      }),
    )
    .catch((error: unknown) => {
      const failure = z
        .object({ error: z.object({ details: z.array(z.object({ message: z.string() })) }) })
        .safeParse(error instanceof APIError ? error.response.json : undefined);
      for (const detail of failure.success ? failure.data.error.details : []) {
        const code = detail.message.match(/assertion failure with message: ([A-Z_]+)/)?.[1];
        if (code) throw new Error(code);
      }
      throw new Error('NATIVE_ACTION_REJECTED');
    });
  executedChainResult(result, tx.id.toString());
}
const count = z
  .union([
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^(0|[1-9][0-9]*)$/),
  ])
  .transform((v) => BigInt(v));
async function used(account = runtime) {
  return z
    .object({ ram_usage: z.number().int().nonnegative() })
    .parse(await rpc('get_account', { account_name: account })).ram_usage;
}
async function accounted(payer = runtime) {
  let total = 0n;
  for (const scope of daoScopes) {
    const counters = z
      .object({
        rows: z.array(
          z.object({
            payer: z.string(),
            identity: count,
            activity: count,
            retained: count,
            platform: count,
          }),
        ),
      })
      .parse(
        await rpc('get_table_rows', {
          json: true,
          code: runtime,
          scope,
          table: 'ramstats',
          limit: 100,
        }),
      );
    for (const r of counters.rows)
      if (r.payer === payer) total += r.identity + r.activity + r.retained + r.platform;
  }
  if (payer !== runtime) return total;
  const cfg = z.object({ rows: z.array(z.object({ meter_bytes: count })) }).parse(
    await rpc('get_table_rows', {
      json: true,
      code: runtime,
      scope: runtime,
      table: 'ramobs',
      limit: 1,
    }),
  );
  const first = cfg.rows[0];
  if (!first) throw new Error('OBSERVER_NOT_INITIALIZED');
  return total + first.meter_bytes;
}
const modules = [
  ['decide', 'decide'],
  ['works', 'works'],
  ['payroll', 'payroll'],
  ['grants-rounds', 'grants'],
  ['endorsement-admission', 'endorse'],
] as const;
const moduleHashes = new Map<string, string>();
const moduleBaselines = new Map<string, number>();
async function act(
  target: string,
  action: string,
  fields: Record<string, unknown>,
  dao: string | number = 1,
) {
  const member = z.object({ rows: z.array(z.object({ nonce: count })) }).parse(
    await rpc('get_table_rows', {
      json: true,
      code: runtime,
      scope: String(dao),
      table: 'members',
      limit: 1,
    }),
  ).rows[0];
  if (!member) throw new Error('FIXTURE_MEMBER_REQUIRED');
  const now = (await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000;
  const targetAbi =
    target === runtime
      ? abi
      : ABI.from(readFileSync('.artifacts/modules-release/' + target + '.abi', 'utf8'));
  const request = {
    version: 1,
    chain_id: network.chainId,
    deployment: runtime,
    dao_id: dao,
    member_id: 1,
    nonce: member.nonce.toString(),
    expires: Math.floor(now) + 120,
    target,
    action,
    data: Serializer.encode({
      abi: targetAbi,
      type: action,
      object: { runtime, dao_id: dao, member_id: 1, ...fields },
    }).hexString,
  };
  await push('submit', {
    request,
    sig: key
      .signDigest(
        Checksum256.hash(Serializer.encode({ abi, type: 'instruction', object: request })),
      )
      .toString(),
  });
}
let baseline = 0;
beforeAll(async () => {
  unlockFixtureWallet(network.container);
  let exists = true;
  try {
    cleos(['get', 'account', runtime]);
  } catch {
    exists = false;
  }
  if (exists) throw new Error('FRESH_RAM_LEDGER_ACCOUNT_REQUIRED');
  cleos([
    'push',
    'transaction',
    JSON.stringify({
      actions: [
        {
          account: 'eosio',
          name: 'newaccount',
          authorization: [{ actor: 'eosio', permission: 'active' }],
          data: {
            creator: 'eosio',
            name: runtime,
            owner: {
              threshold: 1,
              keys: [{ key: key.toPublic().toString(), weight: 1 }],
              accounts: [],
              waits: [],
            },
            active: {
              threshold: 1,
              keys: [{ key: key.toPublic().toString(), weight: 1 }],
              accounts: [],
              waits: [],
            },
          },
        },
        {
          account: 'eosio',
          name: 'buyrambytes',
          authorization: [{ actor: 'alice', permission: 'active' }],
          data: { payer: 'alice', receiver: runtime, bytes: 16_777_216 },
        },
        {
          account: 'eosio',
          name: 'delegatebw',
          authorization: [{ actor: 'alice', permission: 'active' }],
          data: {
            from: 'alice',
            receiver: runtime,
            stake_net_quantity: '1.0000 TLOS',
            stake_cpu_quantity: '1.0000 TLOS',
            transfer: false,
          },
        },
      ],
    }),
  ]);
  cleos([
    'set',
    'contract',
    runtime,
    '/work/.artifacts/contracts',
    'runtime.wasm',
    'runtime.abi',
    '-p',
    runtime + '@active',
  ]);
  cleos([
    'set',
    'account',
    'permission',
    runtime,
    'active',
    '--add-code',
    '-p',
    runtime + '@active',
  ]);
  await push('init', { chain_id: network.chainId }, runtime);
  baseline = await used();
  await push('initramobs', {}, runtime);
  mkdirSync('.artifacts/modules-release', { recursive: true });
  for (const [, account] of modules) {
    for (const ext of ['abi', 'wasm'])
      copyFileSync(
        '../daclify-backend-modules/.artifacts/contracts/' + account + '.' + ext,
        '.artifacts/modules-release/' + account + '.' + ext,
      );
    moduleHashes.set(
      account,
      createHash('sha256')
        .update(readFileSync('.artifacts/modules-release/' + account + '.wasm'))
        .digest('hex'),
    );
    cleos([
      'set',
      'contract',
      account,
      '/work/.artifacts/modules-release',
      account + '.wasm',
      account + '.abi',
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
    moduleBaselines.set(account, await used(account));
  }
  const beforePermissions = await used();
  configureFixtureContext(network.container, runtime);
  baseline += (await used()) - beforePermissions;
}, 60000);
it('reconciles core and all five module payers against actual native RAM', async () => {
  expect(BigInt((await used()) - baseline)).toBe(await accounted());
  await push(
    'setfees',
    {
      third_party_bps: 500,
      first_party_bps: 10000,
      treasury: 'alice',
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
      names: '',
    },
    runtime,
  );
  expect(BigInt((await used()) - baseline)).toBe(await accounted());
  await push(
    'setresources',
    {
      native_ram_bps: 500,
      card_ram_bps: 2000,
      included_activity_bytes: '262144',
      identity_bytes_per_slot: '2048',
      quote_lifetime_seconds: 300,
      storage_free_bytes: '100000000',
      storage_unit_bytes: '1000000000',
      storage_monthly_usd: 100,
    },
    runtime,
  );
  expect(BigInt((await used()) - baseline)).toBe(await accounted());
  for (const id of daoScopes.slice(1)) {
    await push('createdao', {
      dao_id: id,
      owner: 'alice',
      metadata: '{}',
      privacy: id === '2' ? 1 : 0,
      token_contract: 'eosio.token',
      token_symbol: '4,TLOS',
    });
    await push('enroll', {
      dao_id: id,
      member_id: 1,
      native_account: 'alice',
      signing_key: key.toPublic().toString(),
      encryption_key: 'fixture-encryption',
      custody: 0,
    });
    expect(BigInt((await used()) - baseline)).toBe(await accounted());
  }
  await expect(
    push('ramadjust', { dao_id: 1, payer: runtime, category: 1, added: 100, removed: 0 }, runtime),
  ).rejects.toThrow('RAM_SOURCE_SENDER');
  expect(BigInt((await used()) - baseline)).toBe(await accounted());
  for (const [id, account] of modules) {
    const hash = moduleHashes.get(account);
    if (!hash) throw new Error('MODULE_HASH_REQUIRED');
    await push('setramcode', { account, code_hash: hash }, runtime);
    await push(
      'listmod',
      {
        account,
        publisher: 'alice',
        party: 0,
        accepts_fee_rule: 1,
        price: '0.0000 TLOS',
        code_hash: hash,
        title: 'Resource fixture',
      },
      runtime,
    );
    await push('setmodule', {
      dao_id: 1,
      account,
      version: 1,
      actions: ModulePermissions[id].actions,
      grants: ModulePermissions[id].grants,
      code_hash: hash,
    });
  }
  const check = async () => {
    expect(BigInt((await used()) - baseline)).toBe(await accounted());
    for (const [, account] of modules) {
      const before = moduleBaselines.get(account);
      if (before === undefined) throw new Error('MODULE_BASELINE_REQUIRED');
      expect(BigInt((await used(account)) - before)).toBe(await accounted(account));
    }
  };
  await check();
  for (const n of [127, 128, 1]) {
    await act(runtime, 'setprofile', {
      account_name: 'member',
      profile: JSON.stringify({ name: 'member', introduction: 'ą'.repeat(n) }),
    });
    await check();
  }
  const expiry =
    Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000) + 300;
  const session = PrivateKey.generate('K1');
  await act(runtime, 'addsession', {
    session_id: 1,
    signing_key: session.toPublic().toString(),
    expires: expiry,
    permissions: [{ target: runtime, action: 'putjson', code_hash: '00'.repeat(32) }],
  });
  await check();
  await act(runtime, 'delsession', { session_id: 1 });
  await check();
  await act(runtime, 'commitepoch', { epoch: 1, commitment: 'ab'.repeat(32), self_grant: '{}' }, 2);
  await check();
  const collision = daoScopes[3];
  if (!collision) throw new Error('SCOPE_COLLISION_REQUIRED');
  await act(
    runtime,
    'putjson',
    { document_id: 1, version: 1, value: '{}', envelope_version: 0, key_epoch: 0 },
    collision,
  );
  await check();
  await act(runtime, 'putjson', {
    document_id: 1,
    version: 1,
    value: '{}',
    envelope_version: 0,
    key_epoch: 0,
  });
  await check();
  await act('works', 'propose', {
    project_id: 1,
    contributor: 1,
    document_id: 1,
    document_version: 1,
    payments: ['1.0000 TLOS'],
    dues: [0],
  });
  await check();
  const now = Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000);
  await act('grants', 'newround', {
    round_id: 1,
    document_id: 1,
    document_version: 1,
    applications_close: now + 3600,
    review_close: now + 7200,
    awards_close: now + 10800,
    maximum: '10.0000 TLOS',
    allow_agents: false,
    works: 'works',
  });
  await check();
  cleos([
    'push',
    'action',
    'eosio.token',
    'transfer',
    JSON.stringify(['alice', runtime, '10.0000 TLOS', 'dao:1']),
    '-p',
    'alice@active',
  ]);
  await act('payroll', 'commit', {
    schedule_id: 1,
    recipient: 1,
    quantity: '1.0000 TLOS',
    periods: 2,
    interval: 86400,
    starts: now + 60,
  });
  await check();
  for (const label of ['a'.repeat(80), 'x']) {
    await act('payroll', 'edit', { schedule_id: 1, paused: 0, label });
    await check();
  }
  await act(runtime, 'setadmit', {
    enabled: true,
    source: 'endorse',
    threshold: 1,
    allow_agents: false,
    admin_override: false,
  });
  await act('endorse', 'applyjoin', {
    application_id: 1,
    signing_key: PrivateKey.generate('K1').toPublic().toString(),
    encryption_key: 'fixture-key',
    custody: 0,
    kind: 0,
    operator_label: '',
    document_id: 1,
    document_version: 1,
    expires: now + 3600,
  });
  await check();
  await act('decide', 'open', {
    ballot_id: 1,
    kind: 0,
    choices: 2,
    duration: 60,
    quorum: 5000,
    approval: 5001,
    metadata: '{}',
  });
  await check();
  await act('decide', 'vote', { ballot_id: 1, choice: 0 });
  await check();
  const terminal = async () =>
    z
      .object({ rows: z.array(DecideTableSchemas.pollends) })
      .parse(
        await rpc('get_table_rows', {
          code: 'decide',
          scope: runtime,
          table: 'pollends',
          json: true,
        }),
      )
      .rows.find((row) => row.ballot_id === '1');
  expect((await terminal())?.completed_at).toBe(0);
  const closes = z
    .object({ rows: z.array(DecideTableSchemas.ballots) })
    .parse(
      await rpc('get_table_rows', { code: 'decide', scope: runtime, table: 'ballots', json: true }),
    )
    .rows.find((row) => row.id === '1')?.closes;
  if (!closes) throw new Error('BALLOT_CLOSE_REQUIRED');
  while (
    Math.floor((await api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000) < closes
  )
    await new Promise((resolve) => setTimeout(resolve, 1000));
  await push('finalize', { runtime, dao_id: '1', ballot_id: '1' }, 'alice', 'decide');
  const completed = await terminal();
  expect(completed?.completed_at).toBeGreaterThanOrEqual(closes);
  expect(completed?.legacy).toBe(false);
  await check();
  await push('markpoll', { runtime, dao_id: '1', ballot_id: '1' }, 'decide', 'decide');
  expect(await terminal()).toEqual(completed);
  await check();
}, 120000);

it('backs included DAO grants against actual payer quota, protects platform headroom and never duplicates a grant', async () => {
  for (let i = 0; i < 10; i++)
    await act(runtime, 'putjson', {
      runtime,
      dao_id: '1',
      member_id: '1',
      document_id: String(100 + i),
      version: 1,
      value: JSON.stringify({ text: 'x'.repeat(4000) }),
      envelope_version: 0,
      key_epoch: '0',
    });
  const account = await api.v1.chain.get_account(runtime),
    quota = BigInt(account.ram_quota.toString()),
    base = BigInt(await used()) - (await accounted());
  await push(
    'setrampool',
    {
      payer: runtime,
      expected_quota: quota.toString(),
      baseline_bytes: base.toString(),
      platform_headroom: '131072',
    },
    runtime,
  );
  await push(
    'setrampool',
    {
      payer: runtime,
      expected_quota: quota.toString(),
      baseline_bytes: (quota - (await accounted()) - 32768n).toString(),
      platform_headroom: '32768',
    },
    runtime,
  );
  const beforeTightGrant = await used();
  await expect(
    push(
      'grantdaoram',
      {
        dao_id: '1',
        payer: runtime,
        reference: '99',
        activity: '0',
        identity: '0',
        completion: '32768',
      },
      runtime,
    ),
  ).rejects.toThrow('RAM_POOL_EXHAUSTED');
  expect(await used()).toBe(beforeTightGrant);
  await push(
    'setrampool',
    {
      payer: runtime,
      expected_quota: quota.toString(),
      baseline_bytes: base.toString(),
      platform_headroom: '131072',
    },
    runtime,
  );
  const input = {
    dao_id: '1',
    payer: runtime,
    reference: '1',
    activity: '262144',
    identity: '20480',
    completion: '32768',
  };
  await push('grantdaoram', input, runtime);
  const read = async () =>
    z
      .object({
        rows: z.array(
          z.object({ payer: z.string(), activity: count, identity: count, completion: count }),
        ),
      })
      .parse(
        await rpc('get_table_rows', {
          json: true,
          code: runtime,
          scope: '1',
          table: 'ramlimits',
          limit: 2,
        }),
      );
  const saved = await read();
  expect(saved.rows).toEqual([
    { payer: runtime, activity: 262144n, identity: 20480n, completion: 32768n },
  ]);
  await push('grantdaoram', input, runtime);
  expect(await read()).toEqual(saved);
  await expect(push('grantdaoram', { ...input, activity: '262145' }, runtime)).rejects.toThrow(
    'RAM_GRANT_IMMUTABLE',
  );
  await expect(
    push('grantdaoram', { ...input, reference: '2', activity: quota.toString() }, runtime),
  ).rejects.toThrow('RAM_POOL_EXHAUSTED');
  await expect(push('grantdaoram', { ...input, payer: 'decide' }, runtime)).rejects.toThrow(
    'RAM_POOL_UNKNOWN',
  );
  expect(await read()).toEqual(saved);
  expect(BigInt(await used()) - BigInt(baseline)).toBe(await accounted());
});

it('reads irreversible live vote history without SQL and rejects another DAO ballot', async () => {
  const pool = new Pool({ connectionString: 'postgres://unused:unused@127.0.0.1:1/unused' });
  const gateway = new NativeChainGateway(
      {
        rpcUrl: network.url,
        chainId: network.chainId,
        runtime,
        hub: null,
        environment: 'local',
        relayActor: 'alice',
        relayKey: key,
        modules: [{ id: 'decide', account: 'decide' }],
      },
      pool,
    ),
    dao = { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 as const };
  try {
    const rows = await gateway.archiveLiveVotes({ dao, parentId: '1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ballot: '1', member: '1', choice: 0 });
    await expect(
      gateway.archiveLiveVotes({ dao: { ...dao, daoId: '2' }, parentId: '1' }),
    ).rejects.toThrow('BALLOT_UNKNOWN');
  } finally {
    await pool.end();
  }
});

it('backfills exact native module references without duplicating RAM and refuses forged coverage', async () => {
  await push('backfilldocs', { dao_id: '1', limit: 25 }, runtime);
  for (const [source, tables] of [
    ['works', ['projects', 'milestones']],
    ['grants', ['rounds', 'applications']],
    ['decide', ['elections', 'terms']],
    ['endorse', ['joinapps']],
    ['payroll', []],
  ] as const) {
    if (!tables.length) await push('backfillrefs', { runtime, dao_id: '1' }, runtime, source);
    for (const table of tables)
      await push('backfillrefs', { runtime, dao_id: '1', table, limit: 25 }, runtime, source);
  }
  const before = await used();
  for (const table of ['projects', 'milestones'])
    await push('backfillrefs', { runtime, dao_id: '1', table, limit: 25 }, runtime, 'works');
  expect(await used()).toBe(before);
  const references = z
    .object({
      rows: z.array(
        z.object({
          source: z.string(),
          table: z.string(),
          document_id: count,
          version: z.number(),
        }),
      ),
      more: z.boolean(),
    })
    .parse(
      await rpc('get_table_rows', {
        json: true,
        code: runtime,
        scope: '1',
        table: 'docrefs',
        limit: 100,
      }),
    );
  expect(references.more).toBe(false);
  expect(references.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: 'works', table: 'projects', document_id: 1n, version: 1 }),
    ]),
  );
  await expect(
    push(
      'docref',
      {
        dao_id: '1',
        source: 'works',
        table: 'projects',
        source_id: '1',
        slot: 0,
        document_id: '1',
        version: 1,
      },
      'works',
    ),
  ).rejects.toThrow('DOCUMENT_SOURCE_SENDER');
  await expect(
    push('docsrc', { dao_id: '1', source: 'works', tables: ['projects'] }, 'works'),
  ).rejects.toThrow('DOCUMENT_SOURCE_SENDER');
  expect(BigInt((await used()) - baseline)).toBe(await accounted());
});

it('prunes only old unreferenced native documents and restores exact bytes without ID reuse', async () => {
  for (const version of [1, 2, 3, 4])
    await act(runtime, 'putjson', {
      document_id: 90,
      version,
      value: JSON.stringify({ version, body: 'x'.repeat(1000) }),
      envelope_version: 0,
      key_epoch: 0,
    });
  const docs = await api.v1.chain.get_table_rows({
    code: runtime,
    scope: '1',
    table: 'documents',
    json: true,
    limit: 100,
  });
  const originals = docs.rows
    .map((r) => RuntimeTableSchemas.documents.parse(r))
    .filter((r) => r.document_id === '90');
  if (originals.length !== 4) throw new Error('NATIVE_DOCUMENT_FIXTURE_ROWS');
  const agedAbi = ABI.from(readFileSync('.artifacts/document-aged/runtime.abi', 'utf8')),
    productionHash = createHash('sha256')
      .update(readFileSync('.artifacts/contracts/runtime.wasm'))
      .digest('hex'),
    seedHash = createHash('sha256')
      .update(readFileSync('.artifacts/document-aged/runtime.wasm'))
      .digest('hex');
  const deploy = (directory: string) =>
    cleos([
      'set',
      'contract',
      runtime,
      directory,
      'runtime.wasm',
      'runtime.abi',
      '-p',
      runtime + '@active',
    ]);
  let prior = await used();
  deploy('/work/.artifacts/document-aged');
  await push(
    'rebindramobs',
    { expected_old_hash: productionHash, expected_new_hash: seedHash },
    runtime,
  );
  baseline += (await used()) - prior;
  for (const original of originals)
    cleos([
      'push',
      'action',
      runtime,
      'agedoc',
      JSON.stringify({ dao_id: '1', id: original.id }),
      '-p',
      runtime + '@active',
    ]);
  prior = await used();
  deploy('/work/.artifacts/contracts');
  await push(
    'rebindramobs',
    { expected_old_hash: seedHash, expected_new_hash: productionHash },
    runtime,
  );
  baseline += (await used()) - prior;
  // The seed ABI exists solely to age clock rows; production has no such action.
  expect(agedAbi.actions.some((a) => a.name.toString() === 'agedoc')).toBe(true);
  expect(abi.actions.some((a) => a.name.toString() === 'agedoc')).toBe(false);
  await act('works', 'propose', {
    project_id: 88,
    contributor: 1,
    document_id: 90,
    document_version: 1,
    payments: ['1.0000 TLOS'],
    dues: [0],
  });
  await push(
    'setarchcfg',
    { verifier: 'alice', minimum_retention_seconds: 7776000, pruning_enabled: true },
    runtime,
  );
  const chosen = originals.filter((r) => r.version === 2 || r.version === 3),
    records = chosen.map((r) => ({
      primaryKey: r.id,
      packed: Serializer.encode({ abi, type: 'document_record', object: r }).hexString,
    }));
  const first = chosen[0],
    last = chosen.at(-1);
  if (!first || !last) throw new Error('NATIVE_DOCUMENT_FIXTURE_ROWS');
  const domain = {
      format_version: 1 as const,
      chain_id: network.chainId,
      runtime,
      dao_id: '1',
      source: runtime,
      code_hash: productionHash,
      abi_hash: Checksum256.hash(Serializer.encode({ object: abi }).array).toString(),
      schema_hash: 'ab'.repeat(32),
      table: 'documents',
      scope: '1',
      chunk_ordinal: 0,
      leaf_count: chosen.length,
    },
    tree = buildArchiveTree(domain, records),
    info = await api.v1.chain.get_info();
  const manifest = {
      format_version: 1,
      chain_id: network.chainId,
      runtime,
      dao_id: '1',
      source: runtime,
      code_hash: productionHash,
      abi_hash: domain.abi_hash,
      block_number: Number(info.last_irreversible_block_num),
      block_id: info.last_irreversible_block_id.toString(),
      timestamp: new Date(info.head_block_time.toMilliseconds()).toISOString(),
      families: [
        {
          kind: 'document-versions',
          parent_id: '90',
          table: 'documents',
          scope: '1',
          schema_hash: domain.schema_hash,
          records: String(chosen.length),
          chunks: [
            {
              domain,
              root: tree.root,
              cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              bytes: 3000,
              commitment: 'ab'.repeat(32),
              first_key: first.id,
              last_key: last.id,
            },
          ],
        },
      ],
      files: [],
    },
    manifestHash = 'ac'.repeat(32),
    backup = 'ad'.repeat(32);
  await push(
    'archattest',
    {
      dao_id: '1',
      manifest,
      manifest_cid: 'bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      manifest_bytes: 1000,
      manifest_commitment: manifestHash,
      backup_commitment: backup,
      retention_seconds: 7776000,
    },
    'alice',
  );
  await act(runtime, 'archapprove', {
    manifest_commitment: manifestHash,
    descriptor_commitment: Checksum256.hash(
      Serializer.encode({ abi, type: 'archive_manifest_descriptor', object: manifest }).array,
    ).toString(),
    backup_commitment: backup,
    retention_seconds: 7776000,
  });
  const anchorRows = await api.v1.chain.get_table_rows({
      code: runtime,
      scope: '1',
      table: 'archives',
      json: true,
      limit: 100,
    }),
    anchor = anchorRows.rows
      .map((r) => RuntimeTableSchemas.archives.parse(r))
      .find((a) => a.manifest_commitment === manifestHash);
  if (!anchor) throw new Error('NATIVE_DOCUMENT_ANCHOR');
  const proofs = chosen.map((r, i) => ({ primary_key: r.id, siblings: tree.proof(i) })),
    input = { dao_id: '1', archive_id: anchor.id, chunk_ordinal: 0, start: 0, proofs };
  const gateway = new NativeChainGateway({
    rpcUrl: network.url,
    chainId: network.chainId,
    runtime,
    hub: null,
    environment: 'local',
    relayActor: 'alice',
    relayKey: key,
    modules: modules.map(([id, account]) => ({ id, account })),
  });
  const preview = await gateway.archivePreview({
    dao: { chainId: network.chainId, contract: runtime, daoId: '1', interfaceVersion: 1 },
    documentRows: chosen.map((r) => r.id),
    retentionSeconds: 7776000,
  });
  expect(preview.blocked).toEqual([]);
  expect(preview.families[0]).toMatchObject({ kind: 'document-versions', parentId: '90' });
  const before = await used(),
    counted = await accounted();
  await expect(
    push(
      'prunedocs',
      { ...input, proofs: [proofs[0], { ...proofs[1], siblings: ['00'.repeat(32)] }] },
      'alice',
    ),
  ).rejects.toThrow('ARCHIVE_PROOF');
  expect(await used()).toBe(before);
  await push('prunedocs', input, 'alice');
  const removed = before - (await used());
  expect(removed).toBeGreaterThan(2000);
  expect(counted - (await accounted())).toBe(BigInt(removed));
  await push('prunedocs', input, 'alice');
  expect(before - (await used())).toBe(removed);
  await expect(
    act(runtime, 'restoredoc', { original: { ...first, metadata: '{}' } }),
  ).rejects.toThrow('DOCUMENT_RESTORE_COMMITMENT');
  await act(runtime, 'restoredoc', { original: first });
  const restored = await used();
  await act(runtime, 'restoredoc', { original: first });
  expect(await used()).toBe(restored);
  const after = await api.v1.chain.get_table_rows({
      code: runtime,
      scope: '1',
      table: 'documents',
      json: true,
      limit: 100,
    }),
    rows = after.rows.map((r) => RuntimeTableSchemas.documents.parse(r));
  expect(rows.find((r) => r.id === first.id)).toEqual(first);
  expect(rows.some((r) => r.document_id === '90' && r.version === 1)).toBe(true);
  expect(rows.some((r) => r.document_id === '90' && r.version === 4)).toBe(true);
  await act(runtime, 'putjson', {
    document_id: 90,
    version: 5,
    value: '{}',
    envelope_version: 0,
    key_epoch: 0,
  });
  writeFileSync(
    'docs/evidence/2026-10-08-native-document-archives.json',
    JSON.stringify(
      {
        environment: 'owned local Spring fixture',
        chainId: network.chainId,
        runtime,
        coreCodeHash: productionHash,
        coreRawAbiHash: domain.abi_hash,
        documentId: '90',
        prunedVersions: [2, 3],
        retainedVersions: [1, 4],
        restoredVersion: 2,
        freedNativeRamBytes: removed,
        observedRamDecrease: removed,
        originalRowCommitment: Checksum256.hash(
          Serializer.encode({ abi, type: 'document_record', object: first }).array,
        ).toString(),
        clockFixture:
          'Existing document clocks aged through temporary fixture code, then exact production WASM restored; production contains no age action.',
        qualified: [
          'source-owned backfill',
          'native reference callback rejection',
          'bad-proof atomic rollback',
          'irreversible API preview',
          'replay',
          'latest/referenced rows retained',
          'original-row restoration',
          'normal version continuation',
          'native/counter conservation',
        ],
        notQualified: ['live provider availability', 'public Telos testnet', 'production pruning'],
      },
      null,
      2,
    ) + '\n',
  );
  expect(BigInt((await used()) - baseline)).toBe(await accounted());
});

it('grants included RAM once and only adds newly approved member slots across renewal and policy changes', async () => {
  const quota = (await api.v1.chain.get_account(runtime)).ram_quota.toString();
  await push(
    'setrampool',
    {
      payer: runtime,
      expected_quota: quota,
      baseline_bytes: String(baseline),
      platform_headroom: '131072',
    },
    runtime,
  );
  await push(
    'setresources',
    {
      native_ram_bps: 500,
      card_ram_bps: 2000,
      included_activity_bytes: '262144',
      identity_bytes_per_slot: '2048',
      quote_lifetime_seconds: 300,
      storage_free_bytes: '100000000',
      storage_unit_bytes: '1000000000',
      storage_monthly_usd: 100,
    },
    runtime,
  );
  await expect(
    push(
      'setramauto',
      { enabled: true, offers: [{ payer: runtime, activity: '1', completion: '32768' }] },
      runtime,
    ),
  ).rejects.toThrow('RAM_OFFER_POLICY');
  await expect(
    push(
      'setramauto',
      {
        enabled: true,
        offers: [
          { payer: runtime, activity: '131072', completion: '32768' },
          { payer: runtime, activity: '131072', completion: '32768' },
        ],
      },
      runtime,
    ),
  ).rejects.toThrow('RAM_OFFER_DUPLICATE');
  await push(
    'setramauto',
    { enabled: true, offers: [{ payer: runtime, activity: '262144', completion: '32768' }] },
    runtime,
  );
  await push('createdao', {
    dao_id: '3',
    owner: 'alice',
    metadata: '{}',
    privacy: 0,
    token_contract: 'eosio.token',
    token_symbol: '4,TLOS',
  });
  daoScopes.push('3');
  const limits = async () =>
    RuntimeTableSchemas.ramlimits.parse(
      (
        await api.v1.chain.get_table_rows({
          code: runtime,
          scope: '3',
          table: 'ramlimits',
          json: true,
        })
      ).rows[0],
    );
  expect(await limits()).toMatchObject({
    activity: '262144',
    identity: '20480',
    completion: '32768',
  });
  expect(BigInt(await used()) - BigInt(baseline)).toBe(await accounted());
  await push('sethosted', { free_members: 10, settler: runtime }, runtime);
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const capacity = { dao_id: '3', member_limit: 20, expires, receipt: 'a1'.repeat(32) };
  await push('setcapacity', capacity, runtime);
  const increased = await limits();
  expect(increased.identity).toBe('40960');
  await push('setcapacity', capacity, runtime);
  await push(
    'setcapacity',
    { ...capacity, expires: expires + 1, receipt: 'a2'.repeat(32) },
    runtime,
  );
  expect(await limits()).toEqual(increased);
  await push(
    'setresources',
    {
      native_ram_bps: 500,
      card_ram_bps: 2000,
      included_activity_bytes: '262144',
      identity_bytes_per_slot: '4096',
      quote_lifetime_seconds: 300,
      storage_free_bytes: '100000000',
      storage_unit_bytes: '1000000000',
      storage_monthly_usd: 100,
    },
    runtime,
  );
  await push(
    'setcapacity',
    { ...capacity, member_limit: 21, expires: expires + 2, receipt: 'a3'.repeat(32) },
    runtime,
  );
  expect((await limits()).identity).toBe('43008');
  await push('revokecap', { dao_id: '3', receipt: 'a3'.repeat(32) }, runtime);
  expect((await limits()).identity).toBe('43008');
  expect(BigInt(await used()) - BigInt(baseline)).toBe(await accounted());
});
