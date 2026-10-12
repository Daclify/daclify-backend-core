-- Retain original owners in signed payment/upload/archive evidence.
ALTER TABLE accounts ADD COLUMN merged_into uuid REFERENCES accounts(id);
ALTER TABLE accounts ADD CONSTRAINT account_reconnect_mode CHECK (
  merged_into IS NULL OR (merged_into<>id AND signing_key IS NULL AND encryption_key IS NULL)
);
CREATE INDEX accounts_reconnected_owner ON accounts(merged_into) WHERE merged_into IS NOT NULL;

CREATE FUNCTION validate_account_reconnect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.merged_into IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='retired_account_immutable',MESSAGE='Retired account is immutable';
  END IF;
  IF (NEW.signing_key IS NULL OR NEW.merged_into IS NOT NULL) AND EXISTS (SELECT 1 FROM accounts WHERE merged_into=NEW.id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_reconnect_canonical',MESSAGE='Historical owners require a registered canonical account';
  END IF;
  IF NEW.merged_into IS NOT NULL THEN
    PERFORM id FROM accounts WHERE id=NEW.merged_into FOR SHARE;
  END IF;
  IF NEW.merged_into IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounts WHERE id=NEW.merged_into AND merged_into IS NULL AND signing_key IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='account_reconnect_target',MESSAGE='Reconnect target must be a registered account';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_reconnect_target BEFORE INSERT OR UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION validate_account_reconnect();

CREATE OR REPLACE FUNCTION require_wallet_control() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  target uuid := (item->>CASE WHEN TG_TABLE_NAME='accounts' THEN 'id' ELSE 'account_id' END)::uuid;
BEGIN
  PERFORM id FROM accounts WHERE id=target FOR NO KEY UPDATE;
  IF EXISTS(SELECT 1 FROM accounts WHERE id=target AND signing_key IS NULL AND merged_into IS NULL)
     AND NOT EXISTS(SELECT 1 FROM native_links WHERE account_id=target)
     AND NOT EXISTS(SELECT 1 FROM evm_links WHERE account_id=target AND control_verified_at IS NOT NULL)
  THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='wallet_account_control_required',MESSAGE='Wallet account requires a blockchain control credential';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION require_active_credential_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM accounts WHERE id=NEW.account_id FOR SHARE;
  IF EXISTS(SELECT 1 FROM accounts WHERE id=NEW.account_id AND merged_into IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='retired_account_credential',MESSAGE='Credential owner is retired';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER credential_active_owner BEFORE INSERT OR UPDATE ON credentials FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();
CREATE TRIGGER passkey_active_owner BEFORE INSERT OR UPDATE ON passkeys FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();
CREATE TRIGGER native_active_owner BEFORE INSERT OR UPDATE ON native_links FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();
CREATE TRIGGER evm_active_owner BEFORE INSERT OR UPDATE ON evm_links FOR EACH ROW EXECUTE FUNCTION require_active_credential_owner();

CREATE FUNCTION account_owns(actor uuid, historical_owner uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM accounts a JOIN accounts h ON coalesce(h.merged_into,h.id)=a.id
    WHERE a.id=actor AND a.merged_into IS NULL AND h.id=historical_owner);
$$;
CREATE FUNCTION account_scope(actor uuid) RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT h.id FROM accounts a JOIN accounts h ON h.id=a.id OR h.merged_into=a.id
    WHERE a.id=actor AND a.merged_into IS NULL;
$$;
