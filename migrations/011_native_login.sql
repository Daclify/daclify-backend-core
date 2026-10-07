CREATE TABLE native_links (
  account_id uuid NOT NULL REFERENCES accounts(id), chain_id text NOT NULL CHECK(chain_id ~ '^[0-9a-f]{64}$'),
  native_account text NOT NULL, permission text NOT NULL CHECK(permission='active'),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,chain_id), UNIQUE(chain_id,native_account)
);
CREATE TABLE native_login_intents (
  id uuid PRIMARY KEY, purpose text NOT NULL CHECK(purpose IN ('login','pair')),
  account_id uuid REFERENCES accounts(id), session_hash bytea REFERENCES sessions(token_hash),
  browser_hash bytea NOT NULL CHECK(octet_length(browser_hash)=32), chain_id text NOT NULL,
  native_account text NOT NULL, permission text NOT NULL CHECK(permission='active'),
  runtime text NOT NULL, message text NOT NULL CHECK(octet_length(message)<=2048),
  expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose='login' AND account_id IS NULL AND session_hash IS NULL) OR (purpose='pair' AND account_id IS NOT NULL AND session_hash IS NOT NULL))
);
CREATE INDEX native_intent_expiry ON native_login_intents(expires_at);
