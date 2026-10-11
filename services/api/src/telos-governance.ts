import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TelosGovernanceClient, type TelosGovernanceRpc } from '@daclify/modules/sdk';
import { TelosGovernanceRoutes, TelosGovernanceSourceSchema } from '@daclify/modules';
import { NativeAccountSchema } from '../../../protocol/base.js';
import type { Network } from '../../../protocol/api.js';
import { createWindowLimiter } from './limits.js';
export const TelosPinsSchema = z
  .strictObject({
    codeHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    abiHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
  })
  .refine((value) => !!value.codeHash === !!value.abiHash);
export type TelosPins = z.infer<typeof TelosPinsSchema>;
export function readTelosPins(env: NodeJS.ProcessEnv): TelosPins {
  const parsed = TelosPinsSchema.safeParse({
    codeHash: env.TELOS_DECIDE_CODE_HASH ?? null,
    abiHash: env.TELOS_DECIDE_ABI_HASH ?? null,
  });
  if (!parsed.success) throw new Error('TELOS_CONFIGURATION_INVALID');
  return parsed.data;
}
export function createTelosGovernanceClient(
  network: Network,
  pins: TelosPins,
): TelosGovernanceClient {
  const source = TelosGovernanceSourceSchema.parse({
    chainId: network.chainId,
    rpcUrl: network.rpcUrl,
    environment: network.environment,
    contract: 'telos.decide',
    ...TelosPinsSchema.parse(pins),
  });
  const rpc: TelosGovernanceRpc = async (path, body) => {
    const response = await fetch(new URL('v1/chain/' + path, source.rpcUrl.replace(/\/?$/, '/')), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error('TELOS_UNAVAILABLE');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0,
      text = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 262144) throw new Error('TELOS_RESPONSE_INVALID');
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      const value: unknown = JSON.parse(text);
      return value;
    } catch (cause) {
      await reader.cancel().catch(() => undefined);
      throw cause;
    } finally {
      reader.releaseLock();
    }
  };
  return new TelosGovernanceClient(source, rpc);
}
export function registerTelosGovernanceRoutes(
  app: FastifyInstance,
  client: TelosGovernanceClient | (() => Promise<TelosGovernanceClient>),
): void {
  const limit = createWindowLimiter(60, 60000, 3000);
  const errors = new Set([
    'TELOS_CHAIN_MISMATCH',
    'TELOS_CURSOR_INVALID',
    'TELOS_BALLOT_UNKNOWN',
    'TELOS_BALLOT_UNSUPPORTED',
    'TELOS_BALLOT_CLOSED',
    'TELOS_OPTIONS_INVALID',
    'TELOS_ALREADY_VOTED',
    'TELOS_NO_WEIGHT',
    'TELOS_VOTE_UNAVAILABLE',
  ]);
  async function run(
    ip: string,
    reply: import('fastify').FastifyReply,
    work: (reader: TelosGovernanceClient) => Promise<unknown>,
  ) {
    if (!limit(ip, Date.now()))
      return reply.code(429).send({ code: 'RATE_LIMIT', message: 'Too many requests.' });
    try {
      return await work(typeof client === 'function' ? await client() : client);
    } catch (cause) {
      const code =
        cause instanceof Error && errors.has(cause.message) ? cause.message : 'TELOS_UNAVAILABLE';
      return reply
        .code(code === 'TELOS_UNAVAILABLE' || code === 'TELOS_CHAIN_MISMATCH' ? 503 : 409)
        .send({ code, message: 'The Telos governance request could not be completed.' });
    }
  }
  app.get(TelosGovernanceRoutes.ballots.path, async (request, reply) => {
    const query = TelosGovernanceRoutes.ballots.query.safeParse(request.query);
    if (!query.success)
      return reply
        .code(400)
        .send({ code: 'INPUT_INVALID', message: 'Invalid Telos governance request.' });
    return run(request.ip, reply, (reader) => reader.ballots(query.data.cursor, query.data.kind));
  });
  app.get(TelosGovernanceRoutes.producers.path, async (request, reply) => {
    const query = TelosGovernanceRoutes.producers.query.safeParse(request.query);
    if (!query.success)
      return reply
        .code(400)
        .send({ code: 'INPUT_INVALID', message: 'Invalid Telos governance request.' });
    return run(request.ip, reply, (reader) => reader.producers(query.data.cursor));
  });
  const paramsSchema = z.strictObject({ ballot: TelosGovernanceRoutes.prepare.input.shape.ballot });
  app.get(TelosGovernanceRoutes.ballot.path, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success)
      return reply
        .code(400)
        .send({ code: 'INPUT_INVALID', message: 'Invalid Telos governance request.' });
    return run(request.ip, reply, (reader) => reader.ballot(params.data.ballot));
  });
  app.get(TelosGovernanceRoutes.voter.path, async (request, reply) => {
    const params = paramsSchema.extend({ voter: NativeAccountSchema }).safeParse(request.params);
    if (!params.success)
      return reply
        .code(400)
        .send({ code: 'INPUT_INVALID', message: 'Invalid Telos governance request.' });
    return run(request.ip, reply, async (reader) =>
      reader.voter(params.data.voter, (await reader.ballot(params.data.ballot)).ballot),
    );
  });
  app.post(TelosGovernanceRoutes.prepare.path, async (request, reply) => {
    const input = TelosGovernanceRoutes.prepare.input.safeParse(request.body);
    if (!input.success)
      return reply
        .code(400)
        .send({ code: 'INPUT_INVALID', message: 'Invalid Telos governance request.' });
    return run(request.ip, reply, (reader) => reader.prepareVote(input.data));
  });
}
