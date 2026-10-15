import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerContactRecoveryRoutes } from '../services/api/src/auth/contact-recovery-routes.js';
import { ContactRecoveryRoutes } from '../protocol/contact-recovery.js';

describe('public contact recovery route limits', () => {
  it('validates target and limits unauthenticated state reads', async () => {
    const state = vi.fn(async () => ({
      target: {
        dao: {
          chainId: 'ab'.repeat(32),
          contract: 'daclifycore',
          daoId: '1',
          interfaceVersion: 1 as const,
        },
        memberId: '1',
      },
      supported: false,
      documentsAllowed: false,
      nextPacketId: '1',
      member: null,
      identity: null,
      policy: null,
      pending: null,
      result: null,
      packets: [],
      next: null,
    }));
    const app = Fastify();
    registerContactRecoveryRoutes(
      app,
      { state, submit: vi.fn(), claim: vi.fn(), grant: vi.fn() },
      () => {},
    );
    const malformed = await app.inject({
      method: 'POST',
      url: ContactRecoveryRoutes.contactRecoveryState.path,
      payload: { target: { memberId: '1' } },
    });
    expect(malformed.statusCode).toBe(400);
    expect(state).not.toHaveBeenCalled();
    const payload = {
      target: {
        dao: { chainId: 'ab'.repeat(32), contract: 'daclifycore', daoId: '1', interfaceVersion: 1 },
        memberId: '1',
      },
    };
    let last = 0;
    for (let i = 0; i < 65; i++)
      last = (
        await app.inject({
          method: 'POST',
          url: ContactRecoveryRoutes.contactRecoveryState.path,
          payload,
        })
      ).statusCode;
    expect(last).toBe(429);
    await app.close();
  });
});
