-- Separate MCP resource namespace; only opaque token hashes and bounded public consent context.
CREATE TABLE mcp_oauth_requests (
 id uuid PRIMARY KEY, account_id uuid REFERENCES accounts(id),
 request jsonb NOT NULL CHECK(octet_length(request::text)<=4096),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '5 minutes')
);
CREATE INDEX mcp_oauth_requests_expiry ON mcp_oauth_requests(expires_at);
CREATE TABLE mcp_oauth_families (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id),
 context jsonb NOT NULL CHECK(octet_length(context::text)<=8192),
 local_grant_id uuid REFERENCES mcp_local_grants(id),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days')
);
CREATE INDEX mcp_oauth_families_owner ON mcp_oauth_families(account_id);
CREATE INDEX mcp_oauth_families_expiry ON mcp_oauth_families(expires_at);
CREATE TABLE mcp_oauth_tokens (
 token_hash bytea PRIMARY KEY CHECK(octet_length(token_hash)=32),
 account_id uuid NOT NULL REFERENCES accounts(id),
 family_id uuid NOT NULL REFERENCES mcp_oauth_families(id),
 kind text NOT NULL CHECK(kind IN('code','access','refresh')),
 context jsonb NOT NULL CHECK(octet_length(context::text)<=8192),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days'),
 CHECK(kind='refresh' OR expires_at<=created_at+interval '5 minutes')
);
CREATE INDEX mcp_oauth_tokens_family ON mcp_oauth_tokens(family_id);
CREATE INDEX mcp_oauth_tokens_expiry ON mcp_oauth_tokens(expires_at);
CREATE TRIGGER mcp_oauth_requests_active_owner BEFORE INSERT OR UPDATE ON mcp_oauth_requests FOR EACH ROW EXECUTE FUNCTION require_active_record_owner();
CREATE TRIGGER mcp_oauth_families_active_owner BEFORE INSERT OR UPDATE ON mcp_oauth_families FOR EACH ROW EXECUTE FUNCTION require_active_record_owner();
CREATE TRIGGER mcp_oauth_tokens_active_owner BEFORE INSERT OR UPDATE ON mcp_oauth_tokens FOR EACH ROW EXECUTE FUNCTION require_active_record_owner();
