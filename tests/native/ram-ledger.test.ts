import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
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
async function push(name: string, data: Record<string, unknown>, actor = 'alice') {
  const info = await api.v1.chain.get_info();
  if (info.chain_id.toString() !== network.chainId) throw new Error('FIXTURE_CHAIN_CHANGED');
  const tx = Transaction.from({
    ...info.getTransactionHeader(60 + (seq++ % 60)),
    actions: [
      Action.from(
        { account: runtime, name, authorization: [{ actor, permission: 'active' }], data },
        abi,
      ),
    ],
  });
  const result = await api.v1.chain
    .push_transaction(
      SignedTransaction.from({
        ...tx,
        signatures: [key.signDigest(tx.signingDigest(network.chainId))],
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
});
