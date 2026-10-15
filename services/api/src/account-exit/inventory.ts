import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
const personal = [
  'public.connected_app_invitations:account_id',
  'public.quick_account_preparations:account_id',
  'public.quick_account_anchors:account_id',
  'public.mini_app_directory_reports:account_id',
  'public.mini_app_directory_proofs:account_id',
  'public.mini_app_directory_transfers:account_id',
  'public.mini_app_listings:account_id',
  'public.mcp_oauth_tokens:account_id',
  'public.mcp_oauth_families:account_id',
  'public.mcp_oauth_requests:account_id',
  'public.mcp_preparations:account_id',
  'public.mcp_pairings:account_id',
  'public.mcp_local_grants:account_id',
  'custody.managed_keys:account_id',
  'public.account_control_intents:account_id',
  'public.connected_app_codes:account_id',
  'public.connected_app_refresh_families:account_id',
  'public.connected_app_subjects:account_id',
  'public.connected_app_tokens:account_id',
  'public.credentials:account_id',
  'public.dao_payment_oauth:account_id',
  'public.evm_challenges:account_id',
  'public.evm_links:account_id',
  'public.evm_signin_intents:account_id',
  'public.memberships:account_id',
  'public.native_links:account_id',
  'public.native_login_intents:account_id',
  'public.passkeys:account_id',
  'public.profile_key_revisions:owner_account_id',
  'public.quick_signup_attempts:staged_account_id',
  'public.quick_signup_pending_accounts:account_id',
  'public.sessions:account_id',
  'public.signin_challenges:account_id',
  'public.telegram_oidc_attempts:account_id',
  'public.vault_attach_intents:account_id',
  'public.vault_recovery_devices:account_id',
  'public.vault_recovery_handoffs:account_id',
  'public.vault_recovery_methods:account_id',
  'public.vault_recovery_state:account_id',
];
const shared = [
  'public.dao_claim_links:issuer_account_id',
  'public.dao_claim_links:claimant_account_id',
  'public.accounts:merged_into',
  'public.archive_exports:requested_by',
  'public.archive_storage_holds:requested_by',
  'public.asset_uploads:account_id',
  'public.audit_events:account_id',
  'public.creation_orders:account_id',
  'public.dao_merchants:broker_admin',
  'public.dao_payment_orders:customer_account',
  'public.hosting_subscriptions:created_by',
  'public.module_fee_orders:account_id',
  'public.operator_payment_requests:account_id',
  'public.ram_card_orders:account_id',
  'public.service_payments:account_id',
  'public.storage_approvals:approved_by',
  'public.storage_curation:updated_by',
  'public.storage_subscriptions:created_by',
  'public.uploads:account_id',
  'public.recovery_object_cleanup:account_id',
  'public.account_exit_operations:account_id',
  'public.account_exit_scope:account_id',
];
export const ErasureInventory = [
  ...personal.map((reference) => {
    const [table, column] = reference.split(':');
    if (!table || !column) throw Error('ERASURE_INVENTORY');
    return {
      table,
      column,
      disposition: 'erase' as const,
      purpose: 'Revoke account authentication and remove disposable personal identity projections',
      expiry:
        table === 'public.profile_key_revisions'
          ? 'Journal exclusion through the last controlled backup horizon'
          : 'Immediately upon authenticated account erasure; bounded worker removes remaining rows',
    };
  }),
  ...shared.map((reference) => {
    const [table, column] = reference.split(':');
    if (!table || !column) throw Error('ERASURE_INVENTORY');
    return {
      table,
      column,
      disposition: 'retain' as const,
      purpose:
        'Preserve shared DAO evidence, unresolved financial rights or the minimal historical foreign-key anchor',
      expiry:
        table.startsWith('public.account_exit_') || table === 'public.mini_app_cleanup_notices'
          ? 'Status-only operation and frozen scope expire after 30 days'
          : 'Until settlement and applicable documented operator/legal retention expire; public release requires policy qualification',
    };
  }),
];
// Classes reached indirectly through credentials, subscriptions, orders or finite exit operations.
export const IndirectErasureInventory = [
  ...[
    'public.connected_app_refresh_tokens',
    'public.vault_recovery_grants',
    'public.challenges',
    'public.signin_challenges',
    'public.jobs',
    'public.audit_events',
  ].map((table) => ({
    table,
    disposition: 'erase' as const,
    purpose:
      'Remove personal proof material and disposable account/profile work in dependency order',
    expiry: 'During bounded account cleanup; unowned challenges use their existing short expiry',
  })),
  ...[
    'public.accounts',
    'public.archive_backups',
    'public.archive_chunks',
    'public.dao_payment_products',
    'public.dao_payment_refunds',
    'public.hosted_references',
    'public.hosting_changes',
    'public.hosting_invoices',
    'public.storage_changes',
    'public.storage_invoices',
    'public.account_exit_steps',
    'public.account_exit_app_subjects',
    'public.account_exit_memberships',
    'public.mini_app_cleanup_notices',
  ].map((table) => ({
    table,
    disposition: 'retain' as const,
    purpose:
      'Preserve shared DAO objects, financial reconciliation or finite status/cleanup evidence',
    expiry:
      table.startsWith('public.account_exit_') || table === 'public.mini_app_cleanup_notices'
        ? '30 days after the exit operation begins'
        : 'Shared object lifetime or settlement and the documented operator retention period',
  })),
];
export async function assertErasureInventory(db: Pool | PoolClient) {
  const result = await db.query(
    `SELECT n.nspname||'.'||c.relname AS table,a.attname AS column FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=ANY(f.conkey) WHERE f.contype='f' AND f.confrelid='public.accounts'::regclass`,
  );
  const rows = z.array(z.object({ table: z.string(), column: z.string() })).parse(result.rows);
  const descendants = await db.query(
    `WITH RECURSIVE owned AS(SELECT 'public.accounts'::regclass::oid AS oid UNION SELECT f.conrelid FROM pg_constraint f JOIN owned o ON f.confrelid=o.oid WHERE f.contype='f') SELECT n.nspname||'.'||c.relname AS table FROM owned JOIN pg_class c ON c.oid=owned.oid JOIN pg_namespace n ON n.oid=c.relnamespace`,
  );
  const tables = new Set(
    [...ErasureInventory, ...IndirectErasureInventory].map((item) => item.table),
  );
  if (
    z
      .array(z.object({ table: z.string() }))
      .parse(descendants.rows)
      .some((row) => !tables.has(row.table))
  )
    throw Error('ERASURE_INVENTORY_INCOMPLETE');
  const known = new Set(ErasureInventory.map((item) => item.table + ':' + item.column));
  if (rows.some((row) => !known.has(row.table + ':' + row.column)))
    throw Error('ERASURE_INVENTORY_INCOMPLETE');
}
