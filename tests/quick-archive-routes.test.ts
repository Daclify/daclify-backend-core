import Fastify from 'fastify';
import { expect, it } from 'vitest';
import { registerQuickBallotRoutes } from '../services/api/src/quick-ballots/routes.js';
it('serves only bounded public encrypted archive history without requiring current membership', async () => {
  const app = Fastify();
  let calls = 0;
  registerQuickBallotRoutes(
    app,
    undefined,
    'session',
    async () => {
      throw Error('PRIVATE_SESSION_NOT_REQUIRED');
    },
    () => {},
    {
      history: async (id) => {
        expect(id).toBe('121');
        calls++;
        return { archives: [], complete: false };
      },
    },
  );
  try {
    const result = await app.inject({ method: 'GET', url: '/v1/quick-ballots/121/archive' });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ archives: [], complete: false });
    for (let n = 0; n < 6; n++)
      await app.inject({ method: 'GET', url: '/v1/quick-ballots/121/archive' });
    expect(calls).toBe(6);
  } finally {
    await app.close();
  }
});
