import Fastify from 'fastify';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { expect, it, vi } from 'vitest';
import { DaoRefSchema, NativeAccountSchema } from '../protocol/index.js';
import { QuickBallotRoutes, LegacyQuickBallotRoutes, QuickBallotRowSchema } from '@daclify/modules';
import { QuickBallots } from '../services/api/src/quick-ballots/service.js';
import { NativeQuickBallots } from '../services/api/src/quick-ballots/chain.js';
import { registerQuickBallotRoutes } from '../services/api/src/quick-ballots/routes.js';

it('preserves old reader shapes and pagination without rewriting a private frozen definition', async () => {
  const fixture = z.object({ dao: DaoRefSchema, source: z.object({ account: NativeAccountSchema }), ballot: QuickBallotRowSchema }).parse(JSON.parse(readFileSync('tests/fixtures/quick-ballots/archive-snapshot.json', 'utf8')));
  const domain = { chainId: fixture.dao.chainId, runtime: fixture.dao.contract, source: fixture.source.account };
  const chain = new NativeQuickBallots({ ...domain, rpcUrl: 'http://127.0.0.1:18888', authority: 'quickauth', gateway: { actor: 'gateway', permission: 'active' } }, { key: PrivateKey.generate('K1'), resources: async () => {}, confirm: async () => {} });
  const privateBallot = QuickBallotRowSchema.parse({ ...fixture.ballot, id: '999', definition: { ...fixture.ballot.definition, protocol: 2, all_accounts: false, audience: [fixture.dao.daoId], question: JSON.stringify({ documentId: '999', version: 1, commitment: 'ab'.repeat(32), keyEpoch: '1' }), explanation: '' } });
  const list = vi.spyOn(chain, 'list').mockResolvedValue({ available: true, experimental: true, domain, ballots: [fixture.ballot, privateBallot], next: '1000' });
  vi.spyOn(chain, 'detail').mockImplementation(async (id) => ({ ...domain, ballot: id === '999' ? privateBallot : fixture.ballot, grants: null }));
  const pool = new Pool(), app = Fastify();
  registerQuickBallotRoutes(app, new QuickBallots(pool, chain, 41), 'session', async () => { throw Error('No private session required for encrypted definitions'); }, () => {});
  try {
    const legacy = await app.inject({ method: 'GET', url: LegacyQuickBallotRoutes.quickList.path });
    expect(legacy.statusCode).toBe(200);
    expect(LegacyQuickBallotRoutes.quickList.response.parse(legacy.json()).ballots).toEqual([fixture.ballot]);
    const current = await app.inject({ method: 'GET', url: QuickBallotRoutes.quickList.path });
    expect(current.statusCode).toBe(200);
    expect(QuickBallotRoutes.quickList.response.parse(current.json()).ballots).toEqual([fixture.ballot, privateBallot]);
    const oldDetail = await app.inject({ method: 'GET', url: LegacyQuickBallotRoutes.quickDetail.path.replace(':ballotId', '999') });
    expect(oldDetail.statusCode).toBe(409);
    expect(oldDetail.json()).toMatchObject({ code: 'CLIENT_UPDATE_REQUIRED' });
    const newDetail = await app.inject({ method: 'GET', url: QuickBallotRoutes.quickDetail.path.replace(':ballotId', '999') });
    expect(newDetail.statusCode).toBe(200);
    expect(QuickBallotRoutes.quickDetail.response.parse(newDetail.json()).ballot).toEqual(privateBallot);
    list.mockResolvedValue({ available: true, experimental: true, domain, ballots: [privateBallot], next: '1000' });
    const empty = LegacyQuickBallotRoutes.quickList.response.parse((await app.inject({ method: 'GET', url: LegacyQuickBallotRoutes.quickList.path })).json());
    expect(empty.ballots).toEqual([]);
    expect(empty.next).toBe('1000');
  } finally { await app.close(); await pool.end(); vi.restoreAllMocks(); }
});
