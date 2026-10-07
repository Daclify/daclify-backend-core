ALTER TABLE evm_links ADD COLUMN control_verified_at timestamptz;
CREATE TABLE evm_signin_intents (
  id uuid PRIMARY KEY,purpose text NOT NULL CHECK(purpose IN ('login','pair')),
  account_id uuid REFERENCES accounts(id),session_hash bytea REFERENCES sessions(token_hash),
  browser_hash bytea NOT NULL CHECK(octet_length(browser_hash)=32),chain_id bigint NOT NULL CHECK(chain_id IN(40,41)),
  address text NOT NULL CHECK(address ~ '^0x[0-9a-f]{40}$'),message text NOT NULL CHECK(octet_length(message)<=2048),
  expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((purpose='login' AND account_id IS NULL AND session_hash IS NULL) OR (purpose='pair' AND account_id IS NOT NULL AND session_hash IS NOT NULL))
);
CREATE INDEX evm_signin_expiry ON evm_signin_intents(expires_at);
