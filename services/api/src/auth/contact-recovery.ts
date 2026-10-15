import { isDeepStrictEqual } from 'node:util';
import type { Pool } from 'pg';
import type { ChainGateway } from '../chain.js';
import type { Challenge } from '../store.js';
import { ContactRecoveryRoutes } from '../../../../protocol/contact-recovery.js';
import { EncryptionPublicKeySchema } from '../../../../protocol/crypto.js';
import { withTransaction, insertAccountSession } from './account-session.js';
import { validEncryptionKey, verifyLoginChallenge } from '../auth.js';
import { ApiError } from '../errors.js';

export async function claimContactRecovery(
  pool: Pool,
  chain: Pick<ChainGateway, 'contactRecovery' | 'accountKeyRetired'>,
  input: unknown,
  origin: string,
  audience: string,
) {
  const request = ContactRecoveryRoutes.contactRecoveryClaim.input.parse(input),
    encryption = validEncryptionKey(request.encryptionKey);
  if (!chain.contactRecovery) throw new ApiError('CONTACT_RECOVERY_UNAVAILABLE', 503);
  const read = chain.contactRecovery.bind(chain);
  return withTransaction(pool, async (db) => {
    const state = await read(request.target);
    const result = state.result,
      member = state.member;
    if (
      !state.supported ||
      !result ||
      !member ||
      !state.identity ||
      state.identity.id !== result.identity_id ||
      state.identity.signing_key !== member.signing_key ||
      result.request.request_id !== request.requestId ||
      result.request.signing_key !== member.signing_key ||
      result.request.encryption_key !== member.encryption_key ||
      !isDeepStrictEqual(
        EncryptionPublicKeySchema.parse(JSON.parse(member.encryption_key)),
        encryption,
      )
    )
      throw new ApiError('CONTACT_RECOVERY_CHANGED', 409);
    if (await chain.accountKeyRetired?.(member.signing_key))
      throw new ApiError('CONTACT_RECOVERY_CHANGED', 409);
    const challenge = (
      await db.query<Challenge>(
        'SELECT id,signing_key,message,expires_at FROM challenges WHERE id=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE',
        [request.challengeId],
      )
    ).rows[0];
    if (
      !challenge ||
      challenge.signing_key !== member.signing_key ||
      !verifyLoginChallenge(challenge, request.signature, encryption, { origin, audience })
    )
      throw new ApiError('AUTH_INVALID', 401);
    const identityScope = [
      request.target.dao.chainId,
      request.target.dao.contract,
      result.identity_id,
    ];
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      JSON.stringify(identityScope),
    ]);
    const binding = (
      await db.query<{ account_id: string }>(
        'SELECT account_id FROM contact_recovery_accounts WHERE chain_id=$1 AND runtime=$2 AND identity_id=$3 FOR UPDATE',
        identityScope,
      )
    ).rows[0];
    const accounts = await db.query<{
      id: string;
      signing_key: string;
      custody: string;
      encryption_key: unknown;
    }>(
      "SELECT id,signing_key,custody,encryption_key FROM accounts WHERE (signing_key=ANY($1::text[]) OR id=$2::uuid) AND merged_into IS NULL AND erasure_state='none' ORDER BY id FOR UPDATE",
      [
        [result.old_signing_key, state.identity.origin_key, member.signing_key],
        binding?.account_id ?? null,
      ],
    );
    const sources = accounts.rows.filter(
      (row) =>
        row.signing_key === result.old_signing_key ||
        row.signing_key === state.identity?.origin_key,
    );
    const original = sources[0],
      linked = binding ? accounts.rows.find((row) => row.id === binding.account_id) : undefined;
    if ((binding && !linked) || sources.some((row) => row.id !== (linked ?? original)?.id))
      throw new ApiError('CONTACT_RECOVERY_IDENTITY_CONFLICT', 409);
    const previous = linked ?? original,
      current = accounts.rows.find((row) => row.signing_key === member.signing_key);
    if (previous && current && previous.id !== current.id)
      throw new ApiError('CONTACT_RECOVERY_IDENTITY_CONFLICT', 409);
    if (
      current &&
      !isDeepStrictEqual(EncryptionPublicKeySchema.parse(current.encryption_key), encryption)
    )
      throw new ApiError('CONTACT_RECOVERY_IDENTITY_CONFLICT', 409);
    if ((previous ?? current)?.custody === 'managed')
      throw new ApiError('ACCOUNT_MODE_MISMATCH', 409);
    let accountId = current?.id ?? previous?.id;
    if (previous && previous.signing_key !== member.signing_key) {
      await db.query('UPDATE accounts SET signing_key=$2,encryption_key=$3 WHERE id=$1', [
        previous.id,
        member.signing_key,
        encryption,
      ]);
      await db.query(
        'UPDATE sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL',
        [previous.id],
      );
      await db.query('UPDATE vault_recovery_methods SET quarantined=true WHERE account_id=$1', [
        previous.id,
      ]);
      for (const table of [
        'vault_recovery_grants',
        'vault_recovery_handoffs',
        'vault_recovery_devices',
        'credentials',
        'passkeys',
        'native_links',
        'evm_links',
      ])
        await db.query(`DELETE FROM ${table} WHERE account_id=$1`, [previous.id]);
      await db.query(
        'INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,$2,$3)',
        [
          previous.id,
          'account.contact-recovered',
          { target: request.target, requestId: request.requestId },
        ],
      );
    }
    if (!accountId) {
      accountId = (
        await db.query<{ id: string }>(
          "INSERT INTO accounts(signing_key,encryption_key,custody) VALUES($1,$2,'user-controlled') ON CONFLICT(signing_key) DO NOTHING RETURNING id",
          [member.signing_key, encryption],
        )
      ).rows[0]?.id;
    }
    if (!accountId) throw new ApiError('AUTH_INVALID', 401);
    await db.query(
      'INSERT INTO contact_recovery_accounts(chain_id,runtime,identity_id,account_id) VALUES($1,$2,$3,$4) ON CONFLICT(chain_id,runtime,identity_id) DO NOTHING',
      [...identityScope, accountId],
    );
    const latest = await read(request.target);
    if (
      latest.identity?.id !== result.identity_id ||
      latest.identity.signing_key !== member.signing_key ||
      latest.member?.signing_key !== member.signing_key ||
      latest.member?.encryption_key !== member.encryption_key ||
      latest.result?.request.request_id !== request.requestId
    )
      throw new ApiError('CONTACT_RECOVERY_CHANGED', 409);
    await db.query('UPDATE challenges SET consumed_at=now() WHERE id=$1', [request.challengeId]);
    return insertAccountSession(db, accountId);
  });
}
