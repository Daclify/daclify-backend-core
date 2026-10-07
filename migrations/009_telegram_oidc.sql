CREATE TABLE telegram_oidc_attempts (
 id uuid PRIMARY KEY, purpose text NOT NULL CHECK (purpose IN ('login','pair')),
 state_hash bytea NOT NULL UNIQUE, browser_hash bytea NOT NULL,
 account_id uuid REFERENCES accounts(id), session_hash bytea REFERENCES sessions(token_hash),
 verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, confirmed_at timestamptz, verified_subject text,
 proof_hash bytea, proof_expires_at timestamptz,
 CHECK ((purpose='login' AND account_id IS NULL AND session_hash IS NULL) OR (purpose='pair' AND account_id IS NOT NULL AND session_hash IS NOT NULL)),
 CHECK ((verified_subject IS NULL AND proof_hash IS NULL AND proof_expires_at IS NULL) OR (verified_subject IS NOT NULL AND proof_hash IS NOT NULL AND proof_expires_at IS NOT NULL))
);
CREATE INDEX telegram_oidc_expiry ON telegram_oidc_attempts(expires_at);
