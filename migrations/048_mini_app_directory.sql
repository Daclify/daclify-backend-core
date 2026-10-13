-- Discovery is independent of native app registration/permission. Finite public text and private proofs.
CREATE TABLE mini_app_listings (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts(id), origin text NOT NULL UNIQUE CHECK(octet_length(origin)<=2048),
 listing jsonb NOT NULL CHECK(octet_length(listing::text)<=8192), status text NOT NULL DEFAULT 'unverified' CHECK(status IN('unverified','published','hidden')),
 verified_at timestamptz, moderated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
 CHECK(expires_at<=updated_at+interval '90 days')
);
CREATE INDEX mini_app_listings_owner ON mini_app_listings(account_id);
CREATE INDEX mini_app_listings_public ON mini_app_listings(status,id);
CREATE INDEX mini_app_listings_expiry ON mini_app_listings(expires_at);
CREATE TABLE mini_app_directory_proofs (
 listing_id uuid PRIMARY KEY REFERENCES mini_app_listings(id), account_id uuid NOT NULL REFERENCES accounts(id),
 challenge_hash bytea NOT NULL CHECK(octet_length(challenge_hash)=32), origin text NOT NULL CHECK(octet_length(origin)<=2048),
 expires_at timestamptz NOT NULL CHECK(expires_at<=clock_timestamp()+interval '10 minutes')
);
CREATE INDEX mini_app_directory_proofs_owner ON mini_app_directory_proofs(account_id);
CREATE INDEX mini_app_directory_proofs_expiry ON mini_app_directory_proofs(expires_at);
CREATE TABLE mini_app_directory_transfers (
 listing_id uuid PRIMARY KEY REFERENCES mini_app_listings(id), account_id uuid NOT NULL REFERENCES accounts(id),
 expires_at timestamptz NOT NULL CHECK(expires_at<=clock_timestamp()+interval '10 minutes')
);
CREATE INDEX mini_app_directory_transfers_owner ON mini_app_directory_transfers(account_id);
CREATE INDEX mini_app_directory_transfers_expiry ON mini_app_directory_transfers(expires_at);
CREATE TABLE mini_app_directory_reports (
 listing_id uuid NOT NULL REFERENCES mini_app_listings(id), account_id uuid NOT NULL REFERENCES accounts(id),
 reason text NOT NULL CHECK(octet_length(reason)<=500), created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
 PRIMARY KEY(listing_id,account_id), CHECK(expires_at<=created_at+interval '30 days')
);
CREATE INDEX mini_app_directory_reports_owner ON mini_app_directory_reports(account_id);
CREATE INDEX mini_app_directory_reports_expiry ON mini_app_directory_reports(expires_at);
CREATE TRIGGER listing_active_owner BEFORE INSERT OR UPDATE ON mini_app_listings FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
CREATE TRIGGER listing_proof_active_owner BEFORE INSERT OR UPDATE ON mini_app_directory_proofs FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
CREATE TRIGGER listing_transfer_active_owner BEFORE INSERT OR UPDATE ON mini_app_directory_transfers FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
CREATE TRIGGER listing_report_active_owner BEFORE INSERT OR UPDATE ON mini_app_directory_reports FOR EACH ROW EXECUTE FUNCTION require_active_record_owner('account_id');
