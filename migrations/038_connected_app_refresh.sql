CREATE TABLE connected_app_refresh_families (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid NOT NULL REFERENCES connected_apps(id),account_id uuid NOT NULL REFERENCES accounts(id),
 revision numeric(20,0) NOT NULL,session_id numeric(20,0),session_expires bigint,nonce text NOT NULL CHECK(length(nonce)<=256),
 expires_at timestamptz NOT NULL,revoked_at timestamptz
);
CREATE INDEX connected_app_refresh_families_expiry ON connected_app_refresh_families(expires_at);
CREATE TABLE connected_app_refresh_tokens (
 token_hash bytea PRIMARY KEY,family_id uuid NOT NULL REFERENCES connected_app_refresh_families(id) ON DELETE CASCADE,
 consumed_at timestamptz
);
CREATE INDEX connected_app_refresh_tokens_family ON connected_app_refresh_tokens(family_id);
ALTER TABLE connected_app_tokens ADD COLUMN refresh_family_id uuid REFERENCES connected_app_refresh_families(id) ON DELETE CASCADE;
