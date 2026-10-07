import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Account } from '../../../../protocol/api.js';
import { PaymentRoutes, BrokerRoutes } from '../../../../protocol/payments.js';
import { ApiError } from '../errors.js';
import type { ConnectedPayments } from './service.js';
import type { OperatorPayments } from './operator.js';
export const CONNECT_WEBHOOK = '/v1/payments/stripe/webhook';
export const BROKER_PATHS = [
  BrokerRoutes.brokerCheckout.path,
  BrokerRoutes.brokerOrder.path,
  BrokerRoutes.brokerStatus.path,
] as const;
export function registerPaymentRoutes(
  app: FastifyInstance,
  payments: ConnectedPayments | undefined,
  cookieName: string,
  session: (token: string | undefined, csrf?: string) => Promise<Account>,
  rawBody: (request: object) => Buffer | undefined,
  admit: (key: string, time: number) => boolean,
  operator?: OperatorPayments,
) {
  const service = () => {
    if (!payments) throw new ApiError('PAYMENTS_UNCONFIGURED', 503);
    return payments;
  };
  const browser = () => operator ?? service();
  app.get(PaymentRoutes.paymentStatus.path, async (request) =>
    browser().status(
      await session(request.cookies[cookieName]),
      PaymentRoutes.paymentStatus.query.parse(request.query).dao,
    ),
  );
  app.get(PaymentRoutes.paymentCatalogue.path, async (request) =>
    browser().catalogue(PaymentRoutes.paymentCatalogue.query.parse(request.query).dao),
  );
  const account = (request: FastifyRequest) =>
    session(
      request.cookies[cookieName],
      typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : '',
    );
  app.post(PaymentRoutes.paymentOnboard.path, async (request) => {
    const user = await account(request),
      input = PaymentRoutes.paymentOnboard.input.parse(request.body),
      token = request.cookies[cookieName];
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    if (!admit(user.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return browser().onboard(user, input.dao, input.mode, token);
  });
  app.post(PaymentRoutes.paymentProduct.path, async (request) =>
    browser().product(
      await account(request),
      PaymentRoutes.paymentProduct.input.parse(request.body),
    ),
  );
  app.post(PaymentRoutes.paymentCheckout.path, async (request) => {
    const user = await account(request),
      input = PaymentRoutes.paymentCheckout.input.parse(request.body);
    if (!admit(user.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return browser().checkout(
      input.dao,
      input.productId,
      input.requestId,
      'account:' + user.id,
      user.id,
    );
  });
  app.get<{ Params: { id: string } }>(PaymentRoutes.paymentOrder.path, async (request) =>
    browser().readOrder(await session(request.cookies[cookieName]), request.params.id),
  );
  app.post(PaymentRoutes.paymentRefund.path, async (request) => {
    const user = await account(request),
      input = PaymentRoutes.paymentRefund.input.parse(request.body);
    if (!admit(user.id, Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return browser().refund(user, input.dao, input.orderId, input.requestId, input.amountMinor);
  });
  app.post(PaymentRoutes.paymentCredential.path, async (request) =>
    browser().credential(
      await account(request),
      PaymentRoutes.paymentCredential.input.parse(request.body).dao,
    ),
  );
  app.post(PaymentRoutes.paymentRevoke.path, async (request) =>
    browser().credential(
      await account(request),
      PaymentRoutes.paymentRevoke.input.parse(request.body).dao,
      true,
    ),
  );
  app.get('/v1/payments/stripe/callback', async (request, reply) => {
    const query = z
      .strictObject({
        state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        code: z.string().min(1).max(512).optional(),
        error: z.string().min(1).max(100).optional(),
        error_description: z.string().max(2000).optional(),
        scope: z.string().max(100).optional(),
      })
      .refine((value) => !!value.code !== !!value.error)
      .parse(request.query);
    const token = request.cookies[cookieName];
    if (!token) throw new ApiError('AUTH_REQUIRED', 401);
    return reply.redirect(
      await service().callback(await session(token), token, query.state, query.code),
    );
  });
  app.post(CONNECT_WEBHOOK, { bodyLimit: 1024 * 1024 }, async (request) => {
    const signature = request.headers['stripe-signature'],
      raw = rawBody(request);
    if (typeof signature !== 'string' || !raw) throw new ApiError('SIGNATURE_INVALID', 400);
    try {
      await service().webhook(raw, signature);
    } catch (error) {
      if (error instanceof Error && error.message === 'SIGNATURE_INVALID')
        throw new ApiError('SIGNATURE_INVALID', 400);
      throw error;
    }
    return { received: true };
  });
  async function broker(
    request: { headers: { authorization?: string | undefined } },
    dao: Parameters<ConnectedPayments['broker']>[1],
  ) {
    const token = request.headers.authorization?.match(/^Bearer (dcp_[A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) throw new ApiError('PAYMENT_BROKER_INVALID', 401);
    if (!admit('broker:' + token.slice(-12), Date.now())) throw new ApiError('RATE_LIMIT', 429);
    return service().broker(token, dao);
  }
  app.post(BROKER_PATHS[0], async (request) => {
    const input = BrokerRoutes.brokerCheckout.input.parse(request.body);
    await broker(request, input.dao);
    return service().checkout(
      input.dao,
      input.productId,
      input.requestId,
      'operator:' + input.customerReference,
      null,
    );
  });
  app.post(BROKER_PATHS[1], async (request) => {
    const input = BrokerRoutes.brokerOrder.input.parse(request.body);
    await broker(request, input.dao);
    return service().brokerOrder(input.dao, input.orderId);
  });
  app.post(BROKER_PATHS[2], async (request) => {
    const input = BrokerRoutes.brokerStatus.input.parse(request.body);
    const account = await broker(request, input.dao);
    return service().status(account, input.dao);
  });
}
