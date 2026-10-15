import { requireQuickDeactivation } from '../quick-ballots/accounts.js';
import type { MiniAppCleanup } from '../mini-apps/cleanup.js';
import { reconcileHostedClosure, type HostedClosureReconciliation } from './hosted-closure.js';
import {
  exitOperationCommitment,
  exitStepCommitment,
  ExitCoreActions,
} from '../../../../sdk/account-exit.js';
import { runtimeAbi } from '../../../../sdk/generated/runtime.js';
import { RuntimeActionSchemas } from '../../../../sdk/generated/schemas.js';
import { Serializer } from '@wharfkit/antelope';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  ExitIntentSchema,
  ExitReportSchema,
  ExitCapabilitySchema,
  type ExitOperation,
  type ExitReport,
  type ErasureComponent,
  ExitPreflightSchema,
  type ExitPreflight,
  SignedExitInstructionSchema,
  ExitSubmissionSchema,
} from '../../../../protocol/account-exit.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import { readAccount, withTransaction } from '../auth/account-session.js';
import { assertErasureInventory, ErasureInventory } from './inventory.js';
import type { ProfileExclusions } from '../profiles/exclusions.js';
import { RecoveryReceiptSchema, type RecoveryBackupStore } from '../auth/recovery.js';
import type { AccountErasureExclusions } from './exclusions.js';
import { ProfileContextSchema } from '../../../../protocol/profiles.js';
const hash = (value: string) => createHash('sha256').update(value).digest();
const OperationRow = z.object({
  id: z.uuid(),
  account_id: z.uuid(),
  mode: z.enum(['leave-all', 'delete-account']),
  state: z.enum(['processing', 'complete', 'expired']),
  intent: ExitIntentSchema,
  components: z.array(
    z.object({
      id: z.string(),
      state: z.enum(['pending', 'confirmed', 'unavailable', 'retained']),
      reason: z.string(),
      expiresAt: z.iso.datetime().optional(),
    }),
  ),
  status_hash: z.instanceof(Buffer),
  expires_at: z.date(),
});
function report(input: unknown): ExitReport {
  const row = OperationRow.parse(input);
  return ExitReportSchema.parse({
    version: 1,
    id: row.id,
    mode: row.mode,
    state: row.state,
    components: row.components,
    expiresAt: row.expires_at.toISOString(),
  });
}
export interface AccountExitConfiguration {
  backupRetentionSeconds: number;
  profileExclusions?: ProfileExclusions;
  exclusions?: AccountErasureExclusions;
  recoveryStore?: RecoveryBackupStore;
  hostedReconciliation?: HostedClosureReconciliation;
  appCleanup?: MiniAppCleanup;
}
export class AccountExit {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly configuration: AccountExitConfiguration,
  ) {
    z.int()
      .min(1)
      .max(90 * 86400)
      .parse(configuration.backupRetentionSeconds);
  }
  async preflight(accountId: string): Promise<ExitPreflight> {
    const account = await readAccount(this.pool, accountId);
    if (!account) throw new ApiError('AUTH_REQUIRED', 401);
    let memberships: Awaited<ReturnType<ChainGateway['memberships']>> = [];
    let nativeAvailable = true;
    try {
      memberships = await this.chain.memberships(account);
    } catch {
      nativeAvailable = false;
    }
    let views = await Promise.all(
      memberships.map(async (member) => {
        let dao: Awaited<ReturnType<ChainGateway['dao']>> | undefined;
        try {
          dao = await this.chain.dao(member.dao.daoId);
        } catch {}
        return {
          reference: member.dao,
          memberId: member.memberId,
          nonce: member.nonce,
          active: member.active,
          admin: member.admin,
          claim: member.claim,
          stake: member.stake,
          nativeAccount: member.nativeAccount || null,
          soleMember: dao ? dao.members === 1 : null,
          lifecycle: dao?.lifecycle ?? null,
          reason: dao ? 'DAO_AVAILABLE' : 'DAO_UNAVAILABLE',
        };
      }),
    );
    if (!nativeAvailable) {
      const cached = z
        .array(
          z.object({
            chain_id: z.string(),
            contract: z.string(),
            dao_id: z.string(),
            member_id: z.string(),
          }),
        )
        .parse(
          (
            await this.pool.query(
              'SELECT chain_id,contract,dao_id::text,member_id::text FROM memberships WHERE account_id IN(SELECT account_scope($1)) ORDER BY chain_id,contract,dao_id LIMIT 257',
              [accountId],
            )
          ).rows,
        );
      if (cached.length > 256) throw new ApiError('EXIT_MEMBERSHIP_LIMIT', 409);
      views = cached.map((m) => ({
        reference: {
          chainId: m.chain_id,
          contract: m.contract,
          daoId: m.dao_id,
          interfaceVersion: 1,
        },
        memberId: m.member_id,
        nonce: '0',
        active: false,
        admin: false,
        claim: '0',
        stake: '0',
        nativeAccount: null,
        soleMember: null,
        lifecycle: null,
        reason: 'CACHED_REFERENCE_REQUIRES_NATIVE_RECHECK',
      }));
    }
    return ExitPreflightSchema.parse({
      version: 1,
      nativeAvailable,
      memberships: views,
      limits: { memberships: 256, statusDays: 30 },
      retained:
        'Shared DAO evidence, unsettled rights, required history and recipient/public-chain copies remain; external cleanup is reported separately.',
    });
  }
  async begin(
    accountId: string,
    input: unknown,
    proof: { reauthenticated: true; statusCapability?: string },
  ): Promise<ExitOperation> {
    if (proof.reauthenticated !== true) throw new ApiError('ACCOUNT_CONTROL_REQUIRED', 403);
    const intent = ExitIntentSchema.parse(input),
      capability = ExitCapabilitySchema.parse(
        proof.statusCapability ?? randomBytes(32).toString('base64url'),
      );
    const existing = (
      await this.pool.query(
        "SELECT * FROM account_exit_operations WHERE account_id=$1 AND mode=$2 AND (state='processing' OR status_hash=$3) AND expires_at>now() ORDER BY created_at DESC LIMIT 1",
        [accountId, intent.mode, hash(capability)],
      )
    ).rows[0];
    if (existing) {
      const row = OperationRow.parse(existing);
      if (
        !timingSafeEqual(hash(capability), row.status_hash) ||
        JSON.stringify(row.intent) !== JSON.stringify(intent)
      )
        throw new ApiError('EXIT_ALREADY_STARTED', 409);
      return { ...report(row), statusCapability: capability };
    }
    const preflight = await this.preflight(accountId);
    if (preflight.nativeAvailable) {
      if (
        intent.memberships.some(
          (choice) =>
            choice.choice === 'close' &&
            !preflight.memberships.some(
              (member) =>
                member.reference.chainId === choice.chainId &&
                member.reference.contract === choice.runtime &&
                member.reference.daoId === choice.daoId &&
                member.memberId === choice.memberId &&
                member.soleMember &&
                member.admin,
            ),
        )
      )
        throw new ApiError('EXIT_SOLE_MEMBER_REQUIRED', 409);
      const active = preflight.memberships.filter((m) => m.active);
      if (
        active.length !== intent.memberships.length ||
        active.some(
          (m) =>
            !intent.memberships.some(
              (choice) =>
                choice.chainId === m.reference.chainId &&
                choice.runtime === m.reference.contract &&
                choice.daoId === m.reference.daoId &&
                choice.memberId === m.memberId,
            ),
        )
      )
        throw new ApiError('EXIT_MEMBERSHIP_CHANGED', 409);
    }
    return withTransaction(this.pool, async (db) => {
      await assertErasureInventory(db);
      const ids = (
        await db.query<{ id: string }>(
          'SELECT id FROM accounts WHERE id=$1 OR merged_into=$1 ORDER BY id FOR UPDATE',
          [z.uuid().parse(accountId)],
        )
      ).rows.map((row) => row.id);
      const previous = (
        await db.query(
          "SELECT * FROM account_exit_operations WHERE account_id=$1 AND mode=$2 AND (state='processing' OR status_hash=$3) AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
          [accountId, intent.mode, hash(capability)],
        )
      ).rows[0];
      if (previous) {
        const row = OperationRow.parse(previous);
        if (
          !timingSafeEqual(hash(capability), row.status_hash) ||
          JSON.stringify(row.intent) !== JSON.stringify(intent)
        )
          throw new ApiError('EXIT_ALREADY_STARTED', 409);
        return { ...report(row), statusCapability: capability };
      }
      const account = await readAccount(db, accountId);
      if (!account) throw new ApiError('AUTH_REQUIRED', 401);
      const id = randomUUID(),
        expiresAt = new Date(Date.now() + 30 * 86400000),
        components: ErasureComponent[] = [
          {
            id: 'hosted',
            state: intent.mode === 'delete-account' ? 'pending' : 'retained',
            reason:
              intent.mode === 'delete-account' ? 'HOSTED_CLEANUP_PENDING' : 'ACCOUNT_RETAINED',
          },
          {
            id: 'native',
            state: preflight.nativeAvailable
              ? intent.memberships.length
                ? 'pending'
                : 'confirmed'
              : 'unavailable',
            reason: preflight.nativeAvailable
              ? intent.memberships.length
                ? 'USER_SIGNATURES_REQUIRED'
                : 'NO_ACTIVE_MEMBERSHIPS'
              : 'NATIVE_UNAVAILABLE',
          },
          {
            id: 'profiles',
            state: intent.mode === 'delete-account' ? 'pending' : 'retained',
            reason:
              intent.mode === 'delete-account' ? 'PROFILE_CLEANUP_PENDING' : 'PROFILE_RETAINED',
          },
          { id: 'apps', state: 'pending', reason: 'APP_CLEANUP_NOTICES_PENDING' },
          {
            id: 'backups',
            state: intent.mode === 'delete-account' ? 'pending' : 'retained',
            reason:
              intent.mode === 'delete-account'
                ? 'CONTROLLED_BACKUP_EXPIRY_PENDING'
                : 'ACCOUNT_RETAINED',
            expiresAt: new Date(
              Date.now() + this.configuration.backupRetentionSeconds * 1000,
            ).toISOString(),
          },
          {
            id: 'shared-evidence',
            state: 'retained',
            reason: 'SETTLEMENT_AND_APPLICABLE_RETENTION',
          },
        ];
      await db.query(
        'INSERT INTO account_exit_operations(id,account_id,mode,intent,components,status_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          id,
          accountId,
          intent.mode,
          intent,
          JSON.stringify(components),
          hash(capability),
          expiresAt,
        ],
      );
      for (const owner of ids)
        await db.query('INSERT INTO account_exit_scope(operation_id,account_id) VALUES($1,$2)', [
          id,
          owner,
        ]);
      for (const member of preflight.memberships) {
        const context = [
          member.reference.chainId,
          member.reference.contract,
          member.reference.daoId,
          member.memberId,
        ].join(':');
        await db.query(
          'INSERT INTO account_exit_memberships(operation_id,context,reference) VALUES($1,$2,$3)',
          [id, context, member],
        );
        components.push({
          id: 'membership:' + context,
          state: preflight.nativeAvailable
            ? member.active
              ? 'pending'
              : 'confirmed'
            : 'unavailable',
          reason: preflight.nativeAvailable
            ? member.active
              ? 'OWN_DEPARTURE_SIGNATURE_REQUIRED'
              : 'NATIVE_MEMBER_ALREADY_INACTIVE'
            : 'NATIVE_REFERENCE_REQUIRES_RECHECK',
        });
        if (intent.mode === 'delete-account')
          components.push({
            id: 'native-profile:' + context,
            state: preflight.nativeAvailable ? 'pending' : 'unavailable',
            reason: 'OWN_SIGNATURE_REQUIRED_FOR_CURRENT_PROFILE_ROW',
          });
      }
      await db.query('UPDATE account_exit_operations SET components=$2 WHERE id=$1', [
        id,
        JSON.stringify(components),
      ]);
      await db.query(
        'INSERT INTO account_exit_app_subjects(operation_id,client_id,subject,member_id,configuration_hash) SELECT $1,client_id,subject,member_id,configuration_hash FROM connected_app_subjects WHERE account_id=ANY($2::uuid[])',
        [id, ids],
      );
      if (
        !(
          await db.query('SELECT 1 FROM account_exit_app_subjects WHERE operation_id=$1 LIMIT 1', [
            id,
          ])
        ).rowCount
      ) {
        const apps = components.find((c) => c.id === 'apps');
        if (apps) {
          apps.state = 'confirmed';
          apps.reason = 'NO_CONNECTED_APP_SUBJECTS';
        }
        await db.query('UPDATE account_exit_operations SET components=$2 WHERE id=$1', [
          id,
          JSON.stringify(components),
        ]);
      }
      await this.configuration.appCleanup?.freeze(db, id);
      if (intent.mode === 'delete-account') {
        await requireQuickDeactivation(db, ids, this.chain.quickBallots);
        await db.query(
          'UPDATE sessions SET revoked_at=now() WHERE account_id=ANY($1::uuid[]) AND revoked_at IS NULL',
          [ids],
        );
        await db.query(
          'UPDATE connected_app_refresh_families SET revoked_at=coalesce(revoked_at,now()) WHERE account_id=ANY($1::uuid[])',
          [ids],
        );
        await db.query("UPDATE accounts SET erasure_state='pending' WHERE id=ANY($1::uuid[])", [
          ids,
        ]);
        await db.query(
          "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-account-exit','erase',$1,$2,now()) ON CONFLICT(job_key) DO NOTHING",
          ['account-exit:' + id, { operationId: id }],
        );
      }
      return {
        version: 1,
        id,
        mode: intent.mode,
        state: 'processing',
        components,
        expiresAt: expiresAt.toISOString(),
        statusCapability: capability,
      };
    });
  }
  async status(capability: string): Promise<ExitReport> {
    ExitCapabilitySchema.parse(capability);
    return withTransaction(this.pool, async (db) => {
      const stored = (
        await db.query(
          'SELECT * FROM account_exit_operations WHERE status_hash=$1 AND expires_at>now() FOR UPDATE',
          [hash(capability)],
        )
      ).rows[0];
      if (!stored) throw new ApiError('EXIT_STATUS_UNAVAILABLE', 404);
      const row = OperationRow.parse(stored);
      const reader = this.chain.reconcileExitSubmission;
      if (reader) {
        const steps = z
          .array(
            z.object({
              id: z.string(),
              instruction: z.object({ submission: ExitSubmissionSchema }),
            }),
          )
          .parse(
            (
              await db.query(
                "SELECT id,instruction FROM account_exit_steps WHERE operation_id=$1 AND state<>'confirmed' ORDER BY id LIMIT 25",
                [row.id],
              )
            ).rows,
          );
        for (const step of steps) {
          try {
            const result = await reader.call(this.chain, step.instruction.submission);
            await db.query(
              "UPDATE account_exit_steps SET state=$3,instruction=jsonb_set(instruction,'{submission,cursor}',$4::jsonb) WHERE operation_id=$1 AND id=$2",
              [
                row.id,
                step.id,
                result.state === 'confirmed' ? 'confirmed' : 'unavailable',
                JSON.stringify(result.cursor),
              ],
            );
          } catch {
            /* Receipt-only refresh cannot authorize a new submission. */
          }
        }
      }
      await this.recordClosureReceipts(db, row);
      const confirmed = z
        .array(
          z.object({
            descriptor: z.object({
              action: z.string(),
              chainId: z.string(),
              runtime: z.string(),
              daoId: z.string(),
              memberId: z.string(),
            }),
          }),
        )
        .parse(
          (
            await db.query(
              "SELECT descriptor FROM account_exit_steps WHERE operation_id=$1 AND state='confirmed'",
              [row.id],
            )
          ).rows,
        );
      const matched = (action: string, context: string) =>
        confirmed.some(
          (step) =>
            step.descriptor.action === action &&
            [
              step.descriptor.chainId,
              step.descriptor.runtime,
              step.descriptor.daoId,
              step.descriptor.memberId,
            ].join(':') === context,
        );
      const departed =
        row.intent.memberships.length > 0 &&
        row.intent.memberships.every((member) =>
          matched(
            'leave',
            [member.chainId, member.runtime, member.daoId, member.memberId].join(':'),
          ),
        );
      const components = row.components.map((c) =>
        c.id.startsWith('membership:') && matched('leave', c.id.slice(11))
          ? { ...c, state: 'confirmed' as const, reason: 'SIGNED_DEPARTURE_CONFIRMED' }
          : c.id === 'native' && departed
            ? { ...c, state: 'confirmed' as const, reason: 'SIGNED_DEPARTURES_CONFIRMED' }
            : c.id.startsWith('native-profile:') && matched('delprofile', c.id.slice(15))
              ? { ...c, state: 'confirmed' as const, reason: 'CURRENT_NATIVE_PROFILE_ROW_REMOVED' }
              : c.id === 'backups' &&
                  c.state === 'pending' &&
                  c.expiresAt &&
                  Date.parse(c.expiresAt) <= Date.now()
                ? { ...c, state: 'confirmed' as const, reason: 'CONTROLLED_BACKUP_HORIZON_ELAPSED' }
                : c,
      );
      const state = components.every((c) => c.state === 'confirmed' || c.state === 'retained')
        ? 'complete'
        : 'processing';
      await db.query('UPDATE account_exit_operations SET components=$2,state=$3 WHERE id=$1', [
        row.id,
        JSON.stringify(components),
        state,
      ]);
      return report({ ...row, components, state });
    });
  }
  private async recordClosureReceipts(db: PoolClient, row: z.infer<typeof OperationRow>) {
    const confirmed = z
      .array(
        z.object({
          descriptor: z.object({
            chainId: z.string(),
            runtime: z.string(),
            daoId: z.string(),
            memberId: z.string(),
            action: z.enum(['startclose', 'closedao']),
          }),
        }),
      )
      .parse(
        (
          await db.query(
            "SELECT descriptor FROM account_exit_steps WHERE operation_id=$1 AND state='confirmed' AND descriptor->>'action' IN('startclose','closedao')",
            [row.id],
          )
        ).rows,
      );
    if (!confirmed.length) return;
    row.intent = {
      ...row.intent,
      memberships: row.intent.memberships.map((member) =>
        confirmed.some(
          (step) =>
            step.descriptor.chainId === member.chainId &&
            step.descriptor.runtime === member.runtime &&
            step.descriptor.daoId === member.daoId &&
            step.descriptor.memberId === member.memberId,
        )
          ? { ...member, choice: 'close' as const }
          : member,
      ),
    };
    for (const step of confirmed) {
      const context = [
          step.descriptor.chainId,
          step.descriptor.runtime,
          step.descriptor.daoId,
        ].join(':'),
        id = 'hosted-dao:' + context;
      if (!row.components.some((component) => component.id === id))
        row.components.push({
          id,
          state: 'pending',
          reason: 'HOSTED_CLOSURE_RECONCILIATION_REQUIRED',
        });
      const closed = confirmed.some(
          (value) =>
            value.descriptor.action === 'closedao' &&
            [value.descriptor.chainId, value.descriptor.runtime, value.descriptor.daoId].join(
              ':',
            ) === context,
        ),
        lifecycle: ErasureComponent = {
          id: 'dao-lifecycle:' + context,
          state: closed ? 'confirmed' : 'pending',
          reason: closed ? 'DAO_NATIVE_CLOSED' : 'DAO_CLOSING_AWAITING_SETTLEMENT',
        },
        position = row.components.findIndex((component) => component.id === lifecycle.id);
      if (position < 0) row.components.push(lifecycle);
      else row.components[position] = lifecycle;
    }
    await db.query('UPDATE account_exit_operations SET intent=$2,components=$3 WHERE id=$1', [
      row.id,
      row.intent,
      JSON.stringify(row.components),
    ]);
    await db.query(
      "INSERT INTO jobs(module_id,kind,job_key,payload,due_at) VALUES('core-account-exit','close-hosted',$1,$2,now()) ON CONFLICT(job_key) DO NOTHING",
      ['account-exit-closure:' + row.id, { operationId: row.id }],
    );
  }
  async reconcileClosures(operationId: string) {
    const row = OperationRow.parse(
        (
          await this.pool.query('SELECT * FROM account_exit_operations WHERE id=$1', [
            z.uuid().parse(operationId),
          ])
        ).rows[0],
      ),
      components: ErasureComponent[] = [];
    for (const member of row.intent.memberships.filter((m) => m.choice === 'close'))
      components.push(
        await reconcileHostedClosure(
          this.pool,
          this.chain,
          {
            chainId: member.chainId,
            contract: member.runtime,
            daoId: member.daoId,
            interfaceVersion: 1,
          },
          this.configuration.hostedReconciliation ?? {},
        ),
      );
    await withTransaction(this.pool, async (db) => {
      const current = OperationRow.parse(
        (await db.query('SELECT * FROM account_exit_operations WHERE id=$1 FOR UPDATE', [row.id]))
          .rows[0],
      );
      for (const component of components) {
        const position = current.components.findIndex((c) => c.id === component.id);
        if (position < 0) current.components.push(component);
        else current.components[position] = component;
      }
      await db.query('UPDATE account_exit_operations SET components=$2 WHERE id=$1', [
        row.id,
        JSON.stringify(current.components),
      ]);
    });
    return components.every((c) => c.state === 'confirmed' || c.state === 'retained')
      ? 'completed'
      : 'retry';
  }
  async processApps(operationId: string) {
    return this.configuration.appCleanup?.process(operationId) ?? 'completed';
  }
  async eraseHosted(operationId: string) {
    await this.configuration.appCleanup?.freeze(this.pool, operationId);
    const operation = (
      await this.pool.query('SELECT * FROM account_exit_operations WHERE id=$1', [
        z.uuid().parse(operationId),
      ])
    ).rows[0];
    if (!operation) throw new ApiError('EXIT_UNKNOWN', 404);
    const row = OperationRow.parse(operation);
    if (row.mode !== 'delete-account') throw new ApiError('EXIT_MODE', 409);
    const owners = (
      await this.pool.query<{ account_id: string }>(
        'SELECT account_id FROM account_exit_scope WHERE operation_id=$1',
        [operationId],
      )
    ).rows.map((r) => r.account_id);
    if (!owners.length) throw new ApiError('EXIT_SCOPE_UNAVAILABLE', 409);
    await this.configuration.exclusions?.write({
      version: 1,
      operationId,
      accountIds: owners,
      statusHash: row.status_hash.toString('hex'),
      statusExpiresAt: row.expires_at.toISOString(),
      expiresAt: new Date(
        Date.now() + this.configuration.backupRetentionSeconds * 1000,
      ).toISOString(),
    });
    const profiles = await this.pool.query(
      'SELECT * FROM profile_key_revisions WHERE owner_account_id=ANY($1::uuid[]) LIMIT 25',
      [owners],
    );
    let profileState: ErasureComponent['state'] = 'confirmed';
    if (profiles.rowCount && !this.configuration.profileExclusions) profileState = 'unavailable';
    else
      for (const stored of profiles.rows) {
        const revision = z
          .object({
            chain_id: z.string(),
            runtime: z.string(),
            dao_id: z.string(),
            member_id: z.string(),
            profile_revision: z.uuid(),
            owner_account_id: z.uuid(),
            ciphertext_commitment: z.string(),
          })
          .parse(stored);
        const context = ProfileContextSchema.parse({
          version: 2,
          chainId: revision.chain_id,
          runtime: revision.runtime,
          daoId: revision.dao_id,
          memberId: revision.member_id,
          profileRevision: revision.profile_revision,
        });
        const journal = this.configuration.profileExclusions;
        if (!journal) throw new ApiError('PROFILE_KEYS_UNAVAILABLE', 503);
        await journal.write({
          version: 1,
          context,
          ownerAccountId: revision.owner_account_id,
          ciphertextCommitment: revision.ciphertext_commitment,
          deletedAt: new Date().toISOString(),
          backupExpiresAt: new Date(
            Date.now() + this.configuration.backupRetentionSeconds * 1000,
          ).toISOString(),
        });
        await this.pool.query(
          "DELETE FROM jobs WHERE module_id='core-profiles' AND payload->'context'=$1::jsonb",
          [JSON.stringify(context)],
        );
        await this.pool.query(
          'DELETE FROM profile_key_revisions WHERE chain_id=$1 AND runtime=$2 AND dao_id=$3 AND member_id=$4 AND profile_revision=$5',
          [
            revision.chain_id,
            revision.runtime,
            revision.dao_id,
            revision.member_id,
            revision.profile_revision,
          ],
        );
      }
    if (
      profileState !== 'unavailable' &&
      (
        await this.pool.query(
          'SELECT 1 FROM profile_key_revisions WHERE owner_account_id=ANY($1::uuid[]) LIMIT 1',
          [owners],
        )
      ).rowCount
    )
      profileState = 'pending';
    const pending = await this.pool.query(
      "SELECT receipt_hash,receipt FROM recovery_object_cleanup WHERE account_id=ANY($1::uuid[]) AND state<>'confirmed' AND expires_at>now() LIMIT 25",
      [owners],
    );
    for (const item of pending.rows) {
      const task = z
        .object({ receipt_hash: z.string(), receipt: RecoveryReceiptSchema })
        .parse(item);
      try {
        const store = this.configuration.recoveryStore;
        if (!store?.remove) throw Error('RECOVERY_ERASURE_UNAVAILABLE');
        await store.remove(task.receipt);
        await this.pool.query(
          "UPDATE recovery_object_cleanup SET state='confirmed',receipt='{}'::jsonb WHERE receipt_hash=$1",
          [task.receipt_hash],
        );
      } catch {
        await this.pool.query(
          "UPDATE recovery_object_cleanup SET state='unavailable' WHERE receipt_hash=$1",
          [task.receipt_hash],
        );
      }
    }
    const hostedClosures: ErasureComponent[] = [];
    for (const member of row.intent.memberships.filter((m) => m.choice === 'close'))
      hostedClosures.push(
        await reconcileHostedClosure(
          this.pool,
          this.chain,
          {
            chainId: member.chainId,
            contract: member.runtime,
            daoId: member.daoId,
            interfaceVersion: 1,
          },
          this.configuration.hostedReconciliation ?? {},
        ),
      );
    return withTransaction(this.pool, async (db) => {
      await db.query('SELECT id FROM account_exit_operations WHERE id=$1 FOR UPDATE', [
        operationId,
      ]);
      await db.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
        owners,
      ]);
      async function purge(table: string, column: string, condition?: string) {
        await db.query(
          `DELETE FROM ${table} WHERE ctid IN(SELECT ctid FROM ${table} WHERE ${condition ?? column + '=ANY($1::uuid[])'} LIMIT 25)`,
          [owners],
        );
        return !!(
          await db.query(
            `SELECT 1 FROM ${table} WHERE ${condition ?? column + '=ANY($1::uuid[])'} LIMIT 1`,
            [owners],
          )
        ).rowCount;
      }
      for (const table of [
        'mini_app_directory_reports',
        'mini_app_directory_proofs',
        'mini_app_directory_transfers',
      ]) {
        if (
          await purge(
            table,
            'listing_id',
            'listing_id IN(SELECT id FROM mini_app_listings WHERE account_id=ANY($1::uuid[]))',
          )
        )
          return 'retry';
      }
      // Keep unresolved claimant rights; erase disposable invitations and completed claim descriptions.
      await db.query(
        'DELETE FROM dao_claim_links WHERE id IN(SELECT id FROM dao_claim_links WHERE issuer_account_id=ANY($1::uuid[]) AND claimant_account_id IS NULL LIMIT 25)',
        [owners],
      );
      if (
        (
          await db.query(
            'SELECT 1 FROM dao_claim_links WHERE issuer_account_id=ANY($1::uuid[]) AND claimant_account_id IS NULL LIMIT 1',
            [owners],
          )
        ).rowCount
      )
        return 'retry';
      await db.query(
        'UPDATE dao_claim_links SET request=NULL,token_hash=NULL,revoked_at=COALESCE(revoked_at,now()) WHERE id IN(SELECT id FROM dao_claim_links WHERE (claimant_account_id=ANY($1::uuid[]) OR (issuer_account_id=ANY($1::uuid[]) AND completed_at IS NOT NULL)) AND (request IS NOT NULL OR token_hash IS NOT NULL) LIMIT 25)',
        [owners],
      );
      if (
        (
          await db.query(
            'SELECT 1 FROM dao_claim_links WHERE (claimant_account_id=ANY($1::uuid[]) OR (issuer_account_id=ANY($1::uuid[]) AND completed_at IS NOT NULL)) AND (request IS NOT NULL OR token_hash IS NOT NULL) LIMIT 1',
            [owners],
          )
        ).rowCount
      )
        return 'retry';
      // Remove indirect personal identifiers before their owning credentials and keys disappear.
      if (
        await purge(
          'challenges',
          'signing_key',
          'signing_key IN(SELECT signing_key FROM accounts WHERE id=ANY($1::uuid[]) AND signing_key IS NOT NULL)',
        )
      )
        return 'retry';
      if (
        await purge(
          'signin_challenges',
          'subject',
          "account_id IS NULL AND subject IN(SELECT substring(provider_key FROM 7) FROM credentials WHERE account_id=ANY($1::uuid[]) AND provider_key LIKE 'email:%')",
        )
      )
        return 'retry';
      if (
        await purge(
          'jobs',
          'payload',
          "module_id='core-profiles' AND payload->>'accountId'=ANY($1::text[])",
        )
      )
        return 'retry';
      for (const table of [
        'contact_recovery_accounts',
        'vault_recovery_grants',
        'vault_recovery_handoffs',
        'vault_recovery_devices',
        'account_control_intents',
        'signin_challenges',
        'telegram_oidc_attempts',
        'native_login_intents',
        'evm_signin_intents',
        'vault_attach_intents',
      ]) {
        if (await purge(table, 'account_id')) return 'retry';
      }
      if (
        await purge(
          'connected_app_refresh_tokens',
          'family_id',
          'family_id IN(SELECT id FROM connected_app_refresh_families WHERE account_id=ANY($1::uuid[]))',
        )
      )
        return 'retry';
      for (const item of ErasureInventory.filter(
        (i) => i.disposition === 'erase' && i.table !== 'public.profile_key_revisions',
      )) {
        if (await purge(item.table, item.column)) return 'retry';
      }
      for (const table of ['asset_uploads', 'uploads']) {
        if (
          await purge(
            'jobs',
            'payload',
            "module_id IN('core-assets','core-content') AND payload->>'uploadId' IN(SELECT id::text FROM " +
              table +
              " WHERE account_id=ANY($1::uuid[]) AND state='reserved' AND provider_id IS NULL)",
          )
        )
          return 'retry';
        if (
          await purge(
            table,
            'account_id',
            "account_id=ANY($1::uuid[]) AND state='reserved' AND provider_id IS NULL",
          )
        )
          return 'retry';
      }
      if (
        await purge(
          'audit_events',
          'account_id',
          "account_id=ANY($1::uuid[]) AND (kind='credential.change' OR kind LIKE 'recovery.%' OR kind LIKE 'account.%')",
        )
      )
        return 'retry';
      const recovery = (
        await db.query(
          "SELECT 1 FROM recovery_object_cleanup WHERE account_id=ANY($1::uuid[]) AND state<>'confirmed' LIMIT 1",
          [owners],
        )
      ).rowCount;
      await db.query(
        "UPDATE accounts SET signing_key=NULL,encryption_key=NULL,wallet_origin=NULL,erasure_state='erased',erased_at=now() WHERE id=ANY($1::uuid[]) AND erasure_state='pending'",
        [owners],
      );
      const current = OperationRow.parse(
        (await db.query('SELECT * FROM account_exit_operations WHERE id=$1', [operationId]))
          .rows[0],
      );
      const components = current.components.map((component) =>
        component.id === 'hosted'
          ? { ...component, state: 'confirmed' as const, reason: 'HOSTED_IDENTITY_ERASED' }
          : component.id === 'profiles'
            ? {
                ...component,
                state: profileState,
                reason:
                  profileState === 'confirmed'
                    ? 'CONTROLLED_ENVELOPES_REMOVED'
                    : 'PROFILE_EXCLUSIONS_REQUIRED',
              }
            : component,
      );
      for (const closure of hostedClosures) {
        const position = components.findIndex((c) => c.id === closure.id);
        if (position < 0) components.push(closure);
        else components[position] = closure;
      }
      if (recovery && !components.some((c) => c.id === 'recovery-provider'))
        components.push({
          id: 'recovery-provider',
          state: 'unavailable',
          reason: 'PROVIDER_OBJECT_DELETION_PENDING',
        });
      if (!recovery) {
        const provider = components.find((c) => c.id === 'recovery-provider');
        if (provider && provider.reason !== 'PROVIDER_RECONCILIATION_WINDOW_EXPIRED') {
          provider.state = 'confirmed';
          provider.reason = 'CONTROLLED_PROVIDER_PINS_REMOVED';
        }
      }
      await db.query('UPDATE account_exit_operations SET components=$2 WHERE id=$1', [
        operationId,
        JSON.stringify(components),
      ]);
      return profileState === 'pending' ||
        recovery ||
        hostedClosures.some((c) => c.state !== 'confirmed')
        ? 'retry'
        : 'completed';
    });
  }
  async cleanup() {
    await this.configuration.appCleanup?.cleanupExpired();
    await this.pool.query(
      'DELETE FROM account_exit_app_subjects WHERE ctid IN(SELECT s.ctid FROM account_exit_app_subjects s JOIN account_exit_operations o ON o.id=s.operation_id WHERE o.expires_at<=now() LIMIT 25)',
    );
    await this.configuration.exclusions?.cleanup();
    await withTransaction(this.pool, async (db) => {
      const ids = (
        await db.query<{ id: string }>(
          "SELECT id FROM account_exit_operations WHERE expires_at<=now() AND (mode='leave-all' OR EXISTS(SELECT 1 FROM jsonb_array_elements(components)c WHERE c->>'id'='hosted' AND c->>'state'='confirmed')) ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT 25",
        )
      ).rows.map((row) => row.id);
      if (ids.length) {
        await db.query(
          "DELETE FROM jobs WHERE module_id='core-account-exit' AND payload->>'operationId'=ANY($1::text[])",
          [ids],
        );
        await db.query('DELETE FROM account_exit_operations WHERE id=ANY($1::uuid[])', [ids]);
      }
      const expiredOwners = (
        await db.query<{ account_id: string }>(
          "SELECT account_id FROM recovery_object_cleanup WHERE expires_at<=now() AND state<>'confirmed' ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 25",
        )
      ).rows.map((item) => item.account_id);
      if (expiredOwners.length)
        await db.query(
          "UPDATE account_exit_operations o SET components=(SELECT jsonb_agg(CASE WHEN c->>'id'='recovery-provider' THEN c||jsonb_build_object('state','unavailable','reason','PROVIDER_RECONCILIATION_WINDOW_EXPIRED') ELSE c END) FROM jsonb_array_elements(o.components)c) WHERE EXISTS(SELECT 1 FROM account_exit_scope s WHERE s.operation_id=o.id AND s.account_id=ANY($1::uuid[]))",
          [expiredOwners],
        );
      const references = ErasureInventory.map(
        (item) => 'NOT EXISTS(SELECT 1 FROM ' + item.table + ' WHERE ' + item.column + '=a.id)',
      ).join(' AND ');
      await assertErasureInventory(db);
      await db.query(
        "DELETE FROM accounts WHERE id IN(SELECT a.id FROM accounts a WHERE a.erasure_state='erased' AND a.erased_at<now()-($1::int*interval '1 second') AND " +
          references +
          ' ORDER BY (a.merged_into IS NULL),a.id LIMIT 25)',
        [this.configuration.backupRetentionSeconds],
      );
      await db.query(
        "DELETE FROM recovery_object_cleanup WHERE receipt_hash IN(SELECT receipt_hash FROM recovery_object_cleanup WHERE (state='confirmed' AND created_at<now()-interval '1 day') OR (expires_at<=now() AND account_id=ANY($1::uuid[])) LIMIT 25)",
        [expiredOwners],
      );
    });
  }
  async submitNativeStep(operationId: string, stepId: string, input: unknown): Promise<ExitReport> {
    z.uuid().parse(operationId);
    z.string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .parse(stepId);
    const signed = SignedExitInstructionSchema.parse(input),
      request = signed.request;
    if (
      signed.operation !== exitOperationCommitment(operationId) ||
      signed.step_digest !== exitStepCommitment(operationId, stepId, request)
    )
      throw new ApiError('EXIT_STEP_CONTEXT', 403);
    const action = z.enum(ExitCoreActions).parse(request.action);
    if (['withdraw', 'unstake'].includes(action))
      throw new ApiError('EXIT_SETTLEMENT_SEPARATE', 403);
    const decoded = z
      .record(z.string(), z.unknown())
      .parse(
        Serializer.objectify(
          Serializer.decode({ abi: runtimeAbi, type: action, data: request.data }),
        ),
      );
    for (const field of runtimeAbi.structs.find((value) => value.name === action)?.fields ?? []) {
      const value = decoded[field.name];
      if (
        ['uint64', 'int64'].includes(field.type) &&
        typeof value === 'number' &&
        Number.isSafeInteger(value)
      )
        decoded[field.name] = String(value);
    }
    if ('actor' in decoded) {
      const actor = z.record(z.string(), z.unknown()).parse(decoded.actor);
      for (const field of ['dao_id', 'member_id']) {
        const value = actor[field];
        if (typeof value === 'number' && Number.isSafeInteger(value)) actor[field] = String(value);
      }
      decoded.actor = actor;
    }
    const params = RuntimeActionSchemas[action].parse(decoded);
    const context = 'actor' in params ? params.actor : params;
    if (
      Serializer.encode({ abi: runtimeAbi, type: action, object: params }).hexString !==
      request.data
    )
      throw new ApiError('EXIT_PAYLOAD', 403);
    if (
      !this.chain.prepareExitSubmission ||
      !this.chain.submitPreparedExit ||
      !this.chain.reconcileExitSubmission
    )
      throw new ApiError('EXIT_NATIVE_STEP_UNAVAILABLE', 503);
    const prepared = await withTransaction(this.pool, async (db) => {
      const row = OperationRow.parse(
        (
          await db.query(
            'SELECT * FROM account_exit_operations WHERE id=$1 AND expires_at>now() FOR UPDATE',
            [operationId],
          )
        ).rows[0],
      );
      let choice = row.intent.memberships.find(
        (member) =>
          member.chainId === request.chain_id &&
          member.runtime === request.deployment &&
          member.daoId === request.dao_id &&
          member.memberId === request.member_id,
      );
      if (!choice && action === 'delprofile' && row.mode === 'delete-account') {
        const context = [
          request.chain_id,
          request.deployment,
          request.dao_id,
          request.member_id,
        ].join(':');
        if (
          (
            await db.query(
              'SELECT 1 FROM account_exit_memberships WHERE operation_id=$1 AND context=$2',
              [operationId, context],
            )
          ).rowCount
        )
          choice = {
            chainId: request.chain_id,
            runtime: request.deployment,
            daoId: request.dao_id,
            memberId: request.member_id,
            choice: 'leave',
          };
      }
      if (
        !choice ||
        request.target !== request.deployment ||
        context.runtime !== request.deployment ||
        context.dao_id !== request.dao_id ||
        context.member_id !== request.member_id
      )
        throw new ApiError('EXIT_MEMBERSHIP', 403);
      const allowed =
        choice.choice === 'close'
          ? ['startclose', 'closedao', 'leave', 'delprofile']
          : choice.choice === 'handover'
            ? ['beginhand', 'scanhand', 'leave', 'delprofile']
            : ['leave', 'delprofile'];
      if (
        (!allowed.includes(action) && action !== 'startclose') ||
        (action === 'delprofile' && row.mode !== 'delete-account')
      )
        throw new ApiError('EXIT_ACTION', 403);
      if (
        action === 'beginhand' &&
        RuntimeActionSchemas.beginhand.parse(params).departing !== choice.memberId
      )
        throw new ApiError('EXIT_HANDOVER', 403);
      const existing = (
        await db.query('SELECT * FROM account_exit_steps WHERE operation_id=$1 AND id=$2', [
          operationId,
          stepId,
        ])
      ).rows[0];
      if (existing) {
        const value = z
          .object({
            digest: z.string(),
            instruction: z.object({
              signed: SignedExitInstructionSchema,
              submission: ExitSubmissionSchema,
            }),
            state: z.string(),
          })
          .parse(existing);
        if (
          value.digest !== signed.step_digest ||
          JSON.stringify(value.instruction.signed) !== JSON.stringify(signed)
        )
          throw new ApiError('EXIT_STEP_CHANGED', 409);
        return {
          submission: value.instruction.submission,
          new: false,
          confirmed: value.state === 'confirmed',
        };
      }
      const count = (
        await db.query<{ count: string }>(
          'SELECT count(*) FROM account_exit_steps WHERE operation_id=$1',
          [operationId],
        )
      ).rows[0];
      if (Number(count?.count ?? 0) >= 1024) throw new ApiError('EXIT_STEP_LIMIT', 409);
      const prepare = this.chain.prepareExitSubmission;
      if (!prepare) throw new ApiError('EXIT_NATIVE_STEP_UNAVAILABLE', 503);
      const submission = await prepare.call(this.chain, signed);
      await db.query(
        "INSERT INTO account_exit_steps(operation_id,id,descriptor,digest,instruction,transaction_id,state) VALUES($1,$2,$3,$4,$5,$6,'submitted')",
        [
          operationId,
          stepId,
          {
            action,
            chainId: request.chain_id,
            runtime: request.deployment,
            daoId: request.dao_id,
            memberId: request.member_id,
          },
          signed.step_digest,
          { signed, submission },
          submission.transactionId,
        ],
      );
      return { submission, new: true, confirmed: false };
    });
    let confirmed = prepared.confirmed;
    if (!confirmed) {
      const result = await this.chain
        .reconcileExitSubmission(prepared.submission)
        .catch(() => ({ state: 'unavailable' as const, cursor: prepared.submission.cursor }));
      confirmed = result.state === 'confirmed';
      if (
        !confirmed &&
        (prepared.new ||
          (result.state === 'pending' && Date.parse(prepared.submission.expiresAt) > Date.now()))
      )
        try {
          const receipt = await this.chain.submitPreparedExit(prepared.submission);
          if (receipt.transactionId !== prepared.submission.transactionId)
            throw new ApiError('EXIT_RECEIPT', 503);
          confirmed = true;
        } catch {
          /* An uncertain delivery is reconciled by exact ID; no replacement nonce/event is signed. */
        }
      await this.pool.query(
        "UPDATE account_exit_steps SET state=$3,instruction=jsonb_set(instruction,'{submission,cursor}',$4::jsonb) WHERE operation_id=$1 AND id=$2 AND state<>'confirmed'",
        [
          operationId,
          stepId,
          confirmed ? 'confirmed' : 'unavailable',
          JSON.stringify(result.cursor),
        ],
      );
    }
    return withTransaction(this.pool, async (db) => {
      const row = OperationRow.parse(
        (
          await db.query('SELECT * FROM account_exit_operations WHERE id=$1 FOR UPDATE', [
            operationId,
          ])
        ).rows[0],
      );
      await this.recordClosureReceipts(db, row);
      const complete = z
        .array(
          z.object({
            descriptor: z.object({
              chainId: z.string(),
              runtime: z.string(),
              daoId: z.string(),
              memberId: z.string(),
              action: z.string(),
            }),
          }),
        )
        .parse(
          (
            await db.query(
              "SELECT descriptor FROM account_exit_steps WHERE operation_id=$1 AND state='confirmed'",
              [operationId],
            )
          ).rows,
        );
      const all = row.intent.memberships.every((member) =>
        complete.some(
          (step) =>
            step.descriptor.action === 'leave' &&
            step.descriptor.chainId === member.chainId &&
            step.descriptor.runtime === member.runtime &&
            step.descriptor.daoId === member.daoId &&
            step.descriptor.memberId === member.memberId,
        ),
      );
      const profileContext =
        'native-profile:' +
        [request.chain_id, request.deployment, request.dao_id, request.member_id].join(':');
      const membershipContext =
        'membership:' +
        [request.chain_id, request.deployment, request.dao_id, request.member_id].join(':');
      const components = row.components.map((component) =>
        confirmed && action === 'leave' && component.id === membershipContext
          ? { ...component, state: 'confirmed' as const, reason: 'SIGNED_DEPARTURE_CONFIRMED' }
          : confirmed && action === 'delprofile' && component.id === profileContext
            ? {
                ...component,
                state: 'confirmed' as const,
                reason: 'CURRENT_NATIVE_PROFILE_ROW_REMOVED',
              }
            : component.id === 'native'
              ? {
                  ...component,
                  state: all ? ('confirmed' as const) : ('pending' as const),
                  reason: all ? 'SIGNED_DEPARTURES_CONFIRMED' : 'NATIVE_STEPS_PENDING',
                }
              : component,
      );
      const state = components.every((component) =>
        ['confirmed', 'retained'].includes(component.state),
      )
        ? 'complete'
        : 'processing';
      await db.query('UPDATE account_exit_operations SET components=$2,state=$3 WHERE id=$1', [
        operationId,
        JSON.stringify(components),
        state,
      ]);
      return report({ ...row, components, state });
    });
  }
}
