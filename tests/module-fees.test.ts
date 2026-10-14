import { beforeEach, expect, it } from 'vitest';
import { Blockchain } from '@proton/vert';
import { TimePoint } from '@greymass/eosio';
import { ABI, Name, PrivateKey, Serializer } from '@wharfkit/antelope';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadContract, row, send } from './helpers/vert.js';
import { wasmCodeHash } from './helpers/code-hash.js';
import { ballotCommitment, DecideTableSchemas } from '@daclify/modules/sdk';
import { RuntimeTableSchemas, makeInstruction, instructionDigest } from '../sdk/index.js';
const runtimePath = '.artifacts/contracts/runtime';
const decidePath = '../daclify-backend-modules/.artifacts/contracts/decide';
const payrollPath = '../daclify-backend-modules/.artifacts/contracts/payroll';
const runtimeName = 'daclifycore';
let chain: Blockchain,
  runtime: ReturnType<typeof loadContract>,
  decide: ReturnType<typeof loadContract>;
const keys = new Map<string, PrivateKey>();
const now = () => chain.timestamp.toMilliseconds() / 1000;
const feeRow = z.object({
  account: z.string(),
  monthly_usd: z.number(),
  revision: z.union([z.number(), z.string()]).transform(String),
  actions: z.array(z.string()),
});
const termRow = z.object({
  account: z.string(),
  expires: z.number(),
  receipt: z.string(),
  revoked: z.boolean(),
});
const nameKey = (value: string) => BigInt(Name.from(value).value.toString());
async function instruction(
  target: string,
  action: string,
  data: Record<string, unknown>,
  dao = 2,
  member = 1,
) {
  const key = keys.get(`${dao}:${member}`);
  if (!key) throw new Error('FIXTURE_KEY');
  const person = RuntimeTableSchemas.members.parse(
    row(runtime, 'members', BigInt(dao), BigInt(member)),
  );
  const abi = ABI.from(
    readFileSync(
      (target === runtimeName ? runtimePath : target === 'payroll' ? payrollPath : decidePath) +
        '.abi',
      'utf8',
    ),
  );
  const bytes = Serializer.encode({
    abi,
    type: action,
    object: { runtime: runtimeName, dao_id: String(dao), member_id: String(member), ...data },
  }).array;
  const request = makeInstruction(
    { chainId: 'ab'.repeat(32), contract: runtimeName, daoId: String(dao), interfaceVersion: 1 },
    String(member),
    person.nonce,
    now() + 120,
    target,
    action,
    bytes,
  );
  return send(
    runtime,
    'submit',
    [request, key.signDigest(instructionDigest(request)).toString()],
    'relay@active',
  );
}
const fee = (value: Record<string, unknown> = {}, dao = 1, member = 1) =>
  instruction(
    runtimeName,
    'govmodfee',
    {
      account: 'decide',
      expected_revision: '0',
      monthly_usd: 200,
      actions: ['open', 'newelect'],
      ...value,
    },
    dao,
    member,
  );
const open = (id: number) =>
  instruction('decide', 'open', {
    ballot_id: String(id),
    kind: 0,
    choices: 2,
    duration: 300,
    quorum: 5000,
    approval: 5001,
    metadata: '{}',
  });
async function enroll(dao: number, member: number) {
  const key = PrivateKey.generate('K1');
  keys.set(`${dao}:${member}`, key);
  await send(
    runtime,
    'enroll',
    [dao, member, '', key.toPublic().toString(), 'fixture', 0],
    'alice@active',
  );
}
beforeEach(async () => {
  keys.clear();
  chain = new Blockchain();
  chain.createAccounts('alice', 'bob', 'relay', 'eosio.token');
  runtime = loadContract(chain, runtimeName, runtimePath);
  decide = loadContract(chain, 'decide', decidePath);
  await send(runtime, 'init', ['ab'.repeat(32)], runtimeName + '@active');
  await send(
    runtime,
    'setfees',
    [500, 10000, 'alice', 'eosio.token', '4,TLOS', ''],
    runtimeName + '@active',
  );
  await send(
    runtime,
    'listmod',
    ['decide', 'alice', 0, 1, '0.0000 TLOS', wasmCodeHash(decidePath + '.wasm'), 'Decide'],
    runtimeName + '@active',
  );
  for (const dao of [1, 2]) {
    await send(
      runtime,
      'createdao',
      [dao, 'alice', '{}', 0, 'eosio.token', '4,TLOS'],
      'alice@active',
    );
    for (let member = 1; member <= (dao === 1 ? 2 : 10); member++) await enroll(dao, member);
  }
  await send(runtime, 'setgov', [1], runtimeName + '@active');
  await send(
    runtime,
    'setmodule',
    [
      2,
      'decide',
      1,
      ['open', 'openpoll', 'vote', 'votecommit', 'newelect'],
      ['govlock'],
      wasmCodeHash(decidePath + '.wasm'),
    ],
    'alice@active',
  );
});
it('keeps the new neutral poll path covered by an existing open subscription', async () => {
  await fee();
  await enroll(2, 11);
  const nonce = RuntimeTableSchemas.members.parse(row(runtime, 'members', 2n, 1n)).nonce;
  await expect(
    instruction('decide', 'openpoll', {
      ballot_id: '8',
      kind: 0,
      choices: 2,
      duration: 300,
      quorum: 5000,
      approval: 5001,
      metadata: JSON.stringify({
        schemaVersion: 3,
        semantics: 'poll',
        title: 'Venue',
        description: 'Choose a venue',
        options: ['Garden', 'Hall'],
      }),
    }),
  ).rejects.toThrow('MODULE_FEE_REQUIRED');
  expect(RuntimeTableSchemas.members.parse(row(runtime, 'members', 2n, 1n)).nonce).toBe(nonce);
  expect(row(decide, 'ballots', runtime.toBigInt(), 8n)).toBeUndefined();
});
it('keeps terms-based payroll covered by an existing commit subscription without consuming the signer nonce', async () => {
  chain.createAccounts('payroll');
  loadContract(chain, 'payroll', payrollPath);
  const hash = wasmCodeHash(payrollPath + '.wasm');
  await send(
    runtime,
    'listmod',
    ['payroll', 'alice', 0, 1, '0.0000 TLOS', hash, 'Payroll'],
    runtimeName + '@active',
  );
  await send(
    runtime,
    'setmodule',
    [2, 'payroll', 1, ['commit', 'commitdoc'], ['reserve', 'approve'], hash],
    'alice@active',
  );
  await fee({ account: 'payroll', actions: ['commit'] });
  await enroll(2, 11);
  const nonce = RuntimeTableSchemas.members.parse(row(runtime, 'members', 2n, 1n)).nonce;
  await expect(
    instruction('payroll', 'commitdoc', {
      schedule_id: '1',
      recipient: '2',
      quantity: '1.0000 TLOS',
      periods: 1,
      interval: 86400,
      starts: now() + 60,
      label: 'Payroll terms',
      document_id: '1',
      document_version: 1,
      expected: '00'.repeat(32),
      successor_of: '0',
    }),
  ).rejects.toThrow('MODULE_FEE_REQUIRED');
  expect(RuntimeTableSchemas.members.parse(row(runtime, 'members', 2n, 1n)).nonce).toBe(nonce);
});
it('governs first-party monthly prices without permitting direct, non-admin, stale or oversized updates', async () => {
  expect(runtime.actions.govmodfee, 'monthly governance action must be available').toBeDefined();
  await expect(
    send(
      runtime,
      'govmodfee',
      [runtimeName, 1, 1, 'decide', 0, 200, ['open']],
      runtimeName + '@active',
    ),
  ).rejects.toThrow('ACTOR_SENDER');
  await expect(fee({}, 2)).rejects.toThrow('PLATFORM_DAO');
  await expect(fee({}, 1, 2)).rejects.toThrow('ADMIN_REQUIRED');
  await fee();
  expect(feeRow.parse(row(runtime, 'modfees', runtime.toBigInt(), nameKey('decide')))).toEqual({
    account: 'decide',
    monthly_usd: 200,
    revision: '1',
    actions: ['open', 'newelect'],
  });
  await expect(fee()).rejects.toThrow('MODULE_FEE_REVISION');
  for (const change of [
    { actions: ['vote'] },
    { monthly_usd: 49 },
    { actions: ['open', 'open'] },
    { actions: [] },
    { actions: Array.from({ length: 17 }, (_, i) => 'a' + 'b'.repeat(i % 12)) },
  ])
    await expect(fee({ expected_revision: '1', ...change })).rejects.toThrow('MODULE_FEE_POLICY');
  await fee({ expected_revision: '1', monthly_usd: 0 });
  expect(
    feeRow.parse(row(runtime, 'modfees', runtime.toBigInt(), nameKey('decide'))),
  ).toMatchObject({ monthly_usd: 0, revision: '2' });
});
it('makes ten members free, gates the eleventh without consuming its nonce, and keeps existing votes available after expiry', async () => {
  expect(runtime.actions.govmodfee).toBeDefined();
  await fee();
  await open(1);
  await enroll(2, 11);
  const before = RuntimeTableSchemas.members.parse(row(runtime, 'members', 2n, 1n)).nonce;
  await expect(open(2)).rejects.toThrow('MODULE_FEE_REQUIRED');
  expect(RuntimeTableSchemas.members.parse(row(runtime, 'members', 2n, 1n)).nonce).toBe(before);
  await send(runtime, 'sethosted', [10, 'relay'], runtimeName + '@active');
  await send(
    runtime,
    'setmodterm',
    [2, 'decide', '00'.repeat(32), now() + 120, 'cd'.repeat(32)],
    'relay@active',
  );
  await open(2);
  chain.setTime(TimePoint.fromMilliseconds((now() + 121) * 1000));
  await expect(open(3)).rejects.toThrow('MODULE_FEE_REQUIRED');
  const ballot = DecideTableSchemas.ballots.parse(row(decide, 'ballots', runtime.toBigInt(), 1n)),
    definition = DecideTableSchemas.ballotdefs.parse(
      row(decide, 'ballotdefs', runtime.toBigInt(), 1n),
    );
  const expected = ballotCommitment({
    chainId: 'ab'.repeat(32),
    runtime: runtimeName,
    decide: 'decide',
    ballot,
    definition,
  });
  await instruction('decide', 'votecommit', { ballot_id: '1', expected, choice: 0 }, 2, 2);
  await instruction(runtimeName, 'setactive', { target: '11', active: false });
  await open(3);
  expect(
    RuntimeTableSchemas.daos.parse(row(runtime, 'daos', runtime.toBigInt(), 2n)).member_count,
  ).toBe('10');
});
it('binds settlement to the existing settler and DAO/module, and an old refund cannot revoke a newer term', async () => {
  expect(runtime.actions.govmodfee).toBeDefined();
  await fee();
  await enroll(2, 11);
  await send(runtime, 'sethosted', [10, 'relay'], runtimeName + '@active');
  const first = now() + 600,
    second = now() + 1200,
    one = 'cd'.repeat(32),
    two = 'ef'.repeat(32);
  await expect(
    send(runtime, 'setmodterm', [2, 'decide', '00'.repeat(32), first, one], 'bob@active'),
  ).rejects.toThrow();
  await expect(
    send(
      runtime,
      'setmodterm',
      [2, 'decide', '00'.repeat(32), now() + 40 * 86400 + 1, one],
      'relay@active',
    ),
  ).rejects.toThrow('MODULE_TERM_RANGE');
  await send(runtime, 'setmodterm', [1, 'decide', '00'.repeat(32), first, one], 'relay@active');
  await expect(open(1)).rejects.toThrow('MODULE_FEE_REQUIRED');
  await send(runtime, 'setmodterm', [2, 'decide', '00'.repeat(32), first, one], 'relay@active');
  await send(runtime, 'setmodterm', [2, 'decide', '00'.repeat(32), first, one], 'relay@active');
  await send(runtime, 'setmodterm', [2, 'decide', one, second, two], 'relay@active');
  await send(runtime, 'revmodterm', [2, 'decide', one], 'relay@active');
  expect(termRow.parse(row(runtime, 'modterms', 2n, nameKey('decide')))).toMatchObject({
    receipt: two,
    revoked: false,
  });
  await expect(
    send(runtime, 'setmodterm', [2, 'decide', '00'.repeat(32), first, one], 'relay@active'),
  ).rejects.toThrow('MODULE_TERM_CHANGED');
  await send(runtime, 'revmodterm', [2, 'decide', two], 'relay@active');
  await expect(open(1)).rejects.toThrow('MODULE_FEE_REQUIRED');
  await expect(
    send(runtime, 'setmodterm', [2, 'decide', one, second, two], 'relay@active'),
  ).rejects.toThrow('MODULE_TERM_REVOKED');
  await send(runtime, 'resmodterm', [2, 'decide', two], 'relay@active');
  await open(1);
  await send(runtime, 'clearmterms', [2, 0, 25], 'bob@active');
  expect(row(runtime, 'modterms', 2n, nameKey('decide'))).toBeDefined();
  chain.setTime(TimePoint.fromMilliseconds((second + 1) * 1000));
  await expect(send(runtime, 'clearmterms', [2, 0, 26], 'bob@active')).rejects.toThrow(
    'MODULE_TERM_CLEANUP',
  );
  await send(runtime, 'clearmterms', [2, 0, 25], 'bob@active');
  expect(row(runtime, 'modterms', 2n, nameKey('decide'))).toBeUndefined();
});
