-- pg_restore deliberately clears search_path. Keep guards effective under restores and stale background writes.
CREATE OR REPLACE FUNCTION public.require_active_record_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid := (to_jsonb(NEW)->>COALESCE(TG_ARGV[0],'account_id'))::uuid;
BEGIN
 IF target IS NOT NULL THEN
  PERFORM id FROM public.accounts WHERE id=target FOR SHARE;
  IF EXISTS(SELECT 1 FROM public.accounts WHERE id=target AND (merged_into IS NOT NULL OR erasure_state<>'none')) THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='retired_account_credential',MESSAGE='Operational record owner unavailable';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
-- Existing core/custody guard functions use these operator-owned namespaces; put temporary objects last.
DO $$
DECLARE item record;
BEGIN
 FOR item IN SELECT p.oid::regprocedure AS identity FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','custody') AND p.prokind='f'
 AND p.proname IN ('keep_hosting_snapshot','keep_hosting_base','guard_removal_domain','freeze_archive_hold','freeze_asset_archive_hold','keep_checkout_return','freeze_asset_request','freeze_storage_approval','freeze_storage_invoice_domain','require_wallet_control','validate_account_reconnect','require_active_credential_owner','account_owns','account_scope','require_stable_app_member','keep_dao_payment_snapshot','protect_gateway_allowance','protect_ram_card_order','retain_recovery_cleanup_pointer','require_active_record_owner','refuse_retired_hosted_commitment','audit_credential_change','revoke_vault_recovery_method')
 LOOP
  EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, custody, pg_temp',item.identity);
 END LOOP;
END;
$$;
