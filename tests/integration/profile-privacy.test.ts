import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { Pool } from 'pg';
import { z } from 'zod';
import { NativeChainGateway } from '../../services/api/src/native-chain.js';
import { createServer } from '../../services/api/src/server.js';
import { encryptProfile } from '../../sdk/profiles.js';

const chainId = 'ab'.repeat(32);
const secret = {
  name: 'alice',
  fullName: 'Synthetic private name',
  email: 'private@example.com',
  location: 'Synthetic private location',
  introduction: 'Synthetic private biography',
  avatar: 'bafkreiehxpuhtr5f6v4eu4byjo2j7kkrhjvd7psmfu4imnpdzb3bdqb7vy',
};
const gateway = () =>
  new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:18888',
    chainId,
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
async function cipher() {
  return encryptProfile(
    new TextEncoder().encode(JSON.stringify(secret)),
    crypto.getRandomValues(new Uint8Array(32)),
    {
      version: 2,
      chainId,
      runtime: 'daclifycore',
      daoId: '1',
      memberId: '2',
      profileRevision: crypto.randomUUID(),
    },
  );
}
afterEach(() => vi.restoreAllMocks());
it('keeps the public alias discoverable without personal fields or a decryptable envelope', async () => {
  const encrypted = await cipher(),
    native = gateway();
  vi.spyOn(native, 'tablePage').mockResolvedValue({
    rows: [
      {
        id: '0',
        dao_id: '1',
        member_id: '2',
        account_name: 'alice',
        profile: JSON.stringify(encrypted),
      },
    ],
    next: null,
  });
  const pool = new Pool({ connectionString: 'postgres://127.0.0.1:9/unused' });
  const app = await createServer(pool, native, 'https://app.example');
  try {
    for (const url of ['/v1/people', '/v1/people?daoId=1&memberId=2']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(200);
      expect(
        z.object({ profiles: z.array(z.object({ profile: z.unknown() })) }).parse(response.json())
          .profiles[0]?.profile,
      ).toEqual({ name: 'alice' });
      for (const value of Object.values(secret).slice(1))
        expect(response.body).not.toContain(value);
      expect(response.body).not.toContain(encrypted.ciphertext);
      expect(response.body).not.toContain('grant');
    }
    expect((await native.memberProfile('1', '2')).profile).toBe(JSON.stringify(encrypted));
  } finally {
    await app.close();
    await pool.end();
  }
});
it('refuses an encrypted row whose full native context does not match its table location', async () => {
  const encrypted = await cipher(),
    native = gateway();
  for (const context of [
    { ...encrypted.context, chainId: 'cd'.repeat(32) },
    { ...encrypted.context, runtime: 'othercore' },
    { ...encrypted.context, daoId: '9' },
    { ...encrypted.context, memberId: '9' },
  ]) {
    vi.spyOn(native, 'tablePage').mockResolvedValue({
      rows: [
        {
          id: '0',
          dao_id: '1',
          member_id: '2',
          account_name: 'alice',
          profile: JSON.stringify({ ...encrypted, context }),
        },
      ],
      next: null,
    });
    expect(await native.people({ daoId: '1' })).toEqual({ profiles: [], next: null, skipped: 1 });
  }
});
it('retains explicitly legacy public data without interpreting a malformed encrypted row as legacy', async () => {
  const native = gateway();
  vi.spyOn(native, 'tablePage').mockResolvedValue({
    rows: [
      {
        id: '0',
        dao_id: '1',
        member_id: '2',
        account_name: 'alice',
        profile: JSON.stringify(secret),
      },
      {
        id: '1',
        dao_id: '1',
        member_id: '3',
        account_name: 'bob',
        profile: '{"version":2,"name":"bob"}',
      },
    ],
    next: null,
  });
  const result = await native.people({ daoId: '1' });
  expect(result.profiles[0]?.profile).toEqual(secret);
  expect(result.skipped).toBe(1);
});
