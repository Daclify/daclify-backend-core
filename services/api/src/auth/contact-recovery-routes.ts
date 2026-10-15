import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { ChainGateway } from '../chain.js';
import { ContactRecoveryRoutes } from '../../../../protocol/contact-recovery.js';
import { createWindowLimiter } from '../limits.js';
import { ApiError } from '../errors.js';
import { claimContactRecovery } from './contact-recovery.js';

export function contactRecoveryService(
  pool: Pool,
  chain: ChainGateway,
  origin: string,
  audience: string,
) {
  return {
    grant: (input: unknown) => {
      if (!chain.contactRecoveryGrant) throw new ApiError('CONTACT_RECOVERY_UNAVAILABLE', 503);
      return chain.contactRecoveryGrant(
        ContactRecoveryRoutes.contactRecoveryGrant.input.parse(input),
      );
    },
    state: (input: unknown) => {
      const { target, after } = ContactRecoveryRoutes.contactRecoveryState.input.parse(input);
      if (!chain.contactRecovery) throw new ApiError('CONTACT_RECOVERY_UNAVAILABLE', 503);
      return chain.contactRecovery(target, after);
    },
    submit: (input: unknown) => {
      if (!chain.submitContactRecovery) throw new ApiError('CONTACT_RECOVERY_UNAVAILABLE', 503);
      return chain.submitContactRecovery(
        ContactRecoveryRoutes.contactRecoverySubmit.input.parse(input),
      );
    },
    claim: (input: unknown) => claimContactRecovery(pool, chain, input, origin, audience),
  };
}
export function registerContactRecoveryRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof contactRecoveryService>,
  sessionCookie: (reply: FastifyReply, token: string) => void | Promise<void>,
) {
  const read = createWindowLimiter(60, 600000, 600),
    grantRead = createWindowLimiter(600, 600000, 6000),
    write = createWindowLimiter(20, 600000, 200),
    claim = createWindowLimiter(8, 300000, 80);
  for (const route of Object.values(ContactRecoveryRoutes))
    app.post(route.path, async (request, reply) => {
      const parsed = route.input.safeParse(request.body);
      if (!parsed.success) throw new ApiError('INPUT_INVALID', 400);
      const limit =
        route === ContactRecoveryRoutes.contactRecoveryGrant
          ? grantRead
          : route === ContactRecoveryRoutes.contactRecoveryState
            ? read
            : route === ContactRecoveryRoutes.contactRecoveryClaim
              ? claim
              : write;
      if (!limit(request.ip, Date.now())) throw new ApiError('RATE_LIMIT', 429);
      if (route === ContactRecoveryRoutes.contactRecoveryState) return service.state(parsed.data);
      if (route === ContactRecoveryRoutes.contactRecoveryGrant) return service.grant(parsed.data);
      if (route === ContactRecoveryRoutes.contactRecoverySubmit) return service.submit(parsed.data);
      const result = await service.claim(parsed.data);
      await sessionCookie(reply, result.token);
      return { account: result.account, csrfToken: result.csrfToken };
    });
}
