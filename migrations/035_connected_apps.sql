CREATE TABLE connected_apps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 chain_id text NOT NULL CHECK(chain_id ~ '^[0-9a-f]{64}$'), runtime text NOT NULL,
 dao_id numeric(20,0) NOT NULL CHECK(dao_id>0 AND dao_id<=18446744073709551615),
 app_id numeric(20,0) NOT NULL CHECK(app_id>0 AND app_id<=18446744073709551615),
 UNIQUE(chain_id,runtime,dao_id,app_id)
);
-- Retain previous revisions so an abandoned staged edit cannot disable a live
-- registration. Native hash and revision select the authoritative configuration.
CREATE TABLE connected_app_configs (
 client_id uuid NOT NULL REFERENCES connected_apps(id),revision numeric(20,0) NOT NULL CHECK(revision>0 AND revision<=18446744073709551615),
 config jsonb NOT NULL,config_hash text NOT NULL CHECK(config_hash ~ '^[0-9a-f]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(client_id,revision,config_hash)
);
CREATE TABLE connected_app_subjects (
 client_id uuid NOT NULL REFERENCES connected_apps(id),account_id uuid NOT NULL REFERENCES accounts(id),subject uuid NOT NULL DEFAULT gen_random_uuid(),
 PRIMARY KEY(client_id,account_id),UNIQUE(client_id,subject)
);
CREATE TABLE connected_app_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid NOT NULL REFERENCES connected_apps(id),revision numeric(20,0) NOT NULL,
 request jsonb NOT NULL,grant_expires bigint,expires_at timestamptz NOT NULL,consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX connected_app_requests_expiry ON connected_app_requests(expires_at);
CREATE TABLE connected_app_codes (
 code_hash bytea PRIMARY KEY,client_id uuid NOT NULL REFERENCES connected_apps(id),account_id uuid NOT NULL REFERENCES accounts(id),
 request jsonb NOT NULL,revision numeric(20,0) NOT NULL,session_id numeric(20,0),session_expires bigint,
 expires_at timestamptz NOT NULL,consumed_at timestamptz
);
CREATE INDEX connected_app_codes_expiry ON connected_app_codes(expires_at);
CREATE TABLE connected_app_tokens (
 token_hash bytea PRIMARY KEY,client_id uuid NOT NULL REFERENCES connected_apps(id),account_id uuid NOT NULL REFERENCES accounts(id),
 revision numeric(20,0) NOT NULL,session_id numeric(20,0),session_expires bigint,expires_at timestamptz NOT NULL,revoked_at timestamptz
);
CREATE INDEX connected_app_tokens_expiry ON connected_app_tokens(expires_at);
