-- Wallet recovery restores a service session, never possession of lost vault keys.
ALTER TABLE accounts ALTER COLUMN signing_key DROP NOT NULL;
ALTER TABLE accounts ALTER COLUMN encryption_key DROP NOT NULL;
ALTER TABLE accounts ADD CONSTRAINT account_key_mode CHECK (
  (signing_key IS NOT NULL AND encryption_key IS NOT NULL) OR
  (signing_key IS NULL AND encryption_key IS NULL AND custody='user-controlled')
);
CREATE TABLE vault_attach_intents (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  session_hash bytea NOT NULL REFERENCES sessions(token_hash),
  signing_key text NOT NULL,
  encryption_key jsonb NOT NULL,
  message text NOT NULL CHECK (octet_length(message)<=2048),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX vault_attach_expiry ON vault_attach_intents(expires_at);

-- Defer until commit so account creation and its first proved wallet link are atomic.
CREATE FUNCTION require_wallet_control() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  target uuid := (item->>CASE WHEN TG_TABLE_NAME='accounts' THEN 'id' ELSE 'account_id' END)::uuid;
BEGIN
  PERFORM id FROM accounts WHERE id=target FOR NO KEY UPDATE;
  IF EXISTS(SELECT 1 FROM accounts WHERE id=target AND signing_key IS NULL)
     AND NOT EXISTS(SELECT 1 FROM native_links WHERE account_id=target)
     AND NOT EXISTS(SELECT 1 FROM evm_links WHERE account_id=target AND control_verified_at IS NOT NULL)
  THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='wallet_account_control_required',
      MESSAGE='Wallet account requires a blockchain control credential';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER wallet_account_control AFTER INSERT OR UPDATE ON accounts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_wallet_control();
CREATE CONSTRAINT TRIGGER wallet_native_control AFTER INSERT OR UPDATE OR DELETE ON native_links
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_wallet_control();
CREATE CONSTRAINT TRIGGER wallet_evm_control AFTER INSERT OR UPDATE OR DELETE ON evm_links
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_wallet_control();
