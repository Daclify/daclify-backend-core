import type { Pool, PoolClient } from 'pg';
import type { Account } from '../../../../protocol/api.js';
import { ApiError } from '../errors.js';
import { revokeCredentialSessions } from './intent.js';
import type { verifyGoogle, ProviderPrincipal } from '../providers/proofs.js';
import type { TelegramOidcConfiguration } from './telegram-oidc.js';
import { insertAccountSession, uniqueViolation, withTransaction } from './account-session.js';
export interface ProviderConfiguration {
  google?: { clientId: string; key: Parameters<typeof verifyGoogle>[3] };
  telegram?: { botToken?: string; botUsername?: string; oidc?: TelegramOidcConfiguration };
}
export function providerCredentialKey(
  principal: Pick<ProviderPrincipal, 'provider' | 'subject'>,
): string {
  if (!/^[\x21-\x7e]{1,255}$/.test(principal.subject)) throw new ApiError('PROVIDER_INVALID', 401);
  return `${principal.provider}:${principal.subject}`;
}
async function consume(client: PoolClient, principal: ProviderPrincipal): Promise<void> {
  try {
    await client.query(
      'INSERT INTO provider_replays(provider,proof_hash,expires_at) VALUES($1,$2,$3)',
      [principal.provider, Buffer.from(principal.proofHash), principal.expires],
    );
  } catch (error) {
    if (uniqueViolation(error)) throw new ApiError('PROVIDER_REPLAY', 401);
    throw error;
  }
}
async function remember(pool: Pool, principal: ProviderPrincipal): Promise<void> {
  await withTransaction(pool, (client) => consume(client, principal));
}
export async function linkProvider(
  pool: Pool,
  accountId: string,
  principal: ProviderPrincipal,
): Promise<{ provider: ProviderPrincipal['provider']; subject: string }> {
  const providerKey = providerCredentialKey(principal);
  await remember(pool, principal);
  return withTransaction(pool, async (client) => {
    const inserted = await client.query<{ account_id: string }>(
      'INSERT INTO credentials(provider_key,account_id) VALUES($1,$2) ON CONFLICT(provider_key) DO NOTHING RETURNING account_id',
      [providerKey, accountId],
    );
    const owner =
      inserted.rows[0]?.account_id ??
      (
        await client.query<{ account_id: string }>(
          'SELECT account_id FROM credentials WHERE provider_key=$1',
          [providerKey],
        )
      ).rows[0]?.account_id;
    if (owner !== accountId) throw new ApiError('CREDENTIAL_LINKED', 409);
    return { provider: principal.provider, subject: principal.subject };
  });
}
export async function unlinkProvider(
  pool: Pool,
  accountId: string,
  provider: ProviderPrincipal['provider'],
  subject: string,
): Promise<void> {
  await withTransaction(pool, async (client) => {
    const deleted = await client.query(
      'DELETE FROM credentials WHERE provider_key=$1 AND account_id=$2',
      [providerCredentialKey({ provider, subject }), accountId],
    );
    if (deleted.rowCount !== 1) throw new ApiError('CREDENTIAL_UNKNOWN', 404);
    await revokeCredentialSessions(client, accountId, providerCredentialKey({ provider, subject }));
  });
}
export async function openLinkedSession(
  pool: Pool,
  principal: ProviderPrincipal,
): Promise<{ account: Account; token: string; csrfToken: string }> {
  const providerKey = providerCredentialKey(principal);
  await remember(pool, principal);
  return withTransaction(pool, async (client) => {
    const row = (
      await client.query<{ account_id: string }>(
        'SELECT account_id FROM credentials WHERE provider_key=$1 FOR SHARE',
        [providerKey],
      )
    ).rows[0];
    if (!row) throw new ApiError('PROVIDER_UNKNOWN', 401);
    return insertAccountSession(client, row.account_id, providerKey);
  });
}
