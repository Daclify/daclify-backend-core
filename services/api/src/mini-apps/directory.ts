import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  MiniAppListingInputSchema,
  MiniAppListingSchema,
  MiniAppOriginProofSchema,
  MiniAppDirectoryRoutes,
} from '../../../../protocol/mini-apps.js';
import { readAccount, withTransaction } from '../auth/account-session.js';
import { ApiError } from '../errors.js';
import { isPublicAddress, probeDependencies, type ProbeDependencies } from './probe.js';
function originConflict(error: unknown): never {
  if (
    z
      .object({ code: z.literal('23505'), constraint: z.literal('mini_app_listings_origin_key') })
      .safeParse(error).success
  )
    throw new ApiError('LISTING_ORIGIN_REGISTERED', 409);
  throw error;
}
const hash = (value: string) => createHash('sha256').update(value).digest();
const proofUrl = (proof: z.infer<typeof MiniAppOriginProofSchema>) =>
  proof.origin + '/.well-known/daclify-mini-app-directory/' + proof.listingId + '.json';
async function fetchOriginProof(url: URL, dependencies: ProbeDependencies) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await Promise.race([
      (async () => {
        if (url.port && url.port !== '443') throw Error('LISTING_PROOF_INVALID');
        const addresses = await dependencies.lookup(url.hostname);
        if (
          !addresses.length ||
          addresses.length > 16 ||
          addresses.some((value) => !isPublicAddress(value.address))
        )
          throw Error('LISTING_PROOF_INVALID');
        const address = addresses[0];
        if (!address || controller.signal.aborted) throw Error('LISTING_PROOF_INVALID');
        const response = await dependencies.request(url, address, controller.signal);
        if (response.status !== 200 || response.bytes.length > 4096)
          throw Error('LISTING_PROOF_INVALID');
        return MiniAppOriginProofSchema.parse(
          JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.bytes)),
        );
      })(),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(Error('LISTING_PROOF_INVALID')), {
          once: true,
        }),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function verifyListingOrigin(
  proof: z.infer<typeof MiniAppOriginProofSchema>,
  dependencies: ProbeDependencies = probeDependencies,
): Promise<boolean> {
  try {
    const received = await fetchOriginProof(new URL(proofUrl(proof)), dependencies);
    return (
      JSON.stringify(received) === JSON.stringify(proof) && Date.parse(proof.expires) > Date.now()
    );
  } catch {
    return false;
  }
}
const rowSchema = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  origin: z.string(),
  listing: MiniAppListingInputSchema,
  status: MiniAppListingSchema.shape.status,
  moderated: z.boolean(),
  verified_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  expires_at: z.date(),
});
type Row = z.infer<typeof rowSchema>;
const publicRow = (row: Row) =>
  MiniAppListingSchema.parse({
    ...row.listing,
    id: row.id,
    status: row.status,
    created: row.created_at.toISOString(),
    updated: row.updated_at.toISOString(),
    expires: row.expires_at.toISOString(),
  });
export class DirectoryService {
  constructor(
    readonly pool: Pool,
    readonly moderation: {
      available(): Promise<boolean>;
      authorize(accountId: string): Promise<boolean>;
    },
    private readonly dependencies: ProbeDependencies = probeDependencies,
  ) {}
  private async active(db: Pool | PoolClient, accountId: string) {
    if (!(await readAccount(db, accountId))) throw new ApiError('AUTH_REQUIRED', 401);
  }
  private async row(db: Pool | PoolClient, id: string, lock = false): Promise<Row> {
    const result = await db.query(
      'SELECT * FROM mini_app_listings WHERE id=$1' + (lock ? ' FOR UPDATE' : ''),
      [z.uuid().parse(id)],
    );
    if (!result.rows[0]) throw new ApiError('LISTING_UNKNOWN', 404);
    return rowSchema.parse(result.rows[0]);
  }
  private owner(row: Row, accountId: string) {
    if (row.account_id !== accountId) throw new ApiError('LISTING_OWNER_REQUIRED', 403);
  }
  async list(
    query: z.infer<typeof MiniAppDirectoryRoutes.miniAppDirectory.query>,
    accountId?: string,
  ) {
    if (query.mine && !accountId) throw new ApiError('AUTH_REQUIRED', 401);
    if (accountId) await this.active(this.pool, accountId);
    const available = await this.moderation.available();
    const rows = await this.pool.query(
      "SELECT * FROM mini_app_listings WHERE expires_at>now() AND id>COALESCE($1::uuid,'00000000-0000-0000-0000-000000000000') AND (($2::uuid IS NOT NULL AND account_id=$2) OR ($3 AND status='published')) ORDER BY id LIMIT 26",
      [query.after ?? null, query.mine ? accountId : null, !query.mine && available],
    );
    const parsed = rows.rows.map((value) => rowSchema.parse(value));
    return {
      listings: parsed.slice(0, 25).map(publicRow),
      next: parsed.length > 25 ? (parsed[24]?.id ?? null) : null,
      publicationAvailable: available,
    };
  }
  async submit(accountId: string, value: unknown) {
    const input = MiniAppListingInputSchema.parse(value);
    return withTransaction(this.pool, async (db) => {
      await this.active(db, accountId);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('mini-app-directory'))");
      const count = await db.query<{ owned: number; total: number }>(
        'SELECT count(*) FILTER(WHERE account_id=$1)::int AS owned,count(*)::int AS total FROM mini_app_listings',
        [accountId],
      );
      if ((count.rows[0]?.owned ?? 8) >= 8 || (count.rows[0]?.total ?? 10000) >= 10000)
        throw new ApiError('LISTING_LIMIT', 429);
      const id = randomUUID();
      await db.query(
        'INSERT INTO mini_app_listings(id,account_id,origin,listing) VALUES($1,$2,$3,$4)',
        [id, accountId, input.origin, JSON.stringify(input)],
      );
      return publicRow(await this.row(db, id));
    }).catch(originConflict);
  }
  async update(accountId: string, id: string, value: unknown, withdraw = false) {
    const input = MiniAppListingInputSchema.parse(value);
    return withTransaction(this.pool, async (db) => {
      await this.active(db, accountId);
      const row = await this.row(db, id, true);
      this.owner(row, accountId);
      const changed = row.origin !== input.origin;
      await db.query(
        "UPDATE mini_app_listings SET origin=$2,listing=$3,status=CASE WHEN $4 OR moderated THEN 'hidden' WHEN $5 THEN 'unverified' ELSE status END,verified_at=CASE WHEN $5 THEN NULL ELSE verified_at END,updated_at=now(),expires_at=CASE WHEN $4 THEN clock_timestamp() ELSE now()+interval '90 days' END WHERE id=$1",
        [id, input.origin, JSON.stringify(input), withdraw, changed],
      );
      await db.query('DELETE FROM mini_app_directory_proofs WHERE listing_id=$1', [id]);
      await db.query('DELETE FROM mini_app_directory_transfers WHERE listing_id=$1', [id]);
      return publicRow(await this.row(db, id));
    }).catch(originConflict);
  }
  async transfer(accountId: string, id: string, successor: string) {
    return withTransaction(this.pool, async (db) => {
      await this.active(db, accountId);
      await this.active(db, successor);
      const row = await this.row(db, id, true);
      this.owner(row, accountId);
      if (successor === accountId) throw new ApiError('LISTING_SUCCESSOR_INVALID', 400);
      await db.query('DELETE FROM mini_app_directory_proofs WHERE listing_id=$1', [id]);
      const expires = new Date(Date.now() + 600000);
      await db.query(
        'INSERT INTO mini_app_directory_transfers(listing_id,account_id,expires_at) VALUES($1,$2,$3) ON CONFLICT(listing_id) DO UPDATE SET account_id=$2,expires_at=$3',
        [id, successor, expires],
      );
      return { expires: expires.toISOString() };
    });
  }
  async verify(accountId: string, id: string, complete = false) {
    await this.active(this.pool, accountId);
    const row = await this.row(this.pool, id);
    const successor = (
      await this.pool.query(
        'SELECT 1 FROM mini_app_directory_transfers WHERE listing_id=$1 AND account_id=$2 AND expires_at>now()',
        [id, accountId],
      )
    ).rowCount;
    if (row.account_id !== accountId && !successor)
      throw new ApiError('LISTING_OWNER_REQUIRED', 403);
    if (!complete) {
      const proof = MiniAppOriginProofSchema.parse({
        version: 1,
        listingId: id,
        accountId,
        origin: row.origin,
        challenge: randomBytes(32).toString('hex'),
        expires: new Date(Date.now() + 600000).toISOString(),
      });
      await this.pool.query(
        'INSERT INTO mini_app_directory_proofs(listing_id,account_id,challenge_hash,origin,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(listing_id) DO UPDATE SET account_id=$2,challenge_hash=$3,origin=$4,expires_at=$5',
        [id, accountId, hash(proof.challenge), proof.origin, proof.expires],
      );
      return { state: 'challenge' as const, proof, proofUrl: proofUrl(proof) };
    }
    const stored = (
      await this.pool.query<{ challenge_hash: Buffer; origin: string; expires_at: Date }>(
        'SELECT challenge_hash,origin,expires_at FROM mini_app_directory_proofs WHERE listing_id=$1 AND account_id=$2 AND expires_at>now()',
        [id, accountId],
      )
    ).rows[0];
    if (!stored || stored.origin !== row.origin) throw new ApiError('LISTING_PROOF_EXPIRED', 403);
    let proof: z.infer<typeof MiniAppOriginProofSchema>;
    try {
      proof = await fetchOriginProof(
        new URL(row.origin + '/.well-known/daclify-mini-app-directory/' + id + '.json'),
        this.dependencies,
      );
      if (
        proof.listingId !== id ||
        proof.accountId !== accountId ||
        proof.origin !== row.origin ||
        Date.parse(proof.expires) !== stored.expires_at.getTime() ||
        Date.parse(proof.expires) <= Date.now() ||
        !hash(proof.challenge).equals(stored.challenge_hash)
      )
        throw Error('LISTING_PROOF_INVALID');
    } catch {
      throw new ApiError('LISTING_PROOF_INVALID', 403);
    }
    if (!(await this.moderation.available()))
      throw new ApiError('LISTING_MODERATION_UNAVAILABLE', 503);
    return withTransaction(this.pool, async (db) => {
      await this.active(db, accountId);
      const current = await this.row(db, id, true);
      const pending = (
        await db.query(
          'SELECT 1 FROM mini_app_directory_transfers WHERE listing_id=$1 AND account_id=$2 AND expires_at>now()',
          [id, accountId],
        )
      ).rowCount;
      if (current.origin !== proof.origin || (current.account_id !== accountId && !pending))
        throw new ApiError('LISTING_OWNER_REQUIRED', 403);
      const consumed = await db.query(
        'DELETE FROM mini_app_directory_proofs WHERE listing_id=$1 AND account_id=$2 AND challenge_hash=$3 AND expires_at>now()',
        [id, accountId, hash(proof.challenge)],
      );
      if (!consumed.rowCount) throw new ApiError('LISTING_PROOF_EXPIRED', 403);
      await db.query(
        "UPDATE mini_app_listings SET account_id=$2,verified_at=now(),status=CASE WHEN moderated THEN 'hidden' ELSE 'published' END,updated_at=now(),expires_at=now()+interval '90 days' WHERE id=$1",
        [id, accountId],
      );
      await db.query('DELETE FROM mini_app_directory_transfers WHERE listing_id=$1', [id]);
      return { state: 'verified' as const, listing: publicRow(await this.row(db, id)) };
    });
  }
  async report(accountId: string, id: string, reason: string) {
    reason = MiniAppDirectoryRoutes.miniAppListingReport.input.parse({ id, reason }).reason;
    return withTransaction(this.pool, async (db) => {
      await this.active(db, accountId);
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'mini-app-directory-report:' + accountId,
      ]);
      await this.row(db, id, true);
      const count = await db.query<{ total: number; owned: number }>(
        "SELECT count(*) FILTER(WHERE listing_id=$1)::int AS total,count(*) FILTER(WHERE account_id=$2 AND created_at>now()-interval '1 day')::int AS owned FROM mini_app_directory_reports",
        [id, accountId],
      );
      if ((count.rows[0]?.total ?? 100) >= 100 || (count.rows[0]?.owned ?? 10) >= 10)
        throw new ApiError('LISTING_REPORT_LIMIT', 429);
      await db.query(
        'INSERT INTO mini_app_directory_reports(listing_id,account_id,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [id, accountId, reason],
      );
      return { received: true as const };
    });
  }
  async reports(accountId: string, id: string, after?: string) {
    await this.active(this.pool, accountId);
    if (!(await this.moderation.authorize(accountId)))
      throw new ApiError('LISTING_MODERATOR_REQUIRED', 403);
    const rows = await this.pool.query<{
      account_id: string;
      reason: string;
      created_at: Date;
      expires_at: Date;
    }>(
      "SELECT account_id,reason,created_at,expires_at FROM mini_app_directory_reports WHERE listing_id=$1 AND expires_at>now() AND account_id>COALESCE($2::uuid,'00000000-0000-0000-0000-000000000000') ORDER BY account_id LIMIT 26",
      [id, after ?? null],
    );
    return {
      reports: rows.rows.slice(0, 25).map((row) => ({
        reason: row.reason,
        created: row.created_at.toISOString(),
        expires: row.expires_at.toISOString(),
      })),
      next: rows.rows.length > 25 ? (rows.rows[24]?.account_id ?? null) : null,
    };
  }
  async moderate(accountId: string, id: string, decision: 'hide' | 'restore') {
    await this.active(this.pool, accountId);
    if (!(await this.moderation.authorize(accountId)))
      throw new ApiError('LISTING_MODERATOR_REQUIRED', 403);
    return withTransaction(this.pool, async (db) => {
      const row = await this.row(db, id, true);
      if (decision === 'restore' && !row.verified_at)
        throw new ApiError('LISTING_VERIFICATION_REQUIRED', 409);
      await db.query(
        'UPDATE mini_app_listings SET moderated=$2,status=$3,updated_at=now() WHERE id=$1',
        [id, decision === 'hide', decision === 'hide' ? 'hidden' : 'published'],
      );
      return publicRow(await this.row(db, id));
    });
  }
  async cleanup() {
    for (const table of [
      'mini_app_directory_reports',
      'mini_app_directory_proofs',
      'mini_app_directory_transfers',
    ])
      await this.pool.query(
        `DELETE FROM ${table} WHERE ctid IN(SELECT ctid FROM ${table} WHERE expires_at<=now() OR listing_id IN(SELECT id FROM mini_app_listings WHERE expires_at<=now()) LIMIT 25)`,
      );
    await this.pool.query(
      'DELETE FROM mini_app_listings WHERE id IN(SELECT id FROM mini_app_listings l WHERE expires_at<=now() AND NOT EXISTS(SELECT 1 FROM mini_app_directory_reports WHERE listing_id=l.id) AND NOT EXISTS(SELECT 1 FROM mini_app_directory_proofs WHERE listing_id=l.id) AND NOT EXISTS(SELECT 1 FROM mini_app_directory_transfers WHERE listing_id=l.id) LIMIT 25)',
    );
  }
}
