-- Additive lifecycle; stable IDs remain only where historical FKs still require them.
ALTER TABLE accounts ADD COLUMN erasure_state text NOT NULL DEFAULT 'none' CHECK(erasure_state IN ('none','pending','erased'));
ALTER TABLE accounts ADD COLUMN erased_at timestamptz;
ALTER TABLE accounts ADD CONSTRAINT account_erasure_fields CHECK (
 (erasure_state='erased' AND erased_at IS NOT NULL AND signing_key IS NULL AND encryption_key IS NULL AND wallet_origin IS NULL)
 OR (erasure_state<>'erased' AND erased_at IS NULL)
);
CREATE OR REPLACE FUNCTION validate_account_reconnect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.erasure_state='erased' AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='erased_account_immutable',MESSAGE='Erased identity is immutable';
  END IF;
  IF OLD.erasure_state='pending' AND NEW.erasure_state NOT IN ('pending','erased') THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_erasure_monotonic',MESSAGE='Erasure cannot be undone';
  END IF;
  IF OLD.erasure_state='none' AND NEW.erasure_state='erased' THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_erasure_monotonic',MESSAGE='Pending erasure required';
  END IF;
  IF OLD.merged_into IS NOT NULL AND
    (to_jsonb(NEW)-ARRAY['erasure_state','erased_at','wallet_origin']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['erasure_state','erased_at','wallet_origin']) THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='retired_account_immutable',MESSAGE='Retired account is immutable';
  END IF;
 END IF;
 IF NEW.erasure_state='none' AND (NEW.signing_key IS NULL OR NEW.merged_into IS NOT NULL)
  AND EXISTS(SELECT 1 FROM accounts WHERE merged_into=NEW.id) THEN
  RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_reconnect_canonical',MESSAGE='Historical owners require canonical keys';
 END IF;
 IF NEW.merged_into IS NOT NULL THEN
  PERFORM id FROM accounts WHERE id=NEW.merged_into FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.merged_into AND merged_into IS NULL
    AND (signing_key IS NOT NULL OR erasure_state IN ('pending','erased'))) THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_reconnect_target',MESSAGE='Reconnect target invalid';
  END IF;
  IF (TG_OP='INSERT' OR OLD.merged_into IS NULL) AND EXISTS(SELECT 1 FROM accounts WHERE id=NEW.merged_into AND erasure_state<>'none') THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_reconnect_target',MESSAGE='Reconnect target unavailable';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION require_wallet_control() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 item jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 target uuid := (item->>CASE WHEN TG_TABLE_NAME='accounts' THEN 'id' ELSE 'account_id' END)::uuid;
BEGIN
 PERFORM id FROM accounts WHERE id=target FOR NO KEY UPDATE;
 IF EXISTS(SELECT 1 FROM accounts WHERE id=target AND erasure_state='none' AND signing_key IS NULL AND merged_into IS NULL)
  AND NOT EXISTS(SELECT 1 FROM native_links WHERE account_id=target)
  AND NOT EXISTS(SELECT 1 FROM evm_links WHERE account_id=target AND control_verified_at IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='wallet_account_control_required',MESSAGE='Wallet account requires control';
 END IF;
 RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION require_active_credential_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM accounts WHERE id=NEW.account_id FOR SHARE;
 IF EXISTS(SELECT 1 FROM accounts WHERE id=NEW.account_id AND (merged_into IS NOT NULL OR erasure_state<>'none')) THEN
  RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='retired_account_credential',MESSAGE='Credential owner unavailable';
 END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION account_owns(actor uuid,historical_owner uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM accounts a JOIN accounts h ON coalesce(h.merged_into,h.id)=a.id
 WHERE a.id=actor AND a.merged_into IS NULL AND a.erasure_state='none' AND h.id=historical_owner AND h.erasure_state='none');
$$;
CREATE OR REPLACE FUNCTION account_scope(actor uuid) RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
 SELECT h.id FROM accounts a JOIN accounts h ON h.id=a.id OR h.merged_into=a.id
 WHERE a.id=actor AND a.merged_into IS NULL AND a.erasure_state='none' AND h.erasure_state='none';
$$;
-- One active operation per owner/mode. Capability is random and hashed; no signing key is retained.
CREATE TABLE account_exit_operations (
 id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id),
 mode text NOT NULL CHECK(mode IN ('leave-all','delete-account')),
 intent jsonb NOT NULL CHECK(octet_length(intent::text)<=65536),
 state text NOT NULL DEFAULT 'processing' CHECK(state IN ('processing','complete','expired')),
 components jsonb NOT NULL CHECK(octet_length(components::text)<=65536),
 status_hash bytea NOT NULL UNIQUE CHECK(octet_length(status_hash)=32),
 expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX account_exit_active ON account_exit_operations(account_id,mode) WHERE state='processing';
CREATE INDEX account_exit_expiry ON account_exit_operations(expires_at);
CREATE TABLE account_exit_scope (
 operation_id uuid NOT NULL REFERENCES account_exit_operations(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES accounts(id),PRIMARY KEY(operation_id,account_id)
);
CREATE TABLE account_exit_steps (
 operation_id uuid NOT NULL REFERENCES account_exit_operations(id) ON DELETE CASCADE,
 id text NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
 descriptor jsonb NOT NULL CHECK(octet_length(descriptor::text)<=16384),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 instruction jsonb CHECK(octet_length(instruction::text)<=32768),
 transaction_id text CHECK(transaction_id ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('pending','submitted','confirmed','unavailable')),
 PRIMARY KEY(operation_id,id)
);
-- Prevent an old session or raced sign-in from creating new authority after pending starts.
CREATE TRIGGER session_active_owner BEFORE INSERT OR UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();
-- Snapshot client subjects before revoking them; X4 delivers notices from this finite frozen mapping.
CREATE TABLE account_exit_app_subjects (
 operation_id uuid NOT NULL REFERENCES account_exit_operations(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES connected_apps(id),subject uuid NOT NULL,
 PRIMARY KEY(operation_id,client_id,subject)
);
-- Minimal provider pointers survive credential-trigger deletion until controlled pin removal is reconciled.
CREATE TABLE recovery_object_cleanup (
 receipt_hash text PRIMARY KEY CHECK(receipt_hash ~ '^[a-f0-9]{64}$'),
 account_id uuid NOT NULL REFERENCES accounts(id),receipt jsonb NOT NULL CHECK(octet_length(receipt::text)<=2048),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','unavailable')),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days'
);
CREATE INDEX recovery_cleanup_due ON recovery_object_cleanup(expires_at) WHERE state<>'confirmed';
CREATE FUNCTION retain_recovery_cleanup_pointer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO recovery_object_cleanup(receipt_hash,account_id,receipt)
 VALUES(encode(sha256(convert_to(OLD.receipt::text,'UTF8')),'hex'),OLD.account_id,OLD.receipt)
 ON CONFLICT DO NOTHING;
 RETURN OLD;
END;
$$;
CREATE TRIGGER recovery_cleanup_pointer BEFORE DELETE ON vault_recovery_methods FOR EACH ROW EXECUTE FUNCTION retain_recovery_cleanup_pointer();
CREATE FUNCTION require_active_record_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
BEGIN
 IF target IS NOT NULL THEN
  PERFORM id FROM accounts WHERE id=target FOR SHARE;
  IF EXISTS(SELECT 1 FROM accounts WHERE id=target AND (merged_into IS NOT NULL OR erasure_state<>'none')) THEN
   RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='retired_account_credential',MESSAGE='Operational record owner unavailable';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DO $$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('custody','managed_keys','account_id'),('public','account_control_intents','account_id'),
 ('public','connected_app_codes','account_id'),('public','connected_app_refresh_families','account_id'),
 ('public','connected_app_subjects','account_id'),('public','connected_app_tokens','account_id'),
 ('public','dao_payment_oauth','account_id'),('public','evm_challenges','account_id'),
 ('public','evm_signin_intents','account_id'),('public','memberships','account_id'),
 ('public','profile_key_revisions','owner_account_id'),('public','quick_signup_attempts','staged_account_id'),
 ('public','quick_signup_pending_accounts','account_id'),('public','signin_challenges','account_id'),
 ('public','telegram_oidc_attempts','account_id'),('public','native_login_intents','account_id'),
 ('public','vault_attach_intents','account_id'),('public','vault_recovery_devices','account_id'),
 ('public','vault_recovery_handoffs','account_id'),('public','vault_recovery_methods','account_id'),
 ('public','vault_recovery_state','account_id')
 ) AS rules(schema_name,table_name,column_name)
 LOOP
  EXECUTE format('CREATE TRIGGER record_active_owner BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION require_active_record_owner(%L)',item.schema_name,item.table_name,item.column_name);
 END LOOP;
END;
$$;

-- Finite reference inventory survives deletion of the ordinary membership projection.
CREATE TABLE account_exit_memberships (
 operation_id uuid NOT NULL REFERENCES account_exit_operations(id) ON DELETE CASCADE,
 reference jsonb NOT NULL CHECK(octet_length(reference::text)<=4096),
 context text NOT NULL CHECK(length(context)<=256),PRIMARY KEY(operation_id,context)
);
-- One fixed fence per retiring DAO. No account identity/index; lifetime follows permanent native retirement.
CREATE TABLE hosted_closure_fences(chain_id text NOT NULL CHECK(chain_id ~ '^[a-f0-9]{64}$'),runtime text NOT NULL CHECK(length(runtime)<=13),dao_id numeric(20,0) NOT NULL,PRIMARY KEY(chain_id,runtime,dao_id));
CREATE FUNCTION refuse_retired_hosted_commitment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reference jsonb;
BEGIN
 IF TG_TABLE_NAME='hosting_changes' THEN
  IF NEW.extra_slots=0 THEN RETURN NEW;END IF;
  SELECT dao INTO reference FROM hosting_subscriptions WHERE id=NEW.subscription_id;
 ELSIF TG_TABLE_NAME='storage_approvals' THEN
  IF NEW.units=0 THEN RETURN NEW;END IF;
  SELECT dao INTO reference FROM storage_subscriptions WHERE id=NEW.subscription_id;
 ELSIF TG_TABLE_NAME='dao_payment_orders' THEN
  SELECT dao INTO reference FROM dao_merchants WHERE dao_key=NEW.dao_key;
 ELSE reference=NEW.dao;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('daclify.hosted-close:'||(reference->>'chainId')||':'||(reference->>'contract')||':'||(reference->>'daoId'),0));
 IF EXISTS(SELECT 1 FROM hosted_closure_fences WHERE chain_id=reference->>'chainId' AND runtime=reference->>'contract' AND dao_id=(reference->>'daoId')::numeric) THEN
  RAISE EXCEPTION 'HOSTED_DAO_CLOSING' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER closure_fence BEFORE INSERT ON hosting_subscriptions FOR EACH ROW EXECUTE FUNCTION refuse_retired_hosted_commitment();
CREATE TRIGGER closure_fence BEFORE INSERT ON storage_subscriptions FOR EACH ROW EXECUTE FUNCTION refuse_retired_hosted_commitment();
CREATE TRIGGER closure_fence BEFORE INSERT ON hosting_changes FOR EACH ROW EXECUTE FUNCTION refuse_retired_hosted_commitment();
CREATE TRIGGER closure_fence BEFORE INSERT ON storage_approvals FOR EACH ROW EXECUTE FUNCTION refuse_retired_hosted_commitment();
CREATE TRIGGER closure_fence BEFORE INSERT ON dao_payment_orders FOR EACH ROW EXECUTE FUNCTION refuse_retired_hosted_commitment();

-- Preserve the published snapshot guard; only an unsubmitted erasing-owner reservation is disposable.
CREATE OR REPLACE FUNCTION freeze_asset_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.state='reserved' AND OLD.provider_id IS NULL AND OLD.storage_object_id IS NULL
      AND EXISTS(SELECT 1 FROM accounts WHERE id=OLD.account_id AND erasure_state IN('pending','erased')) THEN RETURN OLD;END IF;
    RAISE EXCEPTION 'ASSET_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF ROW(NEW.id,NEW.account_id,NEW.dao_key,NEW.provider_scope,NEW.import_profile,NEW.request_id,NEW.kind,NEW.reference_key,NEW.expected_bytes,NEW.commitment,NEW.request_hash,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.dao_key,OLD.provider_scope,OLD.import_profile,OLD.request_id,OLD.kind,OLD.reference_key,OLD.expected_bytes,OLD.commitment,OLD.request_hash,OLD.created_at) THEN
    RAISE EXCEPTION 'ASSET_REQUEST_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
    OR (OLD.cid IS NOT NULL AND NEW.cid IS DISTINCT FROM OLD.cid)
    OR (OLD.storage_object_id IS NOT NULL AND NEW.storage_object_id IS DISTINCT FROM OLD.storage_object_id)
    OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at) THEN
    RAISE EXCEPTION 'ASSET_VERIFICATION_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
