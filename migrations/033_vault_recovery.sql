-- Additive: original identities, keys, memberships and legacy vaults are untouched.
CREATE TABLE vault_recovery_state (
  account_id uuid PRIMARY KEY REFERENCES accounts(id),
  assisted_ever boolean NOT NULL DEFAULT false
);
CREATE TABLE vault_recovery_methods (
  account_id uuid NOT NULL REFERENCES accounts(id),
  credential_key text NOT NULL CHECK(octet_length(credential_key) BETWEEN 3 AND 8192),
  backup_id uuid NOT NULL UNIQUE,
  mode text NOT NULL CHECK(mode IN ('wallet-protected','passkey-protected','daclify-assisted')),
  origin text NOT NULL CHECK(octet_length(origin) <= 2048),
  record jsonb NOT NULL CHECK(octet_length(record::text) <= 32768),
  receipt jsonb NOT NULL CHECK(octet_length(receipt::text) <= 4096),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,credential_key)
);
CREATE TABLE vault_recovery_grants (
  token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32),
  session_hash bytea NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  credential_key text NOT NULL,
  backup_id uuid NOT NULL,
  origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  FOREIGN KEY(account_id,credential_key) REFERENCES vault_recovery_methods(account_id,credential_key) ON DELETE CASCADE
);
CREATE INDEX vault_recovery_grant_expiry ON vault_recovery_grants(expires_at);
CREATE TABLE vault_recovery_handoffs (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  session_hash bytea NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  origin text NOT NULL,
  private_wrap text NOT NULL CHECK(octet_length(private_wrap) <= 8192),
  recipient jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX vault_recovery_handoff_expiry ON vault_recovery_handoffs(expires_at);

-- Removing and re-pairing the same credential never resurrects its old permission.
CREATE FUNCTION revoke_vault_recovery_method() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  method_key text;
BEGIN
  IF TG_TABLE_NAME='credentials' THEN
    IF TG_OP='UPDATE' AND OLD.provider_key=NEW.provider_key AND OLD.account_id=NEW.account_id THEN RETURN NULL; END IF;
    method_key := OLD.provider_key;
  ELSIF TG_TABLE_NAME='passkeys' THEN
    IF TG_OP='UPDATE' AND OLD.credential_id=NEW.credential_id AND OLD.account_id=NEW.account_id AND OLD.public_key=NEW.public_key THEN RETURN NULL; END IF;
    method_key := 'passkey:' || regexp_replace(translate(encode(OLD.credential_id,'base64'),'+/','-_'),'[=\n\r]','','g');
  ELSIF TG_TABLE_NAME='native_links' THEN
    IF TG_OP='UPDATE' AND OLD.chain_id=NEW.chain_id AND OLD.native_account=NEW.native_account AND OLD.account_id=NEW.account_id AND OLD.permission=NEW.permission THEN RETURN NULL; END IF;
    method_key := 'native:' || OLD.chain_id || ':' || OLD.native_account;
  ELSE
    IF TG_OP='UPDATE' AND OLD.chain_id=NEW.chain_id AND OLD.address=NEW.address AND OLD.account_id=NEW.account_id THEN RETURN NULL; END IF;
    method_key := 'evm:' || OLD.chain_id || ':' || OLD.address;
  END IF;
  DELETE FROM vault_recovery_methods WHERE account_id=OLD.account_id AND credential_key=method_key;
  RETURN NULL;
END;
$$;
CREATE TRIGGER recovery_credential_revoke AFTER DELETE OR UPDATE ON credentials FOR EACH ROW EXECUTE FUNCTION revoke_vault_recovery_method();
CREATE TRIGGER recovery_passkey_revoke AFTER DELETE OR UPDATE ON passkeys FOR EACH ROW EXECUTE FUNCTION revoke_vault_recovery_method();
CREATE TRIGGER recovery_native_revoke AFTER DELETE OR UPDATE ON native_links FOR EACH ROW EXECUTE FUNCTION revoke_vault_recovery_method();
CREATE TRIGGER recovery_evm_revoke AFTER DELETE OR UPDATE ON evm_links FOR EACH ROW EXECUTE FUNCTION revoke_vault_recovery_method();
