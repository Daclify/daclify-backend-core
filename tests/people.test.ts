import { describe, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { PeopleRoutes, PublicProfileSchema } from '../protocol/people.js';
import { Pool } from 'pg';
import { createServer } from '../services/api/src/server.js';
import { z } from 'zod';

const publicMember = {
  id: '1',
  native_account: 'alice',
  signing_key: PrivateKey.generate('K1').toPublic().toString(),
  encryption_key: 'private-service-data-is-not-in-this-row',
  custody: 0,
  nonce: '0',
  credits: '0',
  active: true,
  admin: true,
  reviewer: false,
  stake: '0',
  claim: '0',
  join_epoch: '1',
};
const publicDao = {
  id: '1',
  owner: 'alice',
  metadata: '{}',
  privacy: 0,
  token_contract: 'eosio.token',
  token_symbol: '4,TLOS',
  credit_supply: '0',
  member_count: '2',
  max_member: '2',
  active_ballots: 0,
  available: '0',
  reserved: '0',
  claims: '0',
  staked: '0',
  eligible_credits: '0',
  eligible_stake: '0',
  admin_count: 1,
  key_epoch: '0',
  history_policy: 0,
};

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
  it('shows public members without requiring profile publication or exposing keys', async () => {
    const gateway = fixture();
    const requests: Array<{ table: string; scope: string; lower_bound: string; limit: number }> =
      [];
    const rpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request = z
        .object({
          table: z.string(),
          scope: z.string(),
          lower_bound: z.string(),
          limit: z.number(),
        })
        .parse(JSON.parse(String(init?.body)));
      requests.push(request);
      const rows =
        request.table === 'daos'
          ? [publicDao, { ...publicDao, id: '4' }]
          : request.table === 'members'
            ? [publicMember, { ...publicMember, id: '2', native_account: '' }]
            : [];
      return new Response(JSON.stringify({ rows, more: false }));
    });
    try {
      const result = await gateway.publicMembers({});
      expect(result).toEqual({
        members: [
          {
            dao: { ...reference, daoId: '1' },
            id: '1',
            native_account: 'alice',
            active: true,
            profile: null,
          },
          {
            dao: { ...reference, daoId: '1' },
            id: '2',
            native_account: '',
            active: true,
            profile: null,
          },
        ],
        next: { daoId: '4', after: '0' },
      });
      expect(JSON.stringify(result)).not.toContain(publicMember.signing_key);
      expect(JSON.stringify(result)).not.toContain(publicMember.encryption_key);
      expect(requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ table: 'daos', limit: 2 }),
          expect.objectContaining({ table: 'members', scope: '1', limit: 50 }),
          expect.objectContaining({ table: 'profiles', limit: 50 }),
        ]),
      );
      expect(requests).toHaveLength(3);
    } finally {
      rpc.mockRestore();
    }
  });
  it('keeps member pagination in its DAO and enriches only the matching public profile', async () => {
    const gateway = fixture();
    const rpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request = z
        .object({ table: z.string(), lower_bound: z.string() })
        .parse(JSON.parse(String(init?.body)));
      if (request.table === 'daos')
        return new Response(JSON.stringify({ rows: [publicDao], more: false }));
      if (request.table === 'members')
        return new Response(
          JSON.stringify({ rows: [{ ...publicMember, id: '2' }], more: true, next_key: '3' }),
        );
      return new Response(
        JSON.stringify({
          rows: [
            {
              id: '7',
              dao_id: '1',
              member_id: '2',
              account_name: 'alice',
              profile: '{"name":"alice","fullName":"Alice"}',
            },
            {
              id: '8',
              dao_id: '1',
              member_id: '3',
              account_name: 'bob',
              profile: '{"name":"bob"}',
            },
          ],
          more: false,
        }),
      );
    });
    try {
      const result = await gateway.publicMembers({ daoId: '1', after: '2' });
      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.profile).toEqual({ name: 'alice', fullName: 'Alice' });
      expect(result.next).toEqual({ daoId: '1', after: '3' });
    } finally {
      rpc.mockRestore();
    }
  });
  it('serves the public member directory without a service session', async () => {
    const gateway = fixture();
    vi.spyOn(gateway, 'publicMembers').mockResolvedValue({ members: [], next: null });
    const pool = new Pool({ connectionString: 'postgres://127.0.0.1:9/unused' });
    const app = await createServer(pool, gateway, 'https://app.example');
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/people/members' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ members: [], next: null });
      expect(
        (await app.inject({ method: 'GET', url: '/v1/people/members?after=2' })).statusCode,
      ).toBe(400);
      expect(
        (await app.inject({ method: 'GET', url: '/v1/people/members?accountId=secret' }))
          .statusCode,
      ).toBe(400);
    } finally {
      await app.close();
      await pool.end();
    }
  });
  it('advances through an empty DAO without reading profiles and honors short RPC pages', async () => {
    const gateway = fixture();
    const rpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request = z.object({ table: z.string() }).parse(JSON.parse(String(init?.body)));
      if (request.table === 'daos')
        return new Response(JSON.stringify({ rows: [publicDao], more: true, next_key: '4' }));
      expect(request.table).toBe('members');
      return new Response(JSON.stringify({ rows: [], more: false }));
    });
    try {
      expect(await gateway.publicMembers({})).toEqual({
        members: [],
        next: { daoId: '4', after: '0' },
      });
      expect(rpc).toHaveBeenCalledTimes(2);
    } finally {
      rpc.mockRestore();
    }
  });
  it('keeps a member visible when its published profile has invalid JSON', async () => {
    const gateway = fixture();
    const rpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request = z.object({ table: z.string() }).parse(JSON.parse(String(init?.body)));
      const rows =
        request.table === 'daos'
          ? [publicDao]
          : request.table === 'members'
            ? [publicMember]
            : [{ id: '0', dao_id: '1', member_id: '1', account_name: 'alice', profile: 'invalid' }];
      return new Response(JSON.stringify({ rows, more: false }));
    });
    try {
      const result = await gateway.publicMembers({});
      expect(result.members[0]?.native_account).toBe('alice');
      expect(result.members[0]?.profile).toBeNull();
      expect(result.next).toBeNull();
    } finally {
      rpc.mockRestore();
    }
  });
  it('keeps an explicitly scoped operator directory within its selected DAO', async () => {
    const gateway = fixture();
    const rpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const request = z.object({ table: z.string() }).parse(JSON.parse(String(init?.body)));
      const rows =
        request.table === 'daos'
          ? [publicDao, { ...publicDao, id: '4' }]
          : request.table === 'members'
            ? [publicMember]
            : [];
      return new Response(JSON.stringify({ rows, more: false }));
    });
    try {
      const result = await gateway.publicMembers({ daoId: '1', onlyDao: '1' });
      expect(result.members[0]?.dao.daoId).toBe('1');
      expect(result.next).toBeNull();
    } finally {
      rpc.mockRestore();
    }
  });
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
