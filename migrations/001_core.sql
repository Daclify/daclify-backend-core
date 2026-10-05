CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signing_key text NOT NULL UNIQUE,
  custody text NOT NULL CHECK (custody IN ('user-controlled','managed')),
  encryption_key jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE credentials (
  provider_key text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credentials_account ON credentials(account_id);
CREATE TABLE challenges (
  id uuid PRIMARY KEY,
  signing_key text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_expiry ON challenges(expires_at);
CREATE TABLE sessions (
  token_hash bytea PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  csrf_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  step_up_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE TABLE provider_replays (provider text NOT NULL,proof_hash bytea NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(provider,proof_hash));
CREATE TABLE memberships (
  account_id uuid NOT NULL REFERENCES accounts(id),
  chain_id text NOT NULL CHECK (chain_id ~ '^[0-9a-f]{64}$'),
  contract text NOT NULL,
  dao_id numeric(20,0) NOT NULL CHECK (dao_id>0 AND dao_id<=18446744073709551615),
  member_id numeric(20,0) NOT NULL CHECK (member_id>0 AND member_id<=18446744073709551615),
  PRIMARY KEY(account_id,chain_id,contract,dao_id),
  UNIQUE(chain_id,contract,dao_id,member_id)
);
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL,
  kind text NOT NULL,
  job_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','completed','failed')),
  due_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  lease_owner uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_due ON jobs(due_at) WHERE state IN ('pending','running');
CREATE TABLE entitlements (
  dao_key text PRIMARY KEY,
  tier text NOT NULL CHECK(tier IN ('free','operations')),
  expires_at timestamptz,
  storage_limit bigint NOT NULL CHECK(storage_limit>=0),
  relay_limit integer NOT NULL CHECK(relay_limit>=0)
);
CREATE TABLE billing_events (provider text NOT NULL,event_id text NOT NULL,payload_hash bytea NOT NULL,processed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(provider,event_id));
CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  dao_key text NOT NULL,
  expected_size bigint NOT NULL CHECK(expected_size>0 AND expected_size<=100000000),
  privacy text NOT NULL CHECK(privacy IN ('public','encrypted')),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','uploaded','verified','published','failed')),
  provider_id text UNIQUE,
  cid text,
  commitment text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uploads_dao ON uploads(dao_key,state);
CREATE TABLE audit_events (id bigserial PRIMARY KEY,account_id uuid REFERENCES accounts(id),kind text NOT NULL,public_reference jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE SCHEMA custody;
CREATE TABLE custody.managed_keys (account_id uuid PRIMARY KEY REFERENCES accounts(id),signer_name text NOT NULL UNIQUE,signing_public_key text NOT NULL,wrapped_encryption_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON SCHEMA custody FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA custody FROM PUBLIC;
