-- Five-minute public-key/PKCE requests; grants never contain private signing material.
CREATE TABLE mcp_pairings (
 id uuid PRIMARY KEY, account_id uuid REFERENCES accounts(id),
 request jsonb NOT NULL CHECK(octet_length(request::text)<=4096),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 approved_grant uuid, consumed_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '5 minutes')
);
CREATE INDEX mcp_pairings_expiry ON mcp_pairings(expires_at);
CREATE TABLE mcp_local_grants (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 token_hash bytea NOT NULL UNIQUE CHECK(octet_length(token_hash)=32),
 context jsonb NOT NULL CHECK(octet_length(context::text)<=4096),
 credential_epoch numeric(20,0) NOT NULL CHECK(credential_epoch BETWEEN 1 AND 18446744073709551615),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days')
);
CREATE INDEX mcp_grants_owner ON mcp_local_grants(account_id);
CREATE INDEX mcp_grants_expiry ON mcp_local_grants(expires_at);
ALTER TABLE mcp_pairings ADD FOREIGN KEY(approved_grant) REFERENCES mcp_local_grants(id) ON DELETE CASCADE;
CREATE TABLE mcp_preparations (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 grant_id uuid NOT NULL REFERENCES mcp_local_grants(id) ON DELETE CASCADE,
 prepared jsonb NOT NULL CHECK(octet_length(prepared::text)<=16384),
 packet jsonb CHECK(octet_length(packet::text)<=65536),
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN('prepared','submitting','confirmed','unavailable')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mcp_preparations_grant ON mcp_preparations(grant_id,expires_at);
CREATE INDEX mcp_preparations_expiry ON mcp_preparations(expires_at);
CREATE UNIQUE INDEX mcp_one_pending_submission ON mcp_preparations(grant_id) WHERE state='submitting';
CREATE TRIGGER record_active_owner BEFORE INSERT OR UPDATE ON mcp_pairings FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
CREATE TRIGGER record_active_owner BEFORE INSERT OR UPDATE ON mcp_local_grants FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
CREATE TRIGGER record_active_owner BEFORE INSERT OR UPDATE ON mcp_preparations FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
