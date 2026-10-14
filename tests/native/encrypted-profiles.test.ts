import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
import { encodeAction, RuntimeTableSchemas } from '../../sdk/index.js';
import { encryptProfile, decodeRawNativeProfile } from '../../sdk/profiles.js';
import { ProfileContextSchema } from '../../protocol/profiles.js';
let f: NativeContracts;
let dao: Awaited<ReturnType<NativeContracts['dummyDao']>>;
const email = 'native-synthetic@example.test';
const key = Uint8Array.from(randomBytes(32));
const context = () =>
  ProfileContextSchema.parse({
    version: 2,
    chainId: f.chainId,
    runtime: 'daclifycore',
    daoId: dao.daoId,
    memberId: '1',
    profileRevision: randomUUID(),
  });
const actor = () => ({ runtime: 'daclifycore', dao_id: dao.daoId, member_id: '1' });
async function profiles() {
  const result = await f.api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: 'daclifycore',
    table: 'profiles',
    limit: 100,
  });
  return z
    .array(RuntimeTableSchemas.profiles)
    .parse(result.rows)
    .filter((row) => row.dao_id === dao.daoId);
}
async function encrypted() {
  return encryptProfile(
    new TextEncoder().encode(JSON.stringify({ name: 'alice', email })),
    key,
    context(),
  );
}
async function write(value: unknown, account = 'alice') {
  const request = await dao.request(
    'daclifycore',
    'setencprof',
    encodeAction('setencprof', {
      actor: actor(),
      account_name: account,
      profile: JSON.stringify(value),
    }),
  );
  expect(Buffer.from(request.data, 'hex').toString('utf8')).not.toContain(email);
  return dao.submit(request);
}
const cpu = (result: unknown) =>
  z
    .object({
      processed: z.object({
        receipt: z.object({ cpu_usage_us: z.coerce.number().int().positive() }),
      }),
    })
    .parse(JSON.parse(JSON.stringify(result))).processed.receipt.cpu_usage_us;
beforeAll(async () => {
  f = await nativeContracts();
  dao = await f.dummyDao();
}, 90000);
afterAll(async () => f?.stop());
it('requires an explicit encrypted-profile action in the installed native ABI', async () => {
  const abi = await f.api.v1.chain.get_abi('daclifycore');
  expect(abi.abi?.actions.map((action) => String(action.name))).toContain('setencprof');
});
it('preserves canonical public alias validation for encrypted writes', async () => {
  for (const alias of ['.alice', 'alice..bob', 'abcdefghijklj'])
    await expect(write(await encrypted(), alias)).rejects.toThrow('PROFILE_NAME');
  expect(await profiles()).toHaveLength(0);
});
it('rejects unauthorized writes/deletes and binds encrypted content to its full actor', async () => {
  const profile = await encrypted();
  await expect(
    f.call(
      'daclifycore',
      'setencprof',
      { actor: actor(), account_name: 'alice', profile: JSON.stringify(profile) },
      'bob',
    ),
  ).rejects.toThrow();
  await expect(f.call('daclifycore', 'delprofile', { actor: actor() }, 'bob')).rejects.toThrow();
  const request = await dao.request(
    'daclifycore',
    'setencprof',
    encodeAction('setencprof', {
      actor: actor(),
      account_name: 'alice',
      profile: JSON.stringify(profile),
    }),
  );
  await expect(dao.submit(request, '2')).rejects.toThrow();
  for (const wrong of [
    { ...profile, context: { ...profile.context, chainId: 'ab'.repeat(32) } },
    { ...profile, context: { ...profile.context, daoId: '2' } },
    { ...profile, context: { ...profile.context, memberId: '2' } },
    { ...profile, context: { ...profile.context, runtime: 'otherdao' } },
  ])
    await expect(write(wrong)).rejects.toThrow('PROFILE_CONTEXT');
  expect(await profiles()).toHaveLength(0);
});
it('rejects malformed/oversized envelopes and all new plaintext writes', async () => {
  const profile = await encrypted();
  for (const value of [
    { ...profile, iv: 'not-base64' },
    { ...profile, ciphertext: 'AB==' },
    { ...profile, ciphertext: 'A'.repeat(5488) },
    { ...profile, extra: 'personal' },
    { ...profile, context: { ...profile.context, extra: 'personal' } },
  ])
    await expect(write(value)).rejects.toThrow('PROFILE_FORMAT');
  await expect(write({ ...profile, iv: 'A'.repeat(10000) })).rejects.toThrow('PROFILE_SIZE');
  await expect(
    dao.submit(
      await dao.request(
        'daclifycore',
        'setprofile',
        encodeAction('setprofile', {
          ...actor(),
          account_name: 'alice',
          profile: '{"name":"alice"}',
        }),
      ),
    ),
  ).rejects.toThrow('PROFILE_ENCRYPTION_REQUIRED');
});
it('stores/removes format 2 while preserving membership and financial balances and reclaiming RAM', async () => {
  const before = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage),
    profile = await encrypted();
  const written = await write(profile),
    stored = await profiles();
  expect(stored).toHaveLength(1);
  expect(decodeRawNativeProfile(stored[0]).version).toBe(2);
  const filled = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage),
    member = await dao.member();
  const removed = await dao.submit(
    await dao.request('daclifycore', 'delprofile', encodeAction('delprofile', { actor: actor() })),
  );
  expect(await profiles()).toHaveLength(0);
  const after = Number((await f.api.v1.chain.get_account('daclifycore')).ram_usage);
  expect(filled).toBeGreaterThan(before);
  expect(after).toBeLessThan(filled);
  const person = await dao.member();
  expect(person.active).toBe(member.active);
  expect(person.claim).toBe(member.claim);
  expect(person.stake).toBe(member.stake);
  await write(profile);
  await expect(write(profile, 'bob')).rejects.toThrow('NAME_IMMUTABLE');
  await write(profile);
  await writeFile(
    '.artifacts/encrypted-profiles-native.json',
    JSON.stringify(
      {
        wasmBytes: (await readFile('.artifacts/contracts/runtime.wasm')).length,
        profileInsertRam: filled - before,
        profileDeleteRam: filled - after,
        cpuMicroseconds: { write: cpu(written), remove: cpu(removed) },
      },
      null,
      2,
    ) + '\n',
  );
});
it('upgrades an existing plaintext row without changing its serialized identity/indexes', async () => {
  await dao.submit(
    await dao.request('daclifycore', 'delprofile', encodeAction('delprofile', { actor: actor() })),
  );
  await f.deploy('daclifycore', '.artifacts/profile-legacy/runtime');
  await dao.submit(
    await dao.request(
      'daclifycore',
      'setprofile',
      encodeAction('setprofile', {
        ...actor(),
        account_name: 'alice',
        profile: JSON.stringify({ name: 'alice', email: 'historical-public@example.test' }),
      }),
    ),
  );
  const before = (await profiles())[0];
  expect(decodeRawNativeProfile(before).version).toBe(1);
  await f.deploy('daclifycore', '.artifacts/contracts/runtime');
  expect((await profiles())[0]).toEqual(before);
  await write(await encrypted());
  const after = (await profiles())[0];
  expect(after?.id).toBe(before?.id);
  expect(after?.account_name).toBe(before?.account_name);
  expect(decodeRawNativeProfile(after).version).toBe(2);
});
it('refuses fresh plaintext publication at the native boundary', async () => {
  await expect(
    dao.submit(
      await dao.request(
        'daclifycore',
        'setprofile',
        encodeAction('setprofile', {
          ...actor(),
          account_name: 'carol',
          profile: '{"name":"carol","email":"synthetic@example.test"}',
        }),
      ),
    ),
  ).rejects.toThrow('PROFILE_ENCRYPTION_REQUIRED');
});

it('keeps public aliases unique and allows the owner to remove a profile after deactivation', async () => {
  const profile = await encryptProfile(new TextEncoder().encode('{"name":"alice"}'), key, {
    ...context(),
    memberId: '2',
  });
  const second = await dao.request(
    'daclifycore',
    'setencprof',
    encodeAction('setencprof', {
      actor: dao.actor('2'),
      account_name: 'alice',
      profile: JSON.stringify(profile),
    }),
    '2',
  );
  await expect(dao.submit(second, '2')).rejects.toThrow('NAME_TAKEN');
  await dao.act(
    'daclifycore',
    'setroles',
    encodeAction('setroles', { ...actor(), target: '2', admin: true, reviewer: false }),
  );
  await dao.act(
    'daclifycore',
    'setactive',
    encodeAction('setactive', { ...actor(), target: '1', active: false }),
  );
  const member = await dao.member();
  expect(member.active).toBe(false);
  await dao.submit(
    await dao.request('daclifycore', 'delprofile', encodeAction('delprofile', { actor: actor() })),
  );
  expect(await profiles()).toHaveLength(0);
  const after = await dao.member();
  expect(after.active).toBe(false);
  expect(after.claim).toBe(member.claim);
  expect(after.stake).toBe(member.stake);
});
it('refuses plaintext in the API gateway before broadcasting a transaction', async () => {
  const { AccountSchema } = await import('../../protocol/api.js');
  const { generateKeyPairSync } = await import('node:crypto');
  const root = dao.keys[0];
  if (!root) throw new Error('FIXTURE_ROOT_REQUIRED');
  const account = AccountSchema.parse({
    id: randomUUID(),
    custody: 'user-controlled',
    signingKey: root.toPublic().toString(),
    encryptionKey: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({
      format: 'jwk',
    }),
  });
  const request = await dao.request(
    'daclifycore',
    'setprofile',
    encodeAction('setprofile', {
      ...actor(),
      account_name: 'alice',
      profile: '{"name":"alice","email":"synthetic@example.test"}',
    }),
  );
  const observed = vi.spyOn(globalThis, 'fetch');
  try {
    await expect(
      f.gateway.relay(
        account,
        request,
        root.signDigest((await import('../../sdk/index.js')).instructionDigest(request)).toString(),
      ),
    ).rejects.toMatchObject({ code: 'PROFILE_ENCRYPTION_REQUIRED' });
    const paths = observed.mock.calls.map(
      ([input]) => new URL(input instanceof Request ? input.url : String(input)).pathname,
    );
    expect(paths).toContain('/v1/chain/get_abi');
    expect(paths).not.toContain('/v1/chain/push_transaction');
  } finally {
    observed.mockRestore();
  }
});
