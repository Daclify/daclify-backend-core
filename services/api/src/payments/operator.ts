import type { Pool } from 'pg';
import { z } from 'zod';
import { ConnectedPaymentClient } from '@daclify/modules/sdk';
import {
  BrokerCredentialSchema,
  PublicApiOriginSchema,
  daoPaymentKey,
  PaymentOrderSchema,
  PaymentStatusSchema,
} from '../../../../protocol/payments.js';
import { DaoRefSchema, type DaoRef } from '../../../../protocol/base.js';
import type { Account } from '../../../../protocol/api.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import type { ConnectedPayments } from './service.js';
export function readOperatorPayments(value: string | undefined) {
  if (!value) return undefined;
  const schema = z
    .strictObject({
      apiOrigin: PublicApiOriginSchema,
      frontendOrigin: PublicApiOriginSchema,
      daos: z
        .array(z.strictObject({ dao: DaoRefSchema, token: BrokerCredentialSchema.shape.token }))
        .min(1)
        .max(100),
    })
    .refine(
      (config) => new Set(config.daos.map((d) => daoPaymentKey(d.dao))).size === config.daos.length,
    );
  try {
    if (value.length > 65536) throw new Error();
    return schema.parse(JSON.parse(value));
  } catch {
    throw new Error('PAYMENT_OPERATOR_CONFIGURATION_INVALID');
  }
}
type Config = NonNullable<ReturnType<typeof readOperatorPayments>>;
export class OperatorPayments {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly config: Config,
  ) {}
  private client(dao: DaoRef) {
    const entry = this.config.daos.find((e) => daoPaymentKey(e.dao) === daoPaymentKey(dao));
    if (!entry) throw new ApiError('PAYMENT_DAO', 403);
    return new ConnectedPaymentClient(this.config.apiOrigin, entry.token, dao);
  }
  private async admin(account: Account, dao: DaoRef) {
    if (
      !(await this.chain.memberships(account)).some(
        (m) => daoPaymentKey(m.dao) === daoPaymentKey(dao) && m.active && m.admin,
      )
    )
      throw new ApiError('PAYMENT_ADMIN_REQUIRED', 403);
  }
  async status(account: Account, dao: DaoRef) {
    await this.admin(account, dao);
    const status = await this.client(dao).status();
    const url = new URL('/payments', this.config.frontendOrigin);
    url.searchParams.set('dao', JSON.stringify(dao));
    return PaymentStatusSchema.parse({ ...status, merchantSetupUrl: url.toString() });
  }
  catalogue(dao: DaoRef) {
    return this.client(dao).catalogue();
  }
  async checkout(
    dao: DaoRef,
    productId: string,
    requestId: string,
    customerReference: string,
    customerAccount: string | null,
  ) {
    if (!customerAccount || customerReference !== 'account:' + customerAccount)
      throw new ApiError('AUTH_REQUIRED', 401);
    const network = await this.chain.network();
    if (dao.chainId !== network.chainId || dao.contract !== network.runtime)
      throw new ApiError('PAYMENT_DAO', 403);
    const client = this.client(dao),
      key = daoPaymentKey(dao);
    await this.pool.query(
      'INSERT INTO operator_payment_requests(request_id,dao_key,product_id,account_id)VALUES($1,$2,$3,$4)ON CONFLICT(request_id)DO NOTHING',
      [requestId, key, productId, customerAccount],
    );
    const record = await this.pool.query<{
      dao_key: string;
      product_id: string;
      account_id: string;
    }>('SELECT * FROM operator_payment_requests WHERE request_id=$1', [requestId]);
    const saved = record.rows[0];
    if (
      !saved ||
      saved.dao_key !== key ||
      saved.product_id !== productId ||
      saved.account_id !== customerAccount
    )
      throw new ApiError('PAYMENT_REQUEST_CONFLICT', 409);
    const result = await client.checkout(productId, requestId, customerAccount);
    if (result.productId !== productId) throw new ApiError('PAYMENT_RECEIPT_INVALID', 502);
    const savedOrder = await this.pool.query(
      'UPDATE operator_payment_requests SET central_order_id=$2 WHERE request_id=$1 AND (central_order_id IS NULL OR central_order_id=$2)',
      [requestId, result.id],
    );
    if (savedOrder.rowCount !== 1) throw new ApiError('PAYMENT_RECEIPT_INVALID', 502);
    return result;
  }
  async readOrder(account: Account, id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM operator_payment_requests WHERE central_order_id=$1',
      [z.uuid().parse(id)],
    );
    const record = z
      .object({ dao_key: z.string(), account_id: z.uuid(), product_id: z.uuid() })
      .safeParse(result.rows[0]);
    if (!record.success) throw new ApiError('PAYMENT_ORDER_UNKNOWN', 404);
    const entry = this.config.daos.find((e) => daoPaymentKey(e.dao) === record.data.dao_key);
    if (!entry) throw new ApiError('PAYMENT_DAO', 403);
    if (account.id !== record.data.account_id) await this.admin(account, entry.dao);
    const order = PaymentOrderSchema.parse(await this.client(entry.dao).order(id));
    if (order.productId !== record.data.product_id)
      throw new ApiError('PAYMENT_RECEIPT_INVALID', 502);
    return order;
  }
  onboard: ConnectedPayments['onboard'] = async () => {
    throw new ApiError('PAYMENT_PLATFORM_SETUP_REQUIRED', 409);
  };
  product: ConnectedPayments['product'] = async () => {
    throw new ApiError('PAYMENT_PLATFORM_SETUP_REQUIRED', 409);
  };
  credential: ConnectedPayments['credential'] = async () => {
    throw new ApiError('PAYMENT_PLATFORM_SETUP_REQUIRED', 409);
  };
  refund: ConnectedPayments['refund'] = async () => {
    throw new ApiError('PAYMENT_PLATFORM_SETUP_REQUIRED', 409);
  };
}
