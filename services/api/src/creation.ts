import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  CreationRequestSchema,
  CreationOrderViewSchema,
  type CreationRequest,
  type CreationOrderView,
} from '../../../protocol/platform.js';
import { DaoPresets } from '../../../protocol/dao.js';
import type { Account } from '../../../protocol/api.js';
import type { NativeChainGateway } from './native-chain.js';
import type { StripeBilling } from './billing/service.js';
import { ApiError } from './errors.js';
import { withTransaction } from './auth/account-session.js';
import { AccountSchema } from '../../../protocol/api.js';
type Chain = Pick<
  NativeChainGateway,
  | 'validateCreation'
  | 'platform'
  | 'creationOrder'
  | 'orderCreation'
  | 'attestCreation'
  | 'createDao'
>;
const RowSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  reference: z.string().regex(/^[0-9a-f]{64}$/),
  dao_id: z.string(),
  chain_id: z.string(),
  runtime: z.string(),
  request: CreationRequestSchema,
  checkout_id: z.string().nullable(),
  checkout_url: z.url().nullable(),
});
type Row = z.infer<typeof RowSchema>;
export class CreationService {
  constructor(
    private readonly pool: Pool,
    readonly chain: Chain,
  ) {}
  // Persist the immutable request before publishing its order. A lost chain response can be reconciled.
  async prepare(account: Account, input: CreationRequest): Promise<CreationOrderView> {
    if (account.signingKey === null) throw new ApiError('VAULT_IDENTITY_REQUIRED', 409);
    input = CreationRequestSchema.parse(input);
    if (input.deployment !== 'shared') throw new ApiError('INDEPENDENT_UNAVAILABLE', 409);
    const status = await this.chain.platform();
    if (input.request.token.chainId !== status.network.chainId)
      throw new ApiError('ASSET_CHAIN_MISMATCH');
    if (
      input.request.privacy === 'encrypted-user-controlled' &&
      account.custody === 'managed' &&
      !input.request.foundingAgent
    )
      throw new ApiError('CUSTODY_POLICY', 403);
    const reference = createHash('sha256')
      .update(
        `${status.network.chainId}:${status.network.runtime}:${account.id}:${input.requestId}`,
      )
      .digest('hex');
    const daoId = BigInt('0x' + randomBytes(8).toString('hex')).toString();
    if (daoId === '0') throw new ApiError('DAO_ID_RETRY', 503);
    await withTransaction(this.pool, async (client) => {
      await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [account.id]);
      if (input.request.privacy === 'encrypted-user-controlled' && !input.request.foundingAgent) {
        const state = await client.query(
          'SELECT 1 FROM vault_recovery_state WHERE account_id=$1 AND assisted_ever',
          [account.id],
        );
        if (state.rowCount) throw new ApiError('CUSTODY_POLICY', 403);
      }
      await client.query(
        'INSERT INTO creation_orders(id,account_id,reference,dao_id,chain_id,runtime,request) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
        [
          input.requestId,
          account.id,
          reference,
          daoId,
          status.network.chainId,
          status.network.runtime,
          input,
        ],
      );
    });
    return this.lock(account.id, input.requestId, async (row) => {
      if (!isDeepStrictEqual(row.request, input))
        throw new ApiError('CREATION_ORDER_CONFLICT', 409);
      if (
        row.chain_id !== status.network.chainId ||
        row.runtime !== status.network.runtime ||
        !status.chainMatches
      )
        throw new ApiError('DAO_REFERENCE', 409);
      if (!(await this.chain.creationOrder(row.reference))) {
        if (input.method === 'free' && (!status.hosting || status.creation?.shared_usd !== 0))
          throw new ApiError('HOSTING_UNAVAILABLE', 503);
        if (input.method !== 'free' && status.creation?.shared_usd === 0)
          throw new ApiError('CREATION_FREE_PATH', 409);
        await this.chain.validateCreation(input.request);
        if (!status.sharedAvailable) throw new ApiError('DAO_CREATION_UNAVAILABLE', 503);
        if (input.request.setup) {
          const preset = DaoPresets.find(
            (p) =>
              p.id === input.request.setup?.presetId &&
              p.version === input.request.setup.presetVersion,
          );
          if (
            !preset ||
            !preset.modules.every((id) =>
              status.contracts.some(
                (c) =>
                  c.moduleId === id &&
                  c.verified &&
                  status.catalogue.some(
                    (listed) =>
                      listed.account === c.account &&
                      listed.code_hash === c.codeHash &&
                      listed.complies === 1,
                  ),
              ),
            )
          )
            throw new ApiError('PRESET_MODULE_UNAVAILABLE', 503);
        }
        if (input.method === 'tlos' && !status.rateFresh)
          throw new ApiError('CREATION_RATE_UNAVAILABLE', 409);
        await this.chain.orderCreation(row.reference, account.signingKey, input.method);
      }
      return this.view(row);
    });
  }
  async status(accountId: string, id: string) {
    return this.lock(accountId, id, (row) => this.view(row));
  }
  async checkout(accountId: string, id: string, billing: StripeBilling) {
    return this.lock(accountId, id, async (row, client) => {
      const view = await this.view(row);
      if (
        row.request.method !== 'card' ||
        view.state !== 'awaiting-payment' ||
        view.expires < Date.now() / 1000
      )
        throw new ApiError('CREATION_CHECKOUT_UNAVAILABLE', 409);
      if (row.checkout_url) return { url: row.checkout_url };
      if (view.expires < Math.floor(Date.now() / 1000) + 1805)
        throw new ApiError('CREATION_CHECKOUT_UNAVAILABLE', 409);
      const checkout = await billing.startCreationCheckout({
        orderId: row.id,
        accountId,
        usdCents: view.usdCents,
        expires: view.expires,
      });
      await client.query('UPDATE creation_orders SET checkout_id=$2,checkout_url=$3 WHERE id=$1', [
        id,
        checkout.id,
        checkout.url,
      ]);
      return { url: checkout.url };
    });
  }
  async recordCard(input: {
    orderId: string;
    accountId: string;
    checkoutId: string;
    usdCents: number;
    paidAt: number;
  }) {
    await this.lock(input.accountId, input.orderId, async (row) => {
      const view = await this.view(row);
      if (
        row.checkout_id !== input.checkoutId ||
        row.request.method !== 'card' ||
        input.usdCents !== view.usdCents
      )
        throw new ApiError('CREATION_CARD_MISMATCH', 409);
      await this.chain.attestCreation(
        row.reference,
        createHash('sha256').update(input.checkoutId).digest('hex'),
        input.usdCents,
        input.paidAt,
      );
    });
  }
  async fulfill(account: Account, id: string): Promise<CreationOrderView> {
    return this.lock(account.id, id, async (row) => {
      await this.view(row);
      const order = await this.chain.creationOrder(row.reference);
      if (!order?.paid) throw new ApiError('CREATION_PAYMENT_REQUIRED', 409);
      if (order.creator !== account.signingKey) throw new ApiError('CREATION_OWNER', 403);
      if (!order.used)
        await this.chain.createDao(
          AccountSchema.parse({ id: account.id, ...(await this.creator(account.id)) }),
          row.request.request,
          {
            reference: row.reference,
            daoId: row.dao_id,
          },
        );
      return this.view(row);
    });
  }
  private async view(row: Row): Promise<CreationOrderView> {
    const status = await this.chain.platform();
    if (
      !status.chainMatches ||
      status.network.chainId !== row.chain_id ||
      status.network.runtime !== row.runtime
    )
      throw new ApiError('DAO_REFERENCE', 409);
    const order = await this.chain.creationOrder(row.reference);
    if (!order) throw new ApiError('CREATION_ORDER_PENDING', 503);
    return CreationOrderViewSchema.parse({
      network: status.network,
      setup: row.request.request,
      creator: row.request.request.foundingAgent
        ? {
            signingKey: row.request.request.foundingAgent.signingKey,
            encryptionKey: row.request.request.foundingAgent.encryptionKey,
            custody: 'user-controlled',
          }
        : await this.creator(row.account_id),
      requestId: row.id,
      deployment: row.request.deployment,
      method: row.request.method,
      usdCents: order.usd_cents,
      tlosAmount: order.method === 0 ? order.tlos_due : null,
      recipient: row.runtime,
      tokenContract: status.fees?.token_contract ?? '',
      memo: 'create:' + row.reference,
      expires: order.expires,
      state: order.used
        ? 'created'
        : order.paid
          ? 'paid'
          : order.expires < Math.floor(Date.now() / 1000)
            ? 'expired'
            : 'awaiting-payment',
      dao: order.used
        ? { chainId: row.chain_id, contract: row.runtime, daoId: order.dao_id, interfaceVersion: 1 }
        : null,
      checkoutUrl: row.checkout_url,
    });
  }
  private async creator(accountId: string) {
    const result = await this.pool.query<{
      signing_key: string;
      encryption_key: unknown;
      custody: string;
    }>(
      `SELECT a.signing_key,a.encryption_key,CASE WHEN r.assisted_ever THEN 'managed' ELSE a.custody END AS custody
      FROM accounts a LEFT JOIN vault_recovery_state r ON r.account_id=a.id WHERE a.id=$1`,
      [accountId],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError('CREATION_OWNER', 403);
    return { signingKey: row.signing_key, encryptionKey: row.encryption_key, custody: row.custody };
  }
  private async lock<T>(
    accountId: string,
    id: string,
    work: (row: Row, client: PoolClient) => Promise<T>,
  ): Promise<T> {
    z.uuid().parse(id);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT *,dao_id::text FROM creation_orders WHERE id=$1 AND account_id=$2 FOR UPDATE',
        [id, accountId],
      );
      if (!result.rows[0]) throw new ApiError('CREATION_ORDER_UNKNOWN', 404);
      const value = await work(RowSchema.parse(result.rows[0]), client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
