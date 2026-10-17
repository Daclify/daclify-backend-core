import type { Pool } from 'pg';
import { z } from 'zod';
import {
  QuickAccountAnchorSchema,
  QuickAccountDomainSchema,
} from '../../../../protocol/quick-accounts.js';
import { quickAccountIdentity } from '../../../../sdk/quick-accounts.js';
import { uniqueViolation, withTransaction } from '../auth/account-session.js';
import { ApiError } from '../errors.js';
type RecoveryResolver = (
  key: string,
) => Promise<import('../../../../protocol/contact-recovery.js').ContactRecoveryState['identity']>;

const BindingSchema = z.object({
  anchor: QuickAccountAnchorSchema,
  identity: z.instanceof(Uint8Array).refine((value) => value.length === 32),
});

async function resolveQuickAccount(
  pool: Pool,
  accountId: string,
  reference: unknown,
  evmChainId: 40 | 41,
  freeze: boolean,
  check?: (
    binding: { anchor: z.infer<typeof QuickAccountAnchorSchema>; identity: string },
    db: import('pg').PoolClient,
  ) => Promise<void>,
  recovery?: RecoveryResolver,
) {
  const domain = QuickAccountDomainSchema.parse(reference),
    id = z.uuid().parse(accountId);
  try {
    return await withTransaction(pool, async (db) => {
      const owner = await db.query<{ signing_key: string | null }>(
        "SELECT signing_key FROM accounts WHERE id=$1 AND merged_into IS NULL AND erasure_state='none' FOR UPDATE",
        [id],
      );
      if (!owner.rows[0]) throw new ApiError('AUTH_REQUIRED', 401);
      const signingKey = owner.rows[0].signing_key;
      const root = signingKey ? await recovery?.(signingKey) : null;
      if (root && root.signing_key !== signingKey) throw new ApiError('ACCOUNT_KEY_RETIRED', 401);
      async function approval(anchor: z.infer<typeof QuickAccountAnchorSchema>) {
        if (anchor.kind !== 'key' || anchor.publicKey === signingKey) return {};
        const identity = await recovery?.(anchor.publicKey);
        if (!signingKey || identity?.signing_key !== signingKey)
          throw new ApiError('QUICK_ACCOUNT_CHANGED', 409);
        return { approvalKey: signingKey };
      }
      const current = await db.query<Record<string, unknown>>(
        'SELECT anchor,identity FROM quick_account_anchors WHERE account_id=$1 AND chain_id=$2 AND runtime=$3',
        [id, domain.chainId, domain.runtime],
      );
      if (current.rows[0]) {
        const binding = BindingSchema.parse(current.rows[0]);
        const identity = quickAccountIdentity(domain.chainId, domain.runtime, binding.anchor);
        if (Buffer.from(binding.identity).toString('hex') !== identity)
          throw new ApiError('QUICK_ACCOUNT_IDENTITY', 503);
        return {
          anchor: binding.anchor,
          identity,
          frozen: true,
          ...(await approval(binding.anchor)),
        };
      }
      let anchor: z.infer<typeof QuickAccountAnchorSchema>;
      if (owner.rows[0].signing_key)
        anchor = QuickAccountAnchorSchema.parse({
          kind: 'key',
          publicKey: root?.origin_key ?? owner.rows[0].signing_key,
        });
      else {
        const native = await db.query<{ native_account: string; permission: string }>(
          'SELECT native_account,permission FROM native_links WHERE account_id=$1 AND chain_id=$2',
          [id, domain.chainId],
        );
        if (native.rows[0])
          anchor = QuickAccountAnchorSchema.parse({
            kind: 'native',
            account: native.rows[0].native_account,
            permission: native.rows[0].permission,
          });
        else {
          const evm = await db.query<{ address: string }>(
            'SELECT address FROM evm_links WHERE account_id=$1 AND chain_id=$2 AND control_verified_at IS NOT NULL',
            [id, evmChainId],
          );
          if (!evm.rows[0]) throw new ApiError('QUICK_ANCHOR_REQUIRED', 409);
          anchor = QuickAccountAnchorSchema.parse({
            kind: 'evm',
            chainId: evmChainId,
            address: evm.rows[0].address,
          });
        }
      }
      const identity = quickAccountIdentity(domain.chainId, domain.runtime, anchor);
      const authority = await approval(anchor);
      if (!freeze) return { anchor, identity, frozen: false, ...authority };
      await check?.({ anchor, identity }, db);
      await db.query(
        'INSERT INTO quick_account_anchors(account_id,chain_id,runtime,anchor,identity) VALUES($1,$2,$3,$4,$5)',
        [id, domain.chainId, domain.runtime, anchor, Buffer.from(identity, 'hex')],
      );
      return { anchor, identity, frozen: true, ...authority };
    });
  } catch (error) {
    if (uniqueViolation(error)) throw new ApiError('QUICK_ACCOUNT_CONFLICT', 409);
    throw error;
  }
}

export function quickAccountCandidate(
  pool: Pool,
  accountId: string,
  reference: unknown,
  evmChainId: 40 | 41,
  recovery?: RecoveryResolver,
) {
  return resolveQuickAccount(pool, accountId, reference, evmChainId, false, undefined, recovery);
}
export function freezeQuickAccount(
  pool: Pool,
  accountId: string,
  reference: unknown,
  evmChainId: 40 | 41,
  check?: Parameters<typeof resolveQuickAccount>[5],
  recovery?: RecoveryResolver,
) {
  return resolveQuickAccount(pool, accountId, reference, evmChainId, true, check, recovery).then(
    ({ frozen: _frozen, ...binding }) => binding,
  );
}

// Check under the account deletion lock, before sessions or the immutable projection are erased.
export async function requireQuickDeactivation(
  db: Pool | import('pg').PoolClient,
  accountIds: string[],
  chain: Pick<import('./service.js').QuickGateway, 'configuration' | 'account'> | undefined,
) {
  const rows = z
    .array(
      z.object({ chain_id: z.string(), runtime: z.string(), identity: z.instanceof(Uint8Array) }),
    )
    .max(256)
    .parse(
      (
        await db.query(
          'SELECT chain_id,runtime,identity FROM quick_account_anchors WHERE account_id=ANY($1::uuid[]) LIMIT 257',
          [accountIds],
        )
      ).rows,
    );
  if (!rows.length) return;
  if (!chain) throw new ApiError('QUICK_UNAVAILABLE', 503);
  const config = await chain.configuration();
  for (const row of rows) {
    if (row.chain_id !== config.chainId || row.runtime !== config.runtime)
      throw new ApiError('QUICK_UNAVAILABLE', 503);
    const identity = Buffer.from(row.identity).toString('hex'),
      record = await chain.account(identity);
    if (record?.active) throw new ApiError('QUICK_DEACTIVATION_REQUIRED', 409);
    if (
      (
        await db.query(
          "SELECT 1 FROM quick_account_preparations WHERE account_id=ANY($1::uuid[]) AND expires_at>now() AND prepared->>'action'='qregister' AND prepared#>>'{context,identity}'=$2 AND prepared#>>'{request,epoch}'=$3 LIMIT 1",
          [accountIds, identity, record?.epoch ?? '0'],
        )
      ).rowCount
    )
      throw new ApiError('QUICK_REGISTRATION_PENDING', 409);
  }
}
