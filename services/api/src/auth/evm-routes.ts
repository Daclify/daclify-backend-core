import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { beginEvmLink, finishEvmLink, listEvmLinks, unlinkEvm } from './evm-link.js';

const ChainSchema = z.strictObject({ chainId: z.union([z.literal(40), z.literal(41)]) });
const LinkSchema = ChainSchema.extend({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

export function registerEvmRoutes(
  app: FastifyInstance,
  pool: Pool,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
): void {
  function csrf(header: string | string[] | undefined): string {
    return typeof header === 'string' ? header : '';
  }
  function account(request: FastifyRequest) {
    return session(request.cookies[cookieName], csrf(request.headers['x-csrf-token']));
  }
  app.get('/v1/account/evm', async (request) => ({
    links: await listEvmLinks(pool, (await session(request.cookies[cookieName])).id),
  }));
  app.post('/v1/account/evm/challenge', async (request) => {
    const current = await account(request);
    const input = ChainSchema.parse(request.body);
    return beginEvmLink(pool, current.id, input.chainId);
  });
  app.post('/v1/account/evm/link', async (request) => {
    const current = await account(request);
    const input = LinkSchema.parse(request.body);
    return finishEvmLink(pool, current.id, input.chainId, input.address, input.signature);
  });
  app.post('/v1/account/evm/unlink', async (request, reply) => {
    const current = await account(request);
    const input = ChainSchema.parse(request.body);
    await unlinkEvm(pool, current.id, input.chainId);
    return reply.code(204).send();
  });
}
