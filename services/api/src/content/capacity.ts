import type { PoolClient } from 'pg';
import type { DaoRef } from '../../../../protocol/base.js';
import { Uint64Schema } from '../../../../protocol/base.js';
import { DEFAULT_STORAGE_PRICING } from '../../../../protocol/storage.js';
import { storageFunding } from '../billing/storage-state.js';
import { contentDaoKey } from './ledger.js';
export async function fundedStorage(
  client: PoolClient,
  dao: DaoRef,
  providerScope: string,
  freeBytes: bigint,
) {
  const entitlement = await client.query<{ storage_limit: string }>(
    "SELECT storage_limit::text FROM entitlements WHERE dao_key=$1 AND (tier='free' OR expires_at IS NULL OR expires_at>now())",
    [contentDaoKey(dao)],
  );
  const legacy = entitlement.rows[0]
    ? Uint64Schema.parse(entitlement.rows[0].storage_limit)
    : freeBytes.toString();
  return storageFunding(
    client,
    dao,
    providerScope,
    { ...DEFAULT_STORAGE_PRICING, freeBytes: legacy },
    new Date(),
  );
}
