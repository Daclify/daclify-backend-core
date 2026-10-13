import { beforeAll, afterAll, it, expect } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { nativeContracts, type NativeContracts } from '../helpers/native-contracts.js';
import { encodeAction, RuntimeTableSchemas } from '../../sdk/index.js';
import { ModuleCodeHashes } from '@daclify/modules/sdk';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { randomBytes, randomUUID } from 'node:crypto';
import { encryptProfile } from '../../sdk/profiles.js';
import { ProfileContextSchema, MAX_PROFILE_PLAINTEXT_BYTES } from '../../protocol/profiles.js';
let native: NativeContracts;
beforeAll(async () => {
  native = await nativeContracts();
}, 90000);
afterAll(async () => {
  await native?.stop();
}, 30000);
it('reclaims expired routine delegates through the existing bounded cleanup without touching a live session', async () => {
  const dao = await native.dummyDao(),
    expired = 16;
  for (let index = 1; index <= expired; index++)
    await dao.act(
      'daclifycore',
      'addsession',
      encodeAction('addsession', {
        ...dao.actor(),
        session_id: String(index),
        signing_key: PrivateKey.generate('K1').toPublic().toString(),
        expires: Math.floor(Date.now() / 1000) + 4,
        permissions: [{ target: 'decide', action: 'vote', code_hash: ModuleCodeHashes.decide }],
      }),
    );
  await dao.act(
    'daclifycore',
    'addsession',
    encodeAction('addsession', {
      ...dao.actor('2'),
      session_id: '100',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      expires: Math.floor(Date.now() / 1000) + 600,
      permissions: [{ target: 'decide', action: 'vote', code_hash: ModuleCodeHashes.decide }],
    }),
    '2',
  );
  await new Promise((resolve) => setTimeout(resolve, 4500));
  const before = Number((await native.api.v1.chain.get_account('daclifycore')).ram_usage);
  const cleaned = await native.call(
    'daclifycore',
    'pruneappses',
    { dao_id: dao.daoId, after: '0', limit: 25 },
    'bob',
  );
  const rows = await native.api.v1.chain.get_table_rows({
    code: 'daclifycore',
    scope: dao.daoId,
    table: 'sessions',
    limit: 100,
  });
  const sessions = z.array(RuntimeTableSchemas.sessions).parse(rows.rows);
  expect(sessions.map((value) => value.id)).toEqual(['100']);
  expect(Number((await native.api.v1.chain.get_account('daclifycore')).ram_usage)).toBeLessThan(
    before,
  );
  const after = Number((await native.api.v1.chain.get_account('daclifycore')).ram_usage);
  const cpu = z
    .object({
      processed: z.object({ receipt: z.object({ cpu_usage_us: z.coerce.number().positive() }) }),
    })
    .parse(JSON.parse(JSON.stringify(cleaned))).processed.receipt.cpu_usage_us;
  const wasm = await readFile('.artifacts/contracts/runtime.wasm');
  await writeFile(
    '.artifacts/mini-app-lifecycle-native.json',
    JSON.stringify(
      {
        compiler: 'CDT 4.1.1 -O=s',
        runtime: 'Spring 1.2.2',
        wasmBytes: wasm.length,
        wasmSha256: createHash('sha256').update(wasm).digest('hex'),
        expiredRoutineSessions: expired,
        liveSessionsPreserved: 1,
        ramBefore: before,
        ramAfter: after,
        reclaimedBytes: before - after,
        cleanupCpuMicroseconds: cpu,
        batchLimit: 25,
      },
      null,
      2,
    ) + '\n',
  );
  await dao.act(
    'daclifycore',
    'addsession',
    encodeAction('addsession', {
      ...dao.actor(),
      session_id: '101',
      signing_key: PrivateKey.generate('K1').toPublic().toString(),
      expires: Math.floor(Date.now() / 1000) + 600,
      permissions: [{ target: 'decide', action: 'vote', code_hash: ModuleCodeHashes.decide }],
    }),
  );
}, 60000);
it('measures first and subsequent encrypted rows, maximum payload, and eligible removal', async () => {
  const dao = await native.dummyDao(),
    key = Uint8Array.from(randomBytes(32));
  const ram = async () => Number((await native.api.v1.chain.get_account('daclifycore')).ram_usage);
  const cpu = (result: unknown) =>
    z
      .object({
        processed: z.object({ receipt: z.object({ cpu_usage_us: z.coerce.number().positive() }) }),
      })
      .parse(JSON.parse(JSON.stringify(result))).processed.receipt.cpu_usage_us;
  const publish = async (memberId: string, size: number) => {
    const context = ProfileContextSchema.parse({
        version: 2,
        chainId: native.chainId,
        runtime: 'daclifycore',
        daoId: dao.daoId,
        memberId,
        profileRevision: randomUUID(),
      }),
      profile = await encryptProfile(new Uint8Array(size).fill(97), key, context);
    const result = await dao.act(
      'daclifycore',
      'setencprof',
      encodeAction('setencprof', {
        actor: dao.actor(memberId),
        account_name: memberId === '1' ? 'alice' : 'bob',
        profile: JSON.stringify(profile),
      }),
      memberId,
    );
    return { envelopeBytes: Buffer.byteLength(JSON.stringify(profile)), cpuUs: cpu(result) };
  };
  const before = await ram(),
    first = await publish('1', 1024),
    firstRam = await ram(),
    second = await publish('2', 1024),
    secondRam = await ram(),
    maximum = await publish('1', MAX_PROFILE_PLAINTEXT_BYTES),
    maximumRam = await ram();
  expect(maximumRam).toBeGreaterThan(secondRam);
  const removeOne = await dao.act(
      'daclifycore',
      'delprofile',
      encodeAction('delprofile', { actor: dao.actor() }),
    ),
    removeTwo = await dao.act(
      'daclifycore',
      'delprofile',
      encodeAction('delprofile', { actor: dao.actor('2') }),
      '2',
    ),
    after = await ram();
  expect(after).toBe(before);
  await writeFile(
    '.artifacts/mini-app-profile-resource-native.json',
    JSON.stringify(
      {
        plaintextBytes: 1024,
        maximumPlaintextBytes: MAX_PROFILE_PLAINTEXT_BYTES,
        first: { ...first, ramBytes: firstRam - before },
        subsequent: { ...second, ramBytes: secondRam - firstRam },
        maximum: { ...maximum, additionalRamBytes: maximumRam - secondRam },
        removedBytes: maximumRam - after,
        removalCpuUs: [cpu(removeOne), cpu(removeTwo)],
        scope:
          'Actual runtime total RAM deltas include row and index allocation; CPU samples reflect local concurrent load.',
      },
      null,
      2,
    ) + '\n',
  );
}, 60000);
