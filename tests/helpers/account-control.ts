import { createHash } from 'node:crypto';
import type { FastifyInstance, InjectOptions } from 'fastify';
import type { PrivateKey } from '@wharfkit/antelope';
import { z } from 'zod';
import { AccountControlChallengeSchema } from '../../protocol/sign-in.js';

export async function controlledInject(
  app: FastifyInstance,
  key: PrivateKey,
  options: InjectOptions,
) {
  const headers = z
    .object({ origin: z.string(), cookie: z.string(), 'x-csrf-token': z.string() })
    .parse(options.headers);
  const body =
    typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
  if (!body || !options.url) throw new Error('Controlled request requires a body and path');
  const response = await app.inject({
    method: 'POST',
    url: '/v1/account/control',
    headers,
    payload: { path: options.url, bodyHash: createHash('sha256').update(body).digest('hex') },
  });
  const challenge = AccountControlChallengeSchema.parse(response.json());
  return app.inject({
    ...options,
    payload: body,
    headers: {
      ...headers,
      'content-type': 'application/json',
      'x-account-intent-id': challenge.id,
      'x-account-signature': key
        .signMessage(new TextEncoder().encode(challenge.message))
        .toString(),
    },
  });
}
