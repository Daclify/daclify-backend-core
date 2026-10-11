import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import {
  encodeAction,
  instructionDigest,
  bindingTypedData,
  governanceTypedData,
} from '../../sdk/index.js';
import { encodeWorks } from '@daclify/modules/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { hashTypedData, type TypedData } from 'viem';
import { RuntimeTableSchemas } from '../../sdk/generated/schemas.js';
import { contextLinkRepairActions } from '../../tools/deploy/permissions.js';
import {
  nativeContracts,
  type DummyDao,
  type NativeContracts,
} from '../helpers/native-contracts.js';
let owned: NativeContracts | undefined;
let first: DummyDao, second: DummyDao;
function fixture() {
  if (!owned) throw new Error('NATIVE_FIXTURE_REQUIRED');
  return owned;
}
beforeAll(async () => {
  owned = await nativeContracts();
  await owned.push(
    contextLinkRepairActions(owned.context, await owned.api.v1.chain.get_account('daclifycore')),
    [owned.key('daclifycore')],
  );
  first = await owned.dummyDao();
  second = await owned.dummyDao('bob');
}, 90000);
afterAll(async () => {
  await owned?.stop();
});
async function last(dao: DummyDao, member = '1') {
  const rows = await fixture().api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: dao.daoId,
    table: 'memberacts',
    limit: 50,
  });
  const row = rows.rows
    .map((value) => RuntimeTableSchemas.memberacts.parse(value))
    .find((r) => r.member_id === member);
  if (!row) throw new Error('ACTIVITY_ROW_REQUIRED');
  return row.last_active;
}
async function advancePast(timestamp: number) {
  while (
    (await fixture().api.v1.chain.get_info()).head_block_time.toMilliseconds() / 1000 <=
    timestamp
  )
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
}
it('starts ordinary native-chain members with no fabricated activity', async () => {
  expect(await last(first)).toBe(0);
  expect(await last(first, '2')).toBe(0);
  expect(await last(second)).toBe(0);
});
it('records real signed ordinary member actions while isolating other members and DAOs', async () => {
  await first.act(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...first.actor('2'),
      document_id: '2',
      version: 1,
      value: '{"ordinary":true}',
      envelope_version: 0,
      key_epoch: '0',
    }),
    '2',
  );
  expect(await last(first, '2')).toBeGreaterThan(0);
  expect(await last(first)).toBe(0);
  expect(await last(second, '2')).toBe(0);
});
it('real transaction failure, forged signatures and replay leave activity and nonce intact', async () => {
  const request = await first.request(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', { ...first.actor(), metadata: '{invalid' }),
  );
  const before = await first.member();
  await expect(first.submit(request)).rejects.toThrow();
  expect(await last(first)).toBe(0);
  expect((await first.member()).nonce).toBe(before.nonce);
  const forged = fixture().action(
    'daclifycore',
    'submit',
    { request, sig: PrivateKey.generate('K1').signDigest(instructionDigest(request)) },
    [{ actor: 'relay', permission: 'active' }],
    fixture().abi('daclifycore'),
  );
  await expect(fixture().push([forged], [fixture().key('relay')])).rejects.toThrow();
  expect(await last(first)).toBe(0);
  const good = await first.request(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', { ...first.actor(), metadata: '{"title":"Actual native action"}' }),
  );
  await first.submit(good);
  const recorded = await last(first);
  await expect(first.submit(good)).rejects.toThrow();
  expect(await last(first)).toBe(recorded);
});
it('records native submissions and rejects another account claiming the member', async () => {
  await first.act(
    'daclifycore',
    'linknative',
    encodeAction('linknative', { ...first.actor('2'), account: 'alice' }),
    '2',
    'alice',
  );
  const request = await first.request(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...first.actor('2'),
      document_id: '3',
      version: 1,
      value: '{}',
      envelope_version: 0,
      key_epoch: '0',
    }),
    '2',
  );
  const before = (await first.member('2')).nonce;
  await expect(fixture().call('daclifycore', 'submitnat', { request }, 'bob')).rejects.toThrow();
  expect((await first.member('2')).nonce).toBe(before);
  await fixture().call('daclifycore', 'submitnat', { request }, 'alice');
  expect(await last(first, '2')).toBeGreaterThan(0);
});
it('requires real deployment authority for bounded initialization and preserves known timestamps', async () => {
  const before = await last(first);
  await expect(
    fixture().call(
      'daclifycore',
      'initactivity',
      { dao_id: first.daoId, after: '0', limit: 50 },
      'alice',
    ),
  ).rejects.toThrow();
  await fixture().call('daclifycore', 'initactivity', {
    dao_id: first.daoId,
    after: '0',
    limit: 50,
  });
  expect(await last(first)).toBe(before);
  await expect(
    fixture().call('daclifycore', 'initactivity', { dao_id: first.daoId, after: '0', limit: 51 }),
  ).rejects.toThrow();
});
it('updating a reserved activity row consumes no additional physical account RAM', async () => {
  const before = await fixture().api.v1.chain.get_account('daclifycore');
  await first.act(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', { ...first.actor(), metadata: '{"title":"Actual native action"}' }),
  );
  const after = await fixture().api.v1.chain.get_account('daclifycore');
  expect(after.ram_usage.toString()).toBe(before.ram_usage.toString());
  expect(await last(first)).toBeGreaterThan(0);
});
it('records a real R1 scoped-session action and preserves activity for denied session scope', async () => {
  const key = PrivateKey.generate('R1');
  await first.act(
    'daclifycore',
    'addsession',
    encodeAction('addsession', {
      ...first.actor('3'),
      session_id: '1',
      signing_key: key.toPublic().toString(),
      expires: Math.floor(Date.now() / 1000) + 600,
      permissions: [{ target: 'daclifycore', action: 'putjson', code_hash: '00'.repeat(32) }],
    }),
    '3',
  );
  const before = await last(first, '3');
  const denied = await first.request(
    'daclifycore',
    'setmeta',
    encodeAction('setmeta', { ...first.actor('3'), metadata: '{}' }),
    '3',
  );
  await expect(
    fixture().call(
      'daclifycore',
      'submitsess',
      { request: denied, session_id: '1', sig: key.signDigest(instructionDigest(denied)) },
      'relay',
    ),
  ).rejects.toThrow();
  expect(await last(first, '3')).toBe(before);
  await advancePast(before);
  const request = await first.request(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...first.actor('3'),
      document_id: '4',
      version: 1,
      value: '{"session":true}',
      envelope_version: 0,
      key_epoch: '0',
    }),
    '3',
  );
  await fixture().call(
    'daclifycore',
    'submitsess',
    { request, session_id: '1', sig: key.signDigest(instructionDigest(request)) },
    'relay',
  );
  expect(await last(first, '3')).toBeGreaterThan(before);
});
it('records independently signed EVM governance and rejects a changed typed-data domain', async () => {
  const scalar = new Uint8Array(32);
  scalar[31] = 1;
  const binding = {
    chainId: 41 as const,
    address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
    epoch: '1',
  };
  function sign(
    data: ReturnType<typeof bindingTypedData> | ReturnType<typeof governanceTypedData>,
  ) {
    const digest = hashTypedData<TypedData, string>(data),
      raw = secp256k1.sign(Buffer.from(digest.slice(2), 'hex'), scalar, {
        prehash: false,
        format: 'recovered',
      });
    return Buffer.concat([
      Buffer.from(raw.subarray(1)),
      Buffer.from([(raw[0] ?? 0) + 27]),
    ]).toString('hex');
  }
  const nonce = (await first.member('3')).nonce,
    expires = Math.floor(Date.now() / 1000) + 300;
  await first.act(
    'daclifycore',
    'linkevm',
    encodeAction('linkevm', {
      ...first.actor('3'),
      evm_chain_id: '41',
      address: binding.address.slice(2),
      epoch: '1',
      nonce,
      expires,
      proof: sign(bindingTypedData(first.reference, '3', binding, nonce, expires)),
    }),
    '3',
  );
  const before = await last(first, '3');
  await advancePast(before);
  const request = await first.request(
    'daclifycore',
    'putjson',
    encodeAction('putjson', {
      ...first.actor('3'),
      document_id: '5',
      version: 1,
      value: '{"evm":true}',
      envelope_version: 0,
      key_epoch: '0',
    }),
    '3',
  );
  const proof = sign(governanceTypedData(request, binding));
  await expect(
    fixture().call(
      'daclifycore',
      'submitevm',
      {
        request: { ...request, expires: request.expires - 1 },
        evm_chain_id: '41',
        address: binding.address.slice(2),
        binding_epoch: '1',
        proof,
      },
      'relay',
    ),
  ).rejects.toThrow();
  expect(await last(first, '3')).toBe(before);
  await fixture().call(
    'daclifycore',
    'submitevm',
    { request, evm_chain_id: '41', address: binding.address.slice(2), binding_epoch: '1', proof },
    'relay',
  );
  expect(await last(first, '3')).toBeGreaterThan(before);
});
it('records an installed module action for the authenticated member across dummy DAO isolation', async () => {
  await first.document();
  const before = await last(first);
  await advancePast(before);
  await first.act(
    'works',
    'propose',
    encodeWorks('propose', {
      ...first.actor(),
      project_id: '1',
      contributor: '3',
      document_id: '1',
      document_version: 1,
      payments: ['1.0000 TLOS'],
      dues: [0],
    }),
  );
  expect(await last(first)).toBeGreaterThan(before);
  expect(await last(second)).toBe(0);
});
