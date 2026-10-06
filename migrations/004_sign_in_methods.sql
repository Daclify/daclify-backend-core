CREATE TABLE passkeys (
  credential_id bytea PRIMARY KEY CHECK (octet_length(credential_id) BETWEEN 1 AND 1023),
  account_id uuid NOT NULL REFERENCES accounts(id),
  public_key bytea NOT NULL CHECK (octet_length(public_key) BETWEEN 64 AND 512),
  sign_count bigint NOT NULL CHECK (sign_count >= 0 AND sign_count <= 4294967295),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX passkeys_account ON passkeys(account_id);
CREATE TABLE signin_challenges (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('passkey-register','passkey-login','email-link','email-login')),
  account_id uuid REFERENCES accounts(id),
  subject text CHECK (subject IS NULL OR char_length(subject) BETWEEN 1 AND 254),
  secret_hash bytea NOT NULL CHECK (octet_length(secret_hash) = 32),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signin_challenges_open ON signin_challenges(purpose, secret_hash) WHERE consumed_at IS NULL;
