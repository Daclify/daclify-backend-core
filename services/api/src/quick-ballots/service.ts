import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  QuickAccountAnchorSchema,
  QuickAccountContextSchema,
  QuickAccountPreparedSchema,
  QuickAccountRoutes,
  type QuickAccountAnchor,
} from '../../../../protocol/quick-accounts.js';
import { ExitSubmissionSchema } from '../../../../protocol/account-exit.js';
import { quickAccountIdentity, quickAccountRequest } from '../../../../sdk/quick-accounts.js';
import type { NativeQuickBallots } from './chain.js';
import { freezeQuickAccount, quickAccountCandidate } from './accounts.js';
import { withTransaction } from '../auth/account-session.js';
import { ApiError } from '../errors.js';
import { QuickSubmissionRejection } from './rejections.js';

export type QuickGateway = Pick<
  NativeQuickBallots,
  | 'configuration'
  | 'account'
  | 'defaultOwner'
  | 'prepareSubmission'
  | 'submit'
  | 'reconcile'
  | 'list'
  | 'detail'
  | 'responses'
  | 'ownResponse'
  | 'readers'
  | 'advance'
  | 'finalize'
  | 'dueBallots'
  | 'needsAdvance'
  | 'validatePreparation'
  | 'pruneInactiveAccounts'
> &
  Partial<Pick<NativeQuickBallots, 'recoveryIdentity'>>;
const digest = (value: string) => createHash('sha256').update(value).digest();
const savedSchema = z.object({
  prepared: QuickAccountPreparedSchema,
  packet: ExitSubmissionSchema.nullable(),
  cursor: z.int().nonnegative(),
  confirmed: z.boolean(),
});

export class QuickBallots {
  constructor(
    private readonly pool: Pool,
    readonly chain: QuickGateway,
    private readonly evmChainId: 40 | 41,
  ) {}
  async walletChange(
    db: PoolClient,
    accountId: string,
    previous: QuickAccountAnchor | null,
    incoming: QuickAccountAnchor | null,
  ) {
    if (
      (previous?.kind === 'evm' && previous.chainId !== this.evmChainId) ||
      (incoming?.kind === 'evm' && incoming.chainId !== this.evmChainId)
    )
      return;
    const config = await this.chain.configuration(),
      row = (
        await db.query<Record<string, unknown>>(
          'SELECT anchor,identity FROM quick_account_anchors WHERE account_id=$1 AND chain_id=$2 AND runtime=$3',
          [accountId, config.chainId, config.runtime],
        )
      ).rows[0];
    const binding = row
        ? z
            .object({ anchor: QuickAccountAnchorSchema, identity: z.instanceof(Uint8Array) })
            .parse(row)
        : null,
      identity = binding ? Buffer.from(binding.identity).toString('hex') : null;
    if (previous && JSON.stringify(previous) !== JSON.stringify(incoming)) {
      if (await this.chain.defaultOwner(previous))
        throw new ApiError('QUICK_APPROVAL_CHANGE_REQUIRED', 409);
      if (
        binding &&
        JSON.stringify(binding.anchor) === JSON.stringify(previous) &&
        (await this.chain.account(identity ?? ''))?.active
      )
        throw new ApiError('QUICK_APPROVAL_CHANGE_REQUIRED', 409);
    }
    if (incoming) {
      const owner = await this.chain.defaultOwner(incoming),
        original = await this.chain.account(
          quickAccountIdentity(config.chainId, config.runtime, incoming),
        );
      if ((owner && owner !== identity) || (original && original.identity !== identity))
        throw new ApiError('QUICK_ORIGINAL_ACCOUNT_REQUIRED', 409);
    }
  }
  async status(accountId: string) {
    const config = await this.chain.configuration(),
      domain = { chainId: config.chainId, runtime: config.runtime },
      binding = await quickAccountCandidate(
        this.pool,
        accountId,
        domain,
        this.evmChainId,
        this.chain.recoveryIdentity?.bind(this.chain),
      );
    return QuickAccountRoutes.quickAccountStatus.response.parse({
      available: true,
      context: { ...config, ...binding, record: await this.chain.account(binding.identity) },
    });
  }
  private async wallets(db: PoolClient, accountId: string, chainId: string) {
    const native = await db.query<{ native_account: string; permission: string }>(
      'SELECT native_account,permission FROM native_links WHERE account_id=$1 AND chain_id=$2',
      [accountId, chainId],
    );
    const evm = await db.query<{ address: string }>(
      'SELECT address FROM evm_links WHERE account_id=$1 AND chain_id=$2 AND control_verified_at IS NOT NULL',
      [accountId, this.evmChainId],
    );
    return [
      ...native.rows.map((row) =>
        QuickAccountAnchorSchema.parse({
          kind: 'native',
          account: row.native_account,
          permission: row.permission,
        }),
      ),
      ...evm.rows.map((row) =>
        QuickAccountAnchorSchema.parse({
          kind: 'evm',
          chainId: this.evmChainId,
          address: row.address,
        }),
      ),
    ];
  }
  private async guardWallets(db: PoolClient, accountId: string, chainId: string, identity: string) {
    for (const method of await this.wallets(db, accountId, chainId)) {
      const owner = await this.chain.defaultOwner(method);
      const original = await this.chain.account(
        quickAccountIdentity(chainId, (await this.chain.configuration()).runtime, method),
      );
      if ((owner && owner !== identity) || (original && original.identity !== identity))
        throw new ApiError('QUICK_ORIGINAL_ACCOUNT_REQUIRED', 409);
    }
  }
  async prepare(accountId: string, session: string, value: unknown) {
    const input = QuickAccountRoutes.quickAccountPrepare.input.parse(value),
      status = await this.status(accountId);
    if (!status.available) throw new ApiError('QUICK_UNAVAILABLE', 503);
    if (status.context.identity !== input.expectedIdentity)
      throw new ApiError('QUICK_IDENTITY_CHANGED', 409);
    const context = status.context,
      domain = { chainId: context.chainId, runtime: context.runtime };
    if (input.intent.operation === 'default' && input.intent.method) {
      const method: QuickAccountAnchor = input.intent.method;
      await withTransaction(this.pool, async (db) => {
        await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [accountId]);
        const wallets = await this.wallets(db, accountId, context.chainId);
        if (!wallets.some((wallet) => JSON.stringify(wallet) === JSON.stringify(method)))
          throw new ApiError('QUICK_PAIRED_WALLET_REQUIRED', 403);
        await this.guardWallets(db, accountId, context.chainId, context.identity);
      });
    }
    const binding = await freezeQuickAccount(
      this.pool,
      accountId,
      domain,
      this.evmChainId,
      async (candidate, db) => {
        if (candidate.identity !== input.expectedIdentity)
          throw new ApiError('QUICK_IDENTITY_CHANGED', 409);
        await this.guardWallets(db, accountId, context.chainId, candidate.identity);
      },
      this.chain.recoveryIdentity?.bind(this.chain),
    );
    if (binding.identity !== input.expectedIdentity)
      throw new ApiError('QUICK_IDENTITY_CHANGED', 409);
    const current = QuickAccountContextSchema.parse({
        ...context,
        ...binding,
        frozen: true,
        record: await this.chain.account(binding.identity),
      }),
      expires = Math.floor(Date.now() / 1000) + 300;
    let operation;
    try {
      operation = quickAccountRequest(current, input.intent, expires);
    } catch {
      throw new ApiError('QUICK_ACCOUNT_CHANGED', 409);
    }
    const prepared = QuickAccountPreparedSchema.parse({
      id: randomUUID(),
      context: current,
      expiresAt: new Date(expires * 1000).toISOString(),
      ...operation,
    });
    await this.chain.validatePreparation(prepared);
    await withTransaction(this.pool, async (db) => {
      // Serialize the bounded global pending-intent budget across API processes.
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended('quick-preparations',0))");
      await db.query(
        "DELETE FROM quick_account_preparations WHERE ctid IN(SELECT ctid FROM quick_account_preparations WHERE expires_at<now()-interval '3 days' OR (packet IS NULL AND expires_at<now()) ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)",
      );
      const budget = await db.query<{ total: string; owned: string }>(
        'SELECT count(*) AS total,count(*) FILTER(WHERE account_id=$1) AS owned FROM quick_account_preparations WHERE NOT confirmed',
        [accountId],
      );
      if (Number(budget.rows[0]?.total) >= 4000 || Number(budget.rows[0]?.owned) >= 20)
        throw new ApiError('QUICK_PREPARATION_LIMIT', 429);
      await db.query(
        'INSERT INTO quick_account_preparations(id,account_id,session_hash,prepared,expires_at) VALUES($1,$2,$3,$4,$5)',
        [prepared.id, accountId, digest(session), prepared, prepared.expiresAt],
      );
    });
    return prepared;
  }
  async submit(accountId: string, session: string, value: unknown) {
    const input = QuickAccountRoutes.quickAccountSubmit.input.parse(value);
    const saved = await withTransaction(this.pool, async (db) => {
      const rows = await db.query<Record<string, unknown>>(
        'SELECT prepared,packet,cursor,confirmed FROM quick_account_preparations WHERE id=$1 AND account_id=$2 AND session_hash=$3 FOR UPDATE',
        [input.id, accountId, digest(session)],
      );
      if (!rows.rows[0]) throw new ApiError('QUICK_PREPARATION_UNKNOWN', 404);
      const row = savedSchema.parse(rows.rows[0]);
      if (row.packet) return { ...row, fresh: false };
      if (Date.parse(row.prepared.expiresAt) <= Date.now() + 1000)
        throw new ApiError('QUICK_PREPARATION_EXPIRED', 409);
      const packet = ExitSubmissionSchema.parse(
        await this.chain.prepareSubmission(
          row.prepared,
          { proof: input.proof, incoming: input.incoming },
          input.native,
        ),
      );
      await db.query('UPDATE quick_account_preparations SET packet=$2,cursor=$3 WHERE id=$1', [
        input.id,
        packet,
        packet.cursor,
      ]);
      return { ...row, packet, cursor: packet.cursor, fresh: true };
    });
    const packet = ExitSubmissionSchema.parse({ ...saved.packet, cursor: saved.cursor });
    if (saved.confirmed)
      return { transactionId: packet.transactionId, state: 'confirmed' as const };
    let rejection: QuickSubmissionRejection | undefined;
    if (saved.fresh) {
      try {
        await this.chain.submit(saved.prepared, packet);
        await this.pool.query('UPDATE quick_account_preparations SET confirmed=true WHERE id=$1', [
          input.id,
        ]);
        return { transactionId: packet.transactionId, state: 'confirmed' as const };
      } catch (cause) {
        if (cause instanceof QuickSubmissionRejection) rejection = cause;
        /* The exact packet is durable even when the broadcast response is lost. */
      }
    }
    let receipt: Awaited<ReturnType<QuickGateway['reconcile']>>;
    try {
      receipt = await this.chain.reconcile(saved.prepared, packet);
    } catch {
      return { transactionId: packet.transactionId, state: 'pending' as const };
    }
    await this.pool.query(
      'UPDATE quick_account_preparations SET cursor=GREATEST(cursor,$2),confirmed=confirmed OR $3 WHERE id=$1',
      [input.id, receipt.cursor, receipt.state === 'confirmed'],
    );
    if (receipt.state === 'unavailable') throw new ApiError('QUICK_SUBMISSION_EXPIRED', 409);
    if (receipt.state === 'pending' && !saved.fresh && Date.parse(packet.expiresAt) > Date.now()) {
      try {
        await this.chain.submit(saved.prepared, packet);
        await this.pool.query('UPDATE quick_account_preparations SET confirmed=true WHERE id=$1', [
          input.id,
        ]);
        return { transactionId: packet.transactionId, state: 'confirmed' as const };
      } catch (cause) {
        if (cause instanceof QuickSubmissionRejection) rejection = cause;
        /* Replaying identical transaction bytes cannot duplicate a response. */
      }
    }
    if (rejection && receipt.state !== 'confirmed') throw rejection;
    return { transactionId: packet.transactionId, state: receipt.state };
  }
}
