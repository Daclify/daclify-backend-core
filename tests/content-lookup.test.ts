import { afterEach, expect, it, vi } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { RuntimeTableSchemas } from '../sdk/index.js';
import { NativeChainGateway } from '../services/api/src/native-chain.js';
import { ContentService } from '../services/api/src/content/service.js';
import type { ContentProvider } from '../services/api/src/content/provider.js';

const daoId = '18446744073709551615';
const documentId = '18446744073709551614';
const bytes = Buffer.from('owned document bytes');
const document = RuntimeTableSchemas.documents.parse({
  id: '25',
  document_id: documentId,
  version: 4294967295,
  author: '1',
  cid: 'owned-cid',
  metadata: '{}',
  commitment: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length,
  envelope_version: 1,
  key_epoch: '50',
});
const dao = RuntimeTableSchemas.daos.parse({
  id: daoId,
  owner: 'alice',
  metadata: '{}',
  privacy: 2,
  token_contract: 'eosio.token',
  token_symbol: '4,TLOS',
  credit_supply: '0',
  member_count: '200',
  max_member: '200',
  active_ballots: 0,
  available: '0',
  reserved: '0',
  claims: '0',
  staked: '0',
  eligible_credits: '0',
  eligible_stake: '0',
  admin_count: 1,
  key_epoch: '50',
  history_policy: 0,
});
afterEach(() => vi.unstubAllGlobals());
function fixture(rows: unknown[] = [document], knownDao = true) {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: unknown, init?: RequestInit) => {
    const request = z.record(z.string(), z.unknown()).parse(JSON.parse(String(init?.body)));
    requests.push(request);
    if (request.table === 'daos')
      return Response.json({ rows: knownDao ? [dao] : [], more: false });
    if (request.table !== 'documents') throw Error('UNRELATED_HISTORY_READ');
    expect(request).toMatchObject({
      code: 'daclifycore',
      scope: daoId,
      json: true,
      table: 'documents',
      index_position: 2,
      key_type: 'i128',
      limit: 1,
      lower_bound: '79228162514264337589248983039',
      upper_bound: '79228162514264337589248983039',
    });
    return Response.json({ rows, more: false });
  });
  const chain = new NativeChainGateway({
    rpcUrl: 'https://chain.example',
    chainId: 'ab'.repeat(32),
    runtime: 'daclifycore',
    hub: null,
    environment: 'local',
    relayActor: 'relay',
    relayKey: PrivateKey.generate('K1'),
  });
  const retrieve = vi.fn<ContentProvider['retrieve']>().mockResolvedValue(bytes);
  const unused = async (): Promise<never> => {
    throw Error('UNUSED_PROVIDER_WRITE');
  };
  const provider: ContentProvider = { retrieve, upload: unused, find: unused, remove: unused };
  const pool = new Pool();
  return {
    chain,
    service: new ContentService(pool, chain, provider, 0n),
    requests,
    retrieve,
    pool,
  };
}
it('downloads one exact version with two bounded reads and no member, epoch or grant history', async () => {
  const f = fixture();
  try {
    expect(await f.service.retrieve(daoId, documentId, 4294967295)).toEqual(bytes);
    expect(f.requests.map((r) => r.table)).toEqual(['daos', 'documents']);
    expect(f.retrieve).toHaveBeenCalledWith('owned-cid', bytes.length);
    f.retrieve.mockResolvedValue(Buffer.from('corrupt'));
    await expect(f.service.retrieve(daoId, documentId, 4294967295)).rejects.toThrow(
      'DOCUMENT_INTEGRITY',
    );
  } finally {
    await f.pool.end();
  }
});
it.each([
  { rows: [] },
  { rows: [{ ...document, document_id: '1' }] },
  { rows: [{ ...document, version: 1 }] },
])('does not download a missing version or an adjacent index result', async ({ rows }) => {
  const f = fixture(rows);
  try {
    await expect(f.service.retrieve(daoId, documentId, 4294967295)).rejects.toThrow(
      'DOCUMENT_UNKNOWN',
    );
    expect(f.retrieve).not.toHaveBeenCalled();
  } finally {
    await f.pool.end();
  }
});
it('refuses malformed chain rows before a provider read', async () => {
  const f = fixture([{ ...document, commitment: 'invalid' }]);
  try {
    await expect(f.service.retrieve(daoId, documentId, 4294967295)).rejects.toThrow(
      'CHAIN_RESPONSE_INVALID',
    );
    expect(f.retrieve).not.toHaveBeenCalled();
  } finally {
    await f.pool.end();
  }
});
it('does not look up a document in an unknown DAO', async () => {
  const f = fixture([], false);
  try {
    await expect(f.service.retrieve(daoId, documentId, 4294967295)).rejects.toThrow('DAO_UNKNOWN');
    expect(f.requests.map((r) => r.table)).toEqual(['daos']);
  } finally {
    await f.pool.end();
  }
});
it.each([
  { dao: '01', id: documentId, version: 1 },
  { dao: daoId, id: '0', version: 1 },
  { dao: daoId, id: '18446744073709551616', version: 1 },
  { dao: daoId, id: documentId, version: 0 },
  { dao: daoId, id: documentId, version: 4294967296 },
])(
  'refuses invalid lookup identifiers before any chain request: $dao/$id/$version',
  async (input) => {
    const f = fixture();
    try {
      await expect(f.service.retrieve(input.dao, input.id, input.version)).rejects.toThrow();
      expect(f.requests).toEqual([]);
      expect(f.retrieve).not.toHaveBeenCalled();
    } finally {
      await f.pool.end();
    }
  },
);
