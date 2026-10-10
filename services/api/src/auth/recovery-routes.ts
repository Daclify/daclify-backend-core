import type { FastifyInstance } from 'fastify';
import type { Account } from '../../../../protocol/api.js';
import { RecoveryRoutes } from '../../../../protocol/recovery.js';
import { ApiError } from '../errors.js';
import { createWindowLimiter } from '../limits.js';
import type { RecoveryService } from './recovery.js';

export function registerRecoveryRoutes(
  app: FastifyInstance,
  service: RecoveryService,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  frontendOrigin: string,
) {
  const admit = createWindowLimiter(20, 600000, 2000);
  const admitDevice = createWindowLimiter(90, 600000, 9000),
    admitBegin = createWindowLimiter(8, 300000, 800);
  app.get(RecoveryRoutes.deviceRecoveryRequest.path, async (request) => {
    const account = await session(request.cookies[cookieName]);
    const params = RecoveryRoutes.deviceRecoveryPoll.input.pick({ id: true }).parse(request.params);
    return service.deviceRequest(account, params.id, request.headers.origin ?? frontendOrigin);
  });
  for (const route of [
    RecoveryRoutes.deviceRecoveryBegin,
    RecoveryRoutes.deviceRecoveryApprove,
    RecoveryRoutes.deviceRecoveryPoll,
    RecoveryRoutes.deviceRecoveryCancel,
  ] as const) {
    app.post(route.path, async (request) => {
      const token = request.cookies[cookieName],
        account = await session(
          token,
          typeof request.headers['x-csrf-token'] === 'string'
            ? request.headers['x-csrf-token']
            : '',
        );
      if (!token) throw new ApiError('AUTH_REQUIRED', 401);
      const limiter = route === RecoveryRoutes.deviceRecoveryBegin ? admitBegin : admitDevice;
      if (!limiter(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
      const origin = request.headers.origin ?? '';
      if (route === RecoveryRoutes.deviceRecoveryBegin)
        return service.deviceBegin(account, token, request.body, origin);
      if (route === RecoveryRoutes.deviceRecoveryApprove)
        return service.deviceApprove(account, request.body, origin);
      const response = await service.devicePoll(
        account,
        token,
        request.body,
        origin,
        route === RecoveryRoutes.deviceRecoveryCancel,
      );
      return route === RecoveryRoutes.deviceRecoveryCancel ? { cancelled: true } : response;
    });
  }
  app.get(RecoveryRoutes.recoveryMethods.path, async (request) =>
    service.methods(await session(request.cookies[cookieName])),
  );
  for (const route of [RecoveryRoutes.recoveryEnroll, RecoveryRoutes.recoveryDisable] as const) {
    app.post(route.path, async (request) => {
      const account = await session(
        request.cookies[cookieName],
        typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
      );
      if (!admit(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
      const token = request.cookies[cookieName];
      if (!token) throw new ApiError('AUTH_REQUIRED', 401);
      return route === RecoveryRoutes.recoveryEnroll
        ? service.enroll(account, request.body, request.headers.origin ?? '', token)
        : service.disable(account, request.body);
    });
  }
  app.post(RecoveryRoutes.recoveryAssistedOptions.path, async (request) => {
    const input = RecoveryRoutes.recoveryAssistedOptions.input.parse(request.body);
    const token = request.cookies[cookieName];
    const account = await session(
      token,
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    if (!admit(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return service.assistedOptions(account, token, request.headers.origin ?? '', input);
  });
  app.post(RecoveryRoutes.recoveryClaim.path, async (request) => {
    const token = request.cookies[cookieName];
    const account = await session(
      token,
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    if (!admit(account.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return service.claim(token, request.body, request.headers.origin ?? '');
  });
}
