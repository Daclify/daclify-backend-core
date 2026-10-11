import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PublicKey, Signature } from '@wharfkit/antelope';
import { z } from 'zod';
import type { Pool, PoolClient } from 'pg';
import {
  SignupRoutes,
  SignupMessageSchema,
  SignupTicketSchema,
  SignupPreparedSchema,
  SignupAuthorizedSchema,
  signupDeliveryDomain,
} from '../../../../protocol/signup.js';
import {
  RecoveryContextSchema,
  RecoveryBackupSchema,
  recoveryVaultDomain,
} from '../../../../protocol/recovery.js';
import { EncryptionPrivateKeySchema } from '../../../../protocol/crypto.js';
import {
  createRecoveryRecipient,
  openRecoveryDelivery,
  openRecoveryPayload,
} from '../../../../sdk/recovery.js';
import { validEncryptionKey, cleanupSignupAttempts } from '../auth.js';
import { ApiError } from '../errors.js';
import { insertAccountSession, withTransaction, uniqueViolation } from './account-session.js';
import {
  RecoveryReceiptSchema,
  recoveryCommitment,
  type RecoveryConfiguration,
} from './recovery.js';
import { RECOVERY_TRANSIT_KEY, wrapRecoveryKey } from './recovery-storage.js';

const hash = (value: string) => createHash('sha256').update(value).digest();
interface Attempt {
  id: string;
  credential_key: string;
  planned_account_id: string;
  staged_account_id: string | null;
  context: unknown;
  message: string | null;
  private_wrap: string | null;
  recipient: unknown;
  expires_at: Date;
  authorized_at: Date | null;
  completed_at: Date | null;
}
export class SignupService {
  constructor(
    private readonly pool: Pool,
    private readonly origin: string,
    private readonly audience: string,
    private readonly configuration?: RecoveryConfiguration,
  ) {}
  available(): boolean {
    const config = this.configuration;
    return Boolean(
      config?.assistedQualified &&
      config.keys &&
      (config.expiresAt === undefined || config.expiresAt > Date.now()),
    );
  }
  notice(): string | null {
    if (!this.available())
      return 'Quick signup needs a configured recovery service and encrypted backups.';
    return this.configuration?.developmentOnly
      ? 'Testnet development recovery: the API and key service share one VM. Losing that VM may lose recovery; independent-host recovery has not been qualified.'
      : null;
  }
  private configured() {
    const config = this.configuration;
    if (!this.available() || !config?.keys)
      throw new ApiError('RECOVERY_ASSISTED_UNAVAILABLE', 503);
    return { ...config, keys: config.keys };
  }
  async verify(credentialKey: string, browser: Buffer, origin: string) {
    if (
      !/^(email|telegram):[^\u0000-\u001f\u007f]{1,255}$/.test(credentialKey) ||
      browser.length !== 32
    )
      throw new ApiError('PROVIDER_INVALID', 401);
    const existing = await this.pool.query<{ account_id: string }>(
      'SELECT account_id FROM credentials WHERE provider_key=$1',
      [credentialKey],
    );
    if (existing.rows[0])
      return withTransaction(this.pool, async (db) => {
        const row = (
          await db.query<{ account_id: string }>(
            'SELECT account_id FROM credentials WHERE provider_key=$1 FOR SHARE',
            [credentialKey],
          )
        ).rows[0];
        if (!row) throw new ApiError('PROVIDER_UNKNOWN', 401);
        return {
          status: 'existing' as const,
          ...(await insertAccountSession(db, row.account_id, credentialKey)),
        };
      });
    this.configured();
    if (origin !== this.origin) throw new ApiError('ORIGIN_REJECTED', 403);
    await cleanupSignupAttempts(this.pool);
    const id = randomUUID();
    const row = (
      await this.pool.query<{ expires_at: Date }>(
        "INSERT INTO quick_signup_attempts(id,credential_key,browser_hash,origin,planned_account_id,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes') RETURNING expires_at",
        [id, credentialKey, browser, origin, randomUUID()],
      )
    ).rows[0];
    return {
      status: 'pending' as const,
      ...SignupTicketSchema.parse({
        id,
        provider: credentialKey.startsWith('email:') ? 'email' : 'telegram',
        expires: row?.expires_at.toISOString(),
      }),
    };
  }
  private async attempt(
    db: Pool | PoolClient,
    id: string,
    browser: Buffer,
    origin: string,
    lock = false,
  ): Promise<Attempt> {
    const row = (
      await db.query<Attempt>(
        `SELECT * FROM quick_signup_attempts WHERE id=$1 AND browser_hash=$2 AND origin=$3 AND expires_at>now()${lock ? ' FOR UPDATE' : ''}`,
        [z.uuid().parse(id), browser, origin],
      )
    ).rows[0];
    if (!row) throw new ApiError('SIGNUP_ATTEMPT_INVALID', 401);
    return row;
  }
  async pending(id: string, browser: Buffer, origin: string) {
    const row = await this.attempt(this.pool, id, browser, origin);
    if (row.completed_at) throw new ApiError('SIGNUP_ALREADY_COMPLETE', 409);
    return SignupTicketSchema.parse({
      id: row.id,
      provider: row.credential_key.startsWith('email:') ? 'email' : 'telegram',
      expires: row.expires_at.toISOString(),
    });
  }
  async prepare(input: unknown, browser: Buffer, origin: string) {
    const request = SignupRoutes.signupPrepare.input.parse(input);
    this.configured();
    const encryption = validEncryptionKey(request.encryptionKey);
    return withTransaction(this.pool, async (db) => {
      const row = await this.attempt(db, request.id, browser, origin, true);
      if (row.completed_at) throw new ApiError('SIGNUP_ALREADY_COMPLETE', 409);
      if (row.message) {
        const message = SignupMessageSchema.parse(JSON.parse(row.message));
        if (
          message.signingKey !== request.signingKey ||
          !isDeepStrictEqual(message.encryptionKey, encryption)
        )
          throw new ApiError('SIGNUP_IDENTITY_CHANGED', 409);
        return SignupPreparedSchema.parse({
          id: row.id,
          message: row.message,
          expires: row.expires_at.toISOString(),
          context: row.context,
        });
      }
      const context = RecoveryContextSchema.parse({
        version: 1,
        id: randomUUID(),
        accountId: row.planned_account_id,
        origin,
        credentialKey: row.credential_key,
        mode: 'daclify-assisted',
        signingPublicKey: request.signingKey,
        encryptionPublicKey: encryption,
        salt: randomBytes(32).toString('base64'),
      });
      const message = JSON.stringify(
        SignupMessageSchema.parse({
          domain: 'daclify.signup.v1',
          id: row.id,
          accountId: row.planned_account_id,
          origin,
          audience: this.audience,
          expires: row.expires_at.toISOString(),
          signingKey: request.signingKey,
          encryptionKey: encryption,
          assistedConsent: true,
        }),
      );
      await db.query('UPDATE quick_signup_attempts SET context=$2,message=$3 WHERE id=$1', [
        row.id,
        context,
        message,
      ]);
      return SignupPreparedSchema.parse({
        id: row.id,
        message,
        expires: row.expires_at.toISOString(),
        context,
      });
    });
  }
  private context(row: Attempt, origin: string) {
    const context = RecoveryContextSchema.parse(row.context),
      message = SignupMessageSchema.parse(JSON.parse(row.message ?? ''));
    if (
      message.id !== row.id ||
      message.accountId !== row.planned_account_id ||
      message.origin !== origin ||
      message.audience !== this.audience ||
      message.expires !== row.expires_at.toISOString() ||
      context.accountId !== message.accountId ||
      context.origin !== origin ||
      context.credentialKey !== row.credential_key ||
      context.mode !== 'daclify-assisted' ||
      context.signingPublicKey !== message.signingKey ||
      !isDeepStrictEqual(context.encryptionPublicKey, message.encryptionKey)
    )
      throw new ApiError('SIGNUP_ATTEMPT_INVALID', 401);
    return context;
  }
  async authorize(input: unknown, browser: Buffer, origin: string) {
    const request = SignupRoutes.signupAuthorize.input.parse(input),
      config = this.configured();
    return withTransaction(this.pool, async (db) => {
      const row = await this.attempt(db, request.id, browser, origin, true),
        context = this.context(row, origin);
      let valid = false;
      try {
        valid = Signature.from(request.signature).verifyMessage(
          new TextEncoder().encode(row.message ?? ''),
          PublicKey.from(context.signingPublicKey),
        );
      } catch {
        valid = false;
      }
      if (!valid) throw new ApiError('AUTH_INVALID', 401);
      if (row.authorized_at)
        return SignupAuthorizedSchema.parse({
          id: row.id,
          recipient: row.recipient,
          expires: row.expires_at.toISOString(),
        });
      try {
        await db.query(
          "INSERT INTO accounts(id,signing_key,encryption_key,custody) VALUES($1,$2,$3,'user-controlled')",
          [context.accountId, context.signingPublicKey, context.encryptionPublicKey],
        );
      } catch (error) {
        if (uniqueViolation(error)) throw new ApiError('SIGNUP_IDENTITY_CHANGED', 409);
        throw error;
      }
      await db.query('INSERT INTO quick_signup_pending_accounts(account_id) VALUES($1)', [
        context.accountId,
      ]);
      await db.query('INSERT INTO vault_recovery_state(account_id,assisted_ever) VALUES($1,true)', [
        context.accountId,
      ]);
      await db.query(
        "INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'recovery.assisted-authorized',$2)",
        [
          context.accountId,
          { credentialKey: context.credentialKey, backupId: context.id, signupId: row.id },
        ],
      );
      const recipient = await createRecoveryRecipient(),
        domain = signupDeliveryDomain(row.id, context);
      const bytes = Buffer.from(JSON.stringify({ domain, privateKey: recipient.privateKey }));
      let wrapped: string;
      try {
        wrapped = await config.keys.wrap(RECOVERY_TRANSIT_KEY, bytes);
      } catch {
        throw new ApiError('RECOVERY_CUSTODY_UNAVAILABLE', 503);
      } finally {
        bytes.fill(0);
      }
      await db.query(
        'UPDATE quick_signup_attempts SET staged_account_id=$2,private_wrap=$3,recipient=$4,authorized_at=now() WHERE id=$1',
        [row.id, context.accountId, wrapped, recipient.publicKey],
      );
      // This transaction commits authority history before a later request delivers the backup key.
      return SignupAuthorizedSchema.parse({
        id: row.id,
        recipient: recipient.publicKey,
        expires: row.expires_at.toISOString(),
      });
    });
  }
  async finish(input: unknown, browser: Buffer, origin: string) {
    const request = SignupRoutes.signupFinish.input.parse(input),
      config = this.configured();
    return withTransaction(this.pool, async (db) => {
      const row = await this.attempt(db, request.id, browser, origin, true),
        context = this.context(row, origin);
      if (!row.authorized_at || row.staged_account_id !== context.accountId)
        throw new ApiError('SIGNUP_ATTEMPT_INVALID', 401);
      await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [context.accountId]);
      if (row.completed_at) {
        const credential = await db.query(
          'SELECT 1 FROM credentials WHERE provider_key=$1 AND account_id=$2 FOR SHARE',
          [context.credentialKey, context.accountId],
        );
        if (credential.rowCount !== 1) throw new ApiError('PROVIDER_UNKNOWN', 401);
        return insertAccountSession(db, context.accountId, context.credentialKey);
      }
      if (!row.private_wrap) throw new ApiError('SIGNUP_ATTEMPT_INVALID', 401);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        context.credentialKey,
      ]);
      const owner = (
        await db.query<{ account_id: string }>(
          'SELECT account_id FROM credentials WHERE provider_key=$1 FOR SHARE',
          [context.credentialKey],
        )
      ).rows[0];
      if (owner) throw new ApiError('CREDENTIAL_LINKED', 409);
      let bytes: Uint8Array | undefined, key: Uint8Array | undefined;
      try {
        bytes = await config.keys.unwrap(RECOVERY_TRANSIT_KEY, row.private_wrap);
        const handoff = z
          .strictObject({ domain: z.string().max(8192), privateKey: EncryptionPrivateKeySchema })
          .parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
        const domain = signupDeliveryDomain(row.id, context);
        if (handoff.domain !== domain) throw new ApiError('SIGNUP_ATTEMPT_INVALID', 401);
        key = await openRecoveryDelivery(request.keyGrant, handoff.privateKey, domain);
        const backup = RecoveryBackupSchema.parse({
          context,
          envelope: request.envelope,
          keyWrap: {
            kind: 'service',
            ciphertext: await wrapRecoveryKey(
              config.keys,
              key,
              'backup:' + hash(recoveryVaultDomain(context)).toString('hex'),
            ),
          },
        });
        await openRecoveryPayload(backup, key);
        let receipt;
        try {
          receipt = RecoveryReceiptSchema.parse(await config.store.write(backup));
          const retained = RecoveryBackupSchema.parse(await config.store.read(receipt));
          if (
            receipt.commitment !== recoveryCommitment(backup) ||
            recoveryCommitment(retained) !== receipt.commitment
          )
            throw new Error('Unverified recovery copy');
          await openRecoveryPayload(retained, key);
        } catch {
          throw new ApiError('RECOVERY_BACKUP_UNAVAILABLE', 503);
        }
        await db.query('INSERT INTO credentials(provider_key,account_id) VALUES($1,$2)', [
          context.credentialKey,
          context.accountId,
        ]);
        await db.query(
          'INSERT INTO vault_recovery_methods(account_id,credential_key,backup_id,mode,origin,record,receipt) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            context.accountId,
            context.credentialKey,
            context.id,
            context.mode,
            context.origin,
            backup,
            receipt,
          ],
        );
        await db.query(
          'UPDATE quick_signup_attempts SET completed_at=now(),private_wrap=NULL,recipient=NULL WHERE id=$1',
          [row.id],
        );
        await db.query('DELETE FROM quick_signup_pending_accounts WHERE account_id=$1', [
          context.accountId,
        ]);
        await db.query(
          "INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'recovery.enabled',$2)",
          [
            context.accountId,
            {
              credentialKey: context.credentialKey,
              backupId: context.id,
              mode: context.mode,
              signupId: row.id,
            },
          ],
        );
        return insertAccountSession(db, context.accountId, context.credentialKey);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (uniqueViolation(error)) throw new ApiError('CREDENTIAL_LINKED', 409);
        throw new ApiError('RECOVERY_KEY_MISMATCH', 400);
      } finally {
        bytes?.fill(0);
        key?.fill(0);
      }
    });
  }
}
