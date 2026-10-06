import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../errors.js';
import { uniqueViolation, withTransaction } from './account-session.js';
import {
  checksumAddress,
  isTelosEvmChain,
  linkMessage,
  recoverEvmAddress,
  type TelosEvmChainId,
} from './evm-proof.js';

export interface EvmLink {
  chainId: TelosEvmChainId;
  address: string;
}

interface ChallengeRow {
  id: string;
  nonce: string;
}

function present(row: { chain_id: number; address: string }): EvmLink {
  if (!isTelosEvmChain(row.chain_id)) throw new ApiError('EVM_CHAIN_INVALID', 400);
  return { chainId: row.chain_id, address: checksumAddress(row.address) };
}

export async function listEvmLinks(pool: Pool, accountId: string): Promise<EvmLink[]> {
  const result = await pool.query<{ chain_id: number; address: string }>(
    'SELECT chain_id,address FROM evm_links WHERE account_id=$1 ORDER BY chain_id',
    [accountId],
  );
  return result.rows.map(present);
}

export async function beginEvmLink(
  pool: Pool,
  accountId: string,
  chainId: TelosEvmChainId,
): Promise<{ chainId: TelosEvmChainId; message: string; expiresAt: string }> {
  const recent = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM evm_challenges WHERE account_id=$1 AND created_at > now() - interval '10 minutes'",
    [accountId],
  );
  if (Number(recent.rows[0]?.count ?? '0') >= 8) throw new ApiError('RATE_LIMIT', 429);
  const nonce = randomBytes(16).toString('base64url');
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query(
    'INSERT INTO evm_challenges(id,account_id,chain_id,nonce,expires_at) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), accountId, chainId, nonce, expires],
  );
  return {
    chainId,
    message: linkMessage(accountId, chainId, nonce),
    expiresAt: expires.toISOString(),
  };
}

async function consumeChallenge(
  client: PoolClient,
  accountId: string,
  chainId: TelosEvmChainId,
): Promise<string> {
  const result = await client.query<ChallengeRow>(
    `SELECT id,nonce FROM evm_challenges
     WHERE account_id=$1 AND chain_id=$2 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    [accountId, chainId],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError('EVM_CHALLENGE_INVALID', 401);
  await client.query('UPDATE evm_challenges SET consumed_at=now() WHERE id=$1', [row.id]);
  return linkMessage(accountId, chainId, row.nonce);
}

export async function finishEvmLink(
  pool: Pool,
  accountId: string,
  chainId: TelosEvmChainId,
  address: string,
  signature: string,
): Promise<EvmLink> {
  const claimed = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(claimed)) throw new ApiError('EVM_SIGNATURE_INVALID', 401);
  try {
    return await withTransaction(pool, async (client) => {
      const message = await consumeChallenge(client, accountId, chainId);
      let recovered: string;
      try {
        recovered = recoverEvmAddress(message, signature);
      } catch {
        throw new ApiError('EVM_SIGNATURE_INVALID', 401);
      }
      if (recovered !== claimed) throw new ApiError('EVM_SIGNATURE_INVALID', 401);
      const taken = await client.query<{ account_id: string }>(
        'SELECT account_id FROM evm_links WHERE chain_id=$1 AND address=$2',
        [chainId, recovered],
      );
      const owner = taken.rows[0]?.account_id;
      if (owner && owner !== accountId) throw new ApiError('EVM_LINKED', 409);
      await client.query(
        `INSERT INTO evm_links(account_id,chain_id,address) VALUES($1,$2,$3)
         ON CONFLICT (account_id, chain_id) DO UPDATE SET address=EXCLUDED.address, created_at=now()`,
        [accountId, chainId, recovered],
      );
      return { chainId, address: checksumAddress(recovered) };
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ApiError('EVM_LINKED', 409);
    throw error;
  }
}

export async function unlinkEvm(
  pool: Pool,
  accountId: string,
  chainId: TelosEvmChainId,
): Promise<void> {
  const result = await pool.query('DELETE FROM evm_links WHERE account_id=$1 AND chain_id=$2', [
    accountId,
    chainId,
  ]);
  if (result.rowCount !== 1) throw new ApiError('EVM_UNKNOWN', 404);
}
