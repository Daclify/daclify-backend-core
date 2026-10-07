import type { PoolClient } from 'pg';
import type { UserMembership, WalletIdentity } from '../../../../protocol/api.js';
import { ApiError } from '../errors.js';

// Call only after the browser-bound native proof or SIWE signature is verified.
export async function walletAccount(
  client: PoolClient,
  wallet: WalletIdentity,
  discover: ((wallet: WalletIdentity) => Promise<UserMembership[]>) | undefined,
): Promise<string> {
  const key =
    wallet.kind === 'native'
      ? `native:${wallet.chainId}:${wallet.account}`
      : `evm:${wallet.chainId}:${wallet.address.toLowerCase()}`;
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  const value = wallet.kind === 'native' ? wallet.account : wallet.address.toLowerCase();
  const previous = (
    await client.query<{ account_id: string; signing_key: string | null }>(
      wallet.kind === 'native'
        ? "SELECT l.account_id,a.signing_key FROM native_links l JOIN accounts a ON a.id=l.account_id WHERE l.chain_id=$1 AND l.native_account=$2 AND l.permission='active' FOR SHARE OF l,a"
        : 'SELECT l.account_id,a.signing_key FROM evm_links l JOIN accounts a ON a.id=l.account_id WHERE l.chain_id=$1 AND l.address=$2 AND l.control_verified_at IS NOT NULL FOR SHARE OF l,a',
      [wallet.chainId, value],
    )
  ).rows[0];
  if (previous?.signing_key) return previous.account_id;
  if (!discover || !(await discover(wallet)).length) throw new ApiError('PROVIDER_UNKNOWN', 401);
  if (previous) return previous.account_id;
  const row = (
    await client.query<{ id: string }>(
      "INSERT INTO accounts(signing_key,encryption_key,custody) VALUES(NULL,NULL,'user-controlled') RETURNING id",
    )
  ).rows[0];
  if (!row) throw new ApiError('AUTH_REQUIRED', 401);
  await client.query(
    wallet.kind === 'native'
      ? "INSERT INTO native_links(account_id,chain_id,native_account,permission) VALUES($1,$2,$3,'active')"
      : 'INSERT INTO evm_links(account_id,chain_id,address,control_verified_at) VALUES($1,$2,$3,now())',
    [row.id, wallet.chainId, value],
  );
  await client.query(
    'INSERT INTO audit_events(account_id,kind,public_reference) VALUES($1,$2,$3)',
    [
      row.id,
      'account.wallet-recovered',
      { kind: wallet.kind, chainId: wallet.chainId, wallet: value },
    ],
  );
  return row.id;
}
