import { describe, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { PeopleRoutes, PublicProfileSchema } from '../protocol/people.js';
import { Pool } from 'pg';
import { createServer } from '../services/api/src/server.js';

const reference = { chainId: 'ab'.repeat(32), contract: 'daclifycore', interfaceVersion: 1 };
function fixture() {
  return new NativeChainGateway({
    rpcUrl: 'http://127.0.0.1:18888',
    chainId: reference.chainId,
    runtime: reference.contract,
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
}
describe('public people directory', () => {
  it('serves only the public directory without a session and rejects unknown query fields', async () => {
    const gateway = fixture();
    vi.spyOn(gateway, 'people').mockResolvedValue({ profiles: [], next: null, skipped: 0 });
    const pool = new Pool({ connectionString: 'postgres://127.0.0.1:9/unused' }),
      app = await createServer(pool, gateway, 'https://app.example');
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/people' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ profiles: [], next: null, skipped: 0 });
      const invalid = await app.inject({
        method: 'GET',
        url: '/v1/people?accountId=secret-subject',
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.body).not.toContain('secret-subject');
    } finally {
      await app.close();
      await pool.end();
    }
  });
  it('reads one existing profile using its DAO/member index', async () => {
    const gateway = fixture();
    const page = vi.spyOn(gateway, 'tablePage').mockResolvedValue({
      rows: [
        { id: '7', dao_id: '4', member_id: '9', account_name: 'bob', profile: '{"name":"bob"}' },
      ],
      next: null,
    });
    expect(await gateway.memberProfile('4', '9')).toEqual({
      accountName: 'bob',
      profile: '{"name":"bob"}',
    });
    expect(page).toHaveBeenCalledWith('profiles', 'daclifycore', '9', 1, '4');
  });
  it('returns bounded published profiles and a validated cursor, without service identity data', async () => {
    const gateway = fixture();
    const page = vi.spyOn(gateway, 'tablePage').mockResolvedValue({
      rows: [
        {
          id: '0',
          dao_id: '1',
          member_id: '2',
          account_name: 'alice',
          profile: '{"name":"alice","fullName":"Alice"}',
        },
      ],
      next: '8',
    });
    expect(await gateway.people({ after: '0' })).toEqual({
      profiles: [
        {
          id: '0',
          dao: { ...reference, daoId: '1' },
          memberId: '2',
          accountName: 'alice',
          profile: { name: 'alice', fullName: 'Alice' },
        },
      ],
      next: '8',
      skipped: 0,
    });
    expect(page).toHaveBeenCalledWith('profiles', reference.contract, '0', 50, undefined);
  });
  it('uses the DAO secondary index, never scans private service pairings', async () => {
    const gateway = fixture();
    const rows = vi.spyOn(gateway, 'tablePage').mockResolvedValue({ rows: [], next: null });
    await gateway.people({ daoId: '4' });
    expect(rows).toHaveBeenCalledWith('profiles', reference.contract, '0', 50, '4');
  });
  it('rejects invalid links, malformed CIDs, unknown fields and unbounded cursors', () => {
    expect(
      PublicProfileSchema.safeParse({ name: 'alice', website: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(
      PublicProfileSchema.safeParse({ name: 'alice', avatar: 'https://evil.example/avatar' })
        .success,
    ).toBe(false);
    expect(PublicProfileSchema.safeParse({ name: 'alice', signingKey: 'private' }).success).toBe(
      false,
    );
    expect(PeopleRoutes.list.query.safeParse({ after: '-1' }).success).toBe(false);
    expect(PeopleRoutes.list.query.safeParse({ memberId: '1' }).success).toBe(false);
    expect(
      PeopleRoutes.list.query.safeParse({ daoId: '1', memberId: '1', after: '0' }).success,
    ).toBe(false);
    expect(PeopleRoutes.list.query.safeParse({ after: '18446744073709551616' }).success).toBe(
      false,
    );
  });
  it('skips malformed public JSON and reports it without returning raw chain data', async () => {
    const gateway = fixture();
    vi.spyOn(gateway, 'tablePage').mockResolvedValue({
      rows: [
        {
          id: '1',
          dao_id: '1',
          member_id: '2',
          account_name: 'alice',
          profile: '{"name":"alice","website":"javascript:alert(1)"}',
        },
      ],
      next: null,
    });
    expect(await gateway.people({})).toEqual({ profiles: [], next: null, skipped: 1 });
  });
  it('bounds DAO RPC reads and normalizes the secondary cursor', async () => {
    const gateway = fixture();
    const response = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ rows: [], more: true, next_key: ((4n << 64n) + 9n).toString() }),
          { status: 200 },
        ),
      );
    try {
      expect(await gateway.people({ daoId: '4', after: '2' })).toEqual({
        profiles: [],
        next: '9',
        skipped: 0,
      });
      expect(JSON.parse(String(response.mock.calls[0]?.[1]?.body))).toMatchObject({
        table: 'profiles',
        index_position: 2,
        key_type: 'i128',
        limit: 50,
        lower_bound: ((4n << 64n) + 2n).toString(),
        upper_bound: (5n << 64n).toString(),
      });
      response.mockResolvedValueOnce(
        new Response(JSON.stringify({ rows: [], more: true, next_key: (5n << 64n).toString() }), {
          status: 200,
        }),
      );
      await expect(gateway.people({ daoId: '4' })).rejects.toThrow('CHAIN_RESPONSE_INVALID');
    } finally {
      response.mockRestore();
    }
  });
});
