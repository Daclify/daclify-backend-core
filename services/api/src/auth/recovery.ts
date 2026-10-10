import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { Pool, PoolClient } from 'pg';
import type { Account } from '../../../../protocol/api.js';
import {
  RecoveryBackupSchema,
  RecoveryEnrollSchema,
  RecoveryMethodsSchema,
  RecoveryDisableSchema,
  RecoveryMethodSchema,
  RecoveryClaimSchema,
  RecoveryGrantSchema,
  RecoveryAssistedOptionsSchema,
  RecoveryAssistedConsentSchema,
  recoveryVaultDomain,
  DeviceRecoveryRequestSchema,
  DeviceRecoveryPayloadSchema,
  RecoveryRoutes,
  type RecoveryBackup,
  type RecoveryMethods,
  type RecoveryMethod,
} from '../../../../protocol/recovery.js';
import type { ChainGateway } from '../chain.js';
import { ApiError } from '../errors.js';
import { readAccount, withTransaction } from './account-session.js';
import {
  EncryptionPrivateKeySchema,
  EncryptionPublicKeySchema,
} from '../../../../protocol/crypto.js';
import {
  createRecoveryRecipient,
  openRecoveryDelivery,
  sealRecoveryDelivery,
  recoveryDeviceFingerprint,
} from '../../../../sdk/recovery.js';
import {
  RECOVERY_TRANSIT_KEY,
  wrapRecoveryKey,
  unwrapRecoveryKey,
  type RecoveryKeyProvider,
} from './recovery-storage.js';

export const RecoveryReceiptSchema = z.strictObject({
  storeId: z.string().min(1).max(128),
  reference: z.string().min(1).max(1024),
  commitment: z.string().regex(/^[0-9a-f]{64}$/),
  verifiedAt: z.iso.datetime(),
});
export type RecoveryReceipt = z.infer<typeof RecoveryReceiptSchema>;
export interface RecoveryBackupStore {
  write(record: RecoveryBackup): Promise<RecoveryReceipt>;
  read(receipt: RecoveryReceipt): Promise<RecoveryBackup>;
}
export interface RecoveryConfiguration {
  store: RecoveryBackupStore;
  qualifiedWallets: readonly ('evm' | 'native')[];
  passkeysQualified: boolean;
  assistedQualified: boolean;
  keys?: RecoveryKeyProvider;
  expiresAt?: number;
}
const hash = (value: string) => createHash('sha256').update(value).digest();
export const recoveryCommitment = (record: RecoveryBackup): string =>
  hash(JSON.stringify(RecoveryBackupSchema.parse(record))).toString('hex');
interface MethodRow {
  record: unknown;
  receipt: unknown;
}
interface SessionRow {
  account_id: string;
  credential_key: string | null;
}

export class RecoveryService {
  constructor(
    private readonly pool: Pool,
    private readonly chain: ChainGateway,
    private readonly configuration?: RecoveryConfiguration,
  ) {}

  private async credentials(db: Pool | PoolClient, accountId: string): Promise<RecoveryMethod[]> {
    const rows = await db.query<{
      credential_key: string;
      kind: string;
      subject: string;
      chain_id: string | null;
    }>(
      `
      SELECT provider_key AS credential_key,split_part(provider_key,':',1) AS kind,
        substring(provider_key from position(':' in provider_key)+1) AS subject,NULL::text AS chain_id
        FROM credentials WHERE account_id=$1
      UNION ALL SELECT 'passkey:'||regexp_replace(translate(encode(credential_id,'base64'),'+/','-_'),'[=\\n\\r]','','g'),
        'passkey',regexp_replace(translate(encode(credential_id,'base64'),'+/','-_'),'[=\\n\\r]','','g'),NULL FROM passkeys WHERE account_id=$1
      UNION ALL SELECT 'native:'||chain_id||':'||native_account,'native',native_account,chain_id FROM native_links WHERE account_id=$1
      UNION ALL SELECT 'evm:'||chain_id||':'||address,'evm',address,chain_id::text FROM evm_links WHERE account_id=$1 AND control_verified_at IS NOT NULL
      LIMIT 65`,
      [accountId],
    );
    if (rows.rows.length > 64) throw new ApiError('RECOVERY_METHOD_LIMIT', 409);
    return rows.rows.map((row) =>
      RecoveryMethodSchema.parse({
        credentialKey: row.credential_key,
        kind: row.kind,
        subject: row.subject,
        chainId: row.chain_id,
        mode: null,
        availableModes: [],
        reason: null,
      }),
    );
  }
  private modes(method: RecoveryMethod): RecoveryMethod['availableModes'] {
    const config = this.configuration;
    if (!config || (config.expiresAt !== undefined && config.expiresAt <= Date.now())) return [];
    const modes: RecoveryMethod['availableModes'] = [];
    if (
      (method.kind === 'evm' || method.kind === 'native') &&
      config.qualifiedWallets.includes(method.kind)
    )
      modes.push('wallet-protected');
    if (method.kind === 'passkey' && config.passkeysQualified) modes.push('passkey-protected');
    if (config.assistedQualified && config.keys) modes.push('daclify-assisted');
    return modes;
  }
  async methods(account: Account): Promise<RecoveryMethods> {
    const methods = await this.credentials(this.pool, account.id);
    const records = await this.pool.query<{ credential_key: string; mode: string }>(
      'SELECT credential_key,CASE WHEN quarantined THEN NULL ELSE mode END AS mode FROM vault_recovery_methods WHERE account_id=$1',
      [account.id],
    );
    const state = await this.pool.query<{ assisted_ever: boolean }>(
      'SELECT assisted_ever FROM vault_recovery_state WHERE account_id=$1',
      [account.id],
    );
    return RecoveryMethodsSchema.parse({
      methods: methods.map((method) => ({
        ...method,
        mode: records.rows.find((row) => row.credential_key === method.credentialKey)?.mode ?? null,
        availableModes: this.modes(method),
        reason: this.modes(method).length
          ? null
          : 'Full access is unavailable until recovery storage and this method are qualified.',
      })),
      assistedEver: state.rows[0]?.assisted_ever ?? false,
      configured: Boolean(this.configuration),
      reason: this.configuration
        ? null
        : 'Independent encrypted recovery storage has not been configured.',
    });
  }
  private async owned(db: PoolClient, accountId: string, key: string): Promise<boolean> {
    const [kind, ...parts] = key.split(':');
    if (kind === 'evm' || kind === 'native') {
      const chain = parts.shift(),
        subject = parts.join(':');
      if (!chain || !subject) return false;
      const result =
        kind === 'evm'
          ? await db.query(
              'SELECT 1 FROM evm_links WHERE account_id=$1 AND chain_id::text=$2 AND address=$3 AND control_verified_at IS NOT NULL FOR SHARE',
              [accountId, chain, subject],
            )
          : await db.query(
              'SELECT 1 FROM native_links WHERE account_id=$1 AND chain_id=$2 AND native_account=$3 FOR SHARE',
              [accountId, chain, subject],
            );
      return result.rowCount === 1;
    }
    if (kind === 'passkey') {
      const result = await db.query(
        'SELECT 1 FROM passkeys WHERE account_id=$1 AND credential_id=$2 FOR SHARE',
        [accountId, Buffer.from(parts.join(':'), 'base64url')],
      );
      return result.rowCount === 1;
    }
    return (
      (
        await db.query(
          'SELECT 1 FROM credentials WHERE account_id=$1 AND provider_key=$2 FOR SHARE',
          [accountId, key],
        )
      ).rowCount === 1
    );
  }
  private identity(account: Account, record: Pick<RecoveryBackup, 'context'>): void {
    const context = record.context;
    if (
      context.accountId !== account.id ||
      context.signingPublicKey !== account.signingKey ||
      !isDeepStrictEqual(context.encryptionPublicKey, account.encryptionKey)
    )
      throw new ApiError('RECOVERY_IDENTITY_MISMATCH', 409);
  }
  private async assistedPolicy(account: Account, db: Pool | PoolClient): Promise<void> {
    try {
      const memberships = await this.chain.memberships(account);
      const historical = await db.query<{ chain_id: string; contract: string; dao_id: string }>(
        'SELECT chain_id,contract,dao_id::text FROM memberships WHERE account_id=$1',
        [account.id],
      );
      const references = [
        ...memberships.map((member) => member.dao),
        ...historical.rows.map((row) => ({
          chainId: row.chain_id,
          contract: row.contract,
          daoId: row.dao_id,
        })),
      ];
      for (const reference of references) {
        const dao = await this.chain.dao(reference.daoId);
        if (
          dao.reference.chainId !== reference.chainId ||
          dao.reference.contract !== reference.contract ||
          dao.reference.daoId !== reference.daoId
        )
          throw new ApiError('RECOVERY_POLICY_UNAVAILABLE', 503);
        if (dao.privacy === 'encrypted-user-controlled') throw new ApiError('CUSTODY_POLICY', 403);
      }
      const pending = await db.query(
        "SELECT 1 FROM creation_orders WHERE account_id=$1 AND request->'request'->>'privacy'='encrypted-user-controlled' AND NOT (request->'request' ? 'foundingAgent') LIMIT 1",
        [account.id],
      );
      if (pending.rowCount) throw new ApiError('CUSTODY_POLICY', 403);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('RECOVERY_POLICY_UNAVAILABLE', 503);
    }
  }
  private backupDomain(record: RecoveryBackup['context']): string {
    return 'backup:' + hash(recoveryVaultDomain(record)).toString('hex');
  }
  private handoffDomain(
    id: string,
    accountId: string,
    token: string,
    origin: string,
    context: RecoveryBackup['context'],
  ): string {
    return `handoff:${id}:${accountId}:${hash(token).toString('hex')}:${origin}:${hash(recoveryVaultDomain(context)).toString('hex')}`;
  }
  async assistedOptions(account: Account, token: string, origin: string, input: unknown) {
    const consent = RecoveryAssistedConsentSchema.parse(input);
    const config = this.configuration;
    if (!config?.assistedQualified || !config.keys)
      throw new ApiError('RECOVERY_ASSISTED_UNAVAILABLE', 503);
    const keys = config.keys;
    if (consent.context.origin !== origin) throw new ApiError('ORIGIN_REJECTED', 403);
    return withTransaction(this.pool, async (db) => {
      await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [account.id]);
      const current = await readAccount(db, account.id);
      if (!current) throw new ApiError('AUTH_REQUIRED', 401);
      this.identity(current, consent);
      const method = (await this.credentials(db, account.id)).find(
        (value) => value.credentialKey === consent.context.credentialKey,
      );
      if (!method || !(await this.owned(db, account.id, method.credentialKey)))
        throw new ApiError('RECOVERY_METHOD_INVALID', 403);
      if (!this.modes(method).includes('daclify-assisted'))
        throw new ApiError('RECOVERY_METHOD_UNAVAILABLE', 503);
      await this.assistedPolicy(current, db);
      const recipient = await createRecoveryRecipient(),
        id = crypto.randomUUID();
      const domain = this.handoffDomain(id, account.id, token, origin, consent.context);
      const bytes = Buffer.from(JSON.stringify({ domain, privateKey: recipient.privateKey }));
      let wrapped: string;
      try {
        wrapped = await keys.wrap(RECOVERY_TRANSIT_KEY, bytes);
      } catch {
        throw new ApiError('RECOVERY_CUSTODY_UNAVAILABLE', 503);
      } finally {
        bytes.fill(0);
      }
      const row = await db.query<{ expires_at: Date }>(
        `INSERT INTO vault_recovery_handoffs(id,account_id,session_hash,origin,private_wrap,recipient,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,now()+interval '5 minutes') RETURNING expires_at`,
        [id, account.id, hash(token), origin, wrapped, recipient.publicKey],
      );
      // Commit the authority disclosure before a subsequent request can deliver an original unlocking key.
      await db.query(
        'INSERT INTO vault_recovery_state(account_id,assisted_ever) VALUES($1,true) ON CONFLICT(account_id) DO UPDATE SET assisted_ever=true',
        [account.id],
      );
      await db.query(
        "INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'recovery.assisted-authorized',$2)",
        [account.id, { credentialKey: method.credentialKey, backupId: consent.context.id }],
      );
      await db.query('DELETE FROM vault_recovery_handoffs WHERE expires_at<=now()');
      return RecoveryAssistedOptionsSchema.parse({
        id,
        recipient: recipient.publicKey,
        expires: row.rows[0]?.expires_at.toISOString(),
      });
    });
  }
  async enroll(
    account: Account,
    input: unknown,
    origin: string,
    token: string,
  ): Promise<RecoveryMethods> {
    const enrollment = RecoveryEnrollSchema.parse(input),
      config = this.configuration;
    if (!config) throw new ApiError('RECOVERY_UNAVAILABLE', 503);
    if (enrollment.context.origin !== origin) throw new ApiError('ORIGIN_REJECTED', 403);
    await withTransaction(this.pool, async (db) => {
      await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [account.id]);
      const current = await readAccount(db, account.id);
      if (!current) throw new ApiError('AUTH_REQUIRED', 401);
      this.identity(current, enrollment);
      const method = (await this.credentials(db, account.id)).find(
        (m) => m.credentialKey === enrollment.context.credentialKey,
      );
      if (!method || !(await this.owned(db, account.id, method.credentialKey)))
        throw new ApiError('RECOVERY_METHOD_INVALID', 403);
      if (!this.modes(method).includes(enrollment.context.mode))
        throw new ApiError('RECOVERY_METHOD_UNAVAILABLE', 503);
      let keyWrap: RecoveryBackup['keyWrap'];
      if (enrollment.context.mode === 'daclify-assisted') {
        if (!config.assistedQualified || !config.keys || !enrollment.assistedHandoff)
          throw new ApiError('RECOVERY_ASSISTED_UNAVAILABLE', 503);
        await this.assistedPolicy(current, db);
        const handoff = enrollment.assistedHandoff;
        const retained = (
          await db.query<{ private_wrap: string }>(
            'DELETE FROM vault_recovery_handoffs WHERE id=$1 AND account_id=$2 AND session_hash=$3 AND origin=$4 AND expires_at>now() RETURNING private_wrap',
            [handoff.id, account.id, hash(token), origin],
          )
        ).rows[0];
        if (!retained) throw new ApiError('RECOVERY_HANDOFF_INVALID', 401);
        let bytes: Uint8Array | undefined, key: Uint8Array | undefined;
        try {
          bytes = await config.keys.unwrap(RECOVERY_TRANSIT_KEY, retained.private_wrap);
          const decoded = z
            .strictObject({ domain: z.string(), privateKey: EncryptionPrivateKeySchema })
            .parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
          if (
            decoded.domain !==
            this.handoffDomain(handoff.id, account.id, token, origin, enrollment.context)
          )
            throw new Error('Changed handoff');
          key = await openRecoveryDelivery(
            handoff.keyGrant,
            decoded.privateKey,
            `enroll:${handoff.id}:${recoveryVaultDomain(enrollment.context)}`,
          );
          keyWrap = {
            kind: 'service',
            ciphertext: await wrapRecoveryKey(
              config.keys,
              key,
              this.backupDomain(enrollment.context),
            ),
          };
        } catch {
          throw new ApiError('RECOVERY_HANDOFF_INVALID', 503);
        } finally {
          bytes?.fill(0);
          key?.fill(0);
        }
      } else {
        if (!enrollment.clientKeyWrap) throw new ApiError('INPUT_INVALID', 400);
        keyWrap = { kind: 'client', envelope: enrollment.clientKeyWrap };
      }
      const record = RecoveryBackupSchema.parse({
        context: enrollment.context,
        envelope: enrollment.envelope,
        keyWrap,
      });
      this.identity(current, record);
      let receipt: RecoveryReceipt;
      try {
        receipt = RecoveryReceiptSchema.parse(await config.store.write(record));
        const retained = RecoveryBackupSchema.parse(await config.store.read(receipt));
        if (
          receipt.commitment !== recoveryCommitment(record) ||
          recoveryCommitment(retained) !== receipt.commitment
        )
          throw new Error('Unverified recovery copy');
      } catch {
        throw new ApiError('RECOVERY_BACKUP_UNAVAILABLE', 503);
      }
      await db.query(
        'DELETE FROM vault_recovery_grants WHERE account_id=$1 AND credential_key=$2',
        [account.id, method.credentialKey],
      );
      await db.query(
        `INSERT INTO vault_recovery_methods(account_id,credential_key,backup_id,mode,origin,record,receipt)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(account_id,credential_key) DO UPDATE SET
        backup_id=excluded.backup_id,mode=excluded.mode,origin=excluded.origin,record=excluded.record,receipt=excluded.receipt,created_at=now(),quarantined=false`,
        [
          account.id,
          method.credentialKey,
          record.context.id,
          record.context.mode,
          origin,
          record,
          receipt,
        ],
      );
      if (record.context.mode === 'daclify-assisted')
        await db.query(
          'INSERT INTO vault_recovery_state(account_id,assisted_ever) VALUES($1,true) ON CONFLICT(account_id) DO UPDATE SET assisted_ever=true',
          [account.id],
        );
      await db.query(
        "INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'recovery.enabled',$2)",
        [
          account.id,
          {
            credentialKey: method.credentialKey,
            mode: record.context.mode,
            backupId: record.context.id,
          },
        ],
      );
    });
    return this.methods(account);
  }
  async disable(account: Account, input: unknown): Promise<RecoveryMethods> {
    const request = RecoveryDisableSchema.parse(input);
    await withTransaction(this.pool, async (db) => {
      await db.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [account.id]);
      const rows = await db.query<{ credential_key: string }>(
        'SELECT credential_key FROM vault_recovery_methods WHERE account_id=$1 AND NOT quarantined FOR UPDATE',
        [account.id],
      );
      if (
        rows.rows.some((m) => m.credential_key === request.credentialKey) &&
        rows.rowCount === 1 &&
        !request.keepKitFallback
      )
        throw new ApiError('RECOVERY_FALLBACK_REQUIRED', 409);
      await db.query(
        'DELETE FROM vault_recovery_methods WHERE account_id=$1 AND credential_key=$2',
        [account.id, request.credentialKey],
      );
      await db.query(
        "INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,'recovery.disabled',$2)",
        [account.id, { credentialKey: request.credentialKey }],
      );
    });
    return this.methods(account);
  }
  async issueLoginGrant(token: string, origin: string): Promise<string | null> {
    if (!this.configuration) return null;
    return withTransaction(this.pool, async (db) => {
      const session = (
        await db.query<SessionRow>(
          'SELECT account_id,credential_key FROM sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() FOR SHARE',
          [hash(token)],
        )
      ).rows[0];
      if (!session?.credential_key) return null;
      const row = (
        await db.query<MethodRow>(
          'SELECT record,receipt FROM vault_recovery_methods WHERE account_id=$1 AND credential_key=$2 AND origin=$3 AND NOT quarantined FOR SHARE',
          [session.account_id, session.credential_key, origin],
        )
      ).rows[0];
      if (!row || !(await this.owned(db, session.account_id, session.credential_key))) return null;
      const record = RecoveryBackupSchema.parse(row.record);
      const method = (await this.credentials(db, session.account_id)).find(
        (m) => m.credentialKey === session.credential_key,
      );
      if (!method || !this.modes(method).includes(record.context.mode)) return null;
      const grant = randomBytes(32).toString('base64url');
      await db.query(
        'DELETE FROM vault_recovery_grants WHERE session_hash=$1 OR expires_at<=now()',
        [hash(token)],
      );
      await db.query(
        "INSERT INTO vault_recovery_grants(token_hash,session_hash,account_id,credential_key,backup_id,origin,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '5 minutes')",
        [
          hash(grant),
          hash(token),
          session.account_id,
          session.credential_key,
          record.context.id,
          origin,
        ],
      );
      return grant;
    });
  }
  private async grant(
    db: PoolClient,
    token: string,
    grant: string,
    origin: string,
    consume: boolean,
  ): Promise<RecoveryBackup | null> {
    const result = await db.query<MethodRow & { account_id: string; credential_key: string }>(
      `
      SELECT m.record,m.receipt,g.account_id,g.credential_key FROM vault_recovery_grants g
      JOIN sessions s ON s.token_hash=g.session_hash AND s.account_id=g.account_id AND s.credential_key=g.credential_key
      JOIN vault_recovery_methods m ON m.account_id=g.account_id AND m.credential_key=g.credential_key AND m.backup_id=g.backup_id AND NOT m.quarantined
      WHERE g.token_hash=$1 AND g.session_hash=$2 AND g.origin=$3 AND g.expires_at>now() AND s.expires_at>now() AND s.revoked_at IS NULL
      FOR UPDATE OF g FOR SHARE OF s,m`,
      [hash(grant), hash(token), origin],
    );
    const row = result.rows[0];
    if (!row || !(await this.owned(db, row.account_id, row.credential_key))) return null;
    const record = RecoveryBackupSchema.parse(row.record),
      account = await readAccount(db, row.account_id);
    if (!account) return null;
    this.identity(account, record);
    const method = (await this.credentials(db, row.account_id)).find(
      (m) => m.credentialKey === row.credential_key,
    );
    if (!method || !this.modes(method).includes(record.context.mode)) return null;
    if (!consume) return record;
    const receipt = RecoveryReceiptSchema.parse(row.receipt);
    try {
      const retained = RecoveryBackupSchema.parse(await this.configuration?.store.read(receipt));
      if (
        recoveryCommitment(retained) !== receipt.commitment ||
        recoveryCommitment(record) !== receipt.commitment
      )
        throw new Error('Changed recovery copy');
    } catch {
      throw new ApiError('RECOVERY_BACKUP_UNAVAILABLE', 503);
    }
    await db.query('DELETE FROM vault_recovery_grants WHERE token_hash=$1', [hash(grant)]);
    return record;
  }
  async validateLoginGrant(token: string, grant: string, origin: string): Promise<boolean> {
    if (!RecoveryGrantSchema.safeParse(grant).success) return false;
    return withTransaction(this.pool, async (db) =>
      Boolean(await this.grant(db, token, grant, origin, false)),
    );
  }
  async claim(token: string, input: unknown, origin: string) {
    const request = RecoveryClaimSchema.parse(input);
    return withTransaction(this.pool, async (db) => {
      const backup = await this.grant(db, token, request.grant, origin, true);
      if (!backup) throw new ApiError('RECOVERY_GRANT_INVALID', 401);
      if (backup.keyWrap.kind === 'client') return { backup, keyGrant: null };
      const config = this.configuration,
        account = await readAccount(db, backup.context.accountId);
      if (!config?.assistedQualified || !config.keys || !account)
        throw new ApiError('RECOVERY_ASSISTED_UNAVAILABLE', 503);
      await this.assistedPolicy(account, db);
      let key: Uint8Array | undefined;
      try {
        key = await unwrapRecoveryKey(
          config.keys,
          backup.keyWrap.ciphertext,
          this.backupDomain(backup.context),
        );
        const recipient = EncryptionPublicKeySchema.parse(request.recipient);
        return {
          backup,
          keyGrant: await sealRecoveryDelivery(
            key,
            recipient,
            'claim:' + recoveryVaultDomain(backup.context),
          ),
        };
      } catch {
        throw new ApiError('RECOVERY_CUSTODY_UNAVAILABLE', 503);
      } finally {
        key?.fill(0);
      }
    });
  }
  async deviceBegin(account: Account, token: string, input: unknown, origin: string) {
    const incoming = RecoveryRoutes.deviceRecoveryBegin.input.parse(input);
    if (!account.signingKey || !account.encryptionKey)
      throw new ApiError('VAULT_IDENTITY_REQUIRED', 409);
    const id = crypto.randomUUID(),
      pollToken = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + 300000).toISOString();
    const request = DeviceRecoveryRequestSchema.parse({
      version: 1,
      id,
      accountId: account.id,
      origin,
      recipient: incoming.recipient,
      fingerprint: await recoveryDeviceFingerprint(incoming.recipient),
      signingPublicKey: account.signingKey,
      encryptionPublicKey: account.encryptionKey,
      expires,
    });
    await this.pool.query('DELETE FROM vault_recovery_devices WHERE expires_at<=now()');
    await this.pool.query(
      'INSERT INTO vault_recovery_devices(id,account_id,session_hash,poll_hash,origin,request,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [id, account.id, hash(token), hash(pollToken), origin, request, expires],
    );
    return { request, pollToken };
  }
  async deviceRequest(account: Account, id: string, origin: string) {
    const row = (
      await this.pool.query<{ request: unknown }>(
        'SELECT request FROM vault_recovery_devices WHERE id=$1 AND account_id=$2 AND origin=$3 AND expires_at>now()',
        [z.uuid().parse(id), account.id, origin],
      )
    ).rows[0];
    if (!row) throw new ApiError('RECOVERY_DEVICE_INVALID', 401);
    const request = DeviceRecoveryRequestSchema.parse(row.request);
    if (
      request.signingPublicKey !== account.signingKey ||
      !isDeepStrictEqual(request.encryptionPublicKey, account.encryptionKey)
    )
      throw new ApiError('RECOVERY_IDENTITY_MISMATCH', 409);
    return request;
  }
  async deviceApprove(account: Account, input: unknown, origin: string) {
    const approval = RecoveryRoutes.deviceRecoveryApprove.input.parse(input);
    await withTransaction(this.pool, async (db) => {
      const row = (
        await db.query<{ request: unknown; payload: unknown; credential_key: string | null }>(
          `SELECT d.request,d.payload,s.credential_key FROM vault_recovery_devices d JOIN sessions s ON s.token_hash=d.session_hash
        WHERE d.id=$1 AND d.account_id=$2 AND d.origin=$3 AND d.expires_at>now() AND s.revoked_at IS NULL AND s.expires_at>now() FOR UPDATE OF d FOR SHARE OF s`,
          [approval.id, account.id, origin],
        )
      ).rows[0];
      if (!row) throw new ApiError('RECOVERY_DEVICE_INVALID', 401);
      if (row.credential_key && !(await this.owned(db, account.id, row.credential_key)))
        throw new ApiError('RECOVERY_DEVICE_INVALID', 401);
      const request = DeviceRecoveryRequestSchema.parse(row.request);
      if (request.fingerprint !== approval.fingerprint || row.payload !== null)
        throw new ApiError('RECOVERY_DEVICE_MISMATCH', 409);
      if (
        request.signingPublicKey !== account.signingKey ||
        !isDeepStrictEqual(request.encryptionPublicKey, account.encryptionKey)
      )
        throw new ApiError('RECOVERY_IDENTITY_MISMATCH', 409);
      await db.query('UPDATE vault_recovery_devices SET payload=$2 WHERE id=$1', [
        approval.id,
        approval.payload,
      ]);
    });
    return { approved: true as const };
  }
  async devicePoll(
    account: Account,
    token: string,
    input: unknown,
    origin: string,
    cancel = false,
  ) {
    const incoming = RecoveryRoutes.deviceRecoveryPoll.input.parse(input);
    return withTransaction(this.pool, async (db) => {
      const row = (
        await db.query<{ request: unknown; payload: unknown; credential_key: string | null }>(
          `SELECT d.request,d.payload,s.credential_key FROM vault_recovery_devices d JOIN sessions s ON s.token_hash=d.session_hash
        WHERE d.id=$1 AND d.account_id=$2 AND d.session_hash=$3 AND d.poll_hash=$4 AND d.origin=$5 AND d.expires_at>now() AND s.revoked_at IS NULL AND s.expires_at>now() FOR UPDATE OF d FOR SHARE OF s`,
          [incoming.id, account.id, hash(token), hash(incoming.pollToken), origin],
        )
      ).rows[0];
      if (!row) throw new ApiError('RECOVERY_DEVICE_INVALID', 401);
      if (row.credential_key && !(await this.owned(db, account.id, row.credential_key)))
        throw new ApiError('RECOVERY_DEVICE_INVALID', 401);
      const request = DeviceRecoveryRequestSchema.parse(row.request),
        payload = row.payload === null ? null : DeviceRecoveryPayloadSchema.parse(row.payload);
      if (
        request.signingPublicKey !== account.signingKey ||
        !isDeepStrictEqual(request.encryptionPublicKey, account.encryptionKey)
      )
        throw new ApiError('RECOVERY_IDENTITY_MISMATCH', 409);
      if (cancel || payload)
        await db.query('DELETE FROM vault_recovery_devices WHERE id=$1', [incoming.id]);
      return { request, payload };
    });
  }
}
