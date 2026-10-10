ALTER TABLE vault_recovery_methods ADD COLUMN quarantined boolean NOT NULL DEFAULT false;
CREATE TABLE vault_recovery_devices (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  session_hash bytea NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  poll_hash bytea NOT NULL CHECK(octet_length(poll_hash)=32),
  origin text NOT NULL,
  request jsonb NOT NULL CHECK(octet_length(request::text)<=8192),
  payload jsonb CHECK(payload IS NULL OR octet_length(payload::text)<=32768),
  expires_at timestamptz NOT NULL
);
CREATE INDEX vault_recovery_device_expiry ON vault_recovery_devices(expires_at);
