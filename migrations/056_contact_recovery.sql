-- A chain identity survives signing-key changes and partial membership recoveries.
CREATE TABLE contact_recovery_accounts (
  chain_id text NOT NULL CHECK (chain_id ~ '^[0-9a-f]{64}$'),
  runtime text NOT NULL CHECK (runtime ~ '^[a-z1-5.]{1,12}$'),
  identity_id numeric(20,0) NOT NULL CHECK (identity_id > 0 AND identity_id <= 18446744073709551615),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (chain_id,runtime,identity_id)
);
CREATE INDEX contact_recovery_accounts_owner ON contact_recovery_accounts(account_id);
