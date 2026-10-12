import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { EncryptionPublicKeySchema } from '../../../../protocol/crypto.js';
import {
  EncryptedProfileSchema,
  ProfileContextSchema,
  ProfileShareSchema,
  ProfileKeyGrantSchema,
  ProfileRecipientPageSchema,
  profileCipherDomain,
  type ProfileContext,
  type ProfileKeyGrant,
  type KeyDeletionStatus,
} from '../../../../protocol/profiles.js';
import { profileCiphertextCommitment } from '../../../../sdk/profiles.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import { readAccount, withTransaction } from '../auth/account-session.js';
import { ownsAccount } from '../auth/account-ownership.js';
import type { ProfileExclusions, ProfileExclusion } from './exclusions.js';
export interface ProfileKeysConfiguration {
  backupRetentionSeconds: number;
  exclusions: ProfileExclusions;
}
interface RevisionRow {
  owner_account_id: string;
  ciphertext_commitment: string;
  grants: unknown;
  state: 'staged' | 'active';
  expires_at: Date | null;
  profile_revision: string;
}
const scope = 'chain_id=$1 AND runtime=$2 AND dao_id=$3 AND member_id=$4';
const exact = scope + ' AND profile_revision=$5';
const keyIdentity = (key: unknown) => JSON.stringify(EncryptionPublicKeySchema.parse(key));
export async function applyProfileRestoreExclusions(
  pool: Pool,
  exclusions: ProfileExclusions,
): Promise<number> {
  await exclusions.close?.();
  let removed = 0;
  try {
    for (;;) {
      const batch = await exclusions.scan(25);
      for (const record of batch.records) {
        const context = ProfileContextSchema.parse(record.context);
        const result = await pool.query('DELETE FROM profile_key_revisions WHERE ' + exact, [
          context.chainId,
          context.runtime,
          context.daoId,
          context.memberId,
          context.profileRevision,
        ]);
        removed += result.rowCount ?? 0;
      }
      if (batch.done) return removed;
    }
  } finally {
    await exclusions.close?.();
  }
}
export class ProfileKeys {
  readonly enabled: boolean;
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly configuration?: ProfileKeysConfiguration,
  ) {
    if (configuration)
      z.int()
        .min(1)
        .max(90 * 86400)
        .parse(configuration.backupRetentionSeconds);
    this.enabled = !!configuration && !!chain.profileKeyMember && !!chain.profileKeyRecipients;
  }
  private config() {
    if (!this.enabled || !this.configuration) throw new ApiError('PROFILE_KEYS_UNAVAILABLE', 503);
    return this.configuration;
  }
  private ids(context: ProfileContext) {
    return [
      context.chainId,
      context.runtime,
      context.daoId,
      context.memberId,
      context.profileRevision,
    ];
  }
  private async lock(db: PoolClient, context: ProfileContext) {
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      JSON.stringify(this.ids(context).slice(0, 4)),
    ]);
  }
  private async domain(context: ProfileContext) {
    const network = await this.chain.network();
    if (context.chainId !== network.chainId || context.runtime !== network.runtime)
      throw new ApiError('PROFILE_CONTEXT', 403);
    if (!network.capabilities.includes('encrypted-profiles-v2'))
      throw new ApiError('PROFILE_FORMAT_UNSUPPORTED', 409);
  }
  private async owner(db: PoolClient, id: string, context: ProfileContext, active: boolean) {
    await db.query('SELECT id FROM accounts WHERE id=$1 FOR NO KEY UPDATE', [z.uuid().parse(id)]);
    const account = await readAccount(db, id);
    if (!account || account.signingKey === null) throw new ApiError('PROFILE_OWNER', 403);
    await this.domain(context);
    const membership = (await this.chain.memberships(account)).find(
      (member) =>
        member.dao.chainId === context.chainId &&
        member.dao.contract === context.runtime &&
        member.dao.daoId === context.daoId &&
        member.memberId === context.memberId &&
        (!active || member.active),
    );
    if (!membership) throw new ApiError('PROFILE_OWNER', 403);
    const member = await this.chain.profileKeyMember?.(context.daoId, context.memberId);
    if (!member || (active && !member.active)) throw new ApiError('PROFILE_OWNER', 403);
    return { account, member };
  }
  private async audience(context: ProfileContext, grants: ProfileKeyGrant[], ownerKey: string) {
    const wanted = new Set(grants.map((grant) => keyIdentity(grant.recipientEncryptionKey)));
    wanted.delete(ownerKey);
    let after: string | undefined;
    for (let page = 0; wanted.size && page < 100; page++) {
      const result = await this.chain.profileKeyRecipients?.(context.daoId, after);
      if (!result) throw new ApiError('PROFILE_KEYS_UNAVAILABLE', 503);
      const recipients = ProfileRecipientPageSchema.parse(result);
      for (const recipient of recipients.recipients)
        wanted.delete(keyIdentity(recipient.encryptionKey));
      if (!recipients.next) break;
      if (after && BigInt(recipients.next) <= BigInt(after))
        throw new ApiError('PROFILE_AUDIENCE', 403);
      after = recipients.next;
    }
    if (wanted.size) throw new ApiError('PROFILE_AUDIENCE', 403);
  }
  async put(ownerAccountId: string, input: ProfileKeyGrant[]): Promise<void> {
    const config = this.config();
    const { context, grants } = ProfileShareSchema.parse({
      context: input[0]?.context,
      grants: input,
    });
    const commitment = grants[0]?.ciphertextCommitment;
    if (!commitment) throw new ApiError('PROFILE_FORMAT', 400);
    await withTransaction(this.pool, async (db) => {
      const { account, member } = await this.owner(db, ownerAccountId, context, true);
      await this.lock(db, context);
      if (keyIdentity(account.encryptionKey) !== keyIdentity(member.encryptionKey))
        throw new ApiError('PROFILE_KEY_CHANGED', 409);
      const ownerKey = keyIdentity(account.encryptionKey);
      if (!grants.some((grant) => keyIdentity(grant.recipientEncryptionKey) === ownerKey))
        throw new ApiError('PROFILE_OWNER_ENVELOPE', 400);
      await this.audience(context, grants, ownerKey);
      if (await config.exclusions.read(context)) throw new ApiError('PROFILE_KEY_REMOVED', 409);
      const old = (
        await db.query<RevisionRow>(
          'SELECT * FROM profile_key_revisions WHERE ' + exact + ' FOR UPDATE',
          this.ids(context),
        )
      ).rows[0];
      if (old) {
        if (
          !(await ownsAccount(db, account.id, old.owner_account_id)) ||
          old.ciphertext_commitment !== commitment
        )
          throw new ApiError('PROFILE_CONTEXT', 409);
        if (
          JSON.stringify(z.array(ProfileKeyGrantSchema).parse(old.grants)) !==
          JSON.stringify(grants)
        )
          throw new ApiError('PROFILE_REVISION_IMMUTABLE', 409);
        return;
      }
      const staged = await db.query<{ count: string }>(
        'SELECT count(*) FROM profile_key_revisions WHERE ' + scope + " AND state='staged'",
        this.ids(context).slice(0, 4),
      );
      if (Number(staged.rows[0]?.count ?? '0') >= 2)
        throw new ApiError('PROFILE_STAGING_LIMIT', 409);
      await db.query(
        "INSERT INTO profile_key_revisions(chain_id,runtime,dao_id,member_id,profile_revision,owner_account_id,ciphertext_commitment,grants,state,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'staged',now()+interval '15 minutes')",
        [...this.ids(context), account.id, commitment, JSON.stringify(grants)],
      );
      await db.query(
        "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-profiles','reconcile',$1,$2,now()) ON CONFLICT(job_key) DO NOTHING",
        ['profile:' + profileCipherDomain(context), JSON.stringify({ context })],
      );
    });
  }
  async status(input: ProfileContext) {
    const context = ProfileContextSchema.parse(input);
    const row = (
      await this.pool.query<RevisionRow>(
        'SELECT * FROM profile_key_revisions WHERE ' + exact,
        this.ids(context),
      )
    ).rows[0];
    if (!row) throw new ApiError('PROFILE_KEY_UNAVAILABLE', 404);
    return { state: row.state, expiresAt: row.expires_at?.toISOString() ?? null };
  }
  async get(recipientAccountId: string, input: ProfileContext): Promise<ProfileKeyGrant> {
    const config = this.config(),
      context = ProfileContextSchema.parse(input);
    if (await config.exclusions.read(context)) throw new ApiError('PROFILE_KEY_UNAVAILABLE', 404);
    await this.domain(context);
    // Publication and SQL cleanup are separate systems; a committed staged cipher remains recoverable during retries.
    try {
      await this.reconcile(context);
    } catch (error) {
      if (
        error instanceof ApiError &&
        !['CHAIN_UNAVAILABLE', 'PROFILE_KEYS_UNAVAILABLE', 'SERVICE_UNAVAILABLE'].includes(
          error.code,
        )
      )
        throw error;
      if (error instanceof z.ZodError) throw error;
    }
    const account = await readAccount(this.pool, z.uuid().parse(recipientAccountId));
    if (!account || !account.encryptionKey) throw new ApiError('PROFILE_AUDIENCE', 403);
    const row = (
      await this.pool.query<RevisionRow>(
        'SELECT * FROM profile_key_revisions WHERE ' + exact,
        this.ids(context),
      )
    ).rows[0];
    if (!row || (row.state === 'staged' && !(await this.published(context, row))))
      throw new ApiError('PROFILE_KEY_UNAVAILABLE', 404);
    const grant = z
      .array(ProfileKeyGrantSchema)
      .parse(row.grants)
      .find(
        (value) => keyIdentity(value.recipientEncryptionKey) === keyIdentity(account.encryptionKey),
      );
    if (!grant) throw new ApiError('PROFILE_AUDIENCE', 403);
    const membership = (await this.chain.memberships(account)).find(
      (member) =>
        member.dao.chainId === context.chainId &&
        member.dao.contract === context.runtime &&
        member.dao.daoId === context.daoId &&
        (member.active || member.memberId === context.memberId),
    );
    const native =
      membership && (await this.chain.profileKeyMember?.(context.daoId, membership.memberId));
    if (!native || keyIdentity(native.encryptionKey) !== keyIdentity(account.encryptionKey))
      throw new ApiError('PROFILE_AUDIENCE', 403);
    if (await config.exclusions.read(context)) throw new ApiError('PROFILE_KEY_UNAVAILABLE', 404);
    return grant;
  }
  private async published(context: ProfileContext, row: RevisionRow) {
    const native = await this.chain.memberProfile(context.daoId, context.memberId);
    let cipher: unknown;
    try {
      cipher = native.profile === null ? null : JSON.parse(native.profile);
    } catch {
      cipher = null;
    }
    const parsed = EncryptedProfileSchema.safeParse(cipher);
    return (
      parsed.success &&
      profileCipherDomain(parsed.data.context) === profileCipherDomain(context) &&
      (await profileCiphertextCommitment(parsed.data)) === row.ciphertext_commitment
    );
  }
  private deletionStatus(record: ProfileExclusion | null): KeyDeletionStatus {
    return record && Date.parse(record.backupExpiresAt) > Date.now()
      ? { state: 'backup-expiry-pending', backupExpiresAt: record.backupExpiresAt }
      : { state: 'removed', backupExpiresAt: null };
  }
  private async exclude(context: ProfileContext, row: RevisionRow) {
    const config = this.config(),
      now = Date.now();
    return config.exclusions.write({
      version: 1,
      context,
      ownerAccountId: row.owner_account_id,
      ciphertextCommitment: row.ciphertext_commitment,
      deletedAt: new Date(now).toISOString(),
      backupExpiresAt: new Date(now + config.backupRetentionSeconds * 1000).toISOString(),
    });
  }
  async remove(
    ownerAccountId: string,
    input: ProfileContext,
    expectedCommitment?: string,
  ): Promise<KeyDeletionStatus> {
    if (!this.enabled) return { state: 'unavailable', backupExpiresAt: null };
    const context = ProfileContextSchema.parse(input);
    if (expectedCommitment !== undefined)
      z.string()
        .regex(/^[0-9a-f]{64}$/)
        .parse(expectedCommitment);
    try {
      return await withTransaction(this.pool, async (db) => {
        const { account } = await this.owner(db, ownerAccountId, context, false);
        await this.lock(db, context);
        const row = (
          await db.query<RevisionRow>(
            'SELECT * FROM profile_key_revisions WHERE ' + exact + ' FOR UPDATE',
            this.ids(context),
          )
        ).rows[0];
        let excluded = await this.config().exclusions.read(context);
        if (row && !(await ownsAccount(db, account.id, row.owner_account_id)))
          throw new ApiError('PROFILE_OWNER', 403);
        const commitment = row?.ciphertext_commitment ?? excluded?.ciphertextCommitment;
        if (expectedCommitment && commitment && expectedCommitment !== commitment)
          throw new ApiError('PROFILE_CONTEXT', 409);
        if (row && !excluded) excluded = await this.exclude(context, row);
        await db.query('DELETE FROM profile_key_revisions WHERE ' + exact, this.ids(context));
        return this.deletionStatus(excluded);
      });
    } catch (error) {
      if (error instanceof ApiError || error instanceof z.ZodError) throw error;
      return { state: 'unavailable', backupExpiresAt: null };
    }
  }
  async reconcile(input: ProfileContext): Promise<'completed' | 'retry'> {
    const config = this.config(),
      context = ProfileContextSchema.parse(input);
    const hint = (
      await this.pool.query<RevisionRow>(
        'SELECT * FROM profile_key_revisions WHERE ' + exact,
        this.ids(context),
      )
    ).rows[0];
    if (!hint || hint.state === 'active') return 'completed';
    const canonical = (
      await this.pool.query<{ id: string }>(
        'SELECT coalesce(merged_into,id) AS id FROM accounts WHERE id=$1',
        [hint.owner_account_id],
      )
    ).rows[0];
    if (!canonical) return 'retry';
    return withTransaction(this.pool, async (db) => {
      const { account, member } = await this.owner(db, canonical.id, context, false);
      await this.lock(db, context);
      const row = (
        await db.query<RevisionRow>(
          'SELECT * FROM profile_key_revisions WHERE ' + exact + ' FOR UPDATE',
          this.ids(context),
        )
      ).rows[0];
      if (!row || row.state === 'active') return 'completed';
      if (!(await ownsAccount(db, account.id, row.owner_account_id)))
        throw new ApiError('PROFILE_OWNER', 403);
      if (await config.exclusions.read(context)) {
        await db.query('DELETE FROM profile_key_revisions WHERE ' + exact, this.ids(context));
        return 'completed';
      }
      const published = await this.published(context, row);
      if (!published) {
        if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
          await this.exclude(context, row);
          await db.query('DELETE FROM profile_key_revisions WHERE ' + exact, this.ids(context));
          return 'completed';
        }
        return 'retry';
      }
      if (keyIdentity(account.encryptionKey) !== keyIdentity(member.encryptionKey))
        throw new ApiError('PROFILE_KEY_CHANGED', 409);
      const grants = z.array(ProfileKeyGrantSchema).parse(row.grants);
      await this.audience(context, grants, keyIdentity(account.encryptionKey));
      const replaced = await db.query<RevisionRow>(
        'SELECT * FROM profile_key_revisions WHERE ' +
          scope +
          ' AND profile_revision<>$5 FOR UPDATE',
        this.ids(context),
      );
      for (const previous of replaced.rows)
        await this.exclude({ ...context, profileRevision: previous.profile_revision }, previous);
      await db.query(
        'DELETE FROM profile_key_revisions WHERE ' + scope + ' AND profile_revision<>$5',
        this.ids(context),
      );
      await db.query(
        "UPDATE profile_key_revisions SET state='active',expires_at=NULL WHERE " + exact,
        this.ids(context),
      );
      return 'completed';
    });
  }
  async cleanup(): Promise<number> {
    const config = this.config();
    const { records } = await config.exclusions.scan(25);
    for (const record of records) {
      await withTransaction(this.pool, async (db) => {
        await this.lock(db, record.context);
        await db.query(
          'DELETE FROM profile_key_revisions WHERE ' + exact,
          this.ids(record.context),
        );
      });
      // Commit purging restored rows before forgetting an expired exclusion.
      if (Date.parse(record.backupExpiresAt) <= Date.now())
        await config.exclusions.forget(record.context);
    }
    return records.length;
  }
}
