CREATE TABLE account_control_intents (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  session_hash bytea NOT NULL REFERENCES sessions(token_hash),
  path text NOT NULL,
  body_hash text NOT NULL CHECK (body_hash ~ '^[0-9a-f]{64}$'),
  message text NOT NULL CHECK (octet_length(message) <= 2048),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_control_account ON account_control_intents(account_id,created_at);
ALTER TABLE sessions ADD COLUMN credential_key text;
CREATE INDEX sessions_credential ON sessions(account_id,credential_key) WHERE revoked_at IS NULL;
-- Existing provider sessions have no trustworthy credential provenance. Require fresh login.
UPDATE sessions SET revoked_at=now() WHERE revoked_at IS NULL;
