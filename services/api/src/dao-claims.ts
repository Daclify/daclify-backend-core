import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { Account } from '../../../protocol/api.js';
import {
  DaoClaimIssueSchema,
  DaoClaimSetupSchema,
  DaoClaimTokenSchema,
  DaoClaimViewSchema,
} from '../../../protocol/dao-claims.js';
import { CreationMethodSchema } from '../../../protocol/platform.js';
import type { NativeChainGateway } from './native-chain.js';
import { CreationService } from './creation.js';
import { daoClaimReference } from './dao-claim-reference.js';
import { ApiError } from './errors.js';
import { readAccount, withTransaction } from './auth/account-session.js';

const RowSchema = z.object({
  id: z.uuid(),
  issuer_account_id: z.uuid(),
  claimant_account_id: z.uuid().nullable(),
  request: DaoClaimSetupSchema.nullable(),
  chain_id: z.string(),
  runtime: z.string(),
  expires_at: z.date(),
  revoked_at: z.date().nullable(),
  method: CreationMethodSchema.nullable(),
  completed_at: z.date().nullable(),
});
type Row = z.infer<typeof RowSchema>;
type Chain = Pick<NativeChainGateway, 'platform' | 'governance' | 'memberships' | 'creationOrder'>;
const hash = (token: string) =>
  createHash('sha256').update(DaoClaimTokenSchema.parse(token)).digest('hex');
function view(row: Row) {
  return DaoClaimViewSchema.parse({
    id: row.id,
    request: row.request,
    chainId: row.chain_id,
    runtime: row.runtime,
    method: row.method,
    expiresAt: row.expires_at.toISOString(),
    state: row.completed_at
      ? 'created'
      : row.claimant_account_id
        ? 'claiming'
        : row.revoked_at
          ? 'revoked'
          : row.expires_at.getTime() <= Date.now()
            ? 'expired'
            : 'ready',
  });
}
export class DaoClaimLinks {
  constructor(
    private readonly pool: Pool,
    private readonly chain: Chain,
    private readonly creation: CreationService,
  ) {}
  async eligibility(account: Account, db?: Pick<PoolClient, 'query'>) {
    const platform = await this.chain.platform();
    const dao = platform.platformDao;
    if (
      !dao ||
      !platform.chainMatches ||
      dao.chainId !== platform.network.chainId ||
      dao.contract !== platform.network.runtime
    )
      return { eligible: false, governingDao: dao };
    const state = await this.chain.governance(dao.daoId);
    const memberships = await this.chain.memberships(account, db);
    const now = Math.floor(
      Date.parse(platform.headTime.endsWith('Z') ? platform.headTime : platform.headTime + 'Z') /
        1000,
    );
    if (!Number.isFinite(now)) throw new ApiError('CHAIN_UNAVAILABLE', 503);
    const eligible = memberships.some(
      (m) =>
        m.active &&
        !state.actors.some((actor) => actor.id === m.memberId && actor.revoked) &&
        m.dao.chainId === dao.chainId &&
        m.dao.contract === dao.contract &&
        m.dao.daoId === dao.daoId &&
        state.executiveMembers.some((member) => member.id === m.memberId && member.active) &&
        state.executives.some(
          (office) =>
            office.member_id === m.memberId &&
            office.last_active <= now &&
            state.executivePolicy !== null &&
            (state.executivePolicy.inactivity_seconds === 0 ||
              now - office.last_active < state.executivePolicy.inactivity_seconds),
        ),
    );
    return { eligible, governingDao: dao };
  }
  async issue(account: Account, input: z.infer<typeof DaoClaimIssueSchema>) {
    input = DaoClaimIssueSchema.parse(input);
    const token = randomBytes(32).toString('base64url');
    return withTransaction(this.pool, async (db) => {
      const current = await this.account(db, account.id);
      if (!(await this.eligibility(current, db)).eligible)
        throw new ApiError('DAO_CLAIM_EXECUTIVE_REQUIRED', 403);
      const status = await this.chain.platform();
      if (input.request.token.chainId !== status.network.chainId)
        throw new ApiError('DAO_REFERENCE', 409);
      const count = await db.query(
        'SELECT count(*)::int AS count FROM dao_claim_links WHERE issuer_account_id=$1 AND claimant_account_id IS NULL AND revoked_at IS NULL AND expires_at>now()',
        [current.id],
      );
      if (z.object({ count: z.number() }).parse(count.rows[0]).count >= 100)
        throw new ApiError('DAO_CLAIM_LIMIT', 429);
      const result = await db.query(
        'INSERT INTO dao_claim_links(id,issuer_account_id,request,chain_id,runtime,token_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [
          randomUUID(),
          current.id,
          input.request,
          status.network.chainId,
          status.network.runtime,
          hash(token),
        ],
      );
      return { claim: view(RowSchema.parse(result.rows[0])), token };
    });
  }
  async list(account: Account) {
    const result = await this.pool.query(
      'SELECT * FROM dao_claim_links WHERE account_owns($1,issuer_account_id) ORDER BY expires_at DESC,id LIMIT 50',
      [account.id],
    );
    return z.array(RowSchema).parse(result.rows).map(view);
  }
  async preview(token: string) {
    const result = await this.pool.query('SELECT * FROM dao_claim_links WHERE token_hash=$1', [
      hash(token),
    ]);
    if (!result.rowCount) throw new ApiError('DAO_CLAIM_UNKNOWN', 404);
    return view(RowSchema.parse(result.rows[0]));
  }
  async revoke(account: Account, id: string) {
    return withTransaction(this.pool, async (db) => {
      const current = await this.account(db, account.id);
      const result = await db.query(
        'SELECT * FROM dao_claim_links WHERE id=$1 AND account_owns($2,issuer_account_id) FOR UPDATE',
        [z.uuid().parse(id), current.id],
      );
      if (!result.rowCount) throw new ApiError('DAO_CLAIM_UNKNOWN', 404);
      const row = RowSchema.parse(result.rows[0]);
      if (
        row.claimant_account_id ||
        (await this.chain.creationOrder(daoClaimReference(row.chain_id, row.runtime, row.id)))
      )
        throw new ApiError('DAO_CLAIM_RESERVED', 409);
      if (!(await this.eligibility(current, db)).eligible)
        throw new ApiError('DAO_CLAIM_EXECUTIVE_REQUIRED', 403);
      const updated = await db.query(
        'UPDATE dao_claim_links SET revoked_at=COALESCE(revoked_at,now()),request=NULL WHERE id=$1 RETURNING *',
        [id],
      );
      return view(RowSchema.parse(updated.rows[0]));
    });
  }
  async claim(
    account: Account,
    input: { token: string; method: z.infer<typeof CreationMethodSchema> },
  ) {
    const method = CreationMethodSchema.parse(input.method);
    const row = await withTransaction(this.pool, async (db) => {
      const current = await this.account(db, account.id);
      const result = await db.query(
        'SELECT * FROM dao_claim_links WHERE token_hash=$1 FOR UPDATE',
        [hash(input.token)],
      );
      if (!result.rowCount) throw new ApiError('DAO_CLAIM_UNKNOWN', 404);
      const draft = RowSchema.parse(result.rows[0]);
      if (draft.claimant_account_id) {
        const owner = await db.query('SELECT account_owns($1,$2) AS owns', [
          current.id,
          draft.claimant_account_id,
        ]);
        if (!z.object({ owns: z.boolean() }).parse(owner.rows[0]).owns)
          throw new ApiError('DAO_CLAIM_RESERVED', 409);
        if (method !== draft.method) throw new ApiError('CREATION_ORDER_CONFLICT', 409);
        return draft;
      }
      const native = await this.chain.creationOrder(
        daoClaimReference(draft.chain_id, draft.runtime, draft.id),
      );
      // A pre-reservation backup may have lost SQL ownership. Never change the native receipt's creator.
      if (
        native &&
        (native.creator !== current.signingKey ||
          native.method !== (method === 'free' ? 2 : method === 'card' ? 1 : 0))
      )
        throw new ApiError('DAO_CLAIM_RESERVED', 409);
      if (!native) {
        if (draft.revoked_at) throw new ApiError('DAO_CLAIM_REVOKED', 409);
        if (draft.expires_at.getTime() <= Date.now()) throw new ApiError('DAO_CLAIM_EXPIRED', 410);
        const issuer = await readAccount(db, draft.issuer_account_id);
        if (!issuer || !(await this.eligibility(issuer, db)).eligible)
          throw new ApiError('DAO_CLAIM_EXECUTIVE_REQUIRED', 403);
        if (!draft.request) throw new ApiError('DAO_CLAIM_UNKNOWN', 404);
        const status = await this.creation.preflight(
          current,
          { requestId: draft.id, deployment: 'shared', method, request: draft.request },
          undefined,
          db,
        );
        if (status.network.chainId !== draft.chain_id || status.network.runtime !== draft.runtime)
          throw new ApiError('DAO_REFERENCE', 409);
      }
      const updated = await db.query(
        'UPDATE dao_claim_links SET claimant_account_id=$2,method=$3 WHERE id=$1 RETURNING *',
        [draft.id, current.id, method],
      );
      return RowSchema.parse(updated.rows[0]);
    });
    if (!row.request) return this.creation.status(account.id, row.id);
    const order = await this.creation.prepare(account, {
      requestId: row.id,
      deployment: 'shared',
      method,
      request: row.request,
    });
    return order.state === 'paid' || order.state === 'created'
      ? this.creation.fulfill(account, row.id)
      : order;
  }
  async cleanup() {
    return withTransaction(this.pool, async (db) => {
      const rows = await db.query(
        'SELECT * FROM dao_claim_links WHERE token_hash IS NOT NULL AND ((completed_at IS NOT NULL AND expires_at<=now()) OR (claimant_account_id IS NULL AND (expires_at<=now() OR revoked_at IS NOT NULL))) ORDER BY expires_at LIMIT 5 FOR UPDATE SKIP LOCKED',
      );
      let changed = 0;
      for (const row of z.array(RowSchema).parse(rows.rows)) {
        if (row.completed_at && row.expires_at.getTime() <= Date.now()) {
          await db.query('UPDATE dao_claim_links SET token_hash=NULL,request=NULL WHERE id=$1', [
            row.id,
          ]);
        } else {
          const native = await this.chain.creationOrder(
            daoClaimReference(row.chain_id, row.runtime, row.id),
          );
          if (!native) await db.query('DELETE FROM dao_claim_links WHERE id=$1', [row.id]);
          else {
            const owner = await db.query(
              "SELECT id FROM accounts WHERE signing_key=$1 AND merged_into IS NULL AND erasure_state='none'",
              [native.creator],
            );
            if (owner.rowCount)
              await db.query(
                'UPDATE dao_claim_links SET claimant_account_id=$2,method=$3 WHERE id=$1',
                [
                  row.id,
                  z.object({ id: z.uuid() }).parse(owner.rows[0]).id,
                  native.method === 2 ? 'free' : native.method === 1 ? 'card' : 'tlos',
                ],
              );
            else
              await db.query(
                'UPDATE dao_claim_links SET token_hash=NULL,request=NULL WHERE id=$1',
                [row.id],
              );
          }
        }
        changed++;
      }
      return changed;
    });
  }
  private async account(db: PoolClient, id: string) {
    await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [id]);
    const account = await readAccount(db, id);
    if (!account) throw new ApiError('SESSION_REQUIRED', 401);
    return account;
  }
}
