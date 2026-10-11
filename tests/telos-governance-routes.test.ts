import Fastify from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import { TelosGovernanceClient } from '@daclify/modules/sdk';
import { ErrorSchema } from '../protocol/base.js';
import {
  createTelosGovernanceClient,
  registerTelosGovernanceRoutes,
} from '../services/api/src/telos-governance.js';
const source = {
  chainId: 'ab'.repeat(32),
  rpcUrl: 'https://rpc.example.test',
  contract: 'telos.decide' as const,
  environment: 'testnet' as const,
  codeHash: null,
  abiHash: null,
};
it('provides public bounded history without sessions or a broadcast capability', async () => {
  const app = Fastify();
  registerTelosGovernanceRoutes(
    app,
    new TelosGovernanceClient(source, async (path, body) => {
      if (path === 'get_info') return { chain_id: source.chainId };
      if (path === 'get_table_rows' && body.limit === 25) return { rows: [], more: false };
      throw new Error('Unexpected RPC operation');
    }),
  );
  const response = await app.inject('/v1/telos/ballots');
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ ballots: [], nextCursor: null, signingAvailable: false });
  expect((await app.inject('/v1/telos/ballots?cursor=bad')).statusCode).toBe(400);
  await app.close();
});
it('redacts provider failures and refuses unpinned preparation', async () => {
  const app = Fastify();
  registerTelosGovernanceRoutes(
    app,
    new TelosGovernanceClient(source, async () => {
      throw new Error('secret-provider-detail');
    }),
  );
  const response = await app.inject('/v1/telos/ballots');
  expect(response.statusCode).toBe(503);
  expect(response.body).not.toContain('secret-provider-detail');
  expect(ErrorSchema.parse(response.json()).code).toBe('TELOS_UNAVAILABLE');
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/v1/telos/votes/prepare',
        payload: { ballot: 'ballot', voter: 'alice', options: ['yes', 'yes'] },
      })
    ).statusCode,
  ).toBe(400);
  await app.close();
});

afterEach(() => vi.unstubAllGlobals());
it('preserves an operator RPC path prefix and bounds provider responses', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ chain_id: source.chainId })));
  vi.stubGlobal('fetch', fetcher);
  const network = {
    chainId: source.chainId,
    rpcUrl: source.rpcUrl + '/native/',
    environment: 'testnet' as const,
    runtime: 'daclifycore',
    hub: null,
    interfaceVersion: 1 as const,
    coreVersion: '0.14.0-alpha.1',
    capabilities: [],
  };
  const client = createTelosGovernanceClient(network, { codeHash: null, abiHash: null });
  fetcher
    .mockResolvedValueOnce(new Response(JSON.stringify({ chain_id: source.chainId })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ rows: [], more: false })));
  await client.ballots();
  expect(String(fetcher.mock.calls[0]?.[0])).toBe(source.rpcUrl + '/native/v1/chain/get_info');
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
  fetcher.mockResolvedValueOnce(new Response('x'.repeat(262145)));
  await expect(client.ballots()).rejects.toThrow('TELOS_RESPONSE_INVALID');
});
it('serves exact retained ballot identifiers beginning with dots', async () => {
  const name = '..teloscrew1';
  const ballot = {
    ballot_name: name,
    category: 'proposal',
    publisher: 'publisher',
    status: 'closed',
    title: 'Historical proposal',
    description: '',
    content: '',
    treasury_symbol: '4,VOTE',
    voting_method: '1token1vote',
    min_options: 1,
    max_options: 1,
    options: [{ key: 'yes', value: '1.0000 VOTE' }],
    total_voters: 1,
    total_delegates: 0,
    total_raw_weight: '1.0000 VOTE',
    cleaned_count: 0,
    settings: [{ key: 'votestake', value: 1 }],
    begin_time: '2020-01-01T00:00:00',
    end_time: '2020-01-02T00:00:00',
  };
  const app = Fastify();
  registerTelosGovernanceRoutes(
    app,
    new TelosGovernanceClient(source, async (path) =>
      path === 'get_info' ? { chain_id: source.chainId } : { rows: [ballot], more: false },
    ),
  );
  const response = await app.inject('/v1/telos/ballots/' + name);
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json().ballot.ballot_name).toBe(name);
  await app.close();
});
