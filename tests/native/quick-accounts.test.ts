import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ABI, Authority, Checksum256, PrivateKey, Serializer, UInt64 } from '@wharfkit/antelope';
import { z } from 'zod';
import { privateKeyToAccount } from 'viem/accounts';
import { quickAccountTypedData } from '../../sdk/evm.js';
import { QuickAuthTableSchemas } from '../../sdk/quick-accounts.js';
import { nativeProcess, type NativeProcess } from '../helpers/native-process.js';
import { encodeQuickAnchor, quickAccountIdentity } from '../../sdk/quick-accounts.js';

const runtime = 'daclifycore1';
const authority = 'quickauth';
const key = PrivateKey.generate('K1');
const anchor = encodeQuickAnchor({ kind: 'key', publicKey: key.toPublic().toString() });
// Public disposable scalar 1, never an account with value.
const evm = privateKeyToAccount(
  '0x0000000000000000000000000000000000000000000000000000000000000001',
);
const AccountRow = QuickAuthTableSchemas.qaccounts;
let f: NativeProcess;
let abi: ABI;
let core: ABI;
let probe: ABI;
let sourceHash = '';
let id = '';
const measurements: { action: string; cpuMicroseconds: number; ramDeltaBytes: string }[] = [];
const expires = () => Math.floor(Date.now() / 1000) + 120;
function digest(action: string, type: string, request: object) {
  const tag = Serializer.encode({
    object: `daclify.quick-account.${action}.v1`,
    type: 'string',
  }).array;
  const data = Serializer.encode({ abi, type, object: request }).array;
  const bytes = new Uint8Array(tag.length + data.length);
  bytes.set(tag);
  bytes.set(data, tag.length);
  return Checksum256.hash(bytes);
}
function signature(action: string, type: string, request: object, signer = key) {
  return Serializer.encode({ object: signer.signDigest(digest(action, type, request)) }).hexString;
}
async function evmSignature(action: string, type: string, request: object, chainId = 41) {
  const typed = quickAccountTypedData(
    { chainId: f.chainId, runtime },
    chainId,
    digest(action, type, request).toString(),
  );
  return (
    await evm.signTypedData({
      types: { QuickAccount: [{ name: 'operation', type: 'bytes32' }] },
      primaryType: 'QuickAccount',
      domain: typed.domain,
      message: typed.message,
    })
  ).slice(2);
}
async function call(action: string, data: object, actors = ['gateway']) {
  const ramBefore = (await f.api.v1.chain.get_account(authority)).ram_usage;
  const result = await f.push(
    [
      f.action(
        action === 'init' ? runtime : authority,
        action,
        data,
        actors.map((actor) => ({ actor, permission: 'active' })),
        action === 'init' ? core : abi,
      ),
    ],
    actors.map((actor) => f.key(actor)),
  );
  const receipt = z
    .object({
      processed: z.object({ receipt: z.object({ cpu_usage_us: z.number().nonnegative() }) }),
    })
    .parse(JSON.parse(JSON.stringify(result)));
  const ramAfter = (await f.api.v1.chain.get_account(authority)).ram_usage;
  measurements.push({
    action,
    cpuMicroseconds: receipt.processed.receipt.cpu_usage_us,
    ramDeltaBytes: String(BigInt(ramAfter.toString()) - BigInt(ramBefore.toString())),
  });
  return result;
}
async function row(accountId = id) {
  const page = await f.api.v1.chain.get_table_rows({
    code: authority,
    scope: runtime,
    table: 'qaccounts',
    lower_bound: UInt64.from(accountId),
    limit: 1,
  });
  const value = AccountRow.parse(page.rows[0]);
  expect(value.id).toBe(accountId);
  return value;
}
function control(value: z.infer<typeof AccountRow>, useDefault = false) {
  return {
    version: 1,
    chain_id: f.chainId,
    runtime,
    authority,
    anchor,
    account_id: value.id,
    epoch: value.epoch,
    nonce: value.nonce,
    expires: expires(),
    use_default: useDefault,
  };
}
describe('native canonical Quick ballot account authorization', () => {
  beforeAll(async () => {
    f = await nativeProcess();
    for (const name of [runtime, authority, 'gateway', 'alice', 'bob', 'quickprobe'])
      await f.create(name);
    core = await f.deploy(runtime, '.artifacts/contracts/runtime');
    abi = await f.deploy(authority, '.artifacts/contracts/quickauth');
    probe = await f.deploy('quickprobe', '.artifacts/contracts/quickprobe');
    sourceHash = (await f.api.v1.chain.get_raw_abi('quickprobe')).code_hash.toString();
    await call('init', { chain_id: f.chainId }, [runtime]);
    await f.update(
      authority,
      'execctx',
      'active',
      Authority.from({
        threshold: 1,
        keys: [],
        accounts: [{ permission: { actor: authority, permission: 'eosio.code' }, weight: 1 }],
        waits: [],
      }),
    );
    await f.push(
      [
        f.system(
          'linkauth',
          {
            account: authority,
            code: 'quickprobe',
            type: 'respond',
            requirement: 'execctx',
          },
          authority,
        ),
      ],
      [f.key(authority)],
    );
    await call(
      'qconfig',
      {
        runtime,
        source: 'quickprobe',
        code_hash: sourceHash,
        gateway: { actor: 'gateway', permission: 'active' },
        maximum: 3,
      },
      [runtime, authority],
    );
  }, 60000);
  afterAll(async () => {
    mkdirSync('.artifacts/quick-ballots', { recursive: true });
    writeFileSync(
      '.artifacts/quick-ballots/account-native-measurements.json',
      JSON.stringify(
        {
          compiler: 'CDT 4.1.1 -O=s',
          runtime: 'Spring 1.2.2',
          artifacts: Object.fromEntries(
            ['runtime', 'quickauth', 'quickprobe'].map((name) => {
              const bytes = readFileSync(`.artifacts/contracts/${name}.wasm`);
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
    if (f) await f.stop();
  });

  it('requires gateway and actual anchor proof to register one canonical key identity', async () => {
    const request = {
      version: 1,
      chain_id: f.chainId,
      runtime,
      authority,
      anchor,
      account_id: '0',
      epoch: '0',
      expires: expires(),
    };
    const proof = signature('qregister', 'quick_registration', request);
    await expect(call('qregister', { request, proof }, ['bob'])).rejects.toThrow();
    await expect(
      call('qregister', {
        request,
        proof: signature('qregister', 'quick_registration', request, PrivateKey.generate('K1')),
      }),
    ).rejects.toThrow();
    await call('qregister', { request, proof });
    const rows = await f.api.v1.chain.get_table_rows({
      code: authority,
      scope: runtime,
      table: 'qaccounts',
      limit: 5,
    });
    const registered = AccountRow.parse(rows.rows[0]);
    id = registered.id;
    expect(registered.identity).toBe(
      quickAccountIdentity(f.chainId, runtime, {
        kind: 'key',
        publicKey: key.toPublic().toString(),
      }),
    );
    expect(registered.approval).toEqual({ kind: 3, credential: '' });
    await expect(call('qregister', { request, proof })).rejects.toThrow('QUICK_ACCOUNT_EXISTS');
  });

  it('requires a native anchor active approval rather than a gateway assertion', async () => {
    const native = encodeQuickAnchor({ kind: 'native', account: 'alice', permission: 'active' });
    const request = {
      version: 1,
      chain_id: f.chainId,
      runtime,
      authority,
      anchor: native,
      account_id: '0',
      epoch: '0',
      expires: expires(),
    };
    await expect(call('qregister', { request, proof: '' })).rejects.toThrow();
    await call('qregister', { request, proof: '' }, ['gateway', 'alice']);
    const rows = await f.api.v1.chain.get_table_rows({
      code: authority,
      scope: runtime,
      table: 'qaccounts',
      limit: 5,
    });
    expect(rows.rows.map((value) => AccountRow.parse(value).identity)).toContain(
      quickAccountIdentity(f.chainId, runtime, {
        kind: 'native',
        account: 'alice',
        permission: 'active',
      }),
    );
  });

  it('requires root control and incoming consent before enabling one default wallet', async () => {
    const before = await row();
    const request = {
      control: control(before),
      method: encodeQuickAnchor({ kind: 'native', account: 'alice', permission: 'active' }),
    };
    const proof = signature('qdefault', 'quick_default', request);
    await expect(call('qdefault', { request, proof, incoming: '' })).rejects.toThrow();
    await call('qdefault', { request, proof, incoming: '' }, ['gateway', 'alice']);
    const after = await row();
    expect(after.identity).toBe(before.identity);
    expect(after.epoch).toBe('2');
    expect(after.nonce).toBe('1');
    expect(after.approval).toEqual(request.method);
    await expect(
      call('qdefault', { request, proof, incoming: '' }, ['gateway', 'alice']),
    ).rejects.toThrow(/QUICK_(EPOCH|NONCE)/);
  });

  it('verifies an actual EVM anchor and enforces registry capacity', async () => {
    const request = {
      version: 1,
      chain_id: f.chainId,
      runtime,
      authority,
      anchor: encodeQuickAnchor({ kind: 'evm', chainId: 41, address: evm.address }),
      account_id: '0',
      epoch: '0',
      expires: expires(),
    };
    const proof = await evmSignature('qregister', 'quick_registration', request);
    await expect(
      call('qregister', {
        request,
        proof: await evmSignature('qregister', 'quick_registration', request, 40),
      }),
    ).rejects.toThrow();
    await expect(call('qregister', { request, proof: proof.slice(0, 128) })).rejects.toThrow();
    await call('qregister', { request, proof });
    const another = {
      ...request,
      anchor: encodeQuickAnchor({ kind: 'native', account: 'bob', permission: 'active' }),
    };
    await expect(
      call('qregister', { request: another, proof: '' }, ['gateway', 'bob']),
    ).rejects.toThrow('QUICK_CAPACITY');
  });

  it('forwards only the exact authenticated account context to the pinned source', async () => {
    const current = await row();
    const context = { runtime, authority, account_id: id, credential: anchor };
    const data = Serializer.encode({
      abi: probe,
      type: 'respond',
      object: { context, value: '7' },
    }).hexString;
    const request = {
      control: control(current),
      target: 'quickprobe',
      action: 'respond',
      code_hash: sourceHash,
      data,
    };
    const proof = signature('qsubmit', 'quick_instruction', request);
    await expect(
      call('qsubmit', { request: { ...request, target: runtime }, proof }),
    ).rejects.toThrow('QUICK_TARGET');
    await expect(
      call('qsubmit', { request: { ...request, action: 'transfer' }, proof }),
    ).rejects.toThrow('QUICK_ACTION');
    await expect(
      call('qsubmit', { request: { ...request, code_hash: '00'.repeat(32) }, proof }),
    ).rejects.toThrow('QUICK_CODE');
    const forged = {
      ...request,
      data: Serializer.encode({
        abi: probe,
        type: 'respond',
        object: { context: { ...context, account_id: '2' }, value: '7' },
      }).hexString,
    };
    await expect(
      call('qsubmit', {
        request: forged,
        proof: signature('qsubmit', 'quick_instruction', forged),
      }),
    ).rejects.toThrow('QUICK_CONTEXT');
    await expect(call('qsubmit', { request: { ...request, data: '00' }, proof })).rejects.toThrow(
      'QUICK_PAYLOAD',
    );
    await call('qsubmit', { request, proof });
    const page = await f.api.v1.chain.get_table_rows({
      code: 'quickprobe',
      scope: runtime,
      table: 'accepted',
      limit: 5,
    });
    expect(
      z.object({ account_id: z.coerce.string(), value: z.coerce.string() }).parse(page.rows[0]),
    ).toEqual({ account_id: id, value: '7' });
    await expect(call('qsubmit', { request, proof })).rejects.toThrow('QUICK_NONCE');
  });

  it('keeps the same identity when the default native wallet approves', async () => {
    const current = await row();
    const context = { runtime, authority, account_id: id, credential: current.approval };
    const request = {
      control: control(current, true),
      target: 'quickprobe',
      action: 'respond',
      code_hash: sourceHash,
      data: Serializer.encode({ abi: probe, type: 'respond', object: { context, value: '8' } })
        .hexString,
    };
    await expect(call('qsubmit', { request, proof: '' })).rejects.toThrow();
    await call('qsubmit', { request, proof: '' }, ['gateway', 'alice']);
    expect((await row()).identity).toBe(current.identity);
    await expect(
      f.push(
        [
          f.action(
            'quickprobe',
            'respond',
            { context, value: '9' },
            [{ actor: authority, permission: 'active' }],
            probe,
          ),
        ],
        [f.key(authority)],
      ),
    ).rejects.toThrow('QUICK_SENDER');
  });

  it('rejects gateway identity substitution, wrong domains and expired requests', async () => {
    const current = await row();
    const request = control(current);
    for (const changed of [
      { ...request, chain_id: '00'.repeat(32) },
      { ...request, runtime: 'anothercore' },
      { ...request, authority: 'anotherauth' },
      { ...request, expires: 1 },
      {
        ...request,
        anchor: encodeQuickAnchor({ kind: 'native', account: 'bob', permission: 'active' }),
      },
    ])
      await expect(
        call('qdeactivate', {
          request: changed,
          proof: signature('qdeactivate', 'quick_control', changed),
        }),
      ).rejects.toThrow(/QUICK_(DOMAIN|EXPIRES|IDENTITY)|RAM_PAYER_RUNTIME/);
  });

  it('accepts only the consented EVM default, bound to the exact vote payload', async () => {
    const current = await row();
    const change = {
      control: control(current),
      method: encodeQuickAnchor({ kind: 'evm', chainId: 41, address: evm.address }),
    };
    const root = signature('qdefault', 'quick_default', change);
    await expect(
      call('qdefault', { request: change, proof: root, incoming: '' }),
    ).rejects.toThrow();
    await call('qdefault', {
      request: change,
      proof: root,
      incoming: await evmSignature('qdefault', 'quick_default', change),
    });
    const enabled = await row();
    const request = {
      control: control(enabled, true),
      target: 'quickprobe',
      action: 'respond',
      code_hash: sourceHash,
      data: Serializer.encode({
        abi: probe,
        type: 'respond',
        object: {
          context: { runtime, authority, account_id: id, credential: enabled.approval },
          value: '10',
        },
      }).hexString,
    };
    const proof = await evmSignature('qsubmit', 'quick_instruction', request);
    const altered = { ...request, data: request.data.slice(0, -16) + '0b00000000000000' };
    await expect(call('qsubmit', { request: altered, proof })).rejects.toThrow();
    await call('qsubmit', { request, proof });
    expect((await row()).identity).toBe(current.identity);
  });

  it('revokes defaults, rejects early cleanup and resumes only through the anchor', async () => {
    const before = await row();
    const request = control(before);
    await call('qdeactivate', {
      request,
      proof: signature('qdeactivate', 'quick_control', request),
    });
    const inactive = await row();
    expect(inactive.active).toBe(false);
    expect(inactive.approval.kind).toBe(3);
    await expect(call('qprune', { runtime, ids: [id] }, ['bob'])).rejects.toThrow(
      'QUICK_RETENTION',
    );
    const resume = {
      version: 1,
      chain_id: f.chainId,
      runtime,
      authority,
      anchor,
      account_id: id,
      epoch: inactive.epoch,
      expires: expires(),
    };
    await expect(
      call('qregister', { request: resume, proof: '' }, ['gateway', 'alice']),
    ).rejects.toThrow();
    await call('qregister', {
      request: resume,
      proof: signature('qregister', 'quick_registration', resume),
    });
    const after = await row();
    expect(after.active).toBe(true);
    expect(after.identity).toBe(before.identity);
    expect(after.approval.kind).toBe(3);
  });
});
